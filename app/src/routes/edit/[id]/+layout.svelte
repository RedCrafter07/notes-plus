<script>
  import { goto } from "$app/navigation";
  import { resolve } from "$app/paths";

  const { children } = $props();
</script>

<svelte:boundary
  onerror={(e) => {
    console.error(e);
    goto(resolve("/"));
  }}
>
  {@render children()}
</svelte:boundary>
