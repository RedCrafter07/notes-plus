<script lang="ts">
  import { getCurrentWindow } from "@tauri-apps/api/window";
  import { IconCopy, IconMinus, IconSquare, IconX } from "@tabler/icons-svelte";
  import { onMount } from "svelte";

  /*
   * Minimise / maximise / close for the merged title bar. Closing goes
   * through the normal close request, so the unsaved-changes check in the
   * root layout still runs.
   */
  const win = getCurrentWindow();
  let maximized = $state(false);

  onMount(() => {
    let unlisten: (() => void) | undefined;
    (async () => {
      maximized = await win.isMaximized();
      unlisten = await win.onResized(async () => {
        maximized = await win.isMaximized();
      });
    })();
    return () => unlisten?.();
  });

  const btn =
    "w-12 h-full grid place-items-center text-content-2 hover:text-content-1 transition-colors";
</script>

<div class="flex flex-row h-full shrink-0 -my-2 -mr-2" role="group" aria-label="Window">
  <button class="{btn} hover:bg-overlay/30" onclick={() => win.minimize()} aria-label="Minimise" title="Minimise">
    <IconMinus size={18} />
  </button>
  <button
    class="{btn} hover:bg-overlay/30"
    onclick={() => win.toggleMaximize()}
    aria-label={maximized ? "Restore" : "Maximise"}
    title={maximized ? "Restore" : "Maximise"}
  >
    {#if maximized}
      <IconCopy size={16} class="-scale-x-100" />
    {:else}
      <IconSquare size={15} />
    {/if}
  </button>
  <button
    class="{btn} hover:bg-destructive hover:text-destructive-content"
    onclick={() => win.close()}
    aria-label="Close"
    title="Close"
  >
    <IconX size={18} />
  </button>
</div>
