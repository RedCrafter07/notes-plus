use serde::{Deserialize, Serialize};
use specta::Type;

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct Note {
    id: String,
    title: String,
    tags: Vec<String>,
    blocks: Vec<Block>,
    edited_at: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub enum Block {
    Path(Path),
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct Path {
    points: Vec<Point>,
    color: String,
    thickness: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct Point {
    x: f32,
    y: f32,
}
