use crate::state::{Proxy, ProxyPool, RotationMode};
use std::sync::atomic::{AtomicBool, AtomicU16, AtomicUsize, Ordering};
use std::sync::{Arc, Mutex};
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::{TcpListener, TcpStream};

pub struct ProxyServer {
    pool: ProxyPool,
    is_running: Arc<AtomicBool>,
    pub listen_port: Arc<AtomicU16>,
    pub rotation_mode: Arc<Mutex<RotationMode>>,
    round_robin_idx: Arc<AtomicUsize>,
}

impl ProxyServer {
    pub fn new(pool: ProxyPool, default_port: u16) -> Self {
        Self {
            pool,
            is_running: Arc::new(AtomicBool::new(false)),
            listen_port: Arc::new(AtomicU16::new(default_port)),
            rotation_mode: Arc::new(Mutex::new(RotationMode::RoundRobin)),
            round_robin_idx: Arc::new(AtomicUsize::new(0)),
        }
    }

    pub fn get_port(&self) -> u16 {
        self.listen_port.load(Ordering::SeqCst)
    }

    pub fn set_port(&self, port: u16) {
        self.listen_port.store(port, Ordering::SeqCst);
    }

    pub fn is_running(&self) -> bool {
        self.is_running.load(Ordering::SeqCst)
    }

    pub fn get_rotation_mode(&self) -> String {
        self.rotation_mode
            .lock()
            .unwrap()
            .as_str()
            .to_string()
    }

    pub fn set_rotation_mode(&self, mode: RotationMode) {
        *self.rotation_mode.lock().unwrap() = mode;
    }

    pub fn start(&self) {
        if self.is_running.swap(true, Ordering::SeqCst) {
            return;
        }

        let pool          = self.pool.clone();
        let running       = self.is_running.clone();
        let port          = self.listen_port.load(Ordering::SeqCst);
        let rotation_mode = self.rotation_mode.clone();
        let rr_idx        = self.round_robin_idx.clone();

        tauri::async_runtime::spawn(async move {
            let addr = format!("127.0.0.1:{}", port);
            let listener = match TcpListener::bind(&addr).await {
                Ok(l) => l,
                Err(e) => {
                    eprintln!("Failed to bind {}: {}", addr, e);
                    running.store(false, Ordering::SeqCst);
                    return;
                }
            };

            println!("Local proxy listening on {}", addr);

            while running.load(Ordering::SeqCst) {
                if let Ok(Ok((mut client_stream, _))) = tokio::time::timeout(
                    std::time::Duration::from_secs(1),
                    listener.accept(),
                ).await {
                    let p           = pool.clone();
                    let mode        = rotation_mode.lock().unwrap().clone();
                    let idx         = rr_idx.clone();

                    tauri::async_runtime::spawn(async move {
                        if let Err(e) = handle_client(&mut client_stream, p, mode, idx).await {
                            eprintln!("Client error: {}", e);
                        }
                    });
                }
            }
            println!("Local proxy stopped");
        });
    }

    pub fn stop(&self) {
        self.is_running.store(false, Ordering::SeqCst);
    }
}

// ─── Proxy selection ────────────────────────────────────────────────────────

fn select_proxy<'a>(
    alive: &'a [Proxy],
    mode: &RotationMode,
    rr_idx: &Arc<AtomicUsize>,
    target_host: &str,
) -> Option<&'a Proxy> {
    if alive.is_empty() {
        return None;
    }

    match mode {
        // ── Round Robin ─────────────────────────────────────────────────────
        RotationMode::RoundRobin => {
            let idx = rr_idx.fetch_add(1, Ordering::SeqCst) % alive.len();
            Some(&alive[idx])
        }

        // ── Random ──────────────────────────────────────────────────────────
        RotationMode::Random => {
            let seed = std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .subsec_nanos() as usize;
            Some(&alive[seed % alive.len()])
        }

        // ── Least Latency ───────────────────────────────────────────────────
        RotationMode::LeastLatency => {
            alive.iter().min_by_key(|p| p.latency_ms.unwrap_or(u64::MAX))
        }

        // ── Weighted (inversely proportional to latency) ─────────────────
        RotationMode::Weighted => {
            // Weight = 1 / latency_ms. Use integer arithmetic: weight = MAX_MS - latency.
            // Proxies with no latency measurement get a mid-range weight.
            const MAX_MS: u64 = 10_000;
            const DEFAULT_WEIGHT: u64 = MAX_MS / 2;

            let weights: Vec<u64> = alive.iter().map(|p| {
                MAX_MS.saturating_sub(p.latency_ms.unwrap_or(DEFAULT_WEIGHT).min(MAX_MS - 1)) + 1
            }).collect();

            let total: u64 = weights.iter().sum();
            if total == 0 {
                return Some(&alive[0]);
            }

            // Random pick in [0, total)
            let nanos = std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .subsec_nanos() as u64;
            let mut pick = nanos % total;

            for (i, &w) in weights.iter().enumerate() {
                if pick < w {
                    return Some(&alive[i]);
                }
                pick -= w;
            }
            Some(&alive[alive.len() - 1])
        }

        // ── Time-Based Sticky (10-minute window) ─────────────────────────
        // All connections within the same time window go through the same
        // proxy. After the window expires the next proxy in the list is used.
        RotationMode::Sticky => {
            const WINDOW_SECS: u64 = 600; // 10-minute window
            let slot = std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_secs()
                / WINDOW_SECS;
            Some(&alive[(slot as usize) % alive.len()])
        }
    }
}

// ─── Client handler ─────────────────────────────────────────────────────────

async fn handle_client(
    client: &mut TcpStream,
    pool: ProxyPool,
    mode: RotationMode,
    rr_idx: Arc<AtomicUsize>,
) -> std::io::Result<()> {
    let mut buf = [0u8; 256];
    client.read_exact(&mut buf[0..2]).await?;
    if buf[0] != 0x05 {
        return Err(std::io::Error::new(std::io::ErrorKind::InvalidData, "Not SOCKS5"));
    }
    let n_methods = buf[1] as usize;
    client.read_exact(&mut buf[0..n_methods]).await?;

    // No-auth
    client.write_all(&[0x05, 0x00]).await?;

    // Read CONNECT request
    client.read_exact(&mut buf[0..4]).await?;
    if buf[1] != 0x01 {
        return Err(std::io::Error::new(
            std::io::ErrorKind::InvalidData,
            "Only CONNECT supported",
        ));
    }

    let target_addr: String;
    let target_port: u16;

    match buf[3] {
        0x01 => {
            client.read_exact(&mut buf[0..4]).await?;
            let ip = std::net::Ipv4Addr::new(buf[0], buf[1], buf[2], buf[3]);
            client.read_exact(&mut buf[0..2]).await?;
            target_port = u16::from_be_bytes([buf[0], buf[1]]);
            target_addr = ip.to_string();
        }
        0x03 => {
            client.read_exact(&mut buf[0..1]).await?;
            let len = buf[0] as usize;
            client.read_exact(&mut buf[0..len]).await?;
            target_addr = String::from_utf8_lossy(&buf[0..len]).into_owned();
            client.read_exact(&mut buf[0..2]).await?;
            target_port = u16::from_be_bytes([buf[0], buf[1]]);
        }
        0x04 => {
            client.read_exact(&mut buf[0..16]).await?;
            let mut arr = [0u8; 16];
            arr.copy_from_slice(&buf[0..16]);
            let ip = std::net::Ipv6Addr::from(arr);
            client.read_exact(&mut buf[0..2]).await?;
            target_port = u16::from_be_bytes([buf[0], buf[1]]);
            target_addr = ip.to_string();
        }
        _ => {
            return Err(std::io::Error::new(
                std::io::ErrorKind::InvalidData,
                "Invalid address type",
            ))
        }
    }

    // Select upstream proxy using current rotation strategy
    let proxies = pool.get_all();
    let alive_proxies: Vec<Proxy> = proxies.into_iter().filter(|p| p.is_alive).collect();

    let selected = select_proxy(&alive_proxies, &mode, &rr_idx, &target_addr)
        .ok_or_else(|| std::io::Error::new(std::io::ErrorKind::NotFound, "No alive proxies"))?;

    let proxy_addr = format!("{}:{}", selected.host, selected.port);
    let target     = format!("{}:{}", target_addr, target_port);

    let upstream_stream = if let (Some(u), Some(pass)) = (selected.user.clone(), selected.pass.clone()) {
        tokio_socks::tcp::Socks5Stream::connect_with_password(
            proxy_addr.as_str(),
            target.as_str(),
            &u,
            &pass,
        ).await
    } else {
        tokio_socks::tcp::Socks5Stream::connect(proxy_addr.as_str(), target.as_str()).await
    };

    match upstream_stream {
        Ok(mut st) => {
            client.write_all(&[0x05, 0x00, 0x00, 0x01, 0, 0, 0, 0, 0, 0]).await?;
            tokio::io::copy_bidirectional(client, &mut st).await?;
            Ok(())
        }
        Err(e) => {
            client.write_all(&[0x05, 0x04, 0x00, 0x01, 0, 0, 0, 0, 0, 0]).await?;
            Err(std::io::Error::new(std::io::ErrorKind::ConnectionRefused, e))
        }
    }
}

// ─── Health checker ─────────────────────────────────────────────────────────

pub fn start_health_checker(pool: ProxyPool) {
    tauri::async_runtime::spawn(async move {
        loop {
            let proxies = pool.get_all();
            for mut p in proxies {
                let proxy_addr = format!("{}:{}", p.host, p.port);
                let start = std::time::Instant::now();

                let check = if let (Some(u), Some(pass)) = (p.user.clone(), p.pass.clone()) {
                    tokio_socks::tcp::Socks5Stream::connect_with_password(
                        proxy_addr.as_str(), "1.1.1.1:53", &u, &pass,
                    ).await
                } else {
                    tokio_socks::tcp::Socks5Stream::connect(proxy_addr.as_str(), "1.1.1.1:53").await
                };

                let latency = start.elapsed().as_millis() as u64;
                if check.is_ok() {
                    p.is_alive   = true;
                    p.latency_ms = Some(latency);
                } else {
                    p.is_alive   = false;
                    p.latency_ms = None;
                }
                pool.add(p);
            }
            tokio::time::sleep(tokio::time::Duration::from_secs(30)).await;
        }
    });
}
