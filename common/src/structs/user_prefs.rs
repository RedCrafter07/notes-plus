use std::{fs, io::Write};

use serde::{Deserialize, Serialize};
use ts_rs::TS;

#[derive(Clone, Serialize, Deserialize, Debug, TS)]
pub struct UserPrefs {
    version: u8,
    pub default_document_dir: String,
    pub workdir: String,
}

impl UserPrefs {
    pub fn from_file_or_default(path: &str) -> UserPrefs {
        let prefs = UserPrefs::from_file(path);
        prefs.unwrap_or_default()
    }
    pub fn from_file(path: &str) -> Result<UserPrefs, PrefReadError> {
        let file_data = fs::read(path)?;

        let prefs = rmp_serde::from_slice::<UserPrefs>(&file_data)?;

        Ok(prefs)
    }
    pub fn create_dirs(&self) {
        // Check if dirs exist
        let dirs: [&str; 2] = [&self.default_document_dir, &self.workdir];

        dirs.iter().for_each(|path| {
            let _ = fs::create_dir_all(path);
        });
    }
    pub fn to_file(&self, path: &str) -> Result<(), PrefWriteError> {
        let mut file = fs::File::options()
            .write(true)
            .truncate(true)
            .create(true)
            .open(path)?;

        let data = rmp_serde::to_vec(self)?;

        file.write_all(&data)?;

        Ok(())
    }

    pub fn new() -> UserPrefs {
        UserPrefs {
            version: 1,
            default_document_dir: dirs::document_dir()
                .unwrap()
                .join("rednotes-plus")
                .to_str()
                .unwrap()
                .to_string(),
            workdir: dirs::document_dir()
                .unwrap()
                .join("rednotes-plus/workdir")
                .to_str()
                .unwrap()
                .to_string(),
        }
    }
}

impl Default for UserPrefs {
    fn default() -> Self {
        Self::new()
    }
}

#[derive(Debug)]
pub enum PrefReadError {
    IoError(std::io::Error),
    DecodeError(rmp_serde::decode::Error),
}

impl From<std::io::Error> for PrefReadError {
    fn from(value: std::io::Error) -> Self {
        PrefReadError::IoError(value)
    }
}

impl From<rmp_serde::decode::Error> for PrefReadError {
    fn from(value: rmp_serde::decode::Error) -> Self {
        PrefReadError::DecodeError(value)
    }
}

#[derive(Debug)]
pub enum PrefWriteError {
    IoError(std::io::Error),
    EncodeError(rmp_serde::encode::Error),
}

impl From<std::io::Error> for PrefWriteError {
    fn from(value: std::io::Error) -> Self {
        PrefWriteError::IoError(value)
    }
}

impl From<rmp_serde::encode::Error> for PrefWriteError {
    fn from(value: rmp_serde::encode::Error) -> Self {
        PrefWriteError::EncodeError(value)
    }
}
