<script lang="ts">
  import { contentManager } from "$lib/state/contentManager.svelte";
  import { IconCopy, IconTrash } from "@tabler/icons-svelte";
  import { canvasManager } from "./state/canvasManager.svelte";
  import { lassoManager } from "./state/lassoManager.svelte";
  import { fade } from "svelte/transition";

  let height = $state(0);
  let width = $state(0);

  let position = $derived(
    lassoManager.boundingBox
      ? canvasManager.translateToAbsolute({
          x: lassoManager.boundingBox.x,
          y: lassoManager.boundingBox.y,
          pressure: 0,
        }).y -
          height <
        0
        ? "bottom"
        : "top"
      : "top",
  );
  let additionalOffset = $derived(
    position == "bottom" ? (lassoManager.boundingBox?.height ?? 0) + height : 0,
  );
  let topOffset = $derived(
    lassoManager.boundingBox
      ? canvasManager.translateToAbsolute({
          x: lassoManager.boundingBox.x,
          y: lassoManager.boundingBox.y,
          pressure: 0,
        }).y -
          height +
          additionalOffset
      : 0,
  );
  let leftOffset = $derived(
    lassoManager.boundingBox
      ? canvasManager.translateToAbsolute({
          x: lassoManager.boundingBox.x,
          y: lassoManager.boundingBox.y,
          pressure: 0,
        }).x +
          (lassoManager.boundingBox.width * contentManager.zoom - width) / 2
      : 0,
  );
</script>

{#if !lassoManager.isSelecting && !lassoManager.isDraggingSelection && canvasManager.tool === "lasso"}
  <div
    data-ui="true"
    transition:fade={{ duration: 100 }}
    bind:clientHeight={height}
    bind:clientWidth={width}
    class="absolute p-4 rounded-xl bg-base-1 pointer-events-auto flex flex-row gap-3 items-center z-50"
    style="top: {topOffset}px; left: {leftOffset}px"
    role="group"
  >
    <button
      class="cursor-pointer"
      onpointerdown={(e) => {
        e.stopPropagation();
        lassoManager.deleteSelection();
        canvasManager.redrawStrokes();
      }}
    >
      <IconTrash />
    </button>
    <button
      class="cursor-pointer"
      onpointerdown={(e) => {
        e.stopPropagation();
        lassoManager.duplicateSelection();
        canvasManager.redrawStrokes();
      }}
    >
      <IconCopy />
    </button>
  </div>
{/if}
