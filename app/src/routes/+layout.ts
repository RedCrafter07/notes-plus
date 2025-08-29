
import type { UserPrefs } from "$lib/types/bindings/UserPrefs";
import { invoke } from "@tauri-apps/api/core";

// Tauri doesn't have a Node.js server to do proper SSR
// so we will use adapter-static to prerender the app (SSG)
// See: https://v2.tauri.app/start/frontend/sveltekit/ for more info
export const prerender = true;
export const ssr = false;

export const load = async () => {
  const prefs = await getPrefs();

  return { prefs };
}

async function getPrefs() {
  return await invoke<UserPrefs>("get_prefs");
}
