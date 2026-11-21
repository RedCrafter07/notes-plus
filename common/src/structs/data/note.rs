use std::collections::BTreeMap;

use serde::{Deserialize, Serialize};
use specta::Type;

use crate::structs::data::{Content, Layer, Meta, Page, State};

#[derive(Debug, Clone, Serialize, Deserialize, Type, Default)]
pub struct NoteData {
    pub meta: Meta,
    pub content: Content,
    pub state: State,
    /// Binary attachments (images, PDF page renders) as `data:` URLs, keyed by
    /// asset id. Stored as raw files under `assets/` inside the archive.
    ///
    /// Loading fills it completely. Saving only needs the attachments the
    /// target file doesn't hold yet: the others are copied from it, so they
    /// don't cross IPC as base64 on every autosave.
    pub assets: BTreeMap<String, String>,
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

        // Drop assets nothing refers to. Done here (at load/save time) rather than
        // on delete, so undo can still restore a block whose asset was "removed".
        let used = self.used_assets();
        self.assets.retain(|id, _| used.contains(id.as_str()));

        // Add layer if no layer is present
        for page in &mut self.content.pages {
            if page.layers.is_empty() {
                page.layers.push(Layer::default());
            }
        }
    }

    pub fn used_assets(&self) -> std::collections::BTreeSet<String> {
        let mut used = std::collections::BTreeSet::new();
        for page in &self.content.pages {
            if let Some(a) = &page.background_asset {
                used.insert(a.clone());
            }
            for layer in &page.layers {
                for block in &layer.blocks {
                    if let Some(a) = block.asset() {
                        used.insert(a.to_string());
                    }
                }
            }
        }
        used
    }
}
