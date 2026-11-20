use serde::{Deserialize, Serialize};
use specta::Type;

#[derive(Clone, Debug, Type, Serialize, Deserialize)]
#[serde(default)]
pub struct Settings {
    pub sidebar_collapsed: bool,
    pub use_last_page_settings: bool,
    /// Swatches for the pen and text tools.
    pub colors: Vec<String>,
    /// Swatches for the highlighter, which has its own set (like OneNote).
    pub highlighter_colors: Vec<String>,
    pub shift_swaps_scroll_axes: bool,
    pub disable_tool_switch: bool,
    /// Save open notes automatically a moment after each change.
    pub autosave: bool,
}

impl Default for Settings {
    fn default() -> Self {
        Settings {
            sidebar_collapsed: false,
            use_last_page_settings: true,
            colors: vec!["#000000".into(), "#f22e2e".into(), "#55ea41".into()],
            highlighter_colors: ["#ffe600", "#7ae25b", "#4cd6ff", "#ff6fb5", "#ff9f40"]
                .map(String::from)
                .to_vec(),
            shift_swaps_scroll_axes: true,
            disable_tool_switch: false,
            autosave: true,
        }
    }
}
