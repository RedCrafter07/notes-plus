use std::{
    fs::File,
    io::{Read, Write},
    path::Path,
};

use flate2::{Compression, read::GzDecoder, write::GzEncoder};

use crate::structs::note::{Note, NoteData, State};

#[derive(Debug)]
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

pub(crate) fn note_to_file(data: &NoteData, path: &Path) -> Result<(), NoteFileError> {
    let file = File::options()
        .create(true)
        .write(true)
        .truncate(true)
        .open(path)?;

    file.lock()?;

    let mut encoder = GzEncoder::new(&file, Compression::default());

    encoder.write_all(b"REDNOTES")?;
    encoder.write_all(&[0x01, 0x00])?;

    let id_bytes = data.id.as_bytes();
    let id_length = u32::to_le_bytes(id_bytes.len() as u32);

    encoder.write_all(&id_length)?;
    encoder.write_all(&id_bytes)?;

    let note_bytes = rmp_serde::to_vec(&data.content)?;
    let data_length = u32::to_le_bytes(note_bytes.len() as u32);

    encoder.write_all(&data_length)?;
    encoder.write_all(&note_bytes)?;

    let state_bytes = rmp_serde::to_vec(&data.state)?;
    let state_length = u32::to_le_bytes(state_bytes.len() as u32);

    encoder.write_all(&state_length)?;
    encoder.write_all(&state_bytes)?;

    encoder.finish()?;

    file.unlock()?;

    Ok(())
}

pub(crate) fn file_to_note(path: &Path) -> Result<NoteData, NoteFileError> {
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

    let mut id_length = [0u8; 4];
    decoder.read_exact(&mut id_length)?;
    let id_length = u32::from_le_bytes(id_length);

    let mut id = vec![0u8; id_length as usize];
    decoder.read_exact(&mut id)?;
    let id = String::from_utf8(id).unwrap_or_else(|_| uuid::Uuid::new_v4().to_string());

    let mut data_length = [0u8; 4];
    decoder.read_exact(&mut data_length)?;
    let data_length = u32::from_le_bytes(data_length);

    let mut note_data = vec![0u8; data_length as usize];
    decoder.read_exact(&mut note_data)?;

    let note: Note = rmp_serde::from_slice(&note_data)?;

    let mut state_length = [0u8; 4];
    decoder.read_exact(&mut state_length)?;
    let state_length = u32::from_le_bytes(state_length);

    let mut state_data = vec![0u8; state_length as usize];
    decoder.read_exact(&mut state_data)?;

    let state: State = rmp_serde::from_slice(&state_data)?;

    file.unlock()?;

    Ok(NoteData {
        content: note,
        path: Some(path.to_string_lossy().into_owned()),
        id,
        state: state,
    })
}
