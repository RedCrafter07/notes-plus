import { commands, type Settings } from "#lib/tauri/bindings.ts";
import { Store } from "#lib/util/store.svelte.ts";

// Defaults mirror `Settings::default()` in the Rust backend so the UI has
// sensible values before `get_settings` resolves on startup.
export const settingsStore = new Store<Settings>({
  sidebar_collapsed: false,
  use_last_page_settings: true,
  colors: ["#000000", "#f22e2e", "#55ea41"],
  highlighter_colors: ["#ffe600", "#7ae25b", "#4cd6ff", "#ff6fb5", "#ff9f40"],
  shift_swaps_scroll_axes: true,
  disable_tool_switch: false,
  autosave: true,
  system_title_bar: false,
  toolbar_dock: "top",
  present_fullscreen: true,
  pen_pressure: "light",
  transform_anywhere: false,
  pen_presets: [],
  barrel_button: "lasso",
  shape_snap: true,
});

/**
 * Changes some settings and persists them. The backend stores the whole
 * object and broadcasts it back via `settingsUpdate`, which keeps every
 * window in sync.
 */
export async function updateSettings(patch: Partial<Settings>) {
  const next = { ...$state.snapshot(settingsStore.store), ...patch };
  settingsStore.store = next;
  await commands.setSettings(next);
}
