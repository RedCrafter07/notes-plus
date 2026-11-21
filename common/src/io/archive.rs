use std::{
    collections::BTreeMap,
    ffi::OsString,
    fs::{File, rename},
    io::{Read, Seek, Write},
    path::{Path, PathBuf},
};
use thiserror::Error;
use base64::{Engine, engine::general_purpose::STANDARD as BASE64};
use zip::{CompressionMethod, ZipArchive, ZipWriter, result::ZipError, write::SimpleFileOptions};

use crate::{
    io::migrate::{CURRENT_VERSION, migrate_content, parse_version},
    structs::data::{Content, FromToBin, Meta, NoteData, State},
};

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
    #[error("The file uses format version {0}, which is newer than this app supports")]
    NewerVersion(u32),
    #[error("The provided path is not valid UTF-8")]
    InvalidPath,
    #[error("The provided file is invalid")]
    InvalidFile,
    #[error("An attachment in the note is not a valid data URL")]
    InvalidAsset,
    #[error("The attachment {0} is used by the note, but could not be found")]
    MissingAsset(String),
}

/// Archive layout (version 4):
///
/// ```text
/// version          "4", stored uncompressed
/// meta             Meta as JSON
/// data             Content as JSON
/// state            State as JSON
/// assets/index     { asset id: mime type } as JSON
/// assets/<id>      raw bytes of each attachment
/// preview          optional PNG of the first page, for file browsers
/// ```
///
/// `preview` is not part of the note's data: it is regenerated on every
/// save, and a file without one is still valid (the explorer shows an icon).
///
/// Attachments can be large (a semester of lecture PDFs), so they are never
/// all loaded at once: `asset` reads one, and a write copies them from loose
/// files or, byte for byte and still compressed as they are, from an existing
/// archive. See `AssetSources`.
pub struct Rnpf {
    file: File,
    version: u32,
}

const ASSET_INDEX: &str = "assets/index";
const PREVIEW: &str = "preview";

/// An attachment kept as a loose file (e.g. one not saved into a note yet).
#[derive(Debug, Clone)]
pub struct AssetFile {
    pub mime: String,
    pub path: PathBuf,
}

/// Where `create_from_data` finds the bytes of the attachments a note uses.
/// `files` is checked first, then `archive`.
#[derive(Clone, Copy)]
pub struct AssetSources<'a> {
    pub files: &'a BTreeMap<String, AssetFile>,
    /// An existing archive (often the file being replaced) to copy from.
    pub archive: Option<&'a Path>,
}

const NO_FILES: &BTreeMap<String, AssetFile> = &BTreeMap::new();

impl<'a> AssetSources<'a> {
    /// No attachments at all: for notes that don't use any.
    pub const NONE: AssetSources<'static> = AssetSources {
        files: NO_FILES,
        archive: None,
    };

    /// Everything from one archive, e.g. when rewriting a note's metadata.
    pub fn archive(path: &'a Path) -> Self {
        Self {
            files: NO_FILES,
            archive: Some(path),
        }
    }
}

impl Rnpf {
    pub fn new(path: &Path) -> Result<Self, RnpfError> {
        let file = File::options().read(true).open(path)?;
        let version = Self::read_version(&file)?;

        Ok(Self { file, version })
    }

    /// Writes a note atomically (temp file + rename). `preview` is the
    /// first page as a `data:image/png;base64,...` URL, if available.
    ///
    /// Every attachment the note uses is taken from `assets`; one that is in
    /// none of its sources is an error, not a silent loss. Unused ones are
    /// left out: this is where attachments get garbage-collected.
    pub fn create_from_data(
        path: &Path,
        note_data: &NoteData,
        preview: Option<&str>,
        assets: AssetSources,
    ) -> Result<(), RnpfError> {
        let tmp_path = tmp_path_for(path);
        let result = (|| -> Result<(), RnpfError> {
            // Scoped so both files are closed before the rename (Windows
            // refuses to replace a file that is still open).
            let mut source = match assets.archive {
                Some(p) if p.exists() => Some(SourceArchive::open(p)?),
                _ => None,
            };
            let file = File::options()
                .write(true)
                .create_new(true)
                .open(&tmp_path)?;

            let mut zip = ZipWriter::new(&file);

            Self::write_vec(&mut zip, "meta", &note_data.meta)?;
            Self::write_vec(&mut zip, "data", &note_data.content)?;
            Self::write_vec(&mut zip, "state", &note_data.state)?;
            Self::write_assets(&mut zip, note_data, assets.files, source.as_mut())?;
            if let Some(url) = preview {
                let (_, bytes) = decode_data_url(url)?;
                let options =
                    SimpleFileOptions::default().compression_method(CompressionMethod::Stored);
                zip.start_file(PREVIEW, options)?;
                zip.write_all(&bytes)?;
            }
            Self::write_version(&mut zip)?;

            zip.finish()?;
            Ok(())
        })();

        if let Err(e) = result.and_then(|()| rename(&tmp_path, path).map_err(RnpfError::from)) {
            let _ = std::fs::remove_file(&tmp_path);
            return Err(e);
        }

        Ok(())
    }

    /// Rewrites a note with changed metadata (title, folder), keeping its
    /// content, assets and preview. Uses the same atomic temp-file write as a
    /// save. `edited_at` is left alone: renaming or moving a note doesn't make
    /// it "recently edited".
    pub fn update_meta(path: &Path, change: impl FnOnce(&mut Meta)) -> Result<(), RnpfError> {
        let (mut data, preview) = {
            // Scoped so the file is closed before it is replaced (Windows
            // refuses to replace a file that is still open).
            let archive = Self::new(path)?;
            (archive.build_data()?, archive.get_preview())
        };

        change(&mut data.meta);
        data.meta.normalize_folder();
        Self::create_from_data(path, &data, preview.as_deref(), AssetSources::archive(path))
    }

    /// The note's data, without attachments (see `asset_index` and `asset`).
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
        let raw: serde_json::Value = self.read_data("data")?;
        let migrated = migrate_content(raw, self.version)?;

        Ok(serde_json::from_value(migrated)?)
    }

    /// The stored first-page preview as a PNG data URL, if the file has one.
    pub fn get_preview(&self) -> Option<String> {
        let mut zip = ZipArchive::new(&self.file).ok()?;
        let mut bytes = Vec::new();
        zip.by_name(PREVIEW).ok()?.read_to_end(&mut bytes).ok()?;
        Some(format!("data:image/png;base64,{}", BASE64.encode(&bytes)))
    }

    /// `{ asset id: mime type }` for every attachment listed in the file.
    pub fn asset_index(&self) -> Result<BTreeMap<String, String>, RnpfError> {
        if self.version < 3 {
            return Ok(BTreeMap::new());
        }
        match self.read_data(ASSET_INDEX) {
            Err(RnpfError::InvalidFile) => Ok(BTreeMap::new()),
            other => other,
        }
    }

    /// One attachment's bytes, or `None` if the file doesn't have it.
    pub fn asset(&self, id: &str) -> Result<Option<Vec<u8>>, RnpfError> {
        let mut zip = ZipArchive::new(&self.file)?;
        let mut bytes = Vec::new();
        match zip.by_name(&format!("assets/{id}")) {
            Ok(mut f) => f.read_to_end(&mut bytes)?,
            Err(ZipError::FileNotFound) => return Ok(None),
            Err(e) => return Err(e.into()),
        };
        Ok(Some(bytes))
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

    fn write_vec<T: serde::Serialize + ?Sized, W: Write + Seek>(
        zip: &mut ZipWriter<W>,
        file_name: &str,
        data: &T,
    ) -> Result<(), RnpfError> {
        let options = SimpleFileOptions::default().compression_method(CompressionMethod::Zstd);

        zip.start_file(file_name, options)?;
        zip.write_all(&serde_json::to_vec(data)?)?;

        Ok(())
    }

    fn write_assets<W: Write + Seek>(
        zip: &mut ZipWriter<W>,
        note_data: &NoteData,
        files: &BTreeMap<String, AssetFile>,
        mut source: Option<&mut SourceArchive>,
    ) -> Result<(), RnpfError> {
        let mut index = BTreeMap::new();
        // Images are already compressed; zstd would only cost time.
        let options = SimpleFileOptions::default().compression_method(CompressionMethod::Stored);

        for id in note_data.used_assets() {
            let name = format!("assets/{id}");

            if let Some(file) = files.get(&id) {
                zip.start_file(&name, options)?;
                std::io::copy(&mut File::open(&file.path)?, zip)?;
                index.insert(id, file.mime.clone());
                continue;
            }

            let Some(src) = source.as_deref_mut() else {
                return Err(RnpfError::MissingAsset(id));
            };
            let Some(mime) = src.index.get(&id).cloned() else {
                return Err(RnpfError::MissingAsset(id));
            };
            match src.zip.by_name_raw(name.as_bytes()) {
                Ok(entry) => zip.raw_copy_file(entry)?,
                // Listed but absent: the source was already missing it, and
                // reading skips it too. Nothing left to lose.
                Err(ZipError::FileNotFound) => continue,
                Err(e) => return Err(e.into()),
            }
            index.insert(id, mime);
        }

        Self::write_vec(zip, ASSET_INDEX, &index)
    }

    fn read_version(file: &File) -> Result<u32, RnpfError> {
        let mut archive = ZipArchive::new(file)?;
        let mut version = String::new();

        archive.by_name("version")?.read_to_string(&mut version)?;

        parse_version(&version)
    }

    fn write_version<W: Write + Seek>(zip: &mut ZipWriter<W>) -> Result<(), RnpfError> {
        let options = SimpleFileOptions::default().compression_method(CompressionMethod::Stored);

        zip.start_file("version", options)?;
        zip.write_all(CURRENT_VERSION.to_string().as_bytes())?;

        Ok(())
    }
}

/// The attachments of an existing archive, for copying into a new one.
struct SourceArchive {
    zip: ZipArchive<File>,
    /// asset id -> mime type
    index: BTreeMap<String, String>,
}

impl SourceArchive {
    fn open(path: &Path) -> Result<Self, RnpfError> {
        let rnpf = Rnpf::new(path)?;
        let index = rnpf.asset_index()?;
        Ok(Self {
            zip: ZipArchive::new(rnpf.file)?,
            index,
        })
    }
}

/// Splits `data:<mime>;base64,<payload>` into its mime type and decoded bytes.
pub fn decode_data_url(url: &str) -> Result<(&str, Vec<u8>), RnpfError> {
    let rest = url.strip_prefix("data:").ok_or(RnpfError::InvalidAsset)?;
    let (header, payload) = rest.split_once(',').ok_or(RnpfError::InvalidAsset)?;
    let mime = header
        .strip_suffix(";base64")
        .ok_or(RnpfError::InvalidAsset)?;

    let bytes = BASE64
        .decode(payload)
        .map_err(|_| RnpfError::InvalidAsset)?;

    Ok((mime, bytes))
}

fn tmp_path_for(path: &Path) -> std::path::PathBuf {
    let mut file_name = path
        .file_name()
        .map(|n| n.to_os_string())
        .unwrap_or_else(|| OsString::from("note"));

    file_name.push(format!(".tmp-{}", std::process::id()));

    path.with_file_name(file_name)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::structs::data::{Block, ImageBlock};

    #[test]
    fn decodes_data_urls() {
        let (mime, bytes) = decode_data_url("data:image/png;base64,aGk=").unwrap();
        assert_eq!(mime, "image/png");
        assert_eq!(bytes, b"hi");

        assert!(decode_data_url("image/png;base64,aGk=").is_err());
        assert!(decode_data_url("data:image/png,hi").is_err());
    }

    fn note_with_images(ids: &[&str]) -> NoteData {
        let mut note = NoteData::default();
        for id in ids {
            note.content.pages[0].layers[0]
                .blocks
                .push(Block::Image(ImageBlock {
                    id: format!("block-{id}"),
                    x: 0.0,
                    y: 0.0,
                    width: 10.0,
                    height: 10.0,
                    asset: (*id).into(),
                }));
        }
        note
    }

    struct TempDir(PathBuf);
    impl TempDir {
        fn new() -> Self {
            let dir = std::env::temp_dir().join(format!("rnpf-test-{}", uuid::Uuid::new_v4()));
            std::fs::create_dir_all(&dir).unwrap();
            Self(dir)
        }
        fn file(&self, name: &str, bytes: &[u8], mime: &str) -> (String, AssetFile) {
            let path = self.0.join(name);
            std::fs::write(&path, bytes).unwrap();
            (name.into(), AssetFile { mime: mime.into(), path })
        }
    }
    impl Drop for TempDir {
        fn drop(&mut self) {
            let _ = std::fs::remove_dir_all(&self.0);
        }
    }

    #[test]
    fn writes_used_assets_and_drops_unused_ones() {
        let dir = TempDir::new();
        let path = dir.0.join("note.rnpf");
        let files = BTreeMap::from([
            dir.file("used", b"hi", "image/png"),
            dir.file("unused", b"yo", "image/png"),
        ]);

        let note = note_with_images(&["used"]);
        let sources = AssetSources { files: &files, archive: None };
        Rnpf::create_from_data(&path, &note, Some("data:image/png;base64,aGk="), sources)
            .unwrap();

        let archive = Rnpf::new(&path).unwrap();
        assert_eq!(archive.get_preview().as_deref(), Some("data:image/png;base64,aGk="));
        assert_eq!(archive.asset_index().unwrap().len(), 1);
        assert_eq!(archive.asset("used").unwrap().as_deref(), Some(&b"hi"[..]));
        assert_eq!(archive.asset("unused").unwrap(), None);

        Rnpf::update_meta(&path, |m| {
            m.title = "Renamed".into();
            m.folder = Some("/Uni//Physics/".into());
        })
        .unwrap();
        let archive = Rnpf::new(&path).unwrap();
        let updated = archive.build_data().unwrap();
        assert_eq!(updated.meta.title, "Renamed");
        assert_eq!(updated.meta.folder.as_deref(), Some("Uni/Physics"), "normalised");
        assert_eq!(archive.asset("used").unwrap().as_deref(), Some(&b"hi"[..]), "kept");
        assert!(archive.get_preview().is_some(), "preview kept");
    }

    #[test]
    fn copies_assets_from_the_source_archive() {
        let dir = TempDir::new();
        let path = dir.0.join("note.rnpf");

        let files = BTreeMap::from([dir.file("a", b"hi", "image/png")]);
        let sources = AssetSources { files: &files, archive: None };
        Rnpf::create_from_data(&path, &note_with_images(&["a"]), None, sources).unwrap();

        // A later save: "b" is new (a loose file), "a" comes from the archive.
        let files = BTreeMap::from([dir.file("b", b"yo", "image/jpeg")]);
        let sources = AssetSources { files: &files, archive: Some(&path) };
        Rnpf::create_from_data(&path, &note_with_images(&["a", "b"]), None, sources).unwrap();

        let archive = Rnpf::new(&path).unwrap();
        assert_eq!(archive.asset("a").unwrap().as_deref(), Some(&b"hi"[..]), "copied");
        assert_eq!(archive.asset("b").unwrap().as_deref(), Some(&b"yo"[..]), "from file");
        assert_eq!(archive.asset_index().unwrap()["b"], "image/jpeg");

        // Used, but in none of the sources: refuse rather than lose it.
        let note = note_with_images(&["a", "c"]);
        let err = Rnpf::create_from_data(&path, &note, None, AssetSources::archive(&path))
            .unwrap_err();
        assert!(matches!(err, RnpfError::MissingAsset(id) if id == "c"));
        assert_eq!(
            Rnpf::new(&path).unwrap().asset_index().unwrap().len(),
            2,
            "a failed save leaves the file as it was"
        );
        let leftovers = std::fs::read_dir(&dir.0)
            .unwrap()
            .filter(|e| e.as_ref().unwrap().file_name().to_string_lossy().contains(".tmp-"))
            .count();
        assert_eq!(leftovers, 0, "no temp file left behind");
    }
}
