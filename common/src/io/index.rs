use std::{io::ErrorKind, path::Path};

use serde::{Deserialize, Serialize};
use thiserror::Error;

use crate::{
    io::archive::{Rnpf, RnpfError},
    util::is_rnpf,
};

#[derive(Error, Debug)]
pub enum IndexError {
    #[error("An IO error occurred while opening a file or folder")]
    IoError(#[from] std::io::Error),
    #[error("An error occurred while accessing the notebook archive")]
    ArchiveError(#[from] RnpfError),
    #[error("The file has an invalid extension. Expected .rnpf")]
    InvalidExtension,
    #[error("An unknown error occurred")]
    Unknown,
}

#[derive(specta::Type, Clone, Debug, Deserialize, Serialize)]
pub struct File {
    pub title: String,
    pub folder: Option<String>,
    pub path: String,
    pub created_at: u64,
    pub edited_at: u64,
}

pub type IndexErrorResult = Vec<(String, IndexError)>;

pub fn build_index(path: &Path) -> Result<(Vec<File>, IndexErrorResult), IndexError> {
    // Get files in folder, iterate over files
    if !path.is_dir() {
        return Err(
            err_not_found("File or folder could not be found at the specified location").into(),
        );
    }

    // Split the results into success and errors for better UX
    let mut success = Vec::new();
    let mut errors: IndexErrorResult = Vec::new();

    for entry in path.read_dir()? {
        let entry = match entry {
            Ok(entry) => entry,
            Err(e) => {
                errors.push((path.display().to_string(), e.into()));
                continue;
            }
        };

        let path = entry.path();
        // Skip, path is invalid
        if !is_rnpf(&path) {
            continue;
        }

        let result = index_file(&path);

        // Split the results according to the outcome
        match result {
            Ok(file) => success.push(file),
            Err(e) => errors.push((path.display().to_string(), e)),
        };
    }

    // Return both sides
    Ok((success, errors))
}

fn err_not_found(message: &str) -> std::io::Error {
    std::io::Error::new(ErrorKind::NotFound, message)
}

pub fn index_file(path: &Path) -> Result<File, IndexError> {
    // Ignore non-rnpf files
    match path.extension() {
        Some(ext) if ext == "rnpf" => {}
        _ => return Err(IndexError::InvalidExtension),
    }

    // Get data from file by opening the data file in the archive
    let meta = Rnpf::new(path)?.get_meta()?;

    // Redefine data as the actual data, or error otherwise
    let path_str = if let Some(path) = path.to_str() {
        path.to_string()
    } else {
        return Err(IndexError::Unknown);
    };

    Ok(File {
        path: path_str,
        title: meta.title,
        folder: meta.folder,
        created_at: meta.created_at,
        edited_at: meta.edited_at,
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
