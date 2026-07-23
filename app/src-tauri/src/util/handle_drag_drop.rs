use std::path::PathBuf;

use common::util::is_rnpf;
use tauri::{AppHandle, DragDropEvent};
use tauri_specta::Event;

use crate::{commands::open_and_emit, events::DragDropFileEvent};

pub fn handle_drag_drop(handle: &AppHandle, event: &DragDropEvent) {
    match event {
        DragDropEvent::Drop { paths, .. } => {
            let rnpf: Vec<PathBuf> = paths.iter().filter(is_rnpf).cloned().collect();

            if !rnpf.is_empty() {
                open_and_emit(handle, &rnpf);
            }

            DragDropFileEvent(0).emit(handle).ok();
        }
        DragDropEvent::Enter { paths, .. } => {
            let length = paths.iter().filter(is_rnpf).count();

            DragDropFileEvent(length as u32).emit(handle).ok();
        }
        DragDropEvent::Leave => {
            DragDropFileEvent(0).emit(handle).ok();
        }
        _ => (),
    };
}
