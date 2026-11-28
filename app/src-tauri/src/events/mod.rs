use serde::{Deserialize, Serialize};
use specta::Type;
use tauri_specta::Event;

use crate::{
    structs::{OpenData, Settings},
    util::dialog::DialogData,
};

#[derive(Serialize, Deserialize, Debug, Clone, Type, Event)]
pub struct Open(pub OpenData);

#[derive(Serialize, Deserialize, Debug, Clone, Type, Event)]
pub struct SettingsUpdate(pub Settings);

#[derive(Serialize, Deserialize, Debug, Clone, Type, Event)]
pub struct DialogEvent(pub DialogData);

/// Files being dragged over the window (both zero when they leave or drop).
#[derive(Serialize, Deserialize, Debug, Clone, Type, Event)]
pub struct DragDropFileEvent {
    /// `.rnpf` notes, which a drop opens.
    pub notebooks: u32,
    /// Images and PDFs, which a drop adds to the open note.
    pub attachments: u32,
}

/// One dropped image or PDF, copied into `DroppedFiles::session`.
#[derive(Serialize, Deserialize, Debug, Clone, Type)]
pub struct DroppedFile {
    pub id: String,
    pub name: String,
    pub mime: String,
}

/// Images and PDFs dropped on the window. Their bytes wait in a temporary
/// asset session (served by `rnasset://`), which the frontend closes once it
/// has taken them. `x`/`y` is the drop point in CSS pixels of the window.
#[derive(Serialize, Deserialize, Debug, Clone, Type, Event)]
pub struct DroppedFiles {
    pub session: String,
    pub files: Vec<DroppedFile>,
    pub x: f64,
    pub y: f64,
}

/// The audience window was closed (by Escape, the window manager, or Stop).
#[derive(Serialize, Deserialize, Debug, Clone, Type, Event)]
pub struct PresentEnded;
