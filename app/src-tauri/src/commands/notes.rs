use std::path::Path;

use common::structs::note::NoteData;
use tauri_plugin_dialog::DialogExt;

use crate::events::OpenData;

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
        .blocking_pick_files();

    if let Some(notes) = notes {
        let notes: Vec<OpenData> = notes
            .iter()
            .filter_map(|path| {
                let path = path.as_path().unwrap();
                let buffer = common::io::archive::open_data(path);

                if let Ok(buffer) = buffer {
                    let note_data = NoteData::from_bytes(&buffer);

                    if let Ok(note_data) = note_data {
                        return Some(OpenData {
                            note_data,
                            path: path.to_str().unwrap().to_string(),
                        });
                    } else {
                        return None;
                    }
                } else {
                    return None;
                }
            })
            .collect();

        return notes;
    }

    Vec::new()
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
    let bytes = note_data.to_bytes().unwrap();
    let result = common::io::archive::create_with_data(&bytes, path);

    if result.is_err() {
        return false;
    }

    true
}

#[tauri::command]
#[specta::specta]
pub fn save_note_dialog(app: tauri::AppHandle, note_data: NoteData) -> Option<String> {
    let path = app
        .dialog()
        .file()
        .add_filter("RedNotes Plus File", &["rnpf"])
        .set_picker_mode(tauri_plugin_dialog::PickerMode::Document)
        .blocking_save_file();

    if let Some(path) = path {
        let path = path.as_path().unwrap();
        let bytes = note_data.to_bytes().unwrap();

        common::io::archive::create_with_data(&bytes, path).unwrap();

        return Some(path.to_string_lossy().into());
    }

    None
}
