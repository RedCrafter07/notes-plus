use tauri::Manager;

#[tauri::command]
#[specta::specta]
pub fn quit(app: tauri::AppHandle) {
    app.exit(0);
}

#[tauri::command]
#[specta::specta]
pub fn ready(app: tauri::AppHandle) {
    let window = app.get_webview_window("main").unwrap();
    window.show().unwrap();

    #[cfg(desktop)]
    {
        let args = std::env::args().collect::<Vec<String>>();
        if args.len() > 1 {
            let path = std::path::Path::new(&args[1]);
            if path.exists() {
                use common::structs::note::NoteData;

                let note_data = NoteData::from_file(path);

                if let Ok(note) = note_data {
                    use tauri_specta::Event;

                    use crate::events::Open;

                    Open(note).emit(&app).expect("Failed to emit Open event");
                }
            }
        }
    }
}
