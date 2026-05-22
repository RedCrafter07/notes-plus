use std::time::SystemTime;

use serde::{Deserialize, Serialize};
use specta::Type;

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

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct Note {
    pub title: String,
    pub tags: Vec<String>,
    pub pages: Vec<Page>,
    pub created_at: u32,
    pub edited_at: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct State {
    pub zoom: f32,
    pub pan_x: f32,
    pub pan_y: f32,
    pub current_page: u32,
    pub current_layer: u32,
}

#[derive(specta::Type, Debug, Serialize, Deserialize, Clone)]
pub struct NoteData {
    pub content: Note,
    pub path: Option<String>,
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
            tags: Vec::new(),
            pages: vec![Page::default()],
            created_at: SystemTime::now().elapsed().unwrap().as_millis() as u32,
            edited_at: SystemTime::now().elapsed().unwrap().as_millis() as u32,
        }
    }

    pub fn update_edited_at(&mut self) {
        self.edited_at = SystemTime::now().elapsed().unwrap().as_millis() as u32;
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
            pattern_scale: 16,
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
            path: None,
            id: uuid::Uuid::new_v4().to_string(),
            state: State::default(),
        }
    }
}
