<script lang="ts">
  import "@fontsource-variable/funnel-sans";
  import "@fontsource-variable/funnel-display";
  import "../app.css";
  import "../mocha.css";

  const { children } = $props();

  import { invoke } from "@tauri-apps/api/core";

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
</script>

<div class="w-full min-h-screen text-content-1 bg-base-1">
  {@render children()}
</div>
