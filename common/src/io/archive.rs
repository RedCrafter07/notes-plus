use sevenz_rust2::{ArchiveEntry, ArchiveReader, ArchiveWriter, Password};
use std::{ffi::OsString, fs::rename, path::Path};

// TODO: Add functionality and attachment support
// pub fn add_attachment() {}
pub fn create_with_data(note_data: &[u8], path: &Path) -> anyhow::Result<()> {
    let tmp_path = tmp_path_for(path);

    let mut archive_writer = ArchiveWriter::create(&tmp_path)?;
    archive_writer.push_archive_entry(ArchiveEntry::new_file("data"), Some(note_data))?;
    archive_writer.finish()?;

    if let Err(e) = rename(&tmp_path, path) {
        std::fs::remove_file(&tmp_path)?;

        return Err(e.into());
    };

    Ok(())
}

pub fn open_data(path: &Path) -> Result<Vec<u8>, sevenz_rust2::Error> {
    let mut archive_reader = ArchiveReader::open(path, Password::empty())?;

    let file_content = archive_reader.read_file("data")?;

    Ok(file_content)
}

fn tmp_path_for(path: &Path) -> std::path::PathBuf {
    let mut file_name = path
        .file_name()
        .map(|n| n.to_os_string())
        .unwrap_or_else(|| OsString::from("note"));

    file_name.push(format!(".tmp-{}", std::process::id()));

    path.with_file_name(file_name)
}
