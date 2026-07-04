import type { Settings } from "$lib/tauri/bindings";
import { Store } from "$lib/util/store.svelte";

// Defaults mirror `Settings::default()` in the Rust backend so the UI has
// sensible values before `get_settings` resolves on startup.
export const settingsStore = new Store<Settings>({
  sidebar_collapsed: false,
  use_last_page_settings: true,
  colors: ["#000000", "#f22e2e", "#55ea41"],
});
