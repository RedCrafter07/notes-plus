import type { Note } from "$lib/types/bindings/Note";
import { redirect } from "@sveltejs/kit";
import type { PageLoad } from "./$types";
import { invoke } from "@tauri-apps/api/core";

export const load: PageLoad = async ({ url }) => {
  const param = url.searchParams.get("path");

  if (!param) {
    return;
  }

  const pathString = decodeURIComponent(param);

  const data = await invoke<Note>("load", { path: pathString });

  console.log(data);

  return data;
};
