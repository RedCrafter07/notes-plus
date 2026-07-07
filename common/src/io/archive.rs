use std::{
    ffi::OsString,
    fs::{File, rename},
    io::{Read, Write},
    path::Path,
};
use zip::{CompressionMethod, ZipArchive, ZipWriter, write::SimpleFileOptions};

// TODO: Add attachment support

pub fn create_with_data(note_data: &[u8], path: &Path) -> anyhow::Result<()> {
    let tmp_path = tmp_path_for(path);
    let file = File::options()
        .write(true)
        .create_new(true)
        .open(&tmp_path)?;

    let options = SimpleFileOptions::default().compression_method(CompressionMethod::Zstd);
    let mut zip = ZipWriter::new(file);

    zip.start_file("data", options)?;
    zip.write_all(note_data)?;
    zip.finish()?;

    if let Err(e) = rename(&tmp_path, path) {
        std::fs::remove_file(&tmp_path)?;

        return Err(e.into());
    };

    Ok(())
}

pub fn open_data(path: &Path) -> anyhow::Result<Vec<u8>> {
    let mut zip = ZipArchive::new(File::open(path)?)?;

    let mut data = zip.by_name("data")?;

    let mut file_content = Vec::new();
    data.read_to_end(&mut file_content)?;

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
