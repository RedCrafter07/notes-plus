use serde::{Deserialize, Serialize};
use specta::Type;
use tauri_specta::Event;

use crate::{events::DialogEvent, util::app_handle};

#[derive(Clone, Debug, Deserialize, Serialize, Type)]
pub enum DialogType {
    Success,
    Error,
    Warning,
    Info,
}

#[derive(Clone, Debug, Deserialize, Serialize, Type)]
pub struct DialogData {
    dialog_type: DialogType,
    message: String,
    title: Option<String>,
}

pub fn show_dialog(dialog_type: DialogType, message: String) {
    let app = app_handle::get();

    DialogEvent(DialogData {
        dialog_type,
        message,
        title: None,
    })
    .emit(app)
    .expect("IPC channel broken — frontend is non-functional, cannot recover");
}

pub fn show_dialog_with_title(dialog_type: DialogType, title: String, message: String) {
    let app = app_handle::get();

    DialogEvent(DialogData {
        dialog_type,
        message,
        title: Some(title),
    })
    .emit(app)
    .expect("IPC channel broken — frontend is non-functional, cannot recover");
}

pub fn show_error(message: String) {
    eprintln!("{message}");
    show_dialog(DialogType::Error, message);
}
