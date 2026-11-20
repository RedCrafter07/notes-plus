//! Managing notebooks from the dashboard: rename, move to a folder,
//! duplicate, rename a folder. Every path comes from the UI, so each one is
//! checked to be an existing `.rnpf` inside the notebooks folder first.
//!
//! Notes that are open in a tab are changed in the tab instead (by the
//! frontend), so the tab's next save cannot overwrite the change.

use std::path::{Path, PathBuf};

use common::{
    io::{
        archive::{Rnpf, RnpfError},
        index::{build_index, normalize_folder},
    },
    structs::data::Meta,
};

use super::data::{checked_note_path, notebooks_dir};
use crate::util::dialog::show_error;

/// The checked path of a note, or `None` after telling the user why not.
fn note(app: &tauri::AppHandle, path: &str) -> Option<PathBuf> {
    let Some(dir) = notebooks_dir(app) else {
        show_error("Application storage could not be found.".into());
        return None;
    };
    let checked = checked_note_path(&dir, Path::new(path));
    if checked.is_none() {
        show_error(format!("{path} is not a note in your notebooks folder."));
    }
    checked
}

fn report(result: Result<(), RnpfError>, what: &str) -> bool {
    match result {
        Ok(()) => true,
        Err(e) => {
            show_error(format!("Could not {what}: {e}"));
            false
        }
    }
}

#[tauri::command]
#[specta::specta]
pub fn rename_note(app: tauri::AppHandle, path: String, title: String) -> bool {
    let title = title.trim().to_string();
    if title.is_empty() {
        return false;
    }
    let Some(file) = note(&app, &path) else {
        return false;
    };
    report(Rnpf::update_meta(&file, |m| m.title = title), "rename the note")
}

/// `folder` like "Uni/Physics"; `None` or empty for the top level.
#[tauri::command]
#[specta::specta]
pub fn move_note(app: tauri::AppHandle, path: String, folder: Option<String>) -> bool {
    let Some(file) = note(&app, &path) else {
        return false;
    };
    let folder = folder.map(normalize_folder).filter(|f| !f.is_empty());
    report(Rnpf::update_meta(&file, |m| m.folder = folder), "move the note")
}

/// Copies a note into the notebooks folder as a new note ("Title (copy)",
/// new id, same folder). Returns the new file's path.
#[tauri::command]
#[specta::specta]
pub fn duplicate_note(app: tauri::AppHandle, path: String) -> Option<String> {
    let file = note(&app, &path)?;
    let dir = notebooks_dir(&app)?;

    let result = (|| -> Result<PathBuf, RnpfError> {
        let archive = Rnpf::new(&file)?;
        let mut data = archive.build_data()?;
        let preview = archive.get_preview();

        let fresh = Meta::new(format!("{} (copy)", data.meta.title));
        data.meta = Meta {
            folder: data.meta.folder.take(),
            tags: std::mem::take(&mut data.meta.tags),
            ..fresh
        };

        let target = dir.join(format!("{}.rnpf", data.meta.id));
        Rnpf::create_from_data(&target, data, preview.as_deref())?;
        Ok(target)
    })();

    match result {
        Ok(target) => Some(target.to_string_lossy().into()),
        Err(e) => {
            show_error(format!("Could not duplicate the note: {e}"));
            None
        }
    }
}

/// Renames (or moves) a folder: every note in `from` or below it gets the
/// new prefix. Folders only exist as the `folder` of the notes in them.
/// `skip` lists notes open in tabs, which the frontend updates itself.
/// Returns how many files were changed.
#[tauri::command]
#[specta::specta]
pub fn rename_folder(app: tauri::AppHandle, from: String, to: String, skip: Vec<String>) -> u32 {
    let from = normalize_folder(from);
    let to = normalize_folder(to);
    if from.is_empty() || to.is_empty() || from == to {
        return 0;
    }
    let Some(dir) = notebooks_dir(&app) else {
        return 0;
    };
    let Ok((files, _)) = build_index(&dir) else {
        return 0;
    };

    let mut changed = 0;
    for f in files {
        if skip.contains(&f.path) {
            continue;
        }
        let Some(new_folder) = f.folder.as_deref().and_then(|folder| rebase(folder, &from, &to)) else {
            continue;
        };
        let Some(file) = checked_note_path(&dir, Path::new(&f.path)) else {
            continue;
        };
        if report(
            Rnpf::update_meta(&file, |m| m.folder = Some(new_folder)),
            &format!("move {}", f.title),
        ) {
            changed += 1;
        }
    }
    changed
}

/// "Uni/Physics" with `from = "Uni"`, `to = "School"` gives "School/Physics";
/// folders outside `from` (including "University") give `None`.
pub(crate) fn rebase(folder: &str, from: &str, to: &str) -> Option<String> {
    if folder == from {
        Some(to.to_string())
    } else {
        folder
            .strip_prefix(from)
            .and_then(|rest| rest.strip_prefix('/'))
            .map(|rest| format!("{to}/{rest}"))
    }
}

#[cfg(test)]
mod tests {
    use super::rebase;

    #[test]
    fn rebases_folders() {
        assert_eq!(rebase("Uni", "Uni", "School").as_deref(), Some("School"));
        assert_eq!(rebase("Uni/Physics", "Uni", "School").as_deref(), Some("School/Physics"));
        assert_eq!(rebase("University", "Uni", "School"), None, "only whole segments");
        assert_eq!(rebase("Work", "Uni", "School"), None);
    }
}
