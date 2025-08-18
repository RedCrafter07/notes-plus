<script lang="ts">
  import "@fontsource-variable/funnel-sans";
  import "@fontsource-variable/funnel-display";
  import "../app.css";
  import "../mocha.css";
  import { page } from "$app/state";
  import { invoke } from "@tauri-apps/api/core";
  import { fade, fly } from "svelte/transition";
  import { expoOut } from "svelte/easing";
  import Tabs from "$lib/components/Tabs.svelte";
  import { listen } from "@tauri-apps/api/event";
  import { tabManager } from "$lib/tabs/tabs.svelte";

  const { children } = $props();

  $effect(() => {
    document.addEventListener("keydown", handleQuit);

    document.addEventListener("focus", handleInitialFocus);

    (async () => {
      await listen<string>("open-tab", async (event) => {
        console.log("Welcome!");
        console.log("Requested tab opening: ", event.payload);
        await tabManager.loadFile(event.payload, true);
      });
      const tabToOpen: string | null = await invoke("view_window");

      if (tabToOpen) {
        await tabManager.loadFile(tabToOpen, true, true);
      }
    })();

    return () => {
      document.removeEventListener("keydown", handleQuit);
    };
  });

  async function handleInitialFocus() {
    document.removeEventListener("focus", handleInitialFocus);
  }

  async function handleQuit(e: KeyboardEvent) {
    if (!e.ctrlKey) return;
    if (e.key !== "q") return;

    e.preventDefault();
    await invoke("quit");
  }
</script>

<div
  class="w-full min-h-screen text-content-1 bg-base-3 relative overflow-hidden flex flex-col"
>
  <!-- Static elements -->
  <Tabs />
  <div class="relative flex-1">
    {#key page.url.pathname}
      <div
        class="w-full h-screen bg-base-1 absolute top-0 overflow-auto flex-1"
        in:fly={{ duration: 300, x: -200, easing: expoOut }}
        out:fade={{ duration: 300 }}
      >
        {@render children()}
      </div>
    {/key}
  </div>
</div>
