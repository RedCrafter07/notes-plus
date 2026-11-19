<script lang="ts">
  import { contentManager } from "$lib/state/contentManager.svelte";
  import { canvasManager } from "./state/canvasManager.svelte";
  import { lassoManager } from "./state/lassoManager.svelte";

  let {
    visible,
    x,
    y,
  }: {
    visible: boolean;
    x: number;
    y: number;
  } = $props();

  const tool = $derived(canvasManager.tool);

  /** Diameter on screen, matching what the tool will actually touch. */
  let cursorWidth = $derived.by(() => {
    switch (tool) {
      case "eraser":
        return canvasManager.eraserRadius * 2 * contentManager.zoom;
      case "pen":
      case "highlighter":
        return Math.max(3, canvasManager.thickness * contentManager.zoom);
      default:
        return 8;
    }
  });

  const shown = $derived(
    visible &&
      tool !== "text" &&
      !(tool === "lasso" && !lassoManager.isSelecting),
  );
</script>

{#if shown}
  <div
    class={[
      "rounded-full aspect-square absolute pointer-events-none",
      tool === "eraser" ? "border-2 border-destructive bg-white/40" : "opacity-60",
    ]}
    style="width: {cursorWidth}px; top: {y - cursorWidth / 2}px; left: {x -
      cursorWidth / 2}px; {tool === 'pen' || tool === 'highlighter'
      ? `background-color: ${canvasManager.color};`
      : tool === 'lasso'
        ? 'background-color: #99ccff;'
        : ''}"
  ></div>
{/if}
