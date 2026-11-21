use serde::{Deserialize, Serialize};
use specta::Type;

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct State {
    pub zoom: f32,
    pub pan_x: f32,
    pub pan_y: f32,
    pub current_page: u32,
    pub current_layer: u32,
    /// Sections folded away in the page list and overview, by section id.
    /// Absent in files from before sections existed.
    #[serde(default)]
    pub collapsed_sections: Vec<String>,
}

impl Default for State {
    fn default() -> Self {
        Self {
            zoom: 1.0,
            pan_x: 0.0,
            pan_y: 0.0,
            current_page: 0,
            current_layer: 0,
            collapsed_sections: Vec::new(),
        }
    }
}
