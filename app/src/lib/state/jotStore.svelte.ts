import { commands } from "#lib/tauri/bindings.ts";
import { Store } from "#lib/util/store.svelte.ts";

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
