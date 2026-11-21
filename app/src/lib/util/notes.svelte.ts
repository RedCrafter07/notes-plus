import { goto } from "$app/navigation";
import { resolve } from "$app/paths";
import { tabManager } from "#lib/state/tabManager.svelte.ts";
import { commands, type OpenData } from "#lib/tauri/bindings.ts";

export async function newNote() {
  const noteData = await commands.newNote();
  tabManager.add(noteData, true);
}

export function openNotes(files?: OpenData[]) {
  if (!files) return;
  files.forEach(({ note_data: d, path, assets }, i, a) => {
    tabManager.add(d, i === a.length - 1, path, assets);
    if (i === a.length - 1) goto(resolve("/edit/[id]", { id: d.meta.id }));
  });
}
