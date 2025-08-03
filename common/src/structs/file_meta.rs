use std::collections::HashMap;

use serde::{Deserialize, Serialize};
use ts_rs::TS;

use super::file_data::Note;

#[derive(Serialize, Deserialize, Debug, TS)]
pub struct FileMeta {
    pub note: Note,
    pub attachments: HashMap<String, String>,
}
