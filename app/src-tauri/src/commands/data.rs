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
    let path = match app.path().app_data_dir() {
        Ok(p) => p.join("notebooks"),
        Err(e) => {
            eprintln!("Application storage could not be found: {e}");
            return None;
        }
    };

    if path.exists() && !path.is_dir() {
        eprintln!(
            "The path {} is a file, not a folder. The notebooks could not be indexed.",
            path.to_str().unwrap_or("")
        );
        return None;
    }

    if !path.exists()
        && let Err(e) = create_dir_all(&path)
    {
        eprintln!("Could not create notebooks directory: {e}");
        return None;
    }

    match build_index(&path) {
        Ok(index) => Some(EntryType::from_index(index)),
        Err(e) => {
            eprintln!("Could not index notebooks: {e}");
            None
        }
    }
}
