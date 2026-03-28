<script lang="ts">
  import {
    IconEraser,
    IconLasso,
    IconPencil,
    IconZoomCancel,
    IconZoomCheck,
  } from "@tabler/icons-svelte";
  import { canvasManager } from "./state/canvasManager.svelte";
  import ColorPicker from "$lib/components/ColorPicker.svelte";
  import { fly } from "svelte/transition";
  import { cubicInOut } from "svelte/easing";

  let color = $state(canvasManager.color);

  $effect(() => {
    canvasManager.color = color;
  });
</script>

{#snippet penToolbar()}
  <!-- color -->
  <ColorPicker bind:value={color} />
  <!-- <button onclick={() => {
    
  }} tabindex="-1" title="Current Thickness">
    <div
      class="aspect-square rounded-full bg-content-1"
      style="width: {canvasManager.thickness}px;"
    ></div>
  </button> -->
  <button
    onclick={() => {
      canvasManager.zoomLock = !canvasManager.zoomLock;
    }}
  >
    {#if canvasManager.zoomLock}
      <IconZoomCheck />
    {:else}
      <IconZoomCancel />
    {/if}
  </button>
{/snippet}

<div class="top-0 right-4 flex h-full pointer-events-none absolute flex-row">
  <div class="grid grid-cols-1 grid-rows-1 items-start justify-items-start">
    {#if canvasManager.tool === "pen"}
      <div
        style="grid-area: 1 / 1;"
        class="p-4 w-10 rounded-l-xl bg-base-3 flex flex-col gap-4 my-auto items-center justify-center pointer-events-auto z-0"
        transition:fly={{ duration: 150, easing: cubicInOut, x: "100%" }}
      >
        {@render penToolbar()}
      </div>
    {/if}
  </div>
  <div
    class="p-1 w-12 rounded-xl bg-base-1 flex flex-col gap-1 my-auto pointer-events-auto items-center justify-center z-10"
  >
    <button
      class="aspect-square p-2 relative"
      onclick={() => {
        if (canvasManager.tool === "pen") canvasManager.lockTool = true;
        else {
          canvasManager.lockTool = false;
          canvasManager.tool = "pen";
        }
      }}
    >
      <IconPencil />
    </button>
    <button
      class="aspect-square p-2 flex items-center justify-center"
      onclick={() => {
        if (canvasManager.tool === "eraser") canvasManager.lockTool = true;
        else {
          canvasManager.lockTool = false;
          canvasManager.tool = "eraser";
        }
      }}
    >
      <IconEraser />
    </button>
    <button
      class="aspect-square p-2"
      onclick={() => {
        if (canvasManager.tool === "lasso") canvasManager.lockTool = true;
        else {
          canvasManager.lockTool = false;
          canvasManager.tool = "lasso";
        }
      }}
    >
      <IconLasso />
    </button>
  </div>
</div>
