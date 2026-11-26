use std::{
    sync::atomic::{AtomicU64, Ordering},
    thread,
    time::{Duration, Instant},
};

use tauri::{PhysicalPosition, WebviewWindow};

/// Bumped by every start and stop; a drag loop runs while it still holds
/// the value it started with.
static DRAG: AtomicU64 = AtomicU64::new(0);

/// How often the window follows the cursor (about 250 Hz).
const TICK: Duration = Duration::from_millis(4);
/// A drag whose stop never arrives (a lost pointer-up) ends by itself.
const MAX_DRAG: Duration = Duration::from_secs(30);

/// Moves the window with the cursor until `stop_window_drag`, for pen and
/// touch on the tab bar. The OS move loop (`start_dragging`) follows the
/// mouse button, which a pen or finger does not hold on Windows, so it ends
/// at once. Following the cursor here costs no IPC per movement, unlike
/// moving the window from the frontend.
///
/// Returns false where the cursor position is not available (Wayland: only
/// the compositor may move windows), so the frontend can fall back.
#[tauri::command]
#[specta::specta]
pub async fn start_window_drag(window: WebviewWindow) -> bool {
    let (Ok(cursor), Ok(origin)) = (window.cursor_position(), window.outer_position()) else {
        return false;
    };
    let id = DRAG.fetch_add(1, Ordering::SeqCst) + 1;

    thread::spawn(move || {
        let started = Instant::now();
        let mut last = origin;
        while DRAG.load(Ordering::SeqCst) == id && started.elapsed() < MAX_DRAG {
            if let Ok(c) = window.cursor_position() {
                let next = PhysicalPosition::new(
                    origin.x + (c.x - cursor.x).round() as i32,
                    origin.y + (c.y - cursor.y).round() as i32,
                );
                if next != last {
                    let _ = window.set_position(next);
                    last = next;
                }
            }
            thread::sleep(TICK);
        }
    });
    true
}

#[tauri::command]
#[specta::specta]
pub fn stop_window_drag() {
    DRAG.fetch_add(1, Ordering::SeqCst);
}
