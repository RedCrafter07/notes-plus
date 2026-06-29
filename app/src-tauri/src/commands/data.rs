use std::fs::create_dir_all;

use common::io::index::build_index;
use common::io::organize_index::EntryType;
use common::structs::defaults::Defaults;
use common::structs::note::NoteData;
use tauri::Manager;

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

#[tauri::command]
#[specta::specta]
// Indexes the notes in the main notes directory
pub fn get_notebooks(app: tauri::AppHandle) -> Option<EntryType> {
    let path = app
        .path()
        .app_data_dir()
        .expect("Application storage could not be found")
        .join("notebooks");

    if path.exists() && !path.is_dir() {
        eprintln!(
            "The path {} is a file, not a folder. The notebooks could not be indexed.",
            path.to_str().unwrap_or("")
        );
        return None;
    }

    if !path.exists() {
        create_dir_all(&path).expect("Could not create directory!");
    }

    let index = build_index(&path).expect("Could not create index!");

    Some(EntryType::from_index(index))
}
