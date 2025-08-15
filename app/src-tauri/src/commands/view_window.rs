use tauri::{AppHandle, Manager};

#[tauri::command]
pub fn view_window(app_handle: AppHandle) {
    app_handle
        .get_webview_window("main")
        .unwrap()
        .show()
        .unwrap();
}
