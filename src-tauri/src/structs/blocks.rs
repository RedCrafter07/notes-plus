use serde::{Deserialize, Serialize};
use validator::Validate;

#[derive(Debug, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum ContentBlocks {
    Image(ImageBlock),
    Shape(ShapeBlock),
    Stroke(StrokeBlock),
    Text(TextBlock),
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ImageBlock {
    pub id: String,
    pub source: String,
    pub width: u32,
    pub height: u32,
    pub position: (f32, f32),
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ShapeBlock {
    pub id: String,
    pub outline_color: String,
    pub fill_color: String,
    pub stroke_width: f32,
    pub shape: ShapeType,
}
#[derive(Debug, Serialize, Deserialize, Validate)]
#[serde(rename_all = "camelCase")]
pub struct StrokeBlock {
    pub id: String,
    pub tool: String,
    pub color: String,
    pub stroke_width: f32,

    #[validate(length(min = 1))]
    pub points: Vec<Point>,
}
#[derive(Debug, Serialize, Deserialize, Validate)]
pub struct TextBlock {
    pub id: String,
    #[validate(length(min = 1))]
    pub content: String,
    pub position: (f32, f32),
    pub size: u32,
}

#[derive(Debug, Serialize, Deserialize)]
pub enum ShapeType {
    Rectangle {
        x: f32,
        y: f32,
        width: f32,
        height: f32,
    },
    Ellipse {
        x: f32,
        y: f32,
        width: f32,
        height: f32,
    },
    Line {
        x1: f32,
        y1: f32,
        x2: f32,
        y2: f32,
    },
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Point {
    pub x: f32,
    pub y: f32,
    pub pressure: f32,
}
