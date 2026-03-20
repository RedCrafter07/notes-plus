<script lang="ts">
  import { overlayManager } from "$lib/state/overlayManager.svelte";
  import { tabManager } from "$lib/state/tabManager.svelte";
  import Overlay from "./Overlay.svelte";

  let visible = $derived(overlayManager.open?.startsWith("unsaved-") ?? false);

  let firstButton = $state<HTMLButtonElement>();

  $effect(() => {
    if (!firstButton) return;
    if (visible) firstButton.focus();
  });

  let tabToClose = $derived(
    parseInt(overlayManager.open?.split("-")[1] ?? "-1"),
  );
</script>

<Overlay
  {visible}
  title="Unsaved changes"
  closeCb={() => {
    overlayManager.close();
  }}
  minHeight
>
  <h3 class="text-xl">You have unsaved changes!</h3>

  <div class="flex flex-row gap-2 w-full">
    <button
      bind:this={firstButton}
      class="bg-transparent hover:bg-success border-2 focus:bg-success/10 border-success text-success hover:text-success-content p-2 rounded-xl flex-1 transition-all focus:outline-none"
      tabindex="0"
      onclick={() => {
        overlayManager.close();
      }}
    >
      Continue
    </button>
    <button
      class="bg-transparent hover:bg-destructive border-2 focus:bg-destructive/10 border-destructive text-destructive hover:text-destructive-content p-2 rounded-xl flex-1 transition-all focus:outline-none"
      onclick={() => {
        tabManager.remove(tabToClose, true);
        overlayManager.close();
      }}
    >
      Don't save
    </button>
  </div>
</Overlay>
