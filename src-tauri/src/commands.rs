use crate::state::{Proxy, ProxyPool, RotationMode};
use tauri::State;
use crate::engine::ProxyServer;
use uuid::Uuid;

#[tauri::command]
pub fn add_proxy(pool: State<ProxyPool>, host: String, port: u16, user: Option<String>, pass: Option<String>) -> Result<(), String> {
    let p = Proxy {
        id: Uuid::new_v4().to_string(),
        host,
        port,
        user,
        pass,
        latency_ms: None,
        is_alive: false,
    };
    pool.add(p);
    Ok(())
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
        _ => Err(format!("Invalid listen host '{}'. Must be '127.0.0.1' or '0.0.0.0'.", host)),
    }
}

#[tauri::command]
pub fn get_rotation_mode(server: State<ProxyServer>) -> Result<String, String> {
    Ok(server.get_rotation_mode())
}

#[tauri::command]
pub fn set_rotation_mode(server: State<ProxyServer>, mode: String) -> Result<(), String> {
    let parsed = RotationMode::from_str(&mode)
        .ok_or_else(|| format!("Unknown rotation mode: {}", mode))?;
    server.set_rotation_mode(parsed);
    Ok(())
}

#[tauri::command]
pub fn remove_proxy(pool: State<ProxyPool>, id: String) -> Result<(), String> {
    pool.proxies.remove(&id);
    Ok(())
}

#[tauri::command]
pub fn start_vpn() -> Result<(), String> {
    crate::android::start_vpn()
}

#[tauri::command]
pub fn stop_vpn() -> Result<(), String> {
    crate::android::stop_vpn()
}

#[tauri::command]
pub fn get_vpn_status() -> Result<bool, String> {
    crate::android::get_vpn_status()
}
