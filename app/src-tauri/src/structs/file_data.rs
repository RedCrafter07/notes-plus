use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use validator::Validate;

use super::blocks::ContentBlock;

/// This is the layer data.
/// Layers don't have a specific ID as moving them up or down is simply changing the index in the
/// Vec structure. Both layers and content blocks are rendered from bottom to top.
type Layers = Vec<Content>;
type Content = Vec<ContentBlock>;

#[derive(Debug, Validate, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Note {
    pub metadata: Metadata,
    pub layers: Layers,
    pub last_state: LastState,
}

#[derive(Debug, Validate, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Metadata {
    pub id: String,
    #[validate(length(min = 1, max = 100))]
    pub title: String,

    // Date stuff
    pub created_at: DateTime<Utc>,
    pub last_modified: DateTime<Utc>,

    // TODO: Make this actually useful
    pub tags: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct LastState {
    position: (f32, f32),
    zoom: u16,
}
