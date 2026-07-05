<script lang="ts">
  import { overlayManager } from "$lib/state/overlayManager.svelte";
  import { commands } from "$lib/tauri/bindings";
  import Overlay from "./Overlay.svelte";

  let visible = $derived(overlayManager.open === "close-unsaved");
</script>

<Overlay
  {visible}
  title="Unsaved tabs are still open!"
  closeCb={() => {
    overlayManager.close();
  }}
  minHeight
>
  <p>
    When you close now, all unsaved changes will be lost. Would you like to
    continue?
  </p>

  <div class="flex flex-row gap-2 w-full">
    <button
      class="bg-transparent border-2 focus:not-hover:bg-success/10 border-success text-success hover:text-success-content hover:bg-success p-2 rounded-xl flex-1 transition-all focus:outline-none"
      tabindex="0"
      onclick={() => {
        overlayManager.close();
      }}
    >
      Return
    </button>
    <button
      class="bg-transparent hover:bg-destructive border-2 focus:not-hover:bg-destructive/10 border-destructive text-destructive hover:text-destructive-content p-2 rounded-xl flex-1 transition-all focus:outline-none"
      onclick={async () => {
        await commands.quit();
      }}
    >
      Close anyway
    </button>
  </div>
</Overlay>
