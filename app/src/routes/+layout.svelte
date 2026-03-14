<script lang="ts">
  import { onMount } from "svelte";
  import "@fontsource-variable/funnel-display";
  import "@fontsource-variable/funnel-sans";
  import "../app.css";
  import "../mocha.css";
  import { commands } from "$lib/tauri/bindings";
  import { timeout } from "$lib/util/timeout";

  const { children } = $props();

  onMount(async () => {
    await timeout(50);
    await commands.ready();
  });

  $effect(() => {
    const keydownEvent = async (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key == "q") {
        await commands.quit();
      }
    };
    const contextMenuEvent = (e: PointerEvent) => e.preventDefault();

    // We use capture: true to ensure it catches the event before anything else
    document.addEventListener("contextmenu", contextMenuEvent, {
      capture: true,
    });
    document.addEventListener("keydown", keydownEvent);

    return () => {
      document.removeEventListener("keydown", keydownEvent);
      document.removeEventListener("contextmenu", contextMenuEvent, {
        capture: true,
      });
    };
  });
</script>

<div class="min-h-screen bg-base-3 text-content-1">
  {@render children()}
</div>
