pub mod commands;
pub mod crypto;
pub mod engine;
pub mod state;

use crate::engine::{start_health_checker, ProxyServer};
use crate::state::ProxyPool;

const DEFAULT_LISTEN_PORT: u16 = 10808;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let pool = ProxyPool::new();
    let server = ProxyServer::new(pool.clone(), DEFAULT_LISTEN_PORT);

    let pool_clone = pool.clone();

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(move |_app| {
            start_health_checker(pool_clone);
            Ok(())
        })
        .manage(pool)
        .manage(server)
        .invoke_handler(tauri::generate_handler![
            commands::add_proxy,
            commands::get_proxy_list,
            commands::toggle_listener,
            commands::get_listen_port,
            commands::set_listen_port,
            commands::get_listen_host,
            commands::set_listen_host,
            commands::get_rotation_mode,
            commands::set_rotation_mode,
            commands::remove_proxy,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
