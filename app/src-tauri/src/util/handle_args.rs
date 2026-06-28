use tauri::AppHandle;

pub(crate) fn handle_args(app: &AppHandle, args: Option<Vec<String>>) {
    let args = if let Some(args) = args {
        args
    } else {
        std::env::args().collect::<Vec<String>>()
    };

    if args.len() > 1 {
        let path = std::path::Path::new(&args[1]);
        if path.exists() {
            use common::structs::note::NoteData;

            let buffer = common::io::archive::open_data(path);
            if let Ok(buffer) = buffer {
                let note_data = NoteData::from_bytes(&buffer);

                if let Ok(note) = note_data {
                    use tauri_specta::Event;

                    use crate::events::{Open, OpenData};

                    Open(OpenData {
                        note_data: note,
                        path: args[1].to_string(),
                    })
                    .emit(app)
                    .expect("Failed to emit Open event");
                }
            }
        }
    }
}
