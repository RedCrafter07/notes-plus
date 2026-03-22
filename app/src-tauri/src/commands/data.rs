use common::structs::note::NoteData;

#[tauri::command]
#[specta::specta]
pub fn get_recent() -> Vec<NoteData> {
    vec![]
}
