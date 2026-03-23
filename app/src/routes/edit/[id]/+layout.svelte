<script>
  import { goto } from "$app/navigation";
  import { resolve } from "$app/paths";

  const { children } = $props();
</script>

<svelte:boundary
  onerror={() => {
    goto(resolve("/"));
  }}
>
  {@render children()}
</svelte:boundary>
