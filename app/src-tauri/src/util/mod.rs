use crate::commands::*;
use crate::events;

use tauri_specta::{Builder, collect_commands, collect_events};
pub(crate) mod app_handle;
pub(crate) mod dialog;
mod display_error;
pub mod export_bindings;
mod handle_args;

pub(crate) use display_error::*;
pub(crate) use export_bindings::*;
pub(crate) use handle_args::*;

pub(crate) fn get_builder() -> tauri_specta::Builder {
    Builder::<tauri::Wry>::new()
        .commands(collect_commands![
            ready,
            quit,
            get_recent,
            get_defaults,
            list_jot_notes,
            open_notes_dialog,
            open_notes,
            new_note,
            save_note,
            save_note_to_storage,
            save_note_dialog,
            get_settings,
            set_colors,
            collapse_sidebar,
            use_last_page_settings,
            get_notebooks,
            set_jot_notes,
        ])
        .events(collect_events![
            events::Open,
            events::SettingsUpdate,
            events::DialogEvent
        ])
        .typ::<common::structs::data::NoteData>()
        .typ::<common::structs::defaults::Defaults>()
        .typ::<crate::structs::Settings>()
}
