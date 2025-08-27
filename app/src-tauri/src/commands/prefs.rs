use common::structs::user_prefs::UserPrefs;
use tauri::Manager;

use crate::State;

#[tauri::command]
pub fn get_prefs(app: tauri::AppHandle) -> UserPrefs {
    let state = app.state::<State>();
    let state = state.lock().unwrap();

    state.user_prefs.clone()
}

#[tauri::command]
pub fn set_prefs(app: tauri::AppHandle, new_prefs: UserPrefs) {
    let state = app.state::<State>();
    let mut state = state.lock().unwrap();

    new_prefs.create_dirs();
    state.user_prefs = new_prefs;
}
