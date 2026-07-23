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

#[derive(Serialize, Deserialize, Debug, Clone, Type, Event)]
pub struct DragDropFileEvent(pub u32);
