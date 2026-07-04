<script lang="ts">
  import { IconTrash, IconX } from "@tabler/icons-svelte";
  import { fade, scale } from "svelte/transition";
  import { quintOut } from "svelte/easing";
  import ColorPicker from "./ColorPicker.svelte";

  let {
    value = $bindable(),
    onClose,
    onDelete,
    canDelete = true,
  }: {
    /** The color being edited, as a `#rrggbb` hex string. Two-way bindable. */
    value: string;
    onClose: () => void;
    onDelete: () => void;
    canDelete?: boolean;
  } = $props();
</script>

<svelte:window
  onkeydown={(e) => {
    if (e.key === "Escape") onClose();
  }}
/>

<!-- data-ui marks this as UI so the canvas controller ignores pointer input here -->
<div data-ui="true" class="absolute inset-0 z-30">
  <!-- Click-away backdrop -->
  <div
    class="absolute inset-0"
    onclick={onClose}
    transition:fade={{ duration: 150 }}
    role="presentation"
  ></div>

  <div
    class="absolute right-40 top-1/2 flex w-72 -translate-y-1/2 flex-col gap-3 rounded-2xl bg-base-1 p-4 drop-shadow-lg"
    transition:scale={{ duration: 180, start: 0.95, easing: quintOut }}
  >
    <div class="flex flex-row items-center">
      <h2 class="font-display text-lg font-medium">Edit color</h2>
      <button
        class="ml-auto text-content-1 opacity-50 transition-all hover:text-destructive hover:opacity-100 active:scale-90"
        onclick={onClose}
        aria-label="Close"
      >
        <IconX />
      </button>
    </div>

    <ColorPicker bind:value />

    {#if canDelete}
      <button
        class="flex flex-row items-center justify-center gap-2 rounded-xl border-2 border-destructive p-2 font-medium tracking-wide text-destructive transition-all hover:bg-destructive hover:text-destructive-content active:scale-95"
        onclick={onDelete}
      >
        <IconTrash size={20} />
        <span>Remove color</span>
      </button>
    {/if}
  </div>
</div>
