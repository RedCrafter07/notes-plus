use std::path::{Path, PathBuf};

use common::io::archive::Rnpf;
use tauri::AppHandle;
use tauri_specta::Event;
use thiserror::Error;

use crate::{
    events::Open,
    structs::{OpenData, Result},
};

#[derive(Debug, Error)]
pub enum ArgsError {
    #[error("Cannot use path as string: '{0}'")]
    InvalidPath(PathBuf), // carries the offending path now too
}

pub(crate) fn handle_args(
    app: &AppHandle,
    args: Option<Vec<String>>,
    cwd: Option<PathBuf>,
) -> Result<()> {
    let args = args.unwrap_or_else(|| std::env::args().collect());

    if args.len() <= 1 {
        return Ok(());
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

    let archive = Rnpf::new(&path)?;
    let note = archive.build_data()?;

    let path_string = path
        .to_str()
        .ok_or_else(|| ArgsError::InvalidPath(path.clone()))?;

    Open(OpenData {
        note_data: note,
        path: path_string.into(),
    })
    .emit(app)?;

    Ok(())
}
