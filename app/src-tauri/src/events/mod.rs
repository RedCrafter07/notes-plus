use serde::{Deserialize, Serialize};
use specta::Type;
use tauri_specta::Event;

use crate::structs::{OpenData, Settings};

#[derive(Serialize, Deserialize, Debug, Clone, Type, Event)]
pub struct JotDown(pub Vec<String>);

#[derive(Serialize, Deserialize, Debug, Clone, Type, Event)]
pub struct Open(pub OpenData);

#[derive(Serialize, Deserialize, Debug, Clone, Type, Event)]
pub struct SettingsUpdate(pub Settings);
