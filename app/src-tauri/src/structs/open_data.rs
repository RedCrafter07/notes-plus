use common::structs::note::NoteData;
use serde::{Deserialize, Serialize};
use specta::Type;

#[derive(Serialize, Deserialize, Debug, Clone, Type)]
pub struct OpenData {
    pub note_data: NoteData,
    pub path: String,
}
