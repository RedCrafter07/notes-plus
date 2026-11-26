//! Tauri commands.
//!
//! A synchronous command runs on the main thread, which also runs the window:
//! while it works, the app freezes, and building a window from one deadlocks
//! on Windows. So every command that reads or writes files, or opens a
//! dialog or window, is `async` and runs on a worker thread. Only trivial
//! ones (settings, `new_note`, `quit`) stay synchronous.

mod data;
mod export;
mod jot_down;
mod library;
mod lifecycle;
mod notes;
mod present;
mod settings;

pub use data::*;
pub use export::*;
pub use jot_down::*;
pub use library::*;
pub use lifecycle::*;
pub use notes::*;
pub use present::*;
pub use settings::*;
