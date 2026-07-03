use std::path::{Path, PathBuf};

use common::{io::archive, structs::note::NoteData};
use tauri::Manager;
use tauri_plugin_dialog::DialogExt;

use crate::structs::OpenData;

#[tauri::command]
#[specta::specta]
pub fn snapshot_note() {
    // TODO: Implement snapshot note functionality
}

#[tauri::command]
#[specta::specta]
pub fn open_notes_dialog(app: tauri::AppHandle) -> Vec<OpenData> {
    let notes = app
        .dialog()
        .file()
        .add_filter("RedNotes Plus File", &["rnpf"])
        .set_picker_mode(tauri_plugin_dialog::PickerMode::Document)
        .blocking_pick_files()
        .unwrap_or_default();

    let notes: Vec<PathBuf> = notes
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
        .filter_map(|p| {
            let buf = archive::open_data(p).ok()?;
            let data = NoteData::from_bytes(&buf).ok()?;
            let path_str = p.to_str()?.to_string();

            Some(OpenData {
                path: path_str,
                note_data: data,
            })
        })
        .collect()
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
    let bytes = note_data.to_bytes();
    let Ok(bytes) = bytes else {
        return false;
    };
    let result = archive::create_with_data(&bytes, path);

    result.is_err()
}

#[tauri::command]
#[specta::specta]
pub fn save_note_to_storage(app: tauri::AppHandle, note_data: NoteData) -> Option<String> {
    let path = app
        .path()
        .app_data_dir()
        .expect("Application storage could not be found")
        .join("notebooks");

    if !path.exists() {
        std::fs::create_dir_all(&path).ok()?;
    }

    let file_name = format!("{}.rnpf", &note_data.id);
    let full_path = path.join(file_name);

    let bytes = note_data.to_bytes().ok()?;

    archive::create_with_data(&bytes, &full_path).ok()?;

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

    let path = path.as_path()?;
    let bytes = note_data.to_bytes().ok()?;

    archive::create_with_data(&bytes, path).ok()?;

    Some(path.to_string_lossy().into())
}
