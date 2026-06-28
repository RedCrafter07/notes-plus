use std::fs::create_dir_all;

use common::io::index::run_index;
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
pub fn create_index(app: tauri::AppHandle) -> Vec<common::io::index::File> {
    let path = app
        .path()
        .app_data_dir()
        .expect("Application storage could not be found")
        .join("notebooks");

    if path.exists() && !path.is_dir() {
        panic!("The noteboook storage is a file.")
    }

    if !path.exists() {
        create_dir_all(&path).expect("Could not create directory!");
    }

    let index = run_index(&path).expect("Could not create index!");

    index
}
