import type { PageLoad } from "./$types";
import { invoke } from "@tauri-apps/api/core";
import type { FileMeta } from "$lib/types/bindings/FileMeta";

export const load: PageLoad = async ({ url }) => {
  const param = url.searchParams.get("path");

  if (!param) {
    return;
  }

  const pathString = decodeURIComponent(param);

  const data = await invoke<string>("read", { path: pathString });
  const file: FileMeta = JSON.parse(data);

  return { file };
};
