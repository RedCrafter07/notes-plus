import { settingsStore } from "$lib/state/settingsStore.svelte";
import { tabManager } from "$lib/state/tabManager.svelte";
import { saveTab } from "./handleSave.svelte";

/** Quiet time after the last change before saving. */
const DELAY_MS = 1500;

/**
 * Saves every unsaved tab shortly after it stops changing. On a tablet there
 * is no Ctrl+S, and a crash or a flat battery should cost seconds of work,
 * not a lecture.
 *
 * Call once from a component (it registers an effect).
 */
export function useAutosave() {
  $effect(() => {
    if (!settingsStore.store.autosave) return;

    // Track every tab's version; any change restarts the timer.
    const pending = tabManager.tabs.filter((t) => t.unsaved && t.version);
    if (pending.length === 0) return;

    const timer = setTimeout(() => {
      for (const tab of pending) if (tab.unsaved) saveTab(tab, { silent: true });
    }, DELAY_MS);

    return () => clearTimeout(timer);
  });
}
