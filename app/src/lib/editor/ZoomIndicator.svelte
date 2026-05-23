<script lang="ts">
  import { contentManager } from "$lib/state/contentManager.svelte";
</script>

<button
  class={[
    "bottom-4 left-4 absolute rounded-xl p-2 z-10 bg-primary text-base-1 h-max active:scale-90 transition-all",
    {
      "opacity-0 pointer-events-none": contentManager.zoom === 1,
      "opacity-100 pointer-events-auto": contentManager.zoom !== 1,
    },
  ]}
  onclick={() => {
    contentManager.zoom = 1;
  }}
>
  {Math.round(contentManager.zoom * 10000) / 100}%
</button>
