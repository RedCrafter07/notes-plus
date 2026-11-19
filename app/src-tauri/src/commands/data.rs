use std::fs::create_dir_all;

use common::io::index::{File, build_index};
use common::io::organize_index::EntryType;
use common::structs::defaults::Defaults;
use tauri::Manager;

use crate::util::dialog::show_error;
use crate::util::display_error_with_path;

/// The most recently edited notes in app storage, newest first.
#[tauri::command]
#[specta::specta]
pub fn get_recent(app: tauri::AppHandle, limit: u32) -> Vec<File> {
    let Ok(path) = app.path().app_data_dir().map(|p| p.join("notebooks")) else {
        return vec![];
    };
    // Errors are reported by `get_notebooks`; here a missing list is fine.
    let Ok((mut files, _)) = build_index(&path) else {
        return vec![];
    };

    files.sort_by_key(|f| std::cmp::Reverse(f.edited_at));
    files.truncate(limit as usize);
    files
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
        Ok((success, errors)) => {
            errors
                .into_iter()
                .for_each(|(path, error)| display_error_with_path(&path, error.into()));

            Some(EntryType::from_index(success))
        }
        Err(e) => {
            show_error(format!("Could not index notebooks: {e}"));
            None
        }
    }
}
