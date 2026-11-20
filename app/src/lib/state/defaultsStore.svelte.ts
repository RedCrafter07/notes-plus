import type { Defaults, Layer, NoteData, Page } from "#lib/tauri/bindings.ts";
import { deepFreeze } from "#lib/util/deepFreeze.ts";
import { Store } from "#lib/util/store.svelte.ts";

const defaultLayer: Layer = {
  blocks: [],
  id: crypto.randomUUID(),
  locked: false,
  name: "Layer 1",
  visible: true,
};
const defaultPage: Page = {
  name: "Page 1",
  background_color: "#ffffff",
  pattern_color: "#dddddd",
  pattern_scale: 24,
  pattern: null,
  // A4 at 96 units per inch; mirrors `Page::default()` in Rust.
  width: 794,
  height: 1123,
  background_asset: null,
  regions: [],
  layers: [defaultLayer],
};
export const defaultNote: NoteData = {
  content: {
    pages: [defaultPage],
  },
  meta: {
    id: crypto.randomUUID(),
    created_at: Math.floor(Date.now() / 1000).toString(),
    edited_at: Math.floor(Date.now() / 1000).toString(),
    folder: null,
    tags: [],
    title: "New Note",
  },
  state: {
    current_layer: 0,
    current_page: 0,
    pan_x: 0,
    pan_y: 0,
    zoom: 1.0,
  },
  assets: {},
};

export const EMPTY_NOTE = import.meta.env.DEV
  ? deepFreeze(structuredClone(defaultNote))
  : structuredClone(defaultNote);

export const defaultsStore = new Store<Defaults>({
  layer: defaultLayer,
  page: defaultPage,
  note: {
    content: {
      pages: [defaultPage],
    },
    meta: {
      id: crypto.randomUUID(),
      created_at: "0",
      edited_at: "0",
      folder: null,
      tags: [],
      title: "New Note",
    },
    state: {
      current_layer: 0,
      current_page: 0,
      pan_x: 0,
      pan_y: 0,
      zoom: 1.0,
    },
    assets: {},
  },
});
