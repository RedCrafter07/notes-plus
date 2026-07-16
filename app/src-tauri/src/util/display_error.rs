use std::io::ErrorKind;

use common::io::{archive::RnpfError, index::IndexError};

use crate::{
    structs::AppError,
    util::{
        ArgsError,
        dialog::{DialogType, show_dialog},
    },
};

pub fn display_error(e: AppError) {
    show_dialog(DialogType::Error, get_error_message(e));
}

fn get_error_message(e: AppError) -> String {
    match e {
        AppError::Args(ArgsError::InvalidPath(path)) => {
            format!(
                "'{}' contains characters that can't be used as a path!",
                path.display()
            )
        }
        AppError::Rnpf(RnpfError::InvalidVersion) => {
            "This note has been made with a newer version of the app. Please check for updates."
                .into()
        }

        AppError::Rnpf(RnpfError::FileError(ref io)) if io.kind() == ErrorKind::NotFound => {
            "The specified file couldn't be found!".into()
        }
        AppError::Rnpf(_) => "The archive could not be opened and may be corrupt.".into(),
        AppError::Tauri(e) => format!("Internal event error: {e}"),
        AppError::Index(e) => match e {
            IndexError::IoError(ref io) if io.kind() == ErrorKind::NotFound => {
                "Indexing failed because a folder with this name doesn't exist.".into()
            }
            IndexError::ArchiveError(e) => get_error_message(e.into()),
            _ => "An unexpected error occurred while indexing".into(),
        },
    }
}
