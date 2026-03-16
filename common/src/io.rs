use std::{
    fs::File,
    io::{Read, Write},
    path::Path,
};

use flate2::{Compression, read::GzDecoder, write::GzEncoder};

use crate::structs::note::Note;

pub enum NoteFileError {
    Serialization(rmp_serde::encode::Error),
    Deserialization(rmp_serde::decode::Error),
    FileOpen(std::io::Error),
    InvalidFile,
}

impl From<rmp_serde::decode::Error> for NoteFileError {
    fn from(v: rmp_serde::decode::Error) -> Self {
        Self::Deserialization(v)
    }
}

impl From<std::io::Error> for NoteFileError {
    fn from(v: std::io::Error) -> Self {
        Self::FileOpen(v)
    }
}

impl From<rmp_serde::encode::Error> for NoteFileError {
    fn from(v: rmp_serde::encode::Error) -> Self {
        Self::Serialization(v)
    }
}

pub(crate) fn note_to_file(note: &Note, path: &Path) -> Result<(), NoteFileError> {
    let file = File::options()
        .create_new(true)
        .write(true)
        .truncate(true)
        .open(path)?;

    file.lock()?;

    let mut encoder = GzEncoder::new(&file, Compression::default());

    let note_rmp = rmp_serde::to_vec(note)?;
    let data_length = u32::to_le_bytes(note_rmp.len() as u32);

    encoder.write_all(b"REDNOTES")?;
    encoder.write_all(&[0x01, 0x00])?;

    encoder.write_all(&data_length)?;
    encoder.write_all(&note_rmp)?;

    encoder.finish()?;

    file.unlock()?;

    Ok(())
}

pub(crate) fn file_to_note(path: &Path) -> Result<Note, NoteFileError> {
    let file = File::options().read(true).open(path)?;
    file.lock()?;

    let mut decoder = GzDecoder::new(&file);

    let mut header = [0u8; 8];
    decoder.read_exact(&mut header)?;
    let header = str::from_utf8(&header).map_err(|_| NoteFileError::InvalidFile)?;
    if header != "REDNOTES" {
        return Err(NoteFileError::InvalidFile);
    }

    let mut version = [0u8; 2];
    decoder.read_exact(&mut version)?;

    let mut data_length = [0u8; 4];
    decoder.read_exact(&mut data_length)?;
    let data_length = u32::from_le_bytes(data_length);

    let mut note_data = vec![0u8; data_length as usize];
    decoder.read_exact(&mut note_data)?;

    let note: Note = rmp_serde::from_slice(&note_data)?;

    file.unlock()?;

    Ok(note)
}
