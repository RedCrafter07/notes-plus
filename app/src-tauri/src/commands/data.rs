use std::fs::create_dir_all;
use std::path::{Path, PathBuf};

use common::io::index::{File, FileProblem, build_index};
use common::io::organize_index::EntryType;
use common::structs::defaults::Defaults;
use serde::{Deserialize, Serialize};
use specta::Type;
use tauri::Manager;

use crate::util::dialog::show_error;

/// The notebooks folder: its notes as a tree, plus the files that could not
/// be read, which the Problems page lists.
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct Notebooks {
    pub root: EntryType,
    pub problems: Vec<FileProblem>,
}

fn notebooks_dir(app: &tauri::AppHandle) -> Option<PathBuf> {
    app.path().app_data_dir().ok().map(|p| p.join("notebooks"))
}

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
pub fn get_notebooks(app: tauri::AppHandle) -> Option<Notebooks> {
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
        // Broken files are reported, not shown as one dialog each: the
        // Problems page explains them and offers to fix them.
        Ok((success, errors)) => Some(Notebooks {
            root: EntryType::from_index(success),
            problems: errors
                .iter()
                .map(|(path, error)| FileProblem::new(path, error))
                .collect(),
        }),
        Err(e) => {
            show_error(format!("Could not index notebooks: {e}"));
            None
        }
    }
}

/// Moves a note file to the system trash (Recycle Bin on Windows), so it can
/// be restored. Only `.rnpf` files inside the notebooks folder are accepted:
/// the path comes from the UI, and this must never become "delete any file".
#[tauri::command]
#[specta::specta]
pub fn trash_note_file(app: tauri::AppHandle, path: String) -> bool {
    let Some(dir) = notebooks_dir(&app) else {
        show_error("Application storage could not be found.".into());
        return false;
    };

    match checked_note_path(&dir, Path::new(&path)) {
        Some(file) => match trash::delete(&file) {
            Ok(()) => true,
            Err(e) => {
                show_error(format!("Could not move {} to the trash: {e}", file.display()));
                false
            }
        },
        None => {
            show_error(format!("{path} is not a note in your notebooks folder."));
            false
        }
    }
}

/// The canonical path if `path` is an existing `.rnpf` file inside `dir`
/// (symlinks and `..` resolved before comparing), otherwise `None`.
fn checked_note_path(dir: &Path, path: &Path) -> Option<PathBuf> {
    let dir = dir.canonicalize().ok()?;
    let file = path.canonicalize().ok()?;
    let is_note = file
        .extension()
        .is_some_and(|e| e.eq_ignore_ascii_case("rnpf"));

    (is_note && file.is_file() && file.starts_with(&dir)).then_some(file)
}

#[cfg(test)]
mod tests {
    use super::checked_note_path;

    #[test]
    fn only_notes_inside_the_folder_are_accepted() {
        let root = std::env::temp_dir().join(format!("rn-trash-{}", uuid::Uuid::new_v4()));
        let dir = root.join("notebooks");
        std::fs::create_dir_all(dir.join("sub")).unwrap();
        std::fs::write(dir.join("sub/a.rnpf"), b"").unwrap();
        std::fs::write(dir.join("b.txt"), b"").unwrap();
        std::fs::write(root.join("outside.rnpf"), b"").unwrap();

        assert!(checked_note_path(&dir, &dir.join("sub/a.rnpf")).is_some());
        assert!(checked_note_path(&dir, &dir.join("b.txt")).is_none(), "not a note");
        assert!(checked_note_path(&dir, &root.join("outside.rnpf")).is_none(), "outside");
        assert!(
            checked_note_path(&dir, &dir.join("../outside.rnpf")).is_none(),
            "no escaping with .."
        );
        assert!(checked_note_path(&dir, &dir.join("missing.rnpf")).is_none());

        std::fs::remove_dir_all(root).unwrap();
    }
}
