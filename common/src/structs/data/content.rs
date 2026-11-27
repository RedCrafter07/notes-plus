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
    /// The points are already the smoothed centre line, so they are drawn as
    /// they are instead of being smoothed again. Set on the pieces the eraser
    /// leaves: smoothing a piece afresh from its cut would bend it away from
    /// where the ink was. Absent for strokes as drawn. (An `Option` so that
    /// specta types it as optional; `Some(false)` means the same as `None`.)
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub smoothed: Option<bool>,
    /// How much pen pressure changes the width (perfect-freehand's
    /// `thinning`, 0..1), as set when the stroke was drawn, so changing the
    /// setting later does not alter existing ink. Absent means 0: even width.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub thinning: Option<f32>,
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

/// An image placed on the page. `asset` is an attachment id (`assets/<id>` in the archive).
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

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "lowercase")]
pub enum Orientation {
    Portrait,
    Landscape,
}

/// A rectangle on a page that is exported as one output page, e.g. "this part
/// of my infinite canvas as A4". `format` is a page format id ("a4", "letter",
/// "16:9", ...) whose ratio the rectangle keeps, or "free" for any ratio.
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct ExportRegion {
    pub id: String,
    pub name: String,
    pub x: f32,
    pub y: f32,
    pub width: f32,
    pub height: f32,
    pub format: String,
    pub orientation: Orientation,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct Page {
    /// Unique within the note. Stable across edits, unlike the page object
    /// in the frontend, which is replaced on every structural change.
    pub id: String,
    pub layers: Vec<Layer>,
    pub width: f32,
    pub height: f32,
    pub pattern: Option<BackgroundPattern>,
    pub pattern_scale: u16,
    pub background_color: String,
    pub pattern_color: String,
    pub name: String,
    /// An image drawn under the page content, e.g. an imported PDF page.
    /// Attachment id (`assets/<id>` in the archive).
    pub background_asset: Option<String>,
    /// Export regions on this page, in export order.
    pub regions: Vec<ExportRegion>,
    /// The section the page belongs to. A section is a run of consecutive
    /// pages with the same section id; each of them carries the name, so a
    /// section change is a change of the `pages` array (and undoable like
    /// one). Pages before the first section have none.
    pub section: Option<PageSection>,
}

/// A named group of consecutive pages, e.g. one lecture or chapter.
#[derive(Debug, Clone, Serialize, Deserialize, Type, PartialEq)]
pub struct PageSection {
    pub id: String,
    pub name: String,
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
            id: new_id(),
            layers: Vec::new(),
            name,
            width,
            height,
            pattern,
            pattern_scale,
            pattern_color,
            background_color,
            background_asset: None,
            regions: Vec::new(),
            section: None,
        }
    }

    pub fn is_infinite(&self) -> bool {
        self.width < 0.0 || self.height < 0.0
    }
}

impl Default for Page {
    fn default() -> Self {
        Self {
            id: new_id(),
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
            regions: Vec::new(),
            section: None,
        }
    }
}

fn new_id() -> String {
    uuid::Uuid::new_v4().to_string()
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
