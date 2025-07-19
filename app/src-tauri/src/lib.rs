// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
use tauri::Manager;

mod commands;

use crate::commands::{load, quit};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![load, quit])
        .setup(|app| {
            if std::env::var("RNP_TESTING").is_ok() {
                let window = app.get_webview_window("main").unwrap();
                window.eval("window.location.replace('/test')").unwrap();
            }

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
