import { getCurrentWindow } from "@tauri-apps/api/window";
import { settingsStore } from "./settingsStore.svelte.ts";

/**
 * GTK cannot give a window a title bar back once it was created without one
 * (see `create_main_window` in `lib.rs`), so on Linux a change of the setting
 * applies at the next start. Elsewhere it switches live.
 */
const LIVE_SWITCH = !navigator.userAgent.includes("Linux");

/**
 * Whether the OS draws the main window's title bar. It follows the
 * `system_title_bar` setting, but can lag behind it until a restart, and
 * the tab bar must match the window rather than the setting, or there would
 * be two sets of window buttons, or none.
 */
class TitleBar {
  system = $state(false);

  /** Called once settings are loaded; the backend created the window to match. */
  init() {
    this.system = settingsStore.store.system_title_bar;
  }

  /** The setting differs from the window, and only a restart applies it. */
  get needsRestart() {
    return this.system !== settingsStore.store.system_title_bar;
  }

  async follow(want: boolean) {
    if (!LIVE_SWITCH || want === this.system) return;
    await getCurrentWindow().setDecorations(want);
    this.system = want;
  }
}

export const titleBar = new TitleBar();
