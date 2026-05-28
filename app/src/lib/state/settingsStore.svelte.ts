import type { Settings } from "$lib/tauri/bindings";
import { Store } from "$lib/util/store.svelte";

export const settingsStore = new Store<Settings>({ sidebar_collapsed: false });
