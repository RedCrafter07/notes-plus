use serde::{Deserialize, Serialize};
use specta::Type;

use crate::structs::data::{Layer, NoteData, Page};

#[derive(Debug, Clone, Serialize, Deserialize, Type, Default)]
pub struct Defaults {
    page: Page,
    layer: Layer,
    note: NoteData,
}

// TODO: Implement a function for deriving the defaults from user configuration
impl Defaults {
    pub fn new() -> Self {
        Defaults::default()
    }
}
