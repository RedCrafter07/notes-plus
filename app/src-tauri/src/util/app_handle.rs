use std::sync::OnceLock;

use tauri::AppHandle;

static APP_HANDLE: OnceLock<AppHandle> = OnceLock::new();

pub fn init(handle: AppHandle) {
    APP_HANDLE
        .set(handle)
        .expect("AppHandle initialized several times");
}

pub fn get() -> &'static AppHandle {
    APP_HANDLE.get().expect("AppHandle not initialized")
}
