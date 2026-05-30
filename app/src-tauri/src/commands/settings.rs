use serde_json::json;
use tauri_plugin_store::StoreExt;
use tauri_specta::Event;

use crate::{events::SettingsUpdate, structs::Settings};

#[tauri::command]
#[specta::specta]
pub fn collapse_sidebar(app: tauri::AppHandle, collapse: bool) {
    let store = app.store("data.json").unwrap();
    let settings_store = store.get("settings");

    let mut settings: Settings = if let Some(settings_store) = settings_store {
        serde_json::from_value(settings_store).unwrap_or_default()
    } else {
        Settings::default()
    };

    settings.sidebar_collapsed = collapse;

    store.set("settings", json!(settings));
    store.save().unwrap();
    store.close_resource();

    SettingsUpdate(settings)
        .emit(&app)
        .expect("Failed to emit settings update");
}

#[tauri::command]
#[specta::specta]
pub fn use_last_page_settings(app: tauri::AppHandle, use_default: bool) {
    let store = app.store("data.json").unwrap();
    let settings_store = store.get("settings");

    let mut settings: Settings = if let Some(settings_store) = settings_store {
        serde_json::from_value(settings_store).unwrap_or_default()
    } else {
        Settings::default()
    };

    settings.use_last_page_settings = use_default;

    store.set("settings", json!(settings));
    store.save().unwrap();
    store.close_resource();

    SettingsUpdate(settings)
        .emit(&app)
        .expect("Failed to emit settings update");
}

#[tauri::command]
#[specta::specta]
pub fn get_settings(app: tauri::AppHandle) -> Settings {
    let store = app.store("data.json").unwrap();
    let settings_store = store.get("settings");

    if let Some(settings_store) = settings_store {
        serde_json::from_value(settings_store).unwrap_or_default()
    } else {
        Settings::default()
    }
}
