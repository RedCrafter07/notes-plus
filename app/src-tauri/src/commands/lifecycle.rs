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
}
