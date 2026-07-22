<script lang="ts">
  import { contentManager } from "$lib/state/contentManager.svelte";
  import { overlayManager } from "$lib/state/overlayManager.svelte";
  import { IconDownload } from "@tabler/icons-svelte";
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
    class="border-2 flex flex-row gap-2 items-center w-full border-content-3 text-content-3 p-2 rounded-xl font-bold tracking-wider justify-center"
    style="cursor: not-allowed;"
    disabled
  >
    <IconDownload /> Export
    <p
      class="bg-warning text-warning-content rounded-xl px-1 font-normal tracking-normal"
      style="cursor: not-allowed;"
    >
      Soon!
    </p>
  </button>
</Overlay>
