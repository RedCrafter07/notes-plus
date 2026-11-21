import { convertFileSrc } from "@tauri-apps/api/core";

/*
 * Note attachments (images, PDF page renders) never live in the frontend as
 * data: the backend serves each one at a URL, read on demand from the note's
 * file or its cache (see `assets.rs`). Blocks and pages hold only an id;
 * an `Assets` function turns an id into that URL for one note's session.
 */

/** Asset id -> URL the webview can load it from (`undefined`: not available). */
export type Assets = (id: string) => string | undefined;

let base: string | undefined;

/** `rnasset://localhost/`, or `http://rnasset.localhost/` on Windows and Android. */
function schemeBase() {
  return (base ??= convertFileSrc("", "rnasset"));
}

/** The attachments of the tab whose session is `session` (`Tab.assets`). */
export function sessionAssets(session: string): (id: string) => string {
  return (id) => `${schemeBase()}${session}/${id}`;
}

/**
 * An attachment as a data URL, for output that must stand alone (an SVG
 * export): an `rnasset:` URL means nothing outside the app.
 */
export async function assetDataUrl(url: string): Promise<string | undefined> {
  try {
    const blob = await (await fetch(url)).blob();
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  } catch {
    return undefined;
  }
}
