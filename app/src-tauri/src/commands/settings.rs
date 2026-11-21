use serde_json::json;
use tauri_plugin_store::StoreExt;
use tauri_specta::Event;

use crate::{events::SettingsUpdate, structs::Settings, util::dialog::show_error};

pub(crate) fn load_settings(app: &tauri::AppHandle) -> Settings {
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
        show_error("Failed to open store while saving settings".into());
        return;
    };
    store.set("settings", json!(settings));
    if let Err(e) = store.save() {
        show_error(format!("Failed to save settings: {e}"));
    };
    store.close_resource();
    if let Err(e) = SettingsUpdate(settings).emit(app) {
        show_error(format!("Failed to emit settings update event: {e}"));
    }
}

/// Replaces all settings at once. The frontend sends the whole object (see
/// `updateSettings` in `settingsStore`), so adding a setting needs no new
/// command, only a new field on `Settings`.
#[tauri::command]
#[specta::specta]
pub fn set_settings(app: tauri::AppHandle, settings: Settings) {
    save_settings(&app, settings);
}

#[tauri::command]
#[specta::specta]
pub fn get_settings(app: tauri::AppHandle) -> Settings {
    load_settings(&app)
}
