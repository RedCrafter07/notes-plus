use crate::commands::*;
use crate::events;

use tauri_specta::{Builder, collect_commands, collect_events};
pub(crate) mod app_handle;
pub(crate) mod dialog;
mod display_error;
pub mod export_bindings;
mod handle_args;
mod handle_drag_drop;

pub(crate) use display_error::*;
pub(crate) use export_bindings::*;
pub(crate) use handle_args::*;
pub(crate) use handle_drag_drop::*;

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
            add_asset,
            close_asset_session,
            get_settings,
            set_settings,
            get_notebooks,
            set_jot_notes,
            export_file,
            export_files,
            trash_note_file,
            rename_note,
            move_note,
            duplicate_note,
            rename_folder,
            start_presenting,
            stop_presenting,
            start_window_drag,
            stop_window_drag,
        ])
        .events(collect_events![
            events::Open,
            events::SettingsUpdate,
            events::DialogEvent,
            events::DragDropFileEvent,
            events::PresentEnded
        ])
        .typ::<common::structs::data::NoteData>()
        .typ::<common::structs::defaults::Defaults>()
        .typ::<crate::structs::Settings>()
}
