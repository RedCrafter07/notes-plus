use serde::{Deserialize, Serialize};
use specta::Type;

use crate::structs::data::{Content, Layer, Meta, Page, State};

#[derive(Debug, Clone, Serialize, Deserialize, Type, Default)]
pub struct NoteData {
    pub meta: Meta,
    pub content: Content,
    pub state: State,
    // Binary attachments (images, PDF page renders) are not part of this:
    // they can be hundreds of MB, so they stay in the archive (`assets/<id>`)
    // or a cache file, and the frontend loads them by URL. Blocks and pages
    // refer to them by id; see `used_assets`.
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

        // Page ids must be unique (a hand-edited or merged file might repeat one).
        let mut seen = std::collections::HashSet::new();
        for page in &mut self.content.pages {
            if page.id.is_empty() || !seen.insert(page.id.clone()) {
                page.id = uuid::Uuid::new_v4().to_string();
                seen.insert(page.id.clone());
            }
        }

        // Forget folded sections that no longer exist.
        let sections: std::collections::HashSet<&str> = self
            .content
            .pages
            .iter()
            .filter_map(|p| p.section.as_ref().map(|s| s.id.as_str()))
            .collect();
        self.state
            .collapsed_sections
            .retain(|id| sections.contains(id.as_str()));
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

#[cfg(test)]
mod tests {
    use super::*;
    use crate::structs::data::PageSection;

    #[test]
    fn normalize_fixes_page_ids_and_folded_sections() {
        let mut note = NoteData::default();
        let mut page = note.content.pages[0].clone();
        page.section = Some(PageSection { id: "s1".into(), name: "Week 1".into() });
        note.content.pages = vec![page.clone(), page];
        note.state.collapsed_sections = vec!["s1".into(), "gone".into()];

        note.normalize();

        let [a, b] = &note.content.pages[..] else { panic!() };
        assert_ne!(a.id, b.id, "duplicate page ids are replaced");
        assert_eq!(note.state.collapsed_sections, vec!["s1".to_string()]);
    }
}
