<script lang="ts">
  import { tabManager } from "#lib/state/tabManager.svelte.ts";
  import JotDown from "./JotDown.svelte";
  import NotebookSettings from "./NotebookSettings.svelte";
  import PageOverview from "./PageOverview.svelte";
  import PageSettings from "./PageSettings.svelte";
  import Unsaved from "./Unsaved.svelte";
  import UnsavedClose from "./UnsavedClose.svelte";
</script>

<JotDown />
{#if tabManager.activeTab !== -1}
  <Unsaved />
  <PageOverview />
  <PageSettings />
  <UnsavedClose />
  <NotebookSettings />
{/if}
