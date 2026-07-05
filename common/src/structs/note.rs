use std::time::{SystemTime, UNIX_EPOCH};

use serde::{Deserialize, Serialize};
use serde_with::{DisplayFromStr, serde_as};
use specta::Type;

use crate::io::index::normalize_folder;

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub enum BackgroundPattern {
    Dots,
    Lines,
    Squares,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct Layer {
    pub id: String,
    pub blocks: Vec<Block>,
    pub visible: bool,
    pub locked: bool,
    pub name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct Page {
    pub layers: Vec<Layer>,
    pub width: f32,
    pub height: f32,
    pub pattern: Option<BackgroundPattern>,
    pub pattern_scale: u16,
    pub background_color: String,
    pub pattern_color: String,
    pub name: String,
}

#[serde_as]
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct Note {
    pub title: String,
    pub tags: Vec<String>,
    pub pages: Vec<Page>,
    #[serde_as(as = "DisplayFromStr")]
    pub created_at: u64,
    #[serde_as(as = "DisplayFromStr")]
    pub edited_at: u64,
    #[serde(default)]
    pub folder: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct State {
    pub zoom: f32,
    pub pan_x: f32,
    pub pan_y: f32,
    pub current_page: u32,
    pub current_layer: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct NoteData {
    pub content: Note,
    pub id: String, // temporary identifier for tab manager
    pub state: State,
}

impl Default for State {
    fn default() -> Self {
        Self {
            zoom: 1.0,
            pan_x: 0.0,
            pan_y: 0.0,
            current_page: 0,
            current_layer: 0,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub enum Block {
    Stroke(Stroke),
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct Stroke {
    pub id: String,
    pub points: Vec<Point>,
    pub color: String,
    pub thickness: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct Point {
    pub x: f32,
    pub y: f32,
    pub pressure: f32,
}

impl Note {
    pub fn new(title: String) -> Self {
        Self {
            title,
            folder: None,
            tags: Vec::new(),
            pages: vec![Page::default()],
            created_at: duration_now(),
            edited_at: duration_now(),
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

impl Page {
    pub fn new(
        name: String,
        width: f32,
        height: f32,
        pattern: Option<BackgroundPattern>,
        pattern_scale: u16,
        pattern_color: String,
        background_color: String,
    ) -> Self {
        Self {
            layers: Vec::new(),
            name,
            width,
            height,
            pattern,
            pattern_scale,
            pattern_color,
            background_color,
        }
    }
}

impl Default for Page {
    fn default() -> Self {
        Self {
            layers: vec![Layer::default()],
            name: "Page 1".to_string(),
            width: -1.0,
            height: -1.0, // -1 is infinite
            pattern: None,
            pattern_scale: 24,
            pattern_color: String::from("#dddddd"),
            background_color: String::from("#ffffff"),
        }
    }
}

impl Layer {
    pub fn new(name: String) -> Self {
        Self {
            name,
            ..Layer::default()
        }
    }
}

impl Default for Layer {
    fn default() -> Self {
        Self {
            id: uuid::Uuid::new_v4().to_string(),
            blocks: Vec::new(),
            visible: true,
            locked: false,
            name: "Layer 1".to_string(),
        }
    }
}

impl NoteData {
    pub fn to_bytes(&self) -> Result<Vec<u8>, crate::io::data::NoteFileError> {
        use crate::io::data::note_to_bytes;

        note_to_bytes(self)
    }

    pub fn from_bytes(data: &[u8]) -> Result<NoteData, crate::io::data::NoteFileError> {
        use crate::io::data::bytes_to_note;

        bytes_to_note(data)
    }
}

impl Default for NoteData {
    fn default() -> Self {
        Self {
            content: Note::new(chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string()),
            id: uuid::Uuid::new_v4().to_string(),
            state: State::default(),
        }
    }
}

fn duration_now() -> u64 {
    let Ok(time) = SystemTime::now().duration_since(UNIX_EPOCH) else {
        return 0;
    };

    time.as_secs()
}
