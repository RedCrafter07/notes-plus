import { requestRedraw } from "./scheduler";

/*
 * Decoded <img> elements for note assets, keyed by asset id. Asset ids are
 * UUIDs and an id's data never changes, so the cache never needs invalidating;
 * it is only trimmed when it grows large.
 */

const images = new Map<string, HTMLImageElement>();
const LIMIT = 200;

/**
 * Returns the decoded image if it is ready, otherwise starts loading it and
 * returns `undefined`. A redraw is requested once it finishes.
 */
export function getImage(
  id: string,
  src: string | undefined,
): HTMLImageElement | undefined {
  if (!src) return undefined;

  let img = images.get(id);
  if (!img) {
    if (images.size > LIMIT) images.clear();
    img = new Image();
    img.onload = () => requestRedraw();
    img.src = src;
    images.set(id, img);
  }

  return img.complete && img.naturalWidth > 0 ? img : undefined;
}

/** Resolves once the image is decoded, for one-off renders like export. */
export async function loadImage(
  id: string,
  src: string | undefined,
): Promise<HTMLImageElement | undefined> {
  if (!src) return undefined;
  getImage(id, src);
  const img = images.get(id)!;
  try {
    await img.decode();
    return img;
  } catch {
    return undefined;
  }
}
