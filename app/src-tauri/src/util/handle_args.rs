use std::path::{Path, PathBuf};

use common::{io::archive::open_data, structs::note::NoteData};
use tauri::AppHandle;
use tauri_specta::Event;

use crate::{events::Open, structs::OpenData};

pub(crate) fn handle_args(app: &AppHandle, args: Option<Vec<String>>, cwd: Option<PathBuf>) {
    let args = args.unwrap_or_else(|| std::env::args().collect());

    if args.len() <= 1 {
        return;
    }

    let base = cwd
        .or_else(|| std::env::current_dir().ok())
        .unwrap_or_default();

    let args_path = Path::new(&args[1]);
    let path = if args_path.is_absolute() {
        args_path.into()
    } else {
        base.join(args_path)
    };

    if !path.exists() {
        eprintln!("Cannot open {}: file does not exist", path.display());
        return;
    }

    let buffer = match open_data(&path) {
        Ok(b) => b,
        Err(e) => {
            eprintln!("Failed to read {}: {e}", path.display());
            return;
        }
    };

    let Ok(note) = NoteData::from_bytes(&buffer) else {
        return;
    };

    Open(OpenData {
        note_data: note,
        path: args[1].to_string(),
    })
    .emit(app)
    .expect("Failed to emit Open event");
}
