<script lang="ts">
  import { tick } from "svelte";
  import { IconCheck } from "@tabler/icons-svelte";
  import {
    libraryDialog,
    moveNotebook,
    renameFolder,
    renameNotebook,
  } from "#lib/library/actions.svelte.ts";
  import FolderPicker from "./FolderPicker.svelte";
  import Overlay from "./Overlay.svelte";

  /*
   * The dialogs behind the notebook context menu: rename a notebook, move it
   * to a folder, rename a folder. Enter confirms, Escape cancels.
   */
  const d = $derived(libraryDialog.current);

  let text = $state("");
  let folder = $state<string | null>(null);
  let input = $state<HTMLInputElement>();
  let busy = $state(false);

  // Prefill when a dialog opens, and select the text so typing replaces it.
  $effect(() => {
    if (!d) return;
    if (d.kind === "rename") text = d.file.title;
    else if (d.kind === "renameFolder") text = d.folder;
    else folder = d.file.folder;
    tick().then(() => input?.select());
  });

  const close = () => (libraryDialog.current = undefined);

  async function confirm() {
    if (!d || busy) return;
    busy = true;
    try {
      if (d.kind === "rename") await renameNotebook(d.file, text);
      else if (d.kind === "move") await moveNotebook(d.file, folder);
      else {
        const to = text.split("/").map((s) => s.trim()).filter(Boolean).join("/");
        if (to && to !== d.folder) await renameFolder(d.folder, to);
      }
      close();
    } finally {
      busy = false;
    }
  }

  const titles = {
    rename: "Rename notebook",
    move: "Move to folder",
    renameFolder: "Rename folder",
  } as const;
</script>

<Overlay visible={!!d} closeCb={close} title={d ? titles[d.kind] : ""} minHeight>
  {#if d}
    <form
      class="flex flex-col gap-4"
      onsubmit={(e) => {
        e.preventDefault();
        confirm();
      }}
    >
      {#if d.kind === "move"}
        <p class="text-content-2">
          Where should <span class="font-semibold text-content-1">{d.file.title}</span> go?
        </p>
        <FolderPicker id="move-folder" bind:value={folder} />
      {:else}
        {#if d.kind === "renameFolder"}
          <p class="text-content-2">
            Every notebook in this folder moves along. Use slashes to nest it,
            like <span class="font-mono">Uni/Physics</span>.
          </p>
        {/if}
        <input
          bind:this={input}
          bind:value={text}
          class="h-12 px-3 rounded-xl bg-base-3 text-lg focus:outline-none focus:ring-2 focus:ring-primary"
          aria-label={d.kind === "rename" ? "Notebook name" : "Folder path"}
          autocomplete="off"
        />
      {/if}
      <div class="flex flex-row justify-end gap-2">
        <button
          type="button"
          class="h-11 px-4 rounded-xl text-content-2 hover:bg-overlay/30 active:scale-95 transition-all"
          onclick={close}
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={busy || (d.kind !== "move" && !text.trim())}
          class="h-11 px-4 flex flex-row gap-2 items-center rounded-xl border-2 border-success text-success hover:bg-success hover:text-success-content font-semibold active:scale-95 transition-all disabled:opacity-40 disabled:pointer-events-none"
        >
          <IconCheck size={20} />
          {d.kind === "move" ? "Move" : "Rename"}
        </button>
      </div>
    </form>
  {/if}
</Overlay>
