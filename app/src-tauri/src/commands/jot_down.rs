use crate::events::JotDown;
use serde_json::json;
use tauri_plugin_store::StoreExt;
use tauri_specta::Event;

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
        eprintln!("Failed to open store while saving jot notes");
        return;
    };
    store.set("jotNotes", json!(notes));
    if let Err(e) = store.save() {
        eprintln!("Failed to save jot notes: {e}");
    };
    store.close_resource();
    if let Err(e) = JotDown(notes.to_vec()).emit(app) {
        eprintln!("Failed to emit jot-down event: {e}");
    }
}

#[tauri::command]
#[specta::specta]
pub fn add_jot_note(app: tauri::AppHandle, content: String) {
    let mut jot_notes = load_jot_notes(&app);
    jot_notes.push(content);
    save_jot_notes(&app, &jot_notes);
}

#[tauri::command]
#[specta::specta]
pub fn remove_jot_note(app: tauri::AppHandle, index: u32) -> bool {
    let mut jot_notes = load_jot_notes(&app);

    if (index as usize) < jot_notes.len() {
        jot_notes.remove(index as usize);
        save_jot_notes(&app, &jot_notes);
        return true;
    }

    false
}

#[tauri::command]
#[specta::specta]
pub fn edit_jot_note(app: tauri::AppHandle, index: u8, content: String) -> bool {
    let mut jot_notes = load_jot_notes(&app);
    if (index as usize) < jot_notes.len() {
        jot_notes[index as usize] = content;
        save_jot_notes(&app, &jot_notes);
        return true;
    }

    false
}

#[tauri::command]
#[specta::specta]
pub fn list_jot_notes(app: tauri::AppHandle) -> Vec<String> {
    load_jot_notes(&app)
}
