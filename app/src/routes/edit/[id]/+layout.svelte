<script>
  import { goto } from "$app/navigation";
  import { resolve } from "$app/paths";
  import EditorBar from "$lib/components/EditorBar.svelte";

  const { children } = $props();
</script>

<div class="flex flex-row h-full relative">
  <div class="flex-1 h-full relative">
    <svelte:boundary
      onerror={(e) => {
        console.error(e);
        goto(resolve("/"));
      }}
    >
      {@render children()}
    </svelte:boundary>
  </div>
  <EditorBar />
</div>
