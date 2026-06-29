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
    pub title: String,
    pub folder: Option<String>,
    pub path: String,
}

pub fn build_index(path: &Path) -> Result<Vec<File>, IndexError> {
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
    // Get data from file by opening the data file in the archive
    let data = NoteData::from_bytes(&open_data(&path)?);

    // Redefine data as the actual data, or error otherwise
    let data = if let Ok(data) = data {
        data
    } else {
        // Unwrapping is safe here since we checked if it is ok previously
        return Err(IndexError::InvalidFile(data.unwrap_err()));
    };
    let path_str = if let Some(path) = path.to_str() {
        path.to_string()
    } else {
        return Err(IndexError::Unknown);
    };

    Ok(File {
        path: path_str,
        title: data.content.title,
        folder: data.content.folder,
    })
}
