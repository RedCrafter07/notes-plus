use std::path::{Path, PathBuf};

use common::util::is_rnpf;
use tauri::{DragDropEvent, Manager, Window};
use tauri_specta::Event;

use crate::{
    assets::AssetStore,
    commands::open_and_emit,
    events::{DragDropFileEvent, DroppedFile, DroppedFiles},
    util::display_error,
};

/// The mime type of a file a drop can add to a note: an image or a PDF.
pub(crate) fn attachment_mime(path: &Path) -> Option<&'static str> {
    let ext = path.extension()?.to_str()?.to_ascii_lowercase();
    Some(match ext.as_str() {
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "gif" => "image/gif",
        "webp" => "image/webp",
        "bmp" => "image/bmp",
        "svg" => "image/svg+xml",
        "pdf" => "application/pdf",
        _ => return None,
    })
}

fn counts(paths: &[PathBuf]) -> DragDropFileEvent {
    DragDropFileEvent {
        notebooks: paths.iter().filter(|p| is_rnpf(p)).count() as u32,
        attachments: paths.iter().filter(|p| attachment_mime(p).is_some()).count() as u32,
    }
}

const NONE: DragDropFileEvent = DragDropFileEvent { notebooks: 0, attachments: 0 };

/// Notes dropped on the window open; images and PDFs go to the editor
/// (`DroppedFiles`), copied into a temporary asset session first.
pub fn handle_drag_drop(window: &Window, event: &DragDropEvent) {
    // The audience window shows a page; nothing can be dropped there.
    if window.label() == crate::commands::AUDIENCE {
        return;
    }
    let handle = window.app_handle();
    match event {
        DragDropEvent::Drop { paths, position } => {
            NONE.emit(handle).ok();

            let rnpf: Vec<PathBuf> = paths.iter().filter(|p| is_rnpf(p)).cloned().collect();
            if !rnpf.is_empty() {
                open_and_emit(handle, &rnpf);
            }

            let attachments: Vec<(PathBuf, &str)> = paths
                .iter()
                .filter_map(|p| attachment_mime(p).map(|m| (p.clone(), m)))
                .collect();
            if attachments.is_empty() {
                return;
            }
            let scale = window.scale_factor().unwrap_or(1.0);
            let (x, y) = (position.x / scale, position.y / scale);
            let handle = handle.clone();
            // Copying a large PDF must not hold up the window's event loop.
            tauri::async_runtime::spawn_blocking(move || {
                let store = handle.state::<AssetStore>();
                let session = format!("drop-{}", uuid::Uuid::new_v4());
                let mut files = Vec::new();
                for (path, mime) in attachments {
                    let id = uuid::Uuid::new_v4().to_string();
                    match store.add_file(&session, &id, &path, mime) {
                        Ok(()) => files.push(DroppedFile {
                            id,
                            name: path.file_name().map(|n| n.to_string_lossy().into_owned()).unwrap_or_default(),
                            mime: mime.to_string(),
                        }),
                        Err(e) => display_error(e.into()),
                    }
                }
                if !files.is_empty() {
                    DroppedFiles { session, files, x, y }.emit(&handle).ok();
                }
            });
        }
        DragDropEvent::Enter { paths, .. } => {
            counts(paths).emit(handle).ok();
        }
        DragDropEvent::Leave => {
            NONE.emit(handle).ok();
        }
        _ => (),
    };
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn recognises_images_and_pdfs() {
        assert_eq!(attachment_mime(Path::new("C:/x/Scan.PDF")), Some("application/pdf"));
        assert_eq!(attachment_mime(Path::new("photo.JPEG")), Some("image/jpeg"));
        assert_eq!(attachment_mime(Path::new("note.rnpf")), None);
        assert_eq!(attachment_mime(Path::new("README")), None);
    }

    #[test]
    fn copies_a_dropped_file_into_a_session() {
        let dir = std::env::temp_dir().join(format!("drop-test-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&dir).unwrap();
        let src = dir.join("diagram.png");
        std::fs::write(&src, b"png bytes").unwrap();
        let store = AssetStore::new(dir.join("cache"));
        store.add_file("drop-1", "a1", &src, "image/png").unwrap();
        let (mime, bytes) = store.read("drop-1", "a1").unwrap().unwrap();
        assert_eq!((mime.as_str(), bytes.as_slice()), ("image/png", &b"png bytes"[..]));
        assert!(src.exists(), "the dropped file itself is left alone");
        store.close("drop-1");
        std::fs::remove_dir_all(dir).unwrap();
    }
}
