<script lang="ts">
  import { fsStore } from "#lib/state/fsStore.svelte.ts";
  import { IconArrowUp, IconChevronRight, IconFolder, IconHome } from "@tabler/icons-svelte";
  import NoteCard from "./NoteCard.svelte";
  import { contextMenu } from "#lib/state/contextMenu.svelte.ts";
  import { folderMenu } from "#lib/library/menus.ts";
  import { openNotebook } from "#lib/library/actions.svelte.ts";
  import { isFile, isFolder, type FolderEntry } from "#lib/util/fileSystem.svelte.ts";

  /*
   * Notebooks by folder. The breadcrumb shows where you are and every part of
   * it is a button, so moving around is tapping rather than typing a path.
   * Folders and notebooks have context menus (right-click or long-press).
   */
  const fs = $derived(fsStore.store);
  const crumbs = $derived(fs.path ? fs.path.split("/") : []);

  function goTo(depth: number) {
    fs.enterPath(crumbs.slice(0, depth).join("/"));
  }

  /** Notebooks in a folder, including its subfolders. */
  function count(folder: FolderEntry): number {
    return folder.content.reduce(
      (n, e) => n + (isFile(e) ? 1 : isFolder(e) ? count(e.Folder) : 0),
      0,
    );
  }
</script>

<div class="flex flex-col gap-3">
  <nav class="flex flex-row items-center gap-1 min-w-0" aria-label="Folder">
    <button
      class="w-11 h-11 shrink-0 grid place-items-center rounded-xl bg-base-3 text-content-3 hover:text-content-1 transition-all active:scale-95 disabled:opacity-30 disabled:pointer-events-none"
      onclick={() => fs.goBack()}
      disabled={fs.isRoot}
      aria-label="Up one folder"
      title="Up one folder"
    >
      <IconArrowUp />
    </button>
    <div class="flex-1 min-w-0 h-11 px-1 flex flex-row items-center gap-0.5 rounded-xl bg-base-3 overflow-x-auto hide-scrollbars">
      <button
        class={[
          "h-9 px-2 shrink-0 flex flex-row items-center gap-1.5 rounded-lg transition-all",
          crumbs.length === 0 ? "font-semibold text-content-1" : "text-content-3 hover:text-content-1 hover:bg-overlay/30",
        ]}
        onclick={() => fs.goToRoot()}
        aria-current={crumbs.length === 0 ? "location" : undefined}
      >
        <IconHome size={18} /> All notebooks
      </button>
      {#each crumbs as part, i (i)}
        {@const last = i === crumbs.length - 1}
        <IconChevronRight size={16} class="shrink-0 text-content-3" />
        <button
          class={[
            "h-9 px-2 shrink-0 rounded-lg transition-all",
            last ? "font-semibold text-content-1" : "text-content-3 hover:text-content-1 hover:bg-overlay/30",
          ]}
          onclick={() => goTo(i + 1)}
          aria-current={last ? "location" : undefined}
        >
          {part}
        </button>
      {/each}
    </div>
  </nav>

  <div class="grid grid-cols-[repeat(auto-fill,minmax(9rem,1fr))] gap-3">
    {#each fs.folders as folder (folder.name)}
      {@const path = fs.path ? `${fs.path}/${folder.name}` : folder.name}
      {@const n = count(folder)}
      <button
        class="p-2 bg-base-3 rounded-xl flex flex-col gap-2 text-content-2 hover:text-content-1 hover:bg-overlay/30 transition-all active:scale-95 text-left min-w-0"
        onclick={() => fs.enterFolder(folder.name)}
        use:contextMenu={() => folderMenu(path, () => fs.enterFolder(folder.name))}
        title={path}
      >
        <div class="w-full aspect-[3/4] rounded-lg bg-base-1 grid place-items-center">
          <IconFolder size={40} class="text-primary/80" />
        </div>
        <span class="flex flex-col min-w-0 px-1">
          <span class="font-semibold truncate">{folder.name}</span>
          <span class="text-xs text-content-3">{n} notebook{n === 1 ? "" : "s"}</span>
        </span>
      </button>
    {/each}
    {#each fs.files as file (file.path)}
      <NoteCard {file} onclick={() => openNotebook(file)} />
    {/each}
  </div>
  {#if fs.folders.length === 0 && fs.files.length === 0}
    <p class="text-content-3 text-center py-6">
      {fs.isRoot ? "No notebooks yet. Create one with New Notebook." : "This folder is empty."}
    </p>
  {/if}
</div>
