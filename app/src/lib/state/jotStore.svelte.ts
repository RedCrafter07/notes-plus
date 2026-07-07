import { commands } from "$lib/tauri/bindings";
import { Store } from "$lib/util/store.svelte";

class JotStore extends Store<string[]> {
  constructor() {
    super([]);
  }

  async save() {
    await commands.setJotNotes(
      this.store.map((j) => j.trim()).filter((j) => j.length > 0),
    );
  }
}

export const jotStore = new JotStore();
