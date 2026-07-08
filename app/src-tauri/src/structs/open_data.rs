use common::structs::data::NoteData;
use serde::{Deserialize, Serialize};
use specta::Type;

#[derive(Serialize, Deserialize, Debug, Clone, Type)]
pub struct OpenData {
    pub note_data: NoteData,
    pub path: String,
}
