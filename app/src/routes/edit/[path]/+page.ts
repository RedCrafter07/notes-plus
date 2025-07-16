import type { Note } from "$lib/types/bindings/Note";
import type { PageLoad } from "./$types";
import { invoke } from "@tauri-apps/api/core";

export const load: PageLoad = async ({ params }) => {
  const pathString = decodeURI(params.path);

  const data = await invoke<Note>("load", { path: pathString });

  return data;
};
