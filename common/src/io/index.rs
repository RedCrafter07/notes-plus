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
    #[error("The file has an invalid extension. Expected .rnpf")]
    InvalidExtension,
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
    pub created_at: u32,
    pub edited_at: u32,
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
    // Ignore non-rnpf files
    if let Some(ext) = path.extension() {
        if ext != "rnpf" {
            return Err(IndexError::InvalidExtension);
        }
    }
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
        created_at: data.content.created_at,
        edited_at: data.content.edited_at,
    })
}

pub fn normalize_folder(folder: String) -> String {
    let mut folder = folder.trim_matches('/').to_string();

    while folder.contains("//") {
        folder = folder.replace("//", "/");
    }

    folder
}

#[cfg(test)]
mod tests {
    #[test]
    fn test_normalize_folder() {
        exec_normalize_test("/folder//subfolder///".into(), "folder/subfolder");
        exec_normalize_test("//Work".into(), "Work");
        exec_normalize_test("Work///Sub".into(), "Work/Sub");
        exec_normalize_test("/Work/".into(), "Work");

        fn exec_normalize_test(input: String, expected: &str) {
            assert_eq!(super::normalize_folder(input), expected);
        }
    }
}
