<script lang="ts">
  import { popupManager } from "$lib/state/popupManager.svelte";
  import { IconX } from "@tabler/icons-svelte";
  import { expoInOut } from "svelte/easing";
  import { fly } from "svelte/transition";

  let currentPopup = $derived(popupManager.currentPopup);
</script>

<div class="pointer-events-none top-4 left-4 absolute">
  {#if currentPopup}
    <div
      data-ui="true"
      in:fly={{
        y: 20,
        duration: 300,
        easing: expoInOut,
        opacity: 0,
      }}
      out:fly={{
        y: -20,
        duration: 300,
        easing: expoInOut,
        opacity: 0,
      }}
      class={[
        {
          "bg-destructive text-destructive-content":
            currentPopup.type === "destructive",
          "bg-info text-info-content": currentPopup.type === "info",
          "bg-success text-success-content": currentPopup.type === "success",
          "bg-warning text-warning-content": currentPopup.type === "warning",
        },
        "p-2 rounded-xl flex flex-col gap-2 pointer-events-auto w-max h-max",
      ]}
    >
      {#if currentPopup.title}
        <div class="flex flex-row gap-4 items-center justify-between w-full">
          <h3>{currentPopup.title}</h3>
          <button
            class="opacity-75 hover:opacity-100 transition-all aspect-square"
            onclick={() => {
              popupManager.remove();
            }}
          >
            <IconX />
          </button>
        </div>
        <p>{currentPopup.message}</p>
      {:else}
        <div class="flex flex-row gap-4 items-center justify-between w-full">
          <p class="flex-1">{currentPopup.message}</p>
          <button
            class="opacity-75 hover:opacity-100 transition-all aspect-square"
            onclick={() => {
              popupManager.remove();
            }}
          >
            <IconX />
          </button>
        </div>
      {/if}
    </div>
  {/if}
</div>
