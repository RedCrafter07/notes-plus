<script>
  import EditorBar from "#lib/components/EditorBar.svelte";
  import ErrorPanel from "#lib/components/ErrorPanel.svelte";

  const { children } = $props();
</script>

<div class="flex flex-row h-full relative">
  <div class="flex-1 h-full relative">
    <!-- A crash shows what happened instead of silently leaving the editor. -->
    <svelte:boundary onerror={(e) => console.error(e)}>
      {@render children()}
      {#snippet failed(error, reset)}
        <ErrorPanel {error} {reset} where="the editor" />
      {/snippet}
    </svelte:boundary>
  </div>
  <EditorBar />
</div>
