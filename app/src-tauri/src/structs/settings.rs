use serde::{Deserialize, Serialize};
use specta::Type;

#[derive(Clone, Debug, Type, Serialize, Deserialize)]
#[serde(default)]
pub struct Settings {
    pub sidebar_collapsed: bool,
    pub use_last_page_settings: bool,
    pub colors: Vec<String>,
}

impl Default for Settings {
    fn default() -> Self {
        Settings {
            sidebar_collapsed: false,
            use_last_page_settings: true,
            colors: vec!["#000000".into(), "#f22e2e".into(), "#55ea41".into()],
        }
    }
}
