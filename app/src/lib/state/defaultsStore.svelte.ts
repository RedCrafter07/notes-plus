import type { Defaults, Layer, NoteData, Page } from "$lib/tauri/bindings";
import { Store } from "$lib/util/store.svelte";

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
  height: -1.0,
  width: -1.0,
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
};

export const EMPTY_NOTE = Object.freeze(structuredClone(defaultNote));

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
  },
});
