use sevenz_rust2::{ArchiveEntry, ArchiveReader, ArchiveWriter, Password};
use std::path::Path;

// TODO: Add functionality and attachment support
// pub fn add_attachment() {}
pub fn create_with_data(note_data: &[u8], path: &Path) -> Result<(), sevenz_rust2::Error> {
    let mut archive_writer = ArchiveWriter::create(&path)?;

    archive_writer.push_archive_entry(ArchiveEntry::new_file("data"), Some(note_data))?;

    archive_writer.finish()?;

    Ok(())
}

pub fn open_data(path: &Path) -> Result<Vec<u8>, sevenz_rust2::Error> {
    let mut archive_reader = ArchiveReader::open(path, Password::empty())?;

    let file_content = archive_reader.read_file("data")?;

    Ok(file_content)
}
