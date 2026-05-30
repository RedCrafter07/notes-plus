// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/

mod commands;
mod events;
mod structs;
mod util;

use commands::*;
use serde_json::json;
use tauri_plugin_store::StoreExt;
use tauri_specta::{Builder, collect_commands, collect_events};

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

    let builder = Builder::<tauri::Wry>::new()
        // Then register them (separated by a comma)
        .commands(collect_commands![
            ready,
            quit,
            get_recent,
            get_defaults,
            add_jot_note,
            remove_jot_note,
            edit_jot_note,
            list_jot_notes,
            open_notes_dialog,
            new_note,
            save_note,
            save_note_dialog,
            get_settings,
            collapse_sidebar,
            use_last_page_settings,
        ])
        .events(collect_events![
            events::JotDown,
            events::Open,
            events::SettingsUpdate
        ])
        .typ::<common::structs::note::NoteData>()
        .typ::<common::structs::defaults::Defaults>()
        .typ::<crate::structs::Settings>();

    #[cfg(debug_assertions)] // <- Only export on non-release builds
    {
        use specta_typescript::Typescript;
        builder
            .export(Typescript::default(), "../src/lib/tauri/bindings.ts")
            .expect("Failed to export typescript bindings");
    }

    let mut tauri_builder = tauri::Builder::default();

    #[cfg(desktop)]
    {
        tauri_builder =
            tauri_builder.plugin(tauri_plugin_single_instance::init(|app, args, _cwd| {
                use crate::util::handle_args;
                use tauri::Manager;

                handle_args(&app, Some(args));

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
