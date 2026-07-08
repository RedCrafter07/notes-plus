use serde::{Deserialize, Serialize};
use specta::Type;

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct Point {
    pub x: f32,
    pub y: f32,
    pub pressure: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct Stroke {
    pub id: String,
    pub points: Vec<Point>,
    pub color: String,
    pub thickness: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub enum Block {
    Stroke(Stroke),
}

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

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct Content {
    pub pages: Vec<Page>,
}

impl Content {
    pub fn new() -> Self {
        Self {
            pages: vec![Page::default()],
        }
    }
}

impl Default for Content {
    fn default() -> Self {
        Self::new()
    }
}
