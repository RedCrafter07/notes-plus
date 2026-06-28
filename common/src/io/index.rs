use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};
use thiserror::Error;

use crate::{
    io::{archive::open_data, data::NoteFileError},
    structs::note::NoteData,
};

#[derive(Error, Debug)]
pub enum IndexError {
    #[error("An IO error occurred while opening a file or folder")]
    IoError(#[from] std::io::Error),
    #[error("File or folder could not be found at the specified location")]
    NotFound,
    #[error("The file format does not match the .rnpf format.")]
    InvalidFile(NoteFileError),
    #[error("An error occurred while accessing the notebook archive")]
    ArchiveError(#[from] sevenz_rust2::Error),
    #[error("An unknonw error occurred")]
    Unknown,
    #[error(transparent)]
    Other(#[from] anyhow::Error),
}

#[derive(specta::Type, Clone, Debug, Deserialize, Serialize)]
pub struct File {
    title: String,
    folder: Option<String>,
    path: String,
}

pub fn run_index(path: &Path) -> Result<Vec<File>, IndexError> {
    // Get files in folder, iterate over files
    if !path.is_dir() {
        return Err(IndexError::NotFound);
    }

    // Pass each filepath to index_file function
    let index: Vec<File> = path
        .read_dir()?
        .filter_map(|f| index_file(&f.ok()?.path()).ok())
        .collect();

    // Finally, return the vector of indexed files

    Ok(index)
}

pub fn index_file(path: &PathBuf) -> Result<File, IndexError> {
    let data = NoteData::from_bytes(&open_data(&path)?);
    let data = if let Ok(data) = data {
        data
    } else {
        return Err(IndexError::InvalidFile(data.unwrap_err()));
    };
    let path_str = path.to_str().unwrap().to_string();

    Ok(File {
        path: path_str,
        title: data.content.title,
        folder: data.folder,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn index_test_folder() {
        let index = run_index(&Path::new("/home/redi/Documents/RNPF"));

        assert!(index.is_ok());
    }
}
