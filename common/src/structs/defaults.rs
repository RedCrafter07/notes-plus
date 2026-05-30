use serde::{Deserialize, Serialize};
use specta::Type;

use crate::structs::note::{Layer, Page};

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct Defaults {
    page: Page,
    layer: Layer,
}

impl Default for Defaults {
    fn default() -> Self {
        Defaults::new()
    }
}

// TODO: Implement a function for deriving the defaults from user configuration
impl Defaults {
    pub fn new() -> Self {
        Defaults {
            page: Page::default(),
            layer: Layer::default(),
        }
    }
}
