use base64::{Engine, engine::general_purpose::STANDARD as BASE64};
use tauri_plugin_dialog::DialogExt;

use crate::util::dialog::show_error;

/// Asks where to save, then writes `data_base64` there. Used for PNG/PDF
/// export, which is rendered in the webview. Returns the chosen path, or
/// `None` if the user cancelled or writing failed (errors are shown).
#[tauri::command]
#[specta::specta]
pub fn export_file(
    app: tauri::AppHandle,
    data_base64: String,
    file_name: String,
    filter_name: String,
    extension: String,
) -> Option<String> {
    let bytes = match BASE64.decode(data_base64) {
        Ok(b) => b,
        Err(e) => {
            show_error(format!("Export failed, the data is invalid: {e}"));
            return None;
        }
    };

    let path = app
        .dialog()
        .file()
        .add_filter(filter_name, &[extension.as_str()])
        .set_file_name(file_name)
        .blocking_save_file()?;

    let path = path.as_path()?;

    if let Err(e) = std::fs::write(path, bytes) {
        show_error(format!("Could not write {}: {e}", path.display()));
        return None;
    }

    Some(path.to_string_lossy().into())
}
