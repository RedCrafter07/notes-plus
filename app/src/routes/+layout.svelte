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

  const { children } = $props();

  $effect(() => {
    document.addEventListener("keydown", handleQuit);

    return () => {
      document.removeEventListener("keydown", handleQuit);
    };
  });

  async function handleQuit(e: KeyboardEvent) {
    if (!e.ctrlKey) return;
    if (e.key !== "q") return;

    e.preventDefault();
    await invoke("quit");
  }

  invoke("view_window");
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
