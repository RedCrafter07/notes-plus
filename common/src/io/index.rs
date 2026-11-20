use std::{io::ErrorKind, path::Path};

use serde::{Deserialize, Serialize};
use serde_with::{DisplayFromStr, serde_as};
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

/// Timestamps travel as strings, like `Meta`'s, so the JSON matches the
/// TypeScript type (`string`): u64 can exceed JavaScript's safe integers.
/// They used to be sent as numbers while typed as strings.
#[serde_as]
#[derive(specta::Type, Clone, Debug, Deserialize, Serialize)]
pub struct File {
    pub title: String,
    pub folder: Option<String>,
    pub path: String,
    #[serde_as(as = "DisplayFromStr")]
    #[specta(type = String)]
    pub created_at: u64,
    #[serde_as(as = "DisplayFromStr")]
    #[specta(type = String)]
    pub edited_at: u64,
    /// First page as a PNG data URL, if the file carries one.
    pub preview: Option<String>,
}

pub type IndexErrorResult = Vec<(String, IndexError)>;

/// What is wrong with a file, in terms a user can act on.
#[derive(specta::Type, Clone, Copy, Debug, PartialEq, Eq, Deserialize, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum ProblemKind {
    /// Made by a newer RedNotes Plus: update the app.
    NewerVersion,
    /// Has a version marker this app does not recognise.
    UnknownVersion,
    /// A note archive whose contents are missing or broken.
    Damaged,
    /// Named .rnpf but not a RedNotes Plus archive at all.
    NotANote,
    /// Could not be read (permissions, locked, vanished).
    Unreadable,
}

/// A note file that could not be indexed, for the Problems page.
#[derive(specta::Type, Clone, Debug, Deserialize, Serialize)]
pub struct FileProblem {
    pub path: String,
    /// File name only, for display.
    pub name: String,
    pub kind: ProblemKind,
    /// The underlying error, for the "details" section.
    pub detail: String,
}

impl FileProblem {
    pub fn new(path: &str, error: &IndexError) -> Self {
        let name = Path::new(path)
            .file_name()
            .map(|n| n.to_string_lossy().into_owned())
            .unwrap_or_else(|| path.to_string());

        Self {
            path: path.to_string(),
            name,
            kind: classify(error),
            detail: detail(error),
        }
    }
}

fn classify(error: &IndexError) -> ProblemKind {
    match error {
        IndexError::ArchiveError(e) => match e {
            RnpfError::NewerVersion(_) => ProblemKind::NewerVersion,
            RnpfError::InvalidVersion => ProblemKind::UnknownVersion,
            RnpfError::ArchiveError(_) => ProblemKind::NotANote,
            RnpfError::FileError(_) | RnpfError::InvalidPath => ProblemKind::Unreadable,
            RnpfError::SerializationError(_) | RnpfError::InvalidFile | RnpfError::InvalidAsset => {
                ProblemKind::Damaged
            }
        },
        IndexError::IoError(_) | IndexError::InvalidExtension | IndexError::Unknown => {
            ProblemKind::Unreadable
        }
    }
}

/// The error and its causes, e.g. "invalid Zip archive: Could not find EOCD".
fn detail(error: &IndexError) -> String {
    let mut out = error.to_string();
    let mut source = std::error::Error::source(error);
    while let Some(s) = source {
        let text = s.to_string();
        if !out.contains(&text) {
            out.push_str(": ");
            out.push_str(&text);
        }
        source = s.source();
    }
    out
}

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
    let archive = Rnpf::new(path)?;
    let meta = archive.get_meta()?;

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
        preview: archive.get_preview(),
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
    use super::*;

    #[test]
    fn classifies_problems() {
        let dir = std::env::temp_dir().join(format!("rn-index-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&dir).unwrap();
        std::fs::write(dir.join("not-a-zip.rnpf"), b"hello").unwrap();
        std::fs::write(dir.join("ignored.txt"), b"hello").unwrap();

        let (files, errors) = build_index(&dir).unwrap();
        assert!(files.is_empty());
        assert_eq!(errors.len(), 1, "only .rnpf files are indexed");

        let problem = FileProblem::new(&errors[0].0, &errors[0].1);
        assert_eq!(problem.name, "not-a-zip.rnpf");
        assert_eq!(problem.kind, ProblemKind::NotANote);
        assert!(!problem.detail.is_empty());

        std::fs::remove_dir_all(dir).unwrap();
    }

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
