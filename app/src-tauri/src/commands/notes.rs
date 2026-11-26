use std::path::{Path, PathBuf};

use common::{
    io::archive::{Rnpf, RnpfError},
    structs::data::NoteData,
};
use tauri::{AppHandle, Manager};
use tauri_plugin_dialog::DialogExt;
use tauri_specta::Event;

use crate::{
    assets::AssetStore,
    events::Open,
    structs::{AppError, OpenData, ResultExt},
    util::{
        app_handle,
        dialog::{DialogType, show_dialog, show_error},
        display_error, display_error_with_path,
    },
};

#[tauri::command]
#[specta::specta]
pub async fn open_notes_dialog(app: tauri::AppHandle) -> Vec<OpenData> {
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
pub async fn open_notes(paths: Vec<String>) -> Vec<OpenData> {
    let path_data: Vec<PathBuf> = paths.into_iter().map(PathBuf::from).collect();

    open_paths(&path_data)
}

/// Opens files dropped on the window or passed on the command line. Called
/// from window events on the main thread, so the reading happens elsewhere.
pub fn open_and_emit(app: &AppHandle, paths: &[PathBuf]) {
    let app = app.clone();
    let paths = paths.to_vec();
    tauri::async_runtime::spawn_blocking(move || {
        for data in open_paths(&paths) {
            Open(data)
                .emit(&app)
                .map_err(AppError::from)
                .unwrap_or_display(());
        }
    });
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

/// Reads a note and opens an attachment session for it. Attachments stay in
/// the file and are served on demand; see `assets.rs`.
pub(crate) fn open_single(path: &Path) -> Result<OpenData, RnpfError> {
    let archive = Rnpf::new(path)?;
    let data = archive.build_data()?;
    let path_str = path.to_str().ok_or(RnpfError::InvalidPath)?.to_string();
    let assets = app_handle::get().state::<AssetStore>().open(path, &archive)?;

    Ok(OpenData {
        path: path_str,
        note_data: data,
        assets,
    })
}

/// Stores a new attachment (an image or a rendered PDF page) for a note.
/// Sent once, when it is added; from then on it is served by URL and saved
/// from the cache. `id` is chosen by the frontend.
#[tauri::command]
#[specta::specta]
pub async fn add_asset(app: tauri::AppHandle, session: String, id: String, data_url: String) -> bool {
    match app.state::<AssetStore>().add(&session, &id, &data_url) {
        Ok(()) => true,
        Err(e) => {
            display_error(e.into());
            false
        }
    }
}

/// Forgets a closed tab's attachments, deleting any unsaved ones.
#[tauri::command]
#[specta::specta]
pub async fn close_asset_session(app: tauri::AppHandle, session: String) {
    app.state::<AssetStore>().close(&session);
}

#[tauri::command]
#[specta::specta]
pub fn new_note() -> NoteData {
    NoteData::default()
}

/// Saves over an existing file. Attachments come from the session (`assets`),
/// not from the frontend.
#[tauri::command]
#[specta::specta]
pub async fn save_note(
    app: tauri::AppHandle,
    assets: String,
    note_data: NoteData,
    path: String,
    preview: Option<String>,
) -> bool {
    let path = Path::new(&path);

    match save(&app, &assets, path, &note_data, preview) {
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
pub async fn save_note_to_storage(
    app: tauri::AppHandle,
    assets: String,
    note_data: NoteData,
    preview: Option<String>,
) -> Option<String> {
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

    if let Err(e) = save(&app, &assets, &full_path, &note_data, preview) {
        display_error(e.into());
        return None;
    };

    Some(full_path.to_str()?.to_string())
}

/// Save As. The session's attachments are copied from its current file and
/// cache into the new one, which becomes the session's file.
#[tauri::command]
#[specta::specta]
pub async fn save_note_dialog(
    app: tauri::AppHandle,
    assets: String,
    note_data: NoteData,
    preview: Option<String>,
) -> Option<String> {
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
    if let Err(e) = save(&app, &assets, path, &note_data, preview) {
        display_error(e.into());
        return None;
    };

    Some(path.to_string_lossy().into())
}

/// `preview` is a PNG data URL of the first page, shown by the file browser.
fn save(
    app: &AppHandle,
    session: &str,
    path: &Path,
    note_data: &NoteData,
    preview: Option<String>,
) -> Result<(), RnpfError> {
    app.state::<AssetStore>()
        .save(session, path, note_data, preview.as_deref())
}
