use std::sync::Mutex;

use tauri::{AppHandle, Manager};

use crate::structs::app_state::AppState;

#[tauri::command]
pub fn view_window(app_handle: AppHandle) -> Option<String> {
    let _ = app_handle.get_webview_window("main").unwrap().show();

    let state = app_handle.state::<Mutex<AppState>>();
    let mut state = state.lock().unwrap();

    let file_to_open = state.file_to_open.clone();
    state.clear_files();

    file_to_open
}
