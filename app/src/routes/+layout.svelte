<script lang="ts">
  import "@fontsource-variable/funnel-display/wght.css";
  import "@fontsource-variable/funnel-sans/wght.css";
  import "../app.css";
  import "../mocha.css";
  import { getCurrentWindow } from "@tauri-apps/api/window";
  import AppShell from "$lib/components/AppShell.svelte";
  import { AUDIENCE } from "$lib/present/protocol";

  const { children } = $props();

  /*
   * The presenter-mode audience window loads the same app at /present. It
   * must not run the app shell (startup, tabs, autosave, quit-on-close), so
   * it renders only its page.
   */
  const audience = getCurrentWindow().label === AUDIENCE;
</script>

{#if audience}
  {@render children()}
{:else}
  <AppShell>{@render children()}</AppShell>
{/if}
