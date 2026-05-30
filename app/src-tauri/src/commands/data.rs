use common::structs::defaults::Defaults;
use common::structs::note::NoteData;

#[tauri::command]
#[specta::specta]
pub fn get_recent() -> Vec<NoteData> {
    vec![]
}

#[tauri::command]
#[specta::specta]
pub fn get_defaults() -> Defaults {
    Defaults::new()
}
