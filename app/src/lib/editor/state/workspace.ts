// Types only: the registry imports the toolbar icons (Svelte components),
// so the caller passes the tool list in and this stays testable.
import type { SizeSpec, Tool } from "../tools/registry";

/** What the loader needs to know about the tools. */
export interface ToolInfo {
  ids: readonly Tool[];
  size: (t: Tool) => Pick<SizeSpec, "min" | "max"> | undefined;
}

/*
 * The editor as it was left (tool, per-tool colour and size, eraser mode,
 * zoom lock), restored at the next start. Per device, so it lives in the
 * webview's localStorage rather than in Settings, which is written to disk
 * and broadcast to every window on each change. Anything unreadable or out
 * of range falls back to the defaults.
 */

const KEY = "rednotes.workspace.v1";

export interface Workspace {
  tool: Tool;
  colors: Partial<Record<Tool, string>>;
  sizes: Partial<Record<Tool, number>>;
  eraserMode: "partial" | "stroke";
  zoomLock: boolean;
  /** Scaling a selection also scales line widths and font sizes. */
  scaleWidths: boolean;
}

/** The saved workspace, with every invalid field left out. */
export function loadWorkspace(tools: ToolInfo): Partial<Workspace> {
  const isTool = (t: unknown): t is Tool => tools.ids.includes(t as Tool);
  let raw: unknown;
  try {
    raw = JSON.parse(localStorage.getItem(KEY) ?? "null");
  } catch {
    return {};
  }
  if (!raw || typeof raw !== "object") return {};
  const w = raw as Record<string, unknown>;
  const out: Partial<Workspace> = {};

  // The laser is for presenting; starting the app with it would surprise.
  if (isTool(w.tool) && w.tool !== "laser") out.tool = w.tool;
  if (w.eraserMode === "partial" || w.eraserMode === "stroke") out.eraserMode = w.eraserMode;
  if (typeof w.zoomLock === "boolean") out.zoomLock = w.zoomLock;
  if (typeof w.scaleWidths === "boolean") out.scaleWidths = w.scaleWidths;

  if (w.colors && typeof w.colors === "object") {
    out.colors = {};
    for (const [t, c] of Object.entries(w.colors))
      if (isTool(t) && typeof c === "string" && /^#[0-9a-f]{3,8}$/i.test(c)) out.colors[t] = c;
  }
  if (w.sizes && typeof w.sizes === "object") {
    out.sizes = {};
    for (const [t, s] of Object.entries(w.sizes)) {
      const spec = isTool(t) ? tools.size(t) : undefined;
      if (spec && typeof s === "number" && s >= spec.min && s <= spec.max)
        out.sizes[t as Tool] = s;
    }
  }
  return out;
}

export function saveWorkspace(w: Workspace) {
  try {
    localStorage.setItem(KEY, JSON.stringify(w));
  } catch {
    // Storage unavailable or full: the workspace is a convenience.
  }
}
