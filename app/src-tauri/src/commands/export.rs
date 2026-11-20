use std::path::{Path, PathBuf};

use base64::{Engine, engine::general_purpose::STANDARD as BASE64};
use serde::{Deserialize, Serialize};
use specta::Type;
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

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct ExportedFile {
    /// File name including extension, e.g. "Lecture 3 - 1.png".
    pub name: String,
    pub data_base64: String,
}

/// Asks for a folder, then writes every file into it. Existing files are
/// never overwritten: a clash gets " (2)", " (3)", ... appended. Returns the
/// folder, or `None` if cancelled or nothing could be written.
#[tauri::command]
#[specta::specta]
pub fn export_files(app: tauri::AppHandle, files: Vec<ExportedFile>) -> Option<String> {
    let folder = app.dialog().file().blocking_pick_folder()?;
    let folder = folder.as_path()?.to_path_buf();

    let mut written = 0;
    for file in files {
        let bytes = match BASE64.decode(&file.data_base64) {
            Ok(b) => b,
            Err(e) => {
                show_error(format!("Skipped {}: invalid data ({e})", file.name));
                continue;
            }
        };

        let path = free_path(&folder, &sanitize(&file.name));
        match std::fs::write(&path, bytes) {
            Ok(_) => written += 1,
            Err(e) => show_error(format!("Could not write {}: {e}", path.display())),
        }
    }

    (written > 0).then(|| folder.to_string_lossy().into())
}

/// Removes characters that are invalid in file names on Windows (the
/// strictest target), so a note title like "Bio: Cells" still exports.
fn sanitize(name: &str) -> String {
    let cleaned: String = name
        .chars()
        .map(|c| if r#"<>:"/\|?*"#.contains(c) || c.is_control() { '-' } else { c })
        .collect();
    let trimmed = cleaned.trim().trim_end_matches('.');
    if trimmed.is_empty() { "export".into() } else { trimmed.into() }
}

/// `folder/name`, or `folder/stem (n).ext` for the first `n` that is free.
fn free_path(folder: &Path, name: &str) -> PathBuf {
    let candidate = folder.join(name);
    if !candidate.exists() {
        return candidate;
    }

    let (stem, ext) = match name.rsplit_once('.') {
        Some((s, e)) if !s.is_empty() => (s, format!(".{e}")),
        _ => (name, String::new()),
    };

    (2..)
        .map(|n| folder.join(format!("{stem} ({n}){ext}")))
        .find(|p| !p.exists())
        .expect("an unbounded range always yields a free name")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sanitizes_windows_names() {
        assert_eq!(sanitize("Bio: Cells/1?.png"), "Bio- Cells-1-.png");
        assert_eq!(sanitize("  ..."), "export");
    }

    #[test]
    fn finds_a_free_name() {
        let dir = std::env::temp_dir().join(format!("rn-export-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&dir).unwrap();

        assert_eq!(free_path(&dir, "a.png"), dir.join("a.png"));
        std::fs::write(dir.join("a.png"), b"").unwrap();
        assert_eq!(free_path(&dir, "a.png"), dir.join("a (2).png"));
        std::fs::write(dir.join("a (2).png"), b"").unwrap();
        assert_eq!(free_path(&dir, "a.png"), dir.join("a (3).png"));

        std::fs::remove_dir_all(dir).unwrap();
    }
}
