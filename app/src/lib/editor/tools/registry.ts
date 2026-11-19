import {
  IconEraser,
  IconHighlight,
  IconLasso,
  IconPencil,
  IconTypography,
} from "@tabler/icons-svelte";
import { eraser } from "./eraser";
import { lasso } from "./lassoHandlers";
import { highlighter, pen } from "./pen";
import { text } from "./textHandlers";
import type { ToolHandlers } from "./types";

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
  /** Whether the colour swatches apply to this tool. */
  colored: boolean;
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
    colored: true,
    opacity: 1,
    size: { label: "Thickness", min: 1, max: 40, default: 4, presets: [2, 4, 8] },
  },
  highlighter: {
    label: "Highlighter",
    action: "Highlight",
    icon: IconHighlight,
    handlers: highlighter,
    colored: true,
    opacity: 0.35,
    size: { label: "Thickness", min: 6, max: 80, default: 20, presets: [12, 20, 32] },
  },
  eraser: {
    label: "Eraser",
    action: "Erase",
    icon: IconEraser,
    handlers: eraser,
    colored: false,
    size: { label: "Eraser size", min: 4, max: 120, default: 24, presets: [10, 24, 60] },
  },
  lasso: {
    label: "Select",
    action: "Select",
    icon: IconLasso,
    handlers: lasso,
    colored: false,
  },
  text: {
    label: "Text",
    action: "Edit text",
    icon: IconTypography,
    handlers: text,
    colored: true,
    size: { label: "Font size", min: 8, max: 96, default: 18, presets: [14, 18, 28] },
  },
} as const satisfies Record<string, ToolDef>;

export type Tool = keyof typeof TOOLS;

export const TOOL_IDS = Object.keys(TOOLS) as Tool[];

export function toolDef(t: Tool): ToolDef {
  return TOOLS[t];
}

export function defaultSizes(): Record<Tool, number> {
  const out = {} as Record<Tool, number>;
  for (const id of TOOL_IDS) out[id] = toolDef(id).size?.default ?? 0;
  return out;
}
