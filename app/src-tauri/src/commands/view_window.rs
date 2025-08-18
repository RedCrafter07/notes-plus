use tauri::{AppHandle, Emitter, Manager};

use crate::structs::app_state::AppState;

#[tauri::command]
pub fn view_window(app_handle: AppHandle) -> Option<String> {
    let _ = app_handle.get_webview_window("main").unwrap().show();

    let state = app_handle.state::<AppState>();
    state.file_to_open.clone()
}
