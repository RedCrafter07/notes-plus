use std::io::{Read, Write};

use flate2::{Compression, read::GzDecoder, write::GzEncoder};
use thiserror::Error;

use crate::structs::note::{Note, NoteData, State};

#[derive(Debug, Error)]
pub enum NoteFileError {
    #[error(transparent)]
    JsonError(#[from] serde_json::Error),
    #[error(transparent)]
    FileOpen(#[from] std::io::Error),
    #[error("Invalid file")]
    InvalidFile,
    #[error("Unsupported version")]
    UnsupportedVersion,
}

pub(crate) fn note_to_bytes(data: &NoteData) -> Result<Vec<u8>, NoteFileError> {
    let mut buffer: Vec<u8> = Vec::new();

    let mut encoder = GzEncoder::new(&mut buffer, Compression::none()); // <- disable compression to prevent double-compression because of archive

    encoder.write_all(b"REDNOTES")?;
    encoder.write_all(&[0x01, 0x00])?;

    let id_bytes = data.id.as_bytes();
    let id_length = u32::to_le_bytes(id_bytes.len() as u32);

    encoder.write_all(&id_length)?;
    encoder.write_all(id_bytes)?;

    let note_bytes = serde_json::to_vec(&data.content)?;
    let data_length = u32::to_le_bytes(note_bytes.len() as u32);

    encoder.write_all(&data_length)?;
    encoder.write_all(&note_bytes)?;

    let state_bytes = serde_json::to_vec(&data.state)?;
    let state_length = u32::to_le_bytes(state_bytes.len() as u32);

    encoder.write_all(&state_length)?;
    encoder.write_all(&state_bytes)?;

    encoder.finish()?;

    Ok(buffer)
}

pub(crate) fn bytes_to_note(data: &[u8]) -> Result<NoteData, NoteFileError> {
    let mut decoder = GzDecoder::new(data);

    let mut header = [0u8; 8];
    decoder.read_exact(&mut header)?;
    let header = str::from_utf8(&header).map_err(|_| NoteFileError::InvalidFile)?;
    if header != "REDNOTES" {
        return Err(NoteFileError::InvalidFile);
    }

    let mut version = [0u8; 2];
    decoder.read_exact(&mut version)?;
    let version = u16::from_le_bytes(version);

    if version != 1 {
        return Err(NoteFileError::UnsupportedVersion);
    }

    let mut id_length = [0u8; 4];
    decoder.read_exact(&mut id_length)?;
    let id_length = u32::from_le_bytes(id_length);

    let id = read_section(&mut decoder, id_length)?;
    let id = String::from_utf8(id).unwrap_or_else(|_| uuid::Uuid::new_v4().to_string());

    let mut data_length = [0u8; 4];
    decoder.read_exact(&mut data_length)?;
    let data_length = u32::from_le_bytes(data_length);

    let mut note: Note = read_section_serde(&mut decoder, data_length)?;
    note.normalize_folder();

    let mut state_length = [0u8; 4];
    decoder.read_exact(&mut state_length)?;
    let state_length = u32::from_le_bytes(state_length);

    let state: State = read_section_serde(&mut decoder, state_length)?;

    Ok(NoteData {
        content: note,
        id,
        state,
    })
}

fn read_section(reader: &mut impl Read, len: u32) -> Result<Vec<u8>, NoteFileError> {
    let mut buf = Vec::new();
    reader.take(len.into()).read_to_end(&mut buf)?;

    if buf.len() != len as usize {
        return Err(NoteFileError::InvalidFile);
    }

    Ok(buf)
}

fn read_section_serde<T>(reader: &mut impl Read, len: u32) -> Result<T, NoteFileError>
where
    T: serde::de::DeserializeOwned,
{
    let buf = read_section(reader, len)?;

    let data: T = serde_json::from_slice(&buf)?;

    Ok(data)
}
