<script lang="ts">
  import { IconX } from "@tabler/icons-svelte";
  import type { Snippet } from "svelte";
  import { linear } from "svelte/easing";
  import { fade } from "svelte/transition";

  const {
    closeCb,
    visible,
    children,
    title,
    minHeight,
  }: {
    closeCb: () => void;
    visible: boolean;
    children: Snippet<[]>;
    title: string;
    minHeight?: boolean;
  } = $props();
</script>

{#if visible}
  <div
    class="absolute top-0 left-0 z-50 w-full h-screen"
    transition:fade={{ duration: 200, easing: linear }}
  >
    <div class="w-full h-full relative">
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div
        class="absolute top-0 pointer-events-auto w-full h-full backdrop-blur-3xl bg-base-1/50"
        onclick={closeCb}
      ></div>

      <div
        class="absolute top-0 pointer-events-none w-full h-full grid place-items-center"
      >
        <div
          class={[
            "pointer-events-auto w-3/4  rounded-xl bg-base-2 drop-shadow-lg p-4 flex flex-col gap-4",
            { "h-3/4": !minHeight },
          ]}
        >
          <div class="flex flex-row items-center w-full">
            <h1 class="text-3xl font-display font-medium">{title}</h1>
            <button
              class="ml-auto text-content-1 opacity-50 hover:text-destructive hover:opacity-100 active:scale-90 transition-all"
              onclick={() => {
                closeCb();
              }}
            >
              <IconX />
            </button>
          </div>
          {@render children()}
        </div>
      </div>
    </div>
  </div>
{/if}
