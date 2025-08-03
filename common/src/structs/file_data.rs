use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use ts_rs::TS;

use super::blocks::ContentBlock;

/// This is the layer data.
/// Layers don't have a specific ID as moving them up or down is simply changing the index in the
/// Vec structure. Both layers and content blocks are rendered from bottom to top.
type Layers = Vec<Content>;
type Content = Vec<ContentBlock>;

/// The property containing the main data.
/// The file format is a zip archive, which includes a file with the structure of the Note struct,
/// as well as a folder with attachments and a preview image used for displaying the actual data.
#[derive(Debug, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct Note {
    pub metadata: Metadata,
    pub pages: Vec<Page>,
    pub last_state: LastState,
}

#[derive(Debug, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct Metadata {
    pub id: String,
    pub title: String,

    // Date stuff
    pub created_at: DateTime<Utc>,
    pub last_modified: DateTime<Utc>,

    // TODO: Make this actually useful
    pub tags: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize, TS)]
pub enum PageStyle {
    Dots,
    Lines,
    Grid,
}

#[derive(Debug, Serialize, Deserialize, TS)]
pub enum PageType {
    Infinite,
    Fixed,
}

#[derive(Debug, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct Page {
    layers: Layers,
    style: PageStyle,
    background_color: String,
    style_color: String,
    page_size: (u8, u8),
    page_type: PageType,
}

#[derive(Debug, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct LastState {
    pub position: (f32, f32),
    pub zoom: u16,
    pub last_layer: u8,
    pub last_page: u8,
}

impl Default for LastState {
    fn default() -> Self {
        LastState {
            position: (0_f32, 0_f32),
            zoom: 100,
            last_layer: 0,
            last_page: 0,
        }
    }
}
