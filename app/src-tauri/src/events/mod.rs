use common::structs::note::NoteData;
use serde::{Deserialize, Serialize};
use specta::Type;
use tauri_specta::Event;

#[derive(Serialize, Deserialize, Debug, Clone, Type, Event)]
pub struct JotDown(pub Vec<String>);

#[derive(Serialize, Deserialize, Debug, Clone, Type, Event)]
pub struct Open(pub NoteData);
