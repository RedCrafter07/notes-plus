use std::fs::create_dir_all;

use common::io::index::build_index;
use common::io::organize_index::EntryType;
use common::structs::data::NoteData;
use common::structs::defaults::Defaults;
use tauri::Manager;

use crate::util::dialog::show_error;

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
            show_error(format!("Application storage could not be found: {e}"));
            return None;
        }
    };

    if path.exists() && !path.is_dir() {
        show_error(format!(
            "The path {} is a file, not a folder. The notebooks could not be indexed.",
            path.display()
        ));
        return None;
    }

    if !path.exists()
        && let Err(e) = create_dir_all(&path)
    {
        show_error(format!("Could not create notebooks directory: {e}"));
        return None;
    }

    match build_index(&path) {
        Ok(index) => Some(EntryType::from_index(index)),
        Err(e) => {
            show_error(format!("Could not index notebooks: {e}"));
            None
        }
    }
}
