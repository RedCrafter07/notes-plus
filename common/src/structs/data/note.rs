use serde::{Deserialize, Serialize};
use specta::Type;

use crate::structs::data::{Content, Layer, Meta, Page, State};

#[derive(Debug, Clone, Serialize, Deserialize, Type, Default)]
pub struct NoteData {
    pub meta: Meta,
    pub content: Content,
    pub state: State,
}

impl NoteData {
    pub fn normalize(&mut self) {
        if self.content.pages.is_empty() {
            self.state.current_page = 0;
            self.content.pages.push(Page::default());
        }

        if self.state.current_page as usize >= self.content.pages.len() {
            self.state.current_page = 0;
        }
        if self.state.current_layer as usize
            >= self.content.pages[self.state.current_page as usize]
                .layers
                .len()
        {
            self.state.current_layer = 0;
        }

        if !self.state.pan_x.is_finite() {
            self.state.pan_x = 0.0;
        }
        if !self.state.pan_y.is_finite() {
            self.state.pan_y = 0.0;
        }
        if !self.state.zoom.is_finite() || self.state.zoom <= 0.0 {
            self.state.zoom = 1.0;
        }

        // Add layer if no layer is present
        for page in &mut self.content.pages {
            if page.layers.is_empty() {
                page.layers.push(Layer::default());
            }
        }
    }
}
