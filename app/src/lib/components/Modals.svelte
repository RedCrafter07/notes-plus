<script lang="ts">
  import { tabManager } from "$lib/state/tabManager.svelte";
  import JotDown from "./JotDown.svelte";
  import NotebookSettings from "./NotebookSettings.svelte";
  import PageSettings from "./PageSettings.svelte";
  import Unsaved from "./Unsaved.svelte";
  import UnsavedClose from "./UnsavedClose.svelte";
</script>

<JotDown />
{#if tabManager.activeTab !== -1}
  <Unsaved />
  <PageSettings />
  <UnsavedClose />
  <NotebookSettings />
{/if}
