import { goto } from "$app/navigation";
import { resolve } from "$app/paths";
import { tabManager } from "$lib/state/tabManager.svelte";
import { commands, type OpenData } from "$lib/tauri/bindings";

export async function newNote() {
  const noteData = await commands.newNote();
  tabManager.add(noteData, true);
}

export function openNotes(files?: OpenData[]) {
  if (!files) return;
  files.forEach(({ note_data: d, path }, i, a) => {
    tabManager.add(d, i === a.length - 1, path);
    if (i === a.length - 1) goto(resolve("/edit/[id]", { id: d.id }));
  });
}
