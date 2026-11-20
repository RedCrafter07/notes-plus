import {
  IconEraser,
  IconHighlight,
  IconLasso,
  IconPencil,
  IconPointer,
  IconTypography,
} from "@tabler/icons-svelte";
import { eraser } from "./eraser";
import { lasso } from "./lassoHandlers";
import { highlighter, pen } from "./pen";
import { text } from "./textHandlers";
import { laser } from "./laserHandlers";
import type { ToolHandlers } from "./types";
import type { Settings } from "#lib/tauri/bindings.ts";

/** Which list of swatches a tool uses; each is a key of `Settings`. */
export type Palette = keyof Pick<Settings, "colors" | "highlighter_colors">;

/*
 * The one list of tools. Adding a tool means adding an entry here; the `Tool`
 * type, the toolbar, history labels and pointer dispatch all derive from it.
 */

export interface SizeSpec {
  /** Label for the size control. */
  label: string;
  min: number;
  max: number;
  default: number;
  /** One-tap sizes shown in the toolbar. */
  presets: number[];
}

export interface ToolDef {
  label: string;
  /** Undo/redo label for a gesture with this tool. */
  action: string;
  icon: typeof IconPencil;
  handlers: ToolHandlers;
  /** The swatches this tool offers; none means the tool has no colour. */
  palette?: Palette;
  /** Colour the tool starts with. */
  defaultColor?: string;
  size?: SizeSpec;
  /** Opacity of strokes drawn with this tool. */
  opacity?: number;
}

export const TOOLS = {
  pen: {
    label: "Pen",
    action: "Draw",
    icon: IconPencil,
    handlers: pen,
    palette: "colors",
    defaultColor: "#000000",
    opacity: 1,
    size: { label: "Thickness", min: 1, max: 40, default: 4, presets: [2, 4, 8] },
  },
  highlighter: {
    label: "Highlighter",
    action: "Highlight",
    icon: IconHighlight,
    handlers: highlighter,
    palette: "highlighter_colors",
    defaultColor: "#ffe600",
    opacity: 0.35,
    size: { label: "Thickness", min: 6, max: 80, default: 20, presets: [12, 20, 32] },
  },
  eraser: {
    label: "Eraser",
    action: "Erase",
    icon: IconEraser,
    handlers: eraser,
    size: { label: "Eraser size", min: 4, max: 120, default: 24, presets: [10, 24, 60] },
  },
  lasso: {
    label: "Select",
    action: "Select",
    icon: IconLasso,
    handlers: lasso,
  },
  text: {
    label: "Text",
    action: "Edit text",
    icon: IconTypography,
    handlers: text,
    palette: "colors",
    defaultColor: "#000000",
    size: { label: "Font size", min: 8, max: 96, default: 18, presets: [14, 18, 28] },
  },
  laser: {
    label: "Laser pointer",
    action: "Point",
    icon: IconPointer,
    handlers: laser,
  },
} as const satisfies Record<string, ToolDef>;

export type Tool = keyof typeof TOOLS;

export const TOOL_IDS = Object.keys(TOOLS) as Tool[];

export function toolDef(t: Tool): ToolDef {
  return TOOLS[t];
}

export function defaultColors(): Partial<Record<Tool, string>> {
  const out: Partial<Record<Tool, string>> = {};
  for (const id of TOOL_IDS) {
    const c = toolDef(id).defaultColor;
    if (c) out[id] = c;
  }
  return out;
}

export function defaultSizes(): Record<Tool, number> {
  const out = {} as Record<Tool, number>;
  for (const id of TOOL_IDS) out[id] = toolDef(id).size?.default ?? 0;
  return out;
}
