use common::structs::note::Note;
use serde::{Deserialize, Serialize};
use tauri_plugin_dialog::DialogExt;
use uuid::Uuid;

#[tauri::command]
#[specta::specta]
pub fn snapshot_note() {
    // TODO: Implement snapshot note functionality
}

#[derive(specta::Type, Debug, Serialize, Deserialize)]
pub struct NoteData {
    pub content: Note,
    pub path: String,
    pub id: String, // temporary identifier for tab manager
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
                let note = Note::from_file(path);

                if let Ok(note) = note {
                    return Some(NoteData {
                        content: note,
                        path: path.to_string_lossy().into_owned(),
                        id: Uuid::new_v4().to_string(), // identifier for the tab manager
                    });
                } else {
                    return None;
                }
            })
            .collect();

        return notes;
    }

    Vec::new()
}

pub fn save_note(note_data: NoteData) {}

#[tauri::command]
#[specta::specta]
pub fn save_note_dialog(app: tauri::AppHandle, note: Note) -> Option<NoteData> {
    let path = app
        .dialog()
        .file()
        .add_filter("RedNotes Plus File", &["rnpf"])
        .set_picker_mode(tauri_plugin_dialog::PickerMode::Document)
        .blocking_save_file();

    if let Some(path) = path {
        let path = path.as_path().unwrap();
        note.to_file(path).unwrap();

        return Some(NoteData {
            content: note,
            path: path.to_string_lossy().into_owned(),
            id: Uuid::new_v4().to_string(),
        });
    }

    None
}
