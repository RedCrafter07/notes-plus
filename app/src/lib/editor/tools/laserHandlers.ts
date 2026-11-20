import { laserManager } from "$lib/editor/state/laserManager.svelte";
import type { ToolHandler, ToolHandlers } from "./types";

const down: ToolHandler = (p, e) => {
  if (e.button === 0) laserManager.begin(p);
};
const move: ToolHandler = (p) => laserManager.add(p);
const up: ToolHandler = () => laserManager.end();

export const laser: ToolHandlers = { down, move, up };
