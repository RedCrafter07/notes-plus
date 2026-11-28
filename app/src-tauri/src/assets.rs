//! Attachments (images, PDF page renders) of the notes open in tabs.
//!
//! They can add up to hundreds of MB, so they never travel to the frontend
//! as data and are never all in memory. The webviews load each one by URL
//! (`rnasset://localhost/<session>/<asset id>`, see `respond`), and Rust
//! reads it on demand from where it lives:
//!
//! - in the note's file, for attachments it was saved with, or
//! - in a cache file (`<app cache>/assets/<session>/<id>`), for new ones
//!   (`add`) and for ones a save dropped from the file because nothing used
//!   them any more, which undo may still bring back.
//!
//! Each open tab has a session: its id is in the URLs and in every save, so
//! saving needs no attachment data from the frontend at all.

use std::{
    collections::{BTreeMap, HashMap},
    fs,
    path::{Path, PathBuf},
    sync::{Arc, Mutex},
};

use common::{
    io::archive::{AssetFile, AssetSources, Rnpf, RnpfError, decode_data_url},
    structs::data::NoteData,
};
use tauri::http::{Request, Response, StatusCode, header};

pub const SCHEME: &str = "rnasset";

pub struct AssetStore {
    cache: PathBuf,
    sessions: Mutex<HashMap<String, Arc<Mutex<Session>>>>,
}

#[derive(Default)]
struct Session {
    /// The note's file, once it has one.
    file: Option<PathBuf>,
    /// What `file` holds: asset id -> mime type.
    in_file: BTreeMap<String, String>,
    /// Attachments held in cache files. Checked before `file`.
    cached: BTreeMap<String, AssetFile>,
}

/// Where to read one attachment from, taken under the lock and read without.
enum Location {
    Cache(AssetFile),
    File(PathBuf, String),
}

/// Ids end up in file paths and URLs, so they must be plain.
fn valid_id(id: &str) -> Result<&str, RnpfError> {
    let ok = !id.is_empty()
        && id.len() <= 64
        && id.chars().all(|c| c.is_ascii_alphanumeric() || c == '-');
    ok.then_some(id).ok_or(RnpfError::InvalidAsset)
}

impl AssetStore {
    /// Starts with an empty cache: whatever a previous run left there
    /// belonged to notes that were never saved.
    pub fn new(cache: PathBuf) -> Self {
        let _ = fs::remove_dir_all(&cache);
        Self {
            cache,
            sessions: Mutex::default(),
        }
    }

    /// The session, created empty on first use (new notes get their id from
    /// the frontend and only reach Rust once they gain an attachment or are
    /// saved).
    fn session(&self, id: &str) -> Result<Arc<Mutex<Session>>, RnpfError> {
        valid_id(id)?;
        let mut sessions = self.sessions.lock().unwrap();
        Ok(sessions.entry(id.to_string()).or_default().clone())
    }

    /// A session for a note opened from `file`. Returns its id.
    pub fn open(&self, file: &Path, archive: &Rnpf) -> Result<String, RnpfError> {
        let id = uuid::Uuid::new_v4().to_string();
        let session = Session {
            file: Some(file.to_path_buf()),
            in_file: archive.asset_index()?,
            cached: BTreeMap::new(),
        };
        self.sessions
            .lock()
            .unwrap()
            .insert(id.clone(), Arc::new(Mutex::new(session)));
        Ok(id)
    }

    /// Forgets a session (its tab was closed) and deletes its cache files.
    pub fn close(&self, session: &str) {
        if valid_id(session).is_err() {
            return;
        }
        self.sessions.lock().unwrap().remove(session);
        let _ = fs::remove_dir_all(self.cache.join(session));
    }

    fn cache_file(&self, session: &str, id: &str, mime: &str, bytes: &[u8]) -> Result<AssetFile, RnpfError> {
        let dir = self.cache.join(session);
        fs::create_dir_all(&dir)?;
        let path = dir.join(id);
        fs::write(&path, bytes)?;
        Ok(AssetFile {
            mime: mime.to_string(),
            path,
        })
    }

    /// Stores a new attachment, sent once as a data URL when it is added.
    pub fn add(&self, session: &str, id: &str, data_url: &str) -> Result<(), RnpfError> {
        valid_id(id)?;
        let (mime, bytes) = decode_data_url(data_url)?;
        let file = self.cache_file(session, id, mime, &bytes)?;
        self.session(session)?
            .lock()
            .unwrap()
            .cached
            .insert(id.to_string(), file);
        Ok(())
    }

    /// Copies attachments from one session into another's cache (pages
    /// copied between notes). Ids stay the same; they are UUIDs. Returns the
    /// ids `from` does not have.
    pub fn copy(&self, from: &str, to: &str, ids: &[String]) -> Result<Vec<String>, RnpfError> {
        let mut missing = Vec::new();
        for id in ids {
            let Some((mime, bytes)) = self.read(from, id)? else {
                missing.push(id.clone());
                continue;
            };
            let file = self.cache_file(to, id, &mime, &bytes)?;
            self.session(to)?.lock().unwrap().cached.insert(id.clone(), file);
        }
        Ok(missing)
    }

    /// Stores a file from disk (a dropped image or PDF) without sending it
    /// through the webview.
    pub fn add_file(&self, session: &str, id: &str, path: &Path, mime: &str) -> Result<(), RnpfError> {
        valid_id(id)?;
        let dir = self.cache.join(session);
        fs::create_dir_all(&dir)?;
        let target = dir.join(id);
        fs::copy(path, &target)?;
        let file = AssetFile {
            mime: mime.to_string(),
            path: target,
        };
        self.session(session)?.lock().unwrap().cached.insert(id.to_string(), file);
        Ok(())
    }

    /// One attachment's mime type and bytes, if the session has it.
    pub fn read(&self, session: &str, id: &str) -> Result<Option<(String, Vec<u8>)>, RnpfError> {
        valid_id(id)?;
        let location = {
            let s = self.session(session)?;
            let s = s.lock().unwrap();
            if let Some(f) = s.cached.get(id) {
                Location::Cache(f.clone())
            } else if let (Some(file), Some(mime)) = (&s.file, s.in_file.get(id)) {
                Location::File(file.clone(), mime.clone())
            } else {
                return Ok(None);
            }
        };

        Ok(match location {
            Location::Cache(f) => Some((f.mime, fs::read(f.path)?)),
            Location::File(path, mime) => Rnpf::new(&path)?.asset(id)?.map(|b| (mime, b)),
        })
    }

    /// Writes the session's note to `path` (its own file, a new one for a
    /// first save, or another one for Save As), with every attachment it uses.
    pub fn save(
        &self,
        session: &str,
        path: &Path,
        note: &NoteData,
        preview: Option<&str>,
    ) -> Result<(), RnpfError> {
        let s = self.session(session)?;
        let mut s = s.lock().unwrap();
        let used = note.used_assets();

        // Attachments nothing uses any more are left out of the new file.
        // Keep a copy, so undo can still bring back what used them.
        if let Some(file) = s.file.clone() {
            let dropped: Vec<(String, String)> = s
                .in_file
                .iter()
                .filter(|(id, _)| !used.contains(*id) && !s.cached.contains_key(*id))
                .map(|(id, mime)| (id.clone(), mime.clone()))
                .collect();
            if !dropped.is_empty() {
                let archive = Rnpf::new(&file)?;
                for (id, mime) in dropped {
                    if let Some(bytes) = archive.asset(&id)? {
                        let f = self.cache_file(session, &id, &mime, &bytes)?;
                        s.cached.insert(id, f);
                    }
                }
            }
        }

        let sources = AssetSources {
            files: &s.cached,
            archive: s.file.as_deref(),
        };
        Rnpf::create_from_data(path, note, preview, sources)?;

        // `path` now holds every used attachment: those no longer need a
        // cache file.
        let mut in_file = BTreeMap::new();
        for id in used {
            let mime = match s.cached.remove(&id) {
                Some(f) => {
                    let _ = fs::remove_file(&f.path);
                    f.mime
                }
                None => match s.in_file.get(&id) {
                    Some(m) => m.clone(),
                    None => continue,
                },
            };
            in_file.insert(id, mime);
        }
        s.in_file = in_file;
        s.file = Some(path.to_path_buf());
        Ok(())
    }

    /// Answers `rnasset://localhost/<session>/<asset id>`.
    pub fn respond(&self, request: &Request<Vec<u8>>) -> Response<Vec<u8>> {
        let path = request.uri().path().trim_start_matches('/');
        let found = path
            .split_once('/')
            .map(|(session, id)| self.read(session, id));

        let response = Response::builder()
            // The editor's origin differs from this scheme's; canvases that
            // draw these images must stay exportable (toDataURL).
            .header(header::ACCESS_CONTROL_ALLOW_ORIGIN, "*");
        match found {
            Some(Ok(Some((mime, bytes)))) => response
                .header(header::CONTENT_TYPE, mime)
                // An id's content never changes, and sessions are not reused.
                .header(header::CACHE_CONTROL, "max-age=31536000, immutable")
                .body(bytes),
            Some(Err(e)) => response
                .status(StatusCode::INTERNAL_SERVER_ERROR)
                .body(e.to_string().into_bytes()),
            _ => response.status(StatusCode::NOT_FOUND).body(Vec::new()),
        }
        .unwrap_or_else(|_| Response::new(Vec::new()))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use common::structs::data::{Block, ImageBlock};

    fn note_with_images(ids: &[&str]) -> NoteData {
        let mut note = NoteData::default();
        for id in ids {
            note.content.pages[0].layers[0].blocks.push(Block::Image(ImageBlock {
                id: format!("block-{id}"),
                x: 0.0,
                y: 0.0,
                width: 1.0,
                height: 1.0,
                asset: (*id).into(),
            }));
        }
        note
    }

    #[test]
    fn keeps_dropped_attachments_for_undo() {
        let dir = std::env::temp_dir().join(format!("assets-test-{}", uuid::Uuid::new_v4()));
        let store = AssetStore::new(dir.join("cache"));
        fs::create_dir_all(&dir).unwrap();
        let path = dir.join("note.rnpf");
        let png = "data:image/png;base64,aGk=";

        store.add("s1", "a", png).unwrap();
        store.add("s1", "b", png).unwrap();
        store.save("s1", &path, &note_with_images(&["a", "b"]), None).unwrap();
        assert!(!dir.join("cache/s1/a").exists(), "saved, so no cache file");
        assert_eq!(store.read("s1", "a").unwrap().unwrap().1, b"hi", "served from the file");

        // "b" deleted: the file drops it, the session keeps it.
        store.save("s1", &path, &note_with_images(&["a"]), None).unwrap();
        assert_eq!(Rnpf::new(&path).unwrap().asset("b").unwrap(), None);
        assert_eq!(store.read("s1", "b").unwrap().unwrap().1, b"hi");

        // Undo: "b" is used again and goes back into the file.
        store.save("s1", &path, &note_with_images(&["a", "b"]), None).unwrap();
        assert_eq!(Rnpf::new(&path).unwrap().asset("b").unwrap().as_deref(), Some(&b"hi"[..]));

        // Reopened in a new session, everything is served from the file.
        let s2 = store.open(&path, &Rnpf::new(&path).unwrap()).unwrap();
        assert_eq!(store.read(&s2, "b").unwrap().unwrap().0, "image/png");

        // Copied into another session (pages pasted into another note):
        // served from there, and saved with that note.
        let missing = store.copy(&s2, "s3", &["a".into(), "nope".into()]).unwrap();
        assert_eq!(missing, vec!["nope".to_string()]);
        assert_eq!(store.read("s3", "a").unwrap().unwrap().1, b"hi");
        let other = dir.join("other.rnpf");
        store.save("s3", &other, &note_with_images(&["a"]), None).unwrap();
        assert_eq!(Rnpf::new(&other).unwrap().asset("a").unwrap().as_deref(), Some(&b"hi"[..]));

        store.close("s1");
        assert!(!dir.join("cache/s1").exists());
        assert!(store.read("../x", "a").is_err(), "ids are validated");
        fs::remove_dir_all(dir).unwrap();
    }
}
