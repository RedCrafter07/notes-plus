<script lang="ts">
  import { contentManager } from "$lib/state/contentManager.svelte";
  import { overlayManager } from "$lib/state/overlayManager.svelte";
  import { IconFileExport } from "@tabler/icons-svelte";
  import { goto } from "$app/navigation";
  import { resolve } from "$app/paths";
  import Input from "./Input.svelte";
  import Overlay from "./Overlay.svelte";
  import FolderPicker from "./FolderPicker.svelte";

  let visible = $derived(overlayManager.open === "notebook-settings");

  let titleSnapshot = $state(contentManager.title);

  $effect(() => {
    contentManager.id;

    titleSnapshot = contentManager.title;
  });

  function handleTitleBlur() {
    titleSnapshot = titleSnapshot.trim();

    if (titleSnapshot.length > 0) {
      contentManager.title = titleSnapshot;
      // tabManager.current = contentManager.export();
    } else {
      titleSnapshot = contentManager.title;
    }
  }
</script>

<Overlay
  closeCb={() => {
    overlayManager.close();
  }}
  {visible}
  title="Notebook Settings"
>
  <div class="flex flex-col gap-2">
    <Input
      label="Notebook Title"
      id="notebook-title"
      bind:value={titleSnapshot}
      onBlur={handleTitleBlur}
      placeholder="Creativity"
    />
  </div>

  <FolderPicker
    id="folder-picker-notebook"
    bind:value={contentManager.folder}
    type="select"
  />

  <button
    class="border-2 flex flex-row gap-2 items-center justify-center w-full border-primary text-primary hover:bg-primary hover:text-base-1 p-3 rounded-xl font-bold tracking-wider transition-all active:scale-95"
    onclick={() => {
      overlayManager.close();
      goto(resolve("/export/[id]", { id: contentManager.id }));
    }}
  >
    <IconFileExport /> Export…
  </button>
</Overlay>
