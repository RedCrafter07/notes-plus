// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/

mod commands;
mod events;

use commands::*;
use serde_json::json;
use tauri_plugin_store::StoreExt;
use tauri_specta::{Builder, collect_commands, collect_events};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = Builder::<tauri::Wry>::new()
        // Then register them (separated by a comma)
        .commands(collect_commands![
            ready,
            quit,
            get_recent,
            add_jot_note,
            remove_jot_note,
            edit_jot_note,
            list_jot_notes,
            open_notes_dialog,
        ])
        .events(collect_events![events::JotDown])
        .typ::<commands::NoteData>()
        .typ::<common::structs::note::Note>();

    #[cfg(debug_assertions)] // <- Only export on non-release builds
    {
        use specta_typescript::Typescript;
        builder
            .export(Typescript::default(), "../src/lib/tauri/bindings.ts")
            .expect("Failed to export typescript bindings");
    }

    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_sql::Builder::new().build())
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
        })
        .run(tauri::generate_context!())
        .expect("error while running RedNotes Plus");
}
