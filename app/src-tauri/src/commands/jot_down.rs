use serde_json::json;
use tauri_plugin_store::StoreExt;

use crate::util::dialog::show_error;

fn load_jot_notes(app: &tauri::AppHandle) -> Vec<String> {
    let Ok(store) = app.store("data.json") else {
        return Vec::new();
    };
    let notes = store
        .get("jotNotes")
        .and_then(|v| serde_json::from_value(v).ok())
        .unwrap_or_default();
    store.close_resource();

    notes
}
fn save_jot_notes(app: &tauri::AppHandle, notes: &[String]) {
    let Ok(store) = app.store("data.json") else {
        show_error("Failed to open store while saving jot notes".into());
        return;
    };
    store.set("jotNotes", json!(notes));
    if let Err(e) = store.save() {
        show_error(format!("Failed to save jot notes: {e}"));
    };
    store.close_resource();
}

#[tauri::command]
#[specta::specta]
pub fn set_jot_notes(app: tauri::AppHandle, content: Vec<String>) {
    save_jot_notes(&app, &content);
}

#[tauri::command]
#[specta::specta]
pub fn list_jot_notes(app: tauri::AppHandle) -> Vec<String> {
    load_jot_notes(&app)
}
