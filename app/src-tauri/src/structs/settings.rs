use serde::{Deserialize, Serialize};
use specta::Type;

#[derive(Clone, Debug, Type, Serialize, Deserialize)]
pub struct Settings {
    pub sidebar_collapsed: bool,
}

impl Default for Settings {
    fn default() -> Self {
        Settings {
            sidebar_collapsed: false,
        }
    }
}
