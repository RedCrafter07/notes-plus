use std::time::{SystemTime, UNIX_EPOCH};

use serde::{Deserialize, Serialize};
use serde_with::{DisplayFromStr, serde_as};
use specta::Type;

use crate::io::index::normalize_folder;

#[serde_as]
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct Meta {
    #[serde_as(as = "DisplayFromStr")]
    pub created_at: u64,
    #[serde_as(as = "DisplayFromStr")]
    pub edited_at: u64,
    pub id: String,
    pub folder: Option<String>,
    pub tags: Vec<String>,
    pub title: String,
}

impl Meta {
    pub fn new(title: String) -> Self {
        Self {
            created_at: duration_now(),
            edited_at: duration_now(),
            folder: None,
            id: uuid::Uuid::new_v4().to_string(),
            tags: Vec::new(),
            title,
        }
    }

    pub fn update_edited_at(&mut self) {
        self.edited_at = duration_now();
    }

    pub fn normalize_folder(&mut self) {
        if let Some(folder) = &self.folder {
            self.folder = Some(normalize_folder(folder.clone()));
        }
    }
}

impl Default for Meta {
    fn default() -> Self {
        Self::new(chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string())
    }
}

fn duration_now() -> u64 {
    let Ok(time) = SystemTime::now().duration_since(UNIX_EPOCH) else {
        return 0;
    };

    time.as_secs()
}
