<script lang="ts">
  import { events } from "$lib/tauri/bindings";
  import type { UnlistenFn } from "@tauri-apps/api/event";
  import { cubicOut } from "svelte/easing";
  import { fade, scale } from "svelte/transition";

  let count = $state(0);

  $effect(() => {
    let unlisten: UnlistenFn;

    (async () => {
      unlisten = await events.dragDropFileEvent.listen((e) => {
        count = e.payload;
      });
    })();

    return () => {
      unlisten?.();
    };
  });
</script>

{#if count > 0}
  <div
    transition:fade={{ duration: 150 }}
    class="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-base-3/70 backdrop-blur-sm"
  >
    <svg
      class="absolute inset-0 h-full w-full"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
    >
      <rect
        x="0"
        y="0"
        width="100"
        height="100"
        fill="none"
        stroke="var(--color-primary)"
        stroke-width="8"
        stroke-dasharray="12 12"
        vector-effect="non-scaling-stroke"
        class="ants"
      />
    </svg>
    <p
      class="text-2xl font-bold"
      in:scale={{ duration: 200, start: 0.9, easing: cubicOut }}
    >
      Drop to open {count} notebook{count === 1 ? "" : "s"}
    </p>
  </div>
{/if}

<style>
  .ants {
    animation: ants 0.6s linear infinite;
  }
  @keyframes ants {
    to {
      /* offset by one full dash+gap period (12 + 12) for a seamless loop */
      stroke-dashoffset: -24;
    }
  }
</style>
