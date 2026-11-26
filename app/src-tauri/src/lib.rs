// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/

mod assets;
mod commands;
mod events;
mod structs;
pub mod util;

use serde_json::json;
use tauri::{Manager, WindowEvent};
use tauri_plugin_store::StoreExt;

use crate::util::{app_handle, handle_drag_drop};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Linux: WebKitGTK's DMA-BUF renderer is left on. It used to be forced
    // off on Wayland (a common workaround for blank windows with old NVIDIA
    // drivers), but that also disables GPU compositing, which silently drops
    // CSS backdrop blur. Anyone who still needs it can launch the app with
    // WEBKIT_DISABLE_DMABUF_RENDERER=1, WebKit's own switch (see README).

    let builder = util::get_builder();
    #[cfg(debug_assertions)] // <- Only export on non-release builds
    {
        util::export_bindings::export_bindings();
    }

    let mut tauri_builder = tauri::Builder::default();

    #[cfg(desktop)]
    {
        tauri_builder =
            tauri_builder.plugin(tauri_plugin_single_instance::init(|app, args, cwd| {
                use std::path::PathBuf;

                use crate::{structs::ResultExt, util::handle_args};
                use tauri::Manager;

                handle_args(app, Some(args), Some(PathBuf::from(cwd))).unwrap_or_display(());

                let _ = app
                    .get_webview_window("main")
                    .expect("no main window")
                    .set_focus();
            }));
    }

    tauri_builder = tauri_builder
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(builder.invoke_handler())
        // Note attachments, read on demand; see `assets.rs`.
        .register_asynchronous_uri_scheme_protocol(assets::SCHEME, |ctx, request, responder| {
            let app = ctx.app_handle().clone();
            std::thread::spawn(move || {
                let response = match app.try_state::<assets::AssetStore>() {
                    Some(store) => store.respond(&request),
                    None => tauri::http::Response::builder()
                        .status(tauri::http::StatusCode::SERVICE_UNAVAILABLE)
                        .body(Vec::new())
                        .unwrap_or_default(),
                };
                responder.respond(response);
            });
        })
        .on_window_event(|window, event| match event {
            WindowEvent::DragDrop(event) => handle_drag_drop(window.app_handle(), event),
            WindowEvent::Destroyed if window.label() == commands::AUDIENCE => {
                use tauri_specta::Event;
                events::PresentEnded.emit(window.app_handle()).ok();
            }
            _ => {}
        })
        .setup(move |app| {
            app_handle::init(app.handle().clone());

            // This is also required if you want to use events
            builder.mount_events(app);

            app.manage(assets::AssetStore::new(app.path().app_cache_dir()?.join("assets")));

            let store = app.store("data.json")?;
            // init jot notes in store
            if !store.has("jotNotes") {
                store.set("jotNotes", json!([]));
                store.save()?;
            }
            store.close_resource();

            create_main_window(app)?;

            Ok(())
        });

    tauri_builder
        .run(tauri::generate_context!())
        .expect("error while running RedNotes Plus");
}

/// Creates the main window from its entry in `tauri.conf.json` (which has
/// `create: false`), with the title bar the user chose.
///
/// It has to be decided here, before the window exists: on Linux (GTK), a
/// window created without decorations gets an empty custom title bar so the
/// compositor doesn't draw one, and that can't be undone later. Turning
/// decorations on at runtime then shows nothing at all. The frontend
/// therefore applies a change on Linux at the next start; see
/// `titleBar.svelte.ts`.
fn create_main_window(app: &tauri::App) -> tauri::Result<()> {
    let config = app
        .config()
        .app
        .windows
        .iter()
        .find(|w| w.label == "main")
        .expect("no main window in tauri.conf.json")
        .clone();

    let builder = tauri::WebviewWindowBuilder::from_config(app, &config)?;
    #[cfg(desktop)]
    let builder = builder.decorations(commands::load_settings(app.handle()).system_title_bar);
    builder.build()?;

    Ok(())
}
