import { invoke } from "@tauri-apps/api/core";

export const load = async ({ params }) => {
  const pathString = decodeURI(params.path);

  await invoke("load", { path: pathString });
};
