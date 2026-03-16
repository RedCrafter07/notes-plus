use std::{path::Path as SystemPath, time::SystemTime};

use serde::{Deserialize, Serialize};
use specta::Type;

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct Note {
    pub title: String,
    pub tags: Vec<String>,
    pub blocks: Vec<Block>,
    pub created_at: u32,
    pub edited_at: u32,
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

impl Note {
    pub fn new(title: String) -> Self {
        Self {
            title,
            tags: Vec::new(),
            blocks: Vec::new(),
            created_at: SystemTime::now().elapsed().unwrap().as_millis() as u32,
            edited_at: SystemTime::now().elapsed().unwrap().as_millis() as u32,
        }
    }

    pub fn update_edited_at(&mut self) {
        self.edited_at = SystemTime::now().elapsed().unwrap().as_millis() as u32;
    }

    pub fn to_file(&self, path: &SystemPath) -> Result<(), crate::io::NoteFileError> {
        use crate::io::note_to_file;
        note_to_file(self, path)
    }

    pub fn from_file(path: &SystemPath) -> Result<Self, crate::io::NoteFileError> {
        use crate::io::file_to_note;

        file_to_note(path)
    }
}
