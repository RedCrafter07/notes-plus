use std::collections::HashMap;

use serde::{Deserialize, Serialize};

use super::file_data::Note;

#[derive(Serialize, Deserialize, Debug)]
pub struct FileMeta {
    pub note: Note,
    pub attachments: HashMap<String, String>,
}
