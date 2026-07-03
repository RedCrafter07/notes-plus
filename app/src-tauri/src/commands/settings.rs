use serde_json::json;
use tauri_plugin_store::StoreExt;
use tauri_specta::Event;

use crate::{events::SettingsUpdate, structs::Settings};

fn load_settings(app: &tauri::AppHandle) -> Settings {
    let Ok(store) = app.store("data.json") else {
        return Settings::default();
    };
    let notes = store
        .get("settings")
        .and_then(|v| serde_json::from_value(v).ok())
        .unwrap_or_default();
    store.close_resource();

    notes
}
fn save_settings(app: &tauri::AppHandle, settings: Settings) {
    let Ok(store) = app.store("data.json") else {
        eprintln!("Failed to open store while saving settings");
        return;
    };
    store.set("settings", json!(settings));
    if let Err(e) = store.save() {
        eprintln!("Failed to save settings: {e}");
    };
    store.close_resource();
    if let Err(e) = SettingsUpdate(settings).emit(app) {
        eprintln!("Failed to emit settings update event: {e}");
    }
}

#[tauri::command]
#[specta::specta]
pub fn collapse_sidebar(app: tauri::AppHandle, collapse: bool) {
    let mut settings = load_settings(&app);
    settings.sidebar_collapsed = collapse;
    save_settings(&app, settings);
}

#[tauri::command]
#[specta::specta]
pub fn use_last_page_settings(app: tauri::AppHandle, use_default: bool) {
    let mut settings = load_settings(&app);
    settings.use_last_page_settings = use_default;
    save_settings(&app, settings);
}

#[tauri::command]
#[specta::specta]
pub fn get_settings(app: tauri::AppHandle) -> Settings {
    load_settings(&app)
}
