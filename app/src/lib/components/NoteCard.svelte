<script lang="ts">
  import type { File } from "#lib/tauri/bindings.ts";
  import { IconDots, IconLoader2, IconNotebook } from "@tabler/icons-svelte";
  import { contextMenu, contextMenuState } from "#lib/state/contextMenu.svelte.ts";
  import { notebookMenu } from "#lib/library/menus.ts";
  import { opening } from "#lib/library/actions.svelte.ts";

  /**
   * Right-click, long-press or the ⋯ button open the notebook's menu.
   *
   * A note as a little sheet of paper: its first page if the file carries a
   * preview (saved by this version onwards), otherwise a notebook icon.
   */
  let { file, onclick }: { file: File; onclick: () => void } = $props();

  const dateFormat = new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
</script>

<div
  class="group relative min-w-0"
  use:contextMenu={() => notebookMenu(file)}
>
  <button
    class="w-full flex flex-col gap-2 p-2 rounded-xl bg-base-3 hover:bg-overlay/30 active:scale-95 transition-all text-left min-w-0"
    {onclick}
    title={file.title}
  >
    <div
      class="relative w-full aspect-[3/4] rounded-lg overflow-hidden bg-base-1 grid place-items-center shadow-sm"
      aria-busy={opening.has(file.path)}
    >
      {#if opening.has(file.path)}
        <!-- Reading a big note can take a moment. -->
        <div class="absolute inset-0 grid place-items-center bg-base-3/60 backdrop-blur-[1px]">
          <IconLoader2 size={36} class="animate-spin text-primary" aria-label="Opening" />
        </div>
      {/if}
      {#if file.preview}
        <img
          src={file.preview}
          alt=""
          draggable="false"
          class="w-full h-full object-contain bg-base-1"
        />
      {:else}
        <IconNotebook size={36} class="text-primary/70" />
      {/if}
    </div>
    <div class="flex flex-col min-w-0 px-1 pr-8">
      <span class="font-semibold truncate">{file.title}</span>
      <span class="text-xs text-content-3 truncate">
        {dateFormat.format(new Date(Number(file.edited_at) * 1000))}
      </span>
    </div>
  </button>
  <!-- Visible on hover/focus with a mouse, always on touch screens. -->
  <button
    class="absolute bottom-2 right-1 w-9 h-9 grid place-items-center rounded-lg text-content-3 hover:text-content-1 hover:bg-overlay/30 transition-all opacity-0 group-hover:opacity-100 focus:opacity-100 [@media(hover:none)]:opacity-100"
    aria-label="More actions for {file.title}"
    title="More actions"
    onclick={(e) => {
      const r = e.currentTarget.getBoundingClientRect();
      const { items, title } = notebookMenu(file);
      contextMenuState.show(r.left, r.bottom + 4, items, title);
    }}
  >
    <IconDots size={20} />
  </button>
</div>
