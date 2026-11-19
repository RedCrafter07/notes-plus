<script lang="ts">
  import { contentManager } from "$lib/state/contentManager.svelte";
  import { IconCopy, IconTrash } from "@tabler/icons-svelte";
  import { canvasManager } from "./state/canvasManager.svelte";
  import { lassoManager } from "./state/lassoManager.svelte";
  import { fade } from "svelte/transition";
  import { onMount } from "svelte";
  import ColorSwatch from "$lib/components/ColorSwatch.svelte";

  let color = $state<string>("#000000");

  let height = $state(0);
  let width = $state(0);

  let position = $derived(
    lassoManager.boundingBox
      ? canvasManager.translateToAbsolute({
          x: lassoManager.boundingBox.x,
          y: lassoManager.boundingBox.y,
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
        }).x +
          (lassoManager.boundingBox.width * contentManager.zoom - width) / 2
      : 0,
  );

  $effect(() => {
    color = lassoManager.selectionColor ?? "#00000000";
  });
</script>

{#if !lassoManager.isSelecting && !lassoManager.isDraggingSelection && canvasManager.tool === "lasso"}
  <div
    data-ui="true"
    transition:fade={{ duration: 100 }}
    bind:clientHeight={height}
    bind:clientWidth={width}
    class="absolute p-2 rounded-xl bg-base-1 shadow-lg pointer-events-auto flex flex-row gap-1 items-center z-50"
    style="top: {topOffset}px; left: {leftOffset}px"
    role="group"
  >
    <button
      class="cursor-pointer p-2 rounded-lg hover:bg-overlay/30 active:scale-90 transition-all"
      onpointerdown={(e) => {
        e.stopPropagation();
      }}
    >
      <ColorSwatch
        value={color}
        onchange={(c) => lassoManager.colorSelection(c)}
      />
    </button>
    <button
      class="cursor-pointer p-2 rounded-lg hover:bg-overlay/30 active:scale-90 transition-all"
      onpointerdown={(e) => {
        e.stopPropagation();
        lassoManager.deleteSelection();
      }}
      aria-label="Delete selection"
      title="Delete"
    >
      <IconTrash />
    </button>
    <button
      class="cursor-pointer p-2 rounded-lg hover:bg-overlay/30 active:scale-90 transition-all"
      onpointerdown={(e) => {
        e.stopPropagation();
        lassoManager.duplicateSelection();
      }}
      aria-label="Duplicate selection"
      title="Duplicate"
    >
      <IconCopy />
    </button>
  </div>
{/if}
