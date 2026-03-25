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

  let cursorWidth = $derived(
    (canvasManager.tool === "lasso"
      ? 8 / contentManager.zoom
      : canvasManager.tool === "eraser"
        ? canvasManager.eraserRadius * 2
        : canvasManager.tool === "pen"
          ? canvasManager.thickness
          : 8) * contentManager.zoom,
  );
</script>

{#if visible && !(canvasManager.tool === "lasso" && !lassoManager.isSelecting)}
  <div
    class={[
      "rounded-full aspect-square absolute pointer-events-none opacity-50",
      {
        "border border-destructive": canvasManager.tool === "eraser",
      },
    ]}
    style="width: {cursorWidth}px; background-color: {canvasManager.tool ===
    'pen'
      ? canvasManager.color
      : canvasManager.tool === 'eraser'
        ? '#ffffff'
        : '#99ccff'}; top: {y - cursorWidth / 2}px; left:{x -
      cursorWidth / 2}px;"
  ></div>
{/if}
