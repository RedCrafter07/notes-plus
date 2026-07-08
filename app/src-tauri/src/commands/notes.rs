use std::path::{Path, PathBuf};

use common::{
    io::archive::{Rnpf, RnpfError},
    structs::data::NoteData,
};
use tauri::Manager;
use tauri_plugin_dialog::DialogExt;

use crate::structs::OpenData;

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
        .filter_map(|p| match open_single(p) {
            Ok(data) => Some(data),
            Err(e) => {
                eprintln!("Failed to open note {}: {e}", p.display());
                None
            }
        })
        .collect()
}

fn open_single(path: &Path) -> anyhow::Result<OpenData> {
    let archive = Rnpf::new(path)?;
    let data = archive.build_data()?;
    let path_str = path
        .to_str()
        .ok_or_else(|| anyhow::anyhow!("path is not valid UTF-8"))?
        .to_string();

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
    let path = app.path().app_data_dir().ok()?.join("notebooks");

    if !path.exists() {
        std::fs::create_dir_all(&path).ok()?;
    }

    let safe_id = sanitize_note_id(&note_data.meta.id)?;
    let file_name = format!("{}.rnpf", safe_id);
    let full_path = path.join(file_name);

    save(&full_path, note_data).ok()?;

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
    save(path, note_data).ok()?;

    Some(path.to_string_lossy().into())
}

fn save(path: &Path, note_data: NoteData) -> Result<(), RnpfError> {
    Rnpf::create_from_data(path, note_data)
}
