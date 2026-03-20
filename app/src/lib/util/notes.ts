import { tabManager } from "$lib/state/tabManager.svelte";
import { commands } from "$lib/tauri/bindings";

export async function newNote() {
  const noteData = await commands.newNote();
  tabManager.add(noteData, true);
}
