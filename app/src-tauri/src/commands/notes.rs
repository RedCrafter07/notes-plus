use std::path::{Path, PathBuf};

use common::{
    io::archive::{Rnpf, RnpfError},
    structs::data::NoteData,
};
use tauri::Manager;
use tauri_plugin_dialog::DialogExt;

use crate::{
    structs::OpenData,
    util::{
        dialog::{DialogType, show_dialog, show_error},
        display_error, display_error_with_path,
    },
};

#[tauri::command]
#[specta::specta]
pub fn open_notes_dialog(app: tauri::AppHandle) -> Vec<OpenData> {
    let paths = app
        .dialog()
        .file()
        .add_filter("RedNotes Plus File", &["rnpf"])
        .set_picker_mode(tauri_plugin_dialog::PickerMode::Document)
        .blocking_pick_files();

    let paths = match paths {
        Some(p) => p,
        None => {
            show_dialog(DialogType::Warning, "Selection aborted".into());
            return vec![];
        }
    };

    let notes: Vec<PathBuf> = paths
        .iter()
        .filter_map(|f| f.as_path().map(PathBuf::from))
        .collect();

    open_paths(&notes)
}

#[tauri::command]
#[specta::specta]
pub fn open_notes(paths: Vec<String>) -> Vec<OpenData> {
    let path_data: Vec<PathBuf> = paths.into_iter().map(PathBuf::from).collect();

    open_paths(&path_data)
}

fn open_paths(paths: &[PathBuf]) -> Vec<OpenData> {
    paths
        .iter()
        .filter_map(|p| match open_single(p) {
            Ok(data) => Some(data),
            Err(e) => {
                display_error_with_path(&p.display().to_string(), e.into());
                None
            }
        })
        .collect()
}

fn open_single(path: &Path) -> Result<OpenData, RnpfError> {
    let archive = Rnpf::new(path)?;
    let data = archive.build_data()?;
    let path_str = path.to_str().ok_or(RnpfError::InvalidPath)?.to_string();

    Ok(OpenData {
        path: path_str,
        note_data: data,
    })
}

#[tauri::command]
#[specta::specta]
pub fn new_note() -> NoteData {
    NoteData::default()
}

#[tauri::command]
#[specta::specta]
pub fn save_note(note_data: NoteData, path: String) -> bool {
    let path = Path::new(&path);

    match save(path, note_data) {
        Ok(_) => true,
        Err(e) => {
            eprintln!("An error occurred while saving a note: {e}");
            display_error(e.into());
            false
        }
    }
}

fn sanitize_note_id(id: &str) -> Option<&str> {
    if id.is_empty() || id.len() > 128 {
        return None;
    }

    if id
        .chars()
        .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_')
    {
        Some(id)
    } else {
        None
    }
}

#[tauri::command]
#[specta::specta]
pub fn save_note_to_storage(app: tauri::AppHandle, note_data: NoteData) -> Option<String> {
    let path = match app.path().app_data_dir() {
        Ok(p) => p.join("notebooks"),
        Err(e) => {
            show_error(format!("Could not find application storage: {e}"));
            return None;
        }
    };

    if !path.exists()
        && let Err(e) = std::fs::create_dir_all(&path)
    {
        show_error(format!("Could not create notebooks directory: {e}"));
        return None;
    }

    let Some(safe_id) = sanitize_note_id(&note_data.meta.id) else {
        show_error(format!("'{}' is not a valid note ID", note_data.meta.id));
        return None;
    };
    let file_name = format!("{}.rnpf", safe_id);
    let full_path = path.join(file_name);

    if let Err(e) = save(&full_path, note_data) {
        display_error(e.into());
        return None;
    };

    Some(full_path.to_str()?.to_string())
}

#[tauri::command]
#[specta::specta]
pub fn save_note_dialog(app: tauri::AppHandle, note_data: NoteData) -> Option<String> {
    let path = app
        .dialog()
        .file()
        .add_filter("RedNotes Plus File", &["rnpf"])
        .set_picker_mode(tauri_plugin_dialog::PickerMode::Document)
        .blocking_save_file()?;

    let path = match path.as_path() {
        Some(p) => p,
        None => {
            show_dialog(DialogType::Warning, "Selection aborted".into());
            return None;
        }
    };
    if let Err(e) = save(path, note_data) {
        display_error(e.into());
        return None;
    };

    Some(path.to_string_lossy().into())
}

fn save(path: &Path, note_data: NoteData) -> Result<(), RnpfError> {
    Rnpf::create_from_data(path, note_data)
}
