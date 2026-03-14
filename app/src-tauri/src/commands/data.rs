use common::structs::note::Note;

#[tauri::command]
#[specta::specta]
pub fn get_recent() -> Vec<Note> {
    vec![]
}
