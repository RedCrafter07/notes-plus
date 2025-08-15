use common::structs::file_data::Note;

use common::file::io;

use crate::get_prefs;

#[tauri::command]
pub fn read(path: &str) -> String {
    let workdir = get_prefs().read().workdir.to_string();

    let meta = io::read(path, &workdir).unwrap();

    serde_json::ser::to_string(&meta).unwrap()
}

#[tauri::command]
pub fn write(path: String, note: String) {
    let note_data = serde_json::de::from_str::<Note>(&note).unwrap();
    let mut path = path;

    if !path.ends_with(".rnpf") {
        path = format!("{path}.rnpf");
    }

    // TODO: Make attachments work
    io::write(&path, note_data, vec![]).unwrap();
}
