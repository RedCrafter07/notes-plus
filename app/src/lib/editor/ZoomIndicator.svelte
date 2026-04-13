<script lang="ts">
  import { contentManager } from "$lib/state/contentManager.svelte";
</script>

<div class="bottom-4 left-4 absolute rounded-xl p-2 z-10 text-black h-max">
  {Math.round(contentManager.zoom * 10000) / 100}%
</div>
