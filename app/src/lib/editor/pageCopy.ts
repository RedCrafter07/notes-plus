import type { Page } from "#lib/tauri/bindings.ts";
import { blockAsset } from "./blocks";

/** The attachment ids the pages use. */
export function pageAssets(pages: Page[]): string[] {
  const ids = new Set<string>();
  for (const p of pages) {
    if (p.background_asset) ids.add(p.background_asset);
    for (const l of p.layers)
      for (const b of l.blocks) {
        const a = blockAsset(b);
        if (a) ids.add(a);
      }
  }
  return [...ids];
}

/** A copy with fresh ids for its layers, blocks and regions (insertPages gives the page its own). */
export function freshCopy(page: Page): Page {
  return {
    ...page,
    layers: page.layers.map((l) => ({
      ...l,
      id: crypto.randomUUID(),
      blocks: l.blocks.map((b) => ({ ...b, id: crypto.randomUUID() })),
    })),
    regions: page.regions.map((r) => ({ ...r, id: crypto.randomUUID() })),
  };
}
