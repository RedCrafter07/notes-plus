<script lang="ts">
  import { contentManager } from "#lib/state/contentManager.svelte.ts";
  import { IconArrowsDiagonal, IconCopy, IconLineHeight, IconTrash } from "@tabler/icons-svelte";
  import Slider from "#lib/components/Slider.svelte";
  import { formatSize } from "#lib/util/format.ts";
  import { toolDef } from "./tools/registry";
  import { canvasManager } from "./state/canvasManager.svelte";
  import { lassoManager } from "./state/lassoManager.svelte";
  import { fade } from "svelte/transition";
  import { onMount } from "svelte";
  import ColorSwatch from "#lib/components/ColorSwatch.svelte";

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

  /*
   * Width of the selected ink. If every stroke has the same width, the
   * slider shows that width (half steps, like the pen); with mixed widths it
   * scales them all by a percentage, keeping their proportions. Either way
   * it works relative to the widths when the drag began, and one drag is
   * one undo step (`scaleWidth` / `endWidthChange`).
   */
  const PEN = toolDef("pen").size!;
  let widthOpen = $state(false);
  const widths = $derived(lassoManager.strokeWidths);
  const hasInk = $derived(widths.length > 0);
  /** The width all selected strokes share, or null if they differ. Always
   *  read from the strokes, so it is right after an undo, too. */
  const commonWidth = $derived(widths.every((w) => w === widths[0]) ? widths[0] : null);

  // During a drag the slider shows the dragged value, and scaling is
  // relative to the widths when the drag began; between drags it shows the
  // strokes' current width (or 100 % for mixed widths).
  let dragBase: number | null = null;
  let dragValue = $state<number>();
  const sliderValue = $derived(dragValue ?? commonWidth ?? 100);

  function openWidth() {
    widthOpen = !widthOpen;
  }

  function changeWidth(v: number) {
    if (dragValue === undefined) dragBase = commonWidth;
    dragValue = v;
    lassoManager.scaleWidth(dragBase !== null ? v / dragBase : v / 100);
  }

  function endWidth() {
    lassoManager.endWidthChange();
    dragValue = undefined;
  }

  // The popover never covers the ink it changes, nor sits under the main
  // toolbar: with the menu above the selection it goes below the selection,
  // with the menu below it, below the menu.
  const popoverTop = $derived(
    position === "top"
      ? height + (lassoManager.boundingBox?.height ?? 0) * contentManager.zoom + 8
      : height + 8,
  );

  // Close the popover with the selection.
  $effect(() => {
    if (!lassoManager.selection) widthOpen = false;
  });
</script>

{#if !lassoManager.isSelecting && !lassoManager.isDraggingSelection && !lassoManager.scaling && canvasManager.tool === "lasso"}
  <div
    data-ui="true"
    transition:fade={{ duration: 100 }}
    bind:clientHeight={height}
    bind:clientWidth={width}
    class="absolute p-2 rounded-xl bg-base-1/80 backdrop-blur-md shadow-lg pointer-events-auto flex flex-row gap-1 items-center z-10"
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
    {#if hasInk}
      <button
        class={[
          "cursor-pointer p-2 rounded-lg active:scale-90 transition-all",
          widthOpen ? "bg-primary text-base-1" : "hover:bg-overlay/30",
        ]}
        onpointerdown={(e) => e.stopPropagation()}
        onclick={openWidth}
        aria-label="Line width"
        aria-expanded={widthOpen}
        title="Line width"
      >
        <IconLineHeight />
      </button>
    {/if}
    <!-- What the corner handles do with line widths and font sizes. -->
    <button
      class={[
        "cursor-pointer p-2 rounded-lg active:scale-90 transition-all",
        lassoManager.scaleWidths ? "bg-primary/20 text-primary" : "hover:bg-overlay/30",
      ]}
      onpointerdown={(e) => e.stopPropagation()}
      onclick={() => (lassoManager.scaleWidths = !lassoManager.scaleWidths)}
      aria-pressed={lassoManager.scaleWidths}
      aria-label="Scale line widths with the selection"
      title={lassoManager.scaleWidths
        ? "Scaling also scales line widths and text (tap to keep them)"
        : "Scaling keeps line widths and text size (tap to scale them too)"}
    >
      <IconArrowsDiagonal />
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
    {#if widthOpen && hasInk}
      <div
        class="absolute left-1/2 -translate-x-1/2 w-64 p-3 rounded-xl bg-base-1/90 backdrop-blur-md shadow-lg border border-content-1/10 flex flex-col gap-1"
        style:top="{popoverTop}px"
        role="group"
        aria-label="Line width"
        onpointerdown={(e) => e.stopPropagation()}
      >
        <div class="flex flex-row justify-between text-sm text-content-2">
          <span>{commonWidth !== null ? "Line width" : "Line width (mixed)"}</span>
          <span class="tabular-nums">
            {commonWidth !== null ? formatSize(sliderValue) : `${sliderValue} %`}
          </span>
        </div>
        {#if commonWidth !== null}
          <Slider
            label="Line width"
            min={PEN.min}
            max={PEN.max}
            step={PEN.step ?? 1}
            value={sliderValue}
            onchange={changeWidth}
            oncommit={endWidth}
          />
        {:else}
          <Slider
            label="Line width, percent of current"
            min={25}
            max={400}
            step={5}
            value={sliderValue}
            onchange={changeWidth}
            oncommit={endWidth}
          />
        {/if}
      </div>
    {/if}
  </div>
{/if}
