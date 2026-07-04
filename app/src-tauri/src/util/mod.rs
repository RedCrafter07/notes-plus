use crate::commands::*;
use crate::events;

use tauri_specta::{Builder, collect_commands, collect_events};
pub mod export_bindings;
mod handle_args;

pub(crate) use export_bindings::*;
pub(crate) use handle_args::*;

pub(crate) fn get_builder() -> tauri_specta::Builder {
    Builder::<tauri::Wry>::new()
        .commands(collect_commands![
            ready,
            quit,
            get_recent,
            get_defaults,
            add_jot_note,
            remove_jot_note,
            edit_jot_note,
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
        ])
        .events(collect_events![
            events::JotDown,
            events::Open,
            events::SettingsUpdate
        ])
        .typ::<common::structs::note::NoteData>()
        .typ::<common::structs::defaults::Defaults>()
        .typ::<crate::structs::Settings>()
}
