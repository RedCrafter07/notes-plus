use std::{
    collections::HashMap,
    fs::{self, File},
    io::{Read, Write},
    path::Path,
};

use flate2::{Compression, read::GzDecoder, write::GzEncoder};

use crate::structs::{file_data::Note, file_meta::FileMeta};

#[derive(Debug)]
pub enum ReadError {
    StdError(std::io::Error),
    DecodeError(rmp_serde::decode::Error),
    ConversionError(std::string::FromUtf8Error),
    HeaderError,
}

impl From<std::io::Error> for ReadError {
    fn from(value: std::io::Error) -> Self {
        ReadError::StdError(value)
    }
}

impl From<rmp_serde::decode::Error> for ReadError {
    fn from(value: rmp_serde::decode::Error) -> Self {
        ReadError::DecodeError(value)
    }
}

impl From<std::string::FromUtf8Error> for ReadError {
    fn from(value: std::string::FromUtf8Error) -> Self {
        ReadError::ConversionError(value)
    }
}

pub fn read(path: &str, attachment_dir: &str) -> Result<(), ReadError> {
    let file = File::options().read(true).open(path)?;

    let mut decoder = GzDecoder::new(file);

    let mut header = [0_u8; 8];
    decoder.read_exact(&mut header)?;

    if &header != b"REDNOTE+" {
        return Err(ReadError::HeaderError);
    }

    let mut version = [0_u8; 2];
    decoder.read_exact(&mut version)?;
    let version_string = format!("{}.{}", version[0], version[1]);
    println!("{version_string}");

    let mut meta_len = [0_u8; 4];
    decoder.read_exact(&mut meta_len)?;
    let meta_len = u32::from_le_bytes(meta_len);

    let mut meta = vec![0_u8; meta_len as usize];
    decoder.read_exact(&mut meta)?;
    let meta = rmp_serde::from_slice::<FileMeta>(&meta)?;

    loop {
        let mut id_length_bytes = [0_u8; 4];
        let id_length = match decoder.read_exact(&mut id_length_bytes) {
            Err(_) => {
                break;
            }
            Ok(_) => u32::from_le_bytes(id_length_bytes),
        };

        println!("ID Length: {id_length}");

        let mut id = vec![0_u8; id_length as usize];
        decoder.read_exact(&mut id)?;

        let id = String::from_utf8(id)?;

        let filename = meta.attachments.get(&id);

        println!("Filename: {filename:?}");

        if filename.is_none() {
            break;
        }

        let mut attachment_length = [0_u8; 4];
        decoder.read_exact(&mut attachment_length)?;
        let attachment_length = u32::from_le_bytes(attachment_length);

        let mut attachment = vec![0_u8; attachment_length as usize];
        decoder.read_exact(&mut attachment)?;

        let file_path = Path::new(attachment_dir).join(filename.unwrap());

        let mut file = File::options()
            .create(true)
            .write(true)
            .truncate(true)
            .open(file_path)?;

        file.write_all(&attachment)?;
    }

    Ok(())
}

pub fn write(
    path: &str,
    note: Note,
    attachment_input: Vec<(String, String)>, // path/id
) -> Result<(), Box<dyn std::error::Error>> {
    let file = File::options()
        .write(true)
        .create(true)
        .truncate(true)
        .open(path)?;

    let mut encoder = GzEncoder::new(file, Compression::fast());

    encoder.write_all(b"REDNOTE+")?;
    encoder.write_all(&[0x01, 0x00])?;

    let mut name_map: HashMap<String, String> = HashMap::new();

    for (file_path, id) in attachment_input.clone() {
        let path = Path::new(&file_path);
        path.metadata()?; // Check if the file exists

        name_map.insert(
            id.to_string(),
            path.file_name().unwrap().to_str().unwrap().to_string(),
        );
    }

    let meta = FileMeta {
        note,
        attachments: name_map,
    };

    let encoded_meta = rmp_serde::to_vec(&meta)?;
    let meta_length = u32::to_le_bytes(encoded_meta.len() as u32);

    encoder.write_all(&meta_length)?;
    encoder.write_all(&encoded_meta)?;

    for (file_path, id) in attachment_input {
        let id_as_bytes = id.as_bytes();
        let id_size = u32::to_le_bytes(id_as_bytes.len() as u32);

        let file_bytes = fs::read(file_path)?;
        let file_size = u32::to_le_bytes(file_bytes.len() as u32);

        encoder.write_all(&id_size)?;
        encoder.write_all(id_as_bytes)?;
        encoder.write_all(&file_size)?;
        encoder.write_all(&file_bytes)?;
    }

    encoder.finish()?;

    Ok(())
}
