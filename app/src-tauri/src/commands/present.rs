use serde::{Deserialize, Serialize};
use specta::Type;
use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindowBuilder};

use crate::{commands::load_settings, util::dialog::show_error};

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

/// Opens the audience window on a display other than the one the editor is
/// on (full screen, or maximized if `present_fullscreen` is off), or as a
/// normal window behind the editor if there is only one display.
///
/// On Wayland the compositor decides where windows go, so the window may
/// open on the editor's display; it can then be moved there by hand.
///
/// Must stay `async`: a sync command runs on the main thread, and building a
/// webview window there deadlocks on Windows (WebView2 needs the event loop
/// that the command is blocking), which also leaves the app unable to close.
#[tauri::command]
#[specta::specta]
pub async fn start_presenting(app: AppHandle) -> Option<Presenting> {
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
            let builder = builder.position(pos.x, pos.y);
            let builder = if load_settings(&app).present_fullscreen {
                builder
                    .inner_size(size.width, size.height)
                    .decorations(false)
                    .fullscreen(true)
            } else {
                // Placed on that display first, so it maximizes there.
                builder.inner_size(size.width / 2.0, size.height / 2.0).maximized(true)
            };
            (
                builder,
                Presenting {
                    second_display: true,
                    display: monitor.name().cloned().unwrap_or_else(|| "Display 2".into()),
                },
            )
        }
        None => {
            // Same display: a 16:9 window that leaves room for the editor,
            // which it opens behind (see below).
            let width = here
                .as_ref()
                .map(|m| m.size().to_logical::<f64>(m.scale_factor()).width * 0.6)
                .unwrap_or(960.0);
            (
                builder.inner_size(width, width * 9.0 / 16.0).center().focused(false),
                Presenting {
                    second_display: false,
                    display: "Window".into(),
                },
            )
        }
    };

    match builder.build() {
        Ok(_) => {
            if !presenting.second_display {
                // A new window opens on top even without focus, and focusing
                // the editor does nothing as it already has focus. Pinning it
                // on top and back raises it above the audience window.
                let _ = main.set_always_on_top(true);
                let _ = main.set_always_on_top(false);
            }
            Some(presenting)
        }
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
