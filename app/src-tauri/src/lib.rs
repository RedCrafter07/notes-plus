// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/

mod commands;
mod events;
mod structs;
pub mod util;

use serde_json::json;
use tauri_plugin_store::StoreExt;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    #[cfg(target_os = "linux")]
    {
        if std::env::var("WAYLAND_DISPLAY").is_ok() {
            // SAFETY: this program is single-threaded up to this point
            unsafe {
                std::env::set_var("WEBKIT_DISABLE_DMABUF_RENDERER", "1");
            }
        }
    }

    let builder = util::get_builder();
    #[cfg(debug_assertions)] // <- Only export on non-release builds
    {
        util::export_bindings();
    }

    let mut tauri_builder = tauri::Builder::default();

    #[cfg(desktop)]
    {
        tauri_builder =
            tauri_builder.plugin(tauri_plugin_single_instance::init(|app, args, cwd| {
                use std::path::PathBuf;

                use crate::util::handle_args;
                use tauri::Manager;

                handle_args(app, Some(args), Some(PathBuf::from(cwd)));

                let _ = app
                    .get_webview_window("main")
                    .expect("no main window")
                    .set_focus();
            }));
    }

    tauri_builder = tauri_builder
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(builder.invoke_handler())
        .setup(move |app| {
            // This is also required if you want to use events
            builder.mount_events(app);

            let store = app.store("data.json")?;
            // init jot notes in store
            if !store.has("jotNotes") {
                store.set("jotNotes", json!([]));
                store.save()?;
            }
            store.close_resource();

            Ok(())
        });

    tauri_builder
        .run(tauri::generate_context!())
        .expect("error while running RedNotes Plus");
}
