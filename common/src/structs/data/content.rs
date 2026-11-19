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
    /// 1.0 for ink; highlighters use a lower value.
    pub opacity: f32,
}

/// A block of plain text, wrapped to `width`. `(x, y)` is the top-left corner.
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct TextBlock {
    pub id: String,
    pub x: f32,
    pub y: f32,
    pub width: f32,
    pub text: String,
    pub font_size: f32,
    pub color: String,
}

/// An image placed on the page. `asset` is a key into `NoteData::assets`.
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct ImageBlock {
    pub id: String,
    pub x: f32,
    pub y: f32,
    pub width: f32,
    pub height: f32,
    pub asset: String,
}

/// Internally tagged so TypeScript sees a discriminated union:
/// `{ type: "Stroke", id, points, ... } | { type: "Text", ... } | ...`
/// Every variant carries its own `id`.
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(tag = "type")]
pub enum Block {
    Stroke(Stroke),
    Text(TextBlock),
    Image(ImageBlock),
}

impl Block {
    pub fn id(&self) -> &str {
        match self {
            Block::Stroke(s) => &s.id,
            Block::Text(t) => &t.id,
            Block::Image(i) => &i.id,
        }
    }

    /// The asset this block references, if any.
    pub fn asset(&self) -> Option<&str> {
        match self {
            Block::Image(i) => Some(&i.asset),
            Block::Stroke(_) | Block::Text(_) => None,
        }
    }
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
    /// An image drawn under the page content, e.g. an imported PDF page.
    /// Key into `NoteData::assets`.
    pub background_asset: Option<String>,
}

/// A4 at 96 CSS pixels per inch (210 x 297 mm).
pub const A4_WIDTH: f32 = 794.0;
pub const A4_HEIGHT: f32 = 1123.0;

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
            background_asset: None,
        }
    }

    pub fn is_infinite(&self) -> bool {
        self.width < 0.0 || self.height < 0.0
    }
}

impl Default for Page {
    fn default() -> Self {
        Self {
            layers: vec![Layer::default()],
            name: "Page 1".to_string(),
            // A negative width or height means the page is infinite.
            width: A4_WIDTH,
            height: A4_HEIGHT,
            pattern: None,
            pattern_scale: 24,
            pattern_color: String::from("#dddddd"),
            background_color: String::from("#ffffff"),
            background_asset: None,
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
