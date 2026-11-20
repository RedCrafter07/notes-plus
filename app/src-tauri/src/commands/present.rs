use serde::{Deserialize, Serialize};
use specta::Type;
use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindowBuilder};

use crate::util::dialog::show_error;

/// Label of the presenter-mode audience window. The frontend checks it to
/// render only the audience view in that window.
pub const AUDIENCE: &str = "audience";

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct Presenting {
    /// Full screen on another display (true), or a normal window, e.g. for
    /// sharing it in a video call when there is no second display (false).
    pub second_display: bool,
    /// Human-readable target, e.g. "HDMI-1" or "Window".
    pub display: String,
}

/// Opens the audience window: full screen on a display other than the one
/// the editor is on, or as a normal window if there is only one display.
///
/// On Wayland the compositor decides where windows go, so the window may
/// open on the editor's display; it can then be moved there by hand.
#[tauri::command]
#[specta::specta]
pub fn start_presenting(app: AppHandle) -> Option<Presenting> {
    if let Some(existing) = app.get_webview_window(AUDIENCE) {
        let _ = existing.set_focus();
        return Some(Presenting {
            second_display: existing.is_fullscreen().unwrap_or(false),
            display: "Audience window".into(),
        });
    }

    let main = app.get_webview_window("main")?;
    let here = main.current_monitor().ok().flatten();
    let other = main.available_monitors().ok().and_then(|monitors| {
        monitors
            .into_iter()
            .find(|m| here.as_ref().is_none_or(|h| m.position() != h.position()))
    });

    let builder = WebviewWindowBuilder::new(&app, AUDIENCE, WebviewUrl::App("present".into()))
        .title("RedNotes Plus — Audience");

    let (builder, presenting) = match &other {
        Some(monitor) => {
            let scale = monitor.scale_factor();
            let pos = monitor.position().to_logical::<f64>(scale);
            let size = monitor.size().to_logical::<f64>(scale);
            (
                builder
                    .position(pos.x, pos.y)
                    .inner_size(size.width, size.height)
                    .decorations(false)
                    .fullscreen(true),
                Presenting {
                    second_display: true,
                    display: monitor.name().cloned().unwrap_or_else(|| "Display 2".into()),
                },
            )
        }
        None => (
            builder.inner_size(1280.0, 720.0).center(),
            Presenting {
                second_display: false,
                display: "Window".into(),
            },
        ),
    };

    match builder.build() {
        Ok(_) => Some(presenting),
        Err(e) => {
            show_error(format!("Could not open the presenter window: {e}"));
            None
        }
    }
}

#[tauri::command]
#[specta::specta]
pub fn stop_presenting(app: AppHandle) {
    if let Some(w) = app.get_webview_window(AUDIENCE) {
        let _ = w.close();
    }
}
