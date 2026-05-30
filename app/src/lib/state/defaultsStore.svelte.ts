import type { Defaults } from "$lib/tauri/bindings";
import { Store } from "$lib/util/store.svelte";

export const defaultsStore = new Store<Defaults>();
