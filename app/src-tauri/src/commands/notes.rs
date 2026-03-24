use std::path::Path;

use common::structs::note::NoteData;
use tauri_plugin_dialog::DialogExt;

#[tauri::command]
#[specta::specta]
pub fn snapshot_note() {
    // TODO: Implement snapshot note functionality
}

#[tauri::command]
#[specta::specta]
pub fn open_notes_dialog(app: tauri::AppHandle) -> Vec<NoteData> {
    let notes = app
        .dialog()
        .file()
        .add_filter("RedNotes Plus File", &["rnpf"])
        .set_picker_mode(tauri_plugin_dialog::PickerMode::Document)
        .blocking_pick_files();

    if let Some(notes) = notes {
        let notes: Vec<NoteData> = notes
            .iter()
            .filter_map(|path| {
                let path = path.as_path().unwrap();
                let note_data = NoteData::from_file(path);

                if let Ok(note_data) = note_data {
                    return Some(note_data);
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
pub fn save_note(note_data: NoteData) -> bool {
    if note_data.path.is_none() {
        return false;
    }

    let result = note_data.to_file(Path::new(&note_data.path.as_ref().unwrap()));

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
        note_data.to_file(path).unwrap();

        return Some(path.to_string_lossy().into());
    }

    None
}
