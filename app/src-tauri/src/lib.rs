use std::sync::OnceLock;

use anyhow::Result;
use parking_lot::RwLock;

use common::structs::user_prefs::UserPrefs;
use tauri::Manager;

mod commands;

use crate::commands::{quit, read, write};

static PREFERENCES: OnceLock<RwLock<UserPrefs>> = OnceLock::new();

pub fn get_prefs() -> &'static RwLock<UserPrefs> {
    PREFERENCES
        .get()
        .expect("UserPrefs RwLock has been accessed before initialization")
}

pub fn set_prefs(prefs: UserPrefs) -> Result<()> {
    let mut old_prefs = PREFERENCES.get().expect("Couldn't read OnceLock").write();
    *old_prefs = prefs;

    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    PREFERENCES
        .set(RwLock::new(UserPrefs::default()))
        .expect("User preferences could not be initialized.");

    PREFERENCES
        .get()
        .unwrap()
        .read()
        .to_file(
            dirs::data_dir()
                .unwrap()
                .join("rednotes-plus/prefs")
                .to_str()
                .unwrap(),
        )
        .unwrap();

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![quit, read, write])
        .setup(|app| {
            #[cfg(debug_assertions)]
            {
                if std::env::var("RNP_TESTING").is_ok() {
                    let window = app.get_webview_window("main").unwrap();
                    window.eval("window.location.replace('/test')").unwrap();
                }
            }

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
