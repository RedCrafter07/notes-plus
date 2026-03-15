use crate::events::JotDown;
use serde_json::json;
use tauri_plugin_store::StoreExt;
use tauri_specta::Event;

#[tauri::command]
#[specta::specta]
pub fn add_note(app: tauri::AppHandle, content: String) {
    let store = app.store("data.json").unwrap();
    let mut jot_notes: Vec<String> =
        serde_json::from_value(store.get("jotNotes").unwrap()).unwrap_or_else(|_| Vec::new());

    jot_notes.push(content);
    store.set("jotNotes", json!(jot_notes));
    store.save().unwrap();
    store.close_resource();

    JotDown(jot_notes).emit(&app).unwrap();
}

#[tauri::command]
#[specta::specta]
pub fn remove_note(app: tauri::AppHandle, index: u8) -> bool {
    let store = app.store("data.json").unwrap();
    let mut jot_notes: Vec<String> =
        serde_json::from_value(store.get("jotNotes").unwrap()).unwrap_or_else(|_| Vec::new());

    if (index as usize) < jot_notes.len() {
        jot_notes.remove(index as usize);
        store.set("jotNotes", json!(jot_notes));
        store.save().unwrap();
        store.close_resource();
        JotDown(jot_notes).emit(&app).unwrap();
        return true;
    }

    store.close_resource();

    false
}

#[tauri::command]
#[specta::specta]
pub fn edit_note(app: tauri::AppHandle, index: u8, content: String) -> bool {
    let store = app.store("data.json").unwrap();
    let mut jot_notes: Vec<String> =
        serde_json::from_value(store.get("jotNotes").unwrap()).unwrap_or_else(|_| Vec::new());

    if (index as usize) < jot_notes.len() {
        jot_notes[index as usize] = content;
        store.set("jotNotes", json!(jot_notes));
        store.save().unwrap();
        store.close_resource();
        JotDown(jot_notes).emit(&app).unwrap();
        return true;
    }

    store.close_resource();

    false
}

#[tauri::command]
#[specta::specta]
pub fn list_notes(app: tauri::AppHandle) -> Vec<String> {
    let store = app.store("data.json").unwrap();
    let jot_notes: Vec<String> =
        serde_json::from_value(store.get("jotNotes").unwrap()).unwrap_or_else(|_| Vec::new());
    store.close_resource();
    jot_notes
}
