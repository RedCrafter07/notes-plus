use std::{
    ffi::OsString,
    fs::{File, rename},
    io::{Read, Seek, Write},
    path::Path,
};
use thiserror::Error;
use zip::{CompressionMethod, ZipArchive, ZipWriter, result::ZipError, write::SimpleFileOptions};

use crate::structs::data::{Content, FromToBin, Meta, NoteData, State};

#[derive(Error, Debug)]
pub enum RnpfError {
    #[error(transparent)]
    FileError(#[from] std::io::Error),
    #[error(transparent)]
    SerializationError(#[from] serde_json::Error),
    #[error(transparent)]
    ArchiveError(#[from] zip::result::ZipError),
    #[error("The provided file has an unknown version")]
    InvalidVersion,
    #[error("The provided path is not valid UTF-8")]
    InvalidPath,
    #[error("The provided file is invalid")]
    InvalidFile,
}

// TODO: Add attachment support

pub struct Rnpf {
    file: File,
}

impl Rnpf {
    pub fn new(path: &Path) -> Result<Self, RnpfError> {
        let rnpf = Self {
            file: File::options().read(true).open(path)?,
        };

        rnpf.validate_version()?;

        Ok(rnpf)
    }

    pub fn create_from_data(path: &Path, note_data: NoteData) -> Result<(), RnpfError> {
        let tmp_path = tmp_path_for(path);
        let file = File::options()
            .write(true)
            .create_new(true)
            .open(&tmp_path)?;

        let mut zip = ZipWriter::new(&file);

        Self::write_vec(&mut zip, "meta", &note_data.meta)?;
        Self::write_vec(&mut zip, "data", &note_data.content)?;
        Self::write_vec(&mut zip, "state", &note_data.state)?;
        Self::write_version(&mut zip)?;

        zip.finish()?;

        if let Err(e) = rename(&tmp_path, path) {
            std::fs::remove_file(&tmp_path)?;

            return Err(e.into());
        };

        Ok(())
    }

    pub fn build_data(&self) -> Result<NoteData, RnpfError> {
        let mut data = NoteData {
            content: self.get_data()?,
            meta: self.get_meta()?,
            state: self.get_state()?,
        };
        data.normalize();

        Ok(data)
    }

    pub fn get_data(&self) -> Result<Content, RnpfError> {
        self.read_data("data")
    }
    pub fn get_meta(&self) -> Result<Meta, RnpfError> {
        self.read_data("meta")
    }
    pub fn get_state(&self) -> Result<State, RnpfError> {
        self.read_data("state")
    }

    fn read_data<T: FromToBin>(&self, name: &str) -> Result<T, RnpfError> {
        let mut zip = ZipArchive::new(&self.file)?;

        let mut file_data = Vec::new();
        let file = zip.by_name(name);
        let mut file = match file {
            Ok(f) => f,
            Err(ZipError::FileNotFound) => return Err(RnpfError::InvalidFile),
            Err(e) => return Err(e.into()),
        };

        file.read_to_end(&mut file_data)?;

        Ok(T::from_bytes(&file_data)?)
    }

    fn write_vec<T: FromToBin + serde::Serialize, W: Write + Seek>(
        zip: &mut ZipWriter<W>,
        file_name: &str,
        data: &T,
    ) -> Result<(), RnpfError> {
        let options = SimpleFileOptions::default().compression_method(CompressionMethod::Zstd);

        zip.start_file(file_name, options)?;
        zip.write_all(&data.to_bytes()?)?;

        Ok(())
    }

    fn validate_version(&self) -> Result<(), RnpfError> {
        let mut archive = ZipArchive::new(&self.file)?;

        let mut version = String::new();

        archive.by_name("version")?.read_to_string(&mut version)?;

        if version == "2" {
            Ok(())
        } else {
            Err(RnpfError::InvalidVersion)
        }
    }

    fn write_version<W: Write + Seek>(zip: &mut ZipWriter<W>) -> Result<(), RnpfError> {
        let options = SimpleFileOptions::default().compression_method(CompressionMethod::Stored);

        zip.start_file("version", options)?;
        zip.write_all(b"2")?;

        Ok(())
    }
}

fn tmp_path_for(path: &Path) -> std::path::PathBuf {
    let mut file_name = path
        .file_name()
        .map(|n| n.to_os_string())
        .unwrap_or_else(|| OsString::from("note"));

    file_name.push(format!(".tmp-{}", std::process::id()));

    path.with_file_name(file_name)
}
