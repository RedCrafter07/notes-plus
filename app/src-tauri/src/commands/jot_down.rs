#[tauri::command]
#[specta::specta]
pub fn add_note(content: String) {}

#[tauri::command]
#[specta::specta]
pub fn remove_note(index: u8) -> bool {
    true
}

#[tauri::command]
#[specta::specta]
pub fn edit_note(index: u8, content: String) -> bool {
    true
}

#[tauri::command]
#[specta::specta]
pub fn list_notes() -> Vec<String> {
    vec![]
}
