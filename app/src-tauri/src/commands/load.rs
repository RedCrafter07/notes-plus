use chrono::Local;
use common::structs::file_data::{LastState, Metadata, Note};
use uuid::Uuid;

#[tauri::command]
pub async fn load(_path: String) -> Note {
    Note {
        last_state: LastState {
            position: (0_f32, 0_f32),
            zoom: 100_u16,
        },
        metadata: Metadata {
            id: Uuid::new_v4().to_string(),
            title: "RedNotes Plus Experiment".to_string(),
            created_at: Local::now().to_utc(),
            last_modified: Local::now().to_utc(),
            tags: vec!["test".to_string()],
        },

        layers: vec![],
    }
}
