use std::sync::Mutex;

use structs::app_state::AppState;
use tauri::{Emitter, Manager};

mod commands;
mod structs;

use crate::commands::*;

pub type State = Mutex<AppState>;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Plugin config
    let mut builder = tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init());

    // Single instance, only available on desktop
    #[cfg(desktop)]
    {
        builder = builder.plugin(tauri_plugin_single_instance::init(|app, args, _cwd| {
            if args.len() > 1 {
                let _ = app.emit("open-tab", &args[1]);
            }
        }));
    }

    // App specific stuff
    builder = builder
        .manage(Mutex::new(AppState::new()))
        .invoke_handler(tauri::generate_handler![
            get_prefs,
            quit,
            read,
            set_prefs,
            view_window,
            write
        ])
        .setup(|app| {
            #[cfg(debug_assertions)]
            {
                use tauri::Manager;

                if std::env::var("RNP_TESTING").is_ok() {
                    let window = app.get_webview_window("main").unwrap();
                    window.eval("window.location.replace('/test')").unwrap();
                }
            }

            let state = app.state::<State>();
            let state = state.lock().unwrap();

            state.user_prefs.create_dirs();

            Ok(())
        });

    builder
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
