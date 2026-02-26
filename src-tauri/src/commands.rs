use crate::engine::ProxyServer;
use crate::state::{Proxy, ProxyPool, RotationMode};
use tauri::State;
use uuid::Uuid;

#[tauri::command]
pub fn add_proxy(
    pool: State<ProxyPool>,
    protocol: Option<String>,
    host: String,
    port: u16,
    user: Option<String>,
    pass: Option<String>,
) -> Result<String, String> {
    let id = Uuid::new_v4().to_string();
    let p = Proxy {
        id: id.clone(),
        protocol: protocol.unwrap_or_else(|| "socks5".to_string()),
        host,
        port,
        user,
        pass,
        latency_ms: None,
        is_alive: false,
    };
    pool.add(p);
    Ok(id)
}

#[tauri::command]
pub fn get_proxy_list(pool: State<ProxyPool>) -> Result<Vec<Proxy>, String> {
    Ok(pool.get_all())
}

#[tauri::command]
pub fn toggle_listener(server: State<ProxyServer>, active: bool) -> Result<(), String> {
    if active {
        server.start();
    } else {
        server.stop();
    }
    Ok(())
}

#[tauri::command]
pub fn get_listen_port(server: State<ProxyServer>) -> Result<u16, String> {
    Ok(server.get_port())
}

#[tauri::command]
pub fn set_listen_port(server: State<ProxyServer>, port: u16) -> Result<(), String> {
    if port < 1024 {
        return Err("Port must be >= 1024".to_string());
    }
    server.set_port(port);
    Ok(())
}

#[tauri::command]
pub fn get_listen_host(server: State<ProxyServer>) -> Result<String, String> {
    Ok(server.get_host())
}

#[tauri::command]
pub fn set_listen_host(server: State<ProxyServer>, host: String) -> Result<(), String> {
    match host.as_str() {
        "127.0.0.1" | "0.0.0.0" => {
            server.set_host(host);
            Ok(())
        }
        _ => Err(format!(
            "Invalid listen host '{}'. Must be '127.0.0.1' or '0.0.0.0'.",
            host
        )),
    }
}

#[tauri::command]
pub fn get_rotation_mode(server: State<ProxyServer>) -> Result<String, String> {
    Ok(server.get_rotation_mode())
}

#[tauri::command]
pub fn set_rotation_mode(server: State<ProxyServer>, mode: String) -> Result<(), String> {
    let parsed =
        RotationMode::from_str(&mode).ok_or_else(|| format!("Unknown rotation mode: {}", mode))?;
    server.set_rotation_mode(parsed);
    Ok(())
}

#[tauri::command]
pub fn remove_proxy(pool: State<ProxyPool>, id: String) -> Result<(), String> {
    pool.proxies.remove(&id);
    Ok(())
}

#[tauri::command]
pub fn clear_proxies(pool: State<ProxyPool>) -> Result<(), String> {
    pool.proxies.clear();
    Ok(())
}

#[tauri::command]
pub fn clear_dead_proxies(pool: State<ProxyPool>) -> Result<(), String> {
    pool.proxies.retain(|_, p| p.is_alive);
    Ok(())
}

#[tauri::command]
pub fn update_proxy(
    pool: State<ProxyPool>,
    id: String,
    protocol: Option<String>,
    host: String,
    port: u16,
    user: Option<String>,
    pass: Option<String>,
) -> Result<(), String> {
    if let Some(mut p) = pool.proxies.get_mut(&id) {
        p.protocol = protocol.unwrap_or_else(|| "socks5".to_string());
        p.host = host;
        p.port = port;
        p.user = user;
        p.pass = pass;
        p.is_alive = false;
        p.latency_ms = None;
    } else {
        return Err(format!("Proxy with id {} not found", id));
    }
    Ok(())
}

#[tauri::command]
pub async fn refresh_health(pool: State<'_, ProxyPool>) -> Result<(), String> {
    crate::engine::check_all_proxies(&pool).await;
    Ok(())
}

#[tauri::command]
pub async fn refresh_proxy_health(pool: State<'_, ProxyPool>, id: String) -> Result<(), String> {
    crate::engine::check_single_proxy(&pool, &id).await;
    Ok(())
}
