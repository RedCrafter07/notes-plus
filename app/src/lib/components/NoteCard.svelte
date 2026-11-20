<script lang="ts">
  import type { File } from "#lib/tauri/bindings.ts";
  import { IconNotebook } from "@tabler/icons-svelte";

  /**
   * A note as a little sheet of paper: its first page if the file carries a
   * preview (saved by this version onwards), otherwise a notebook icon.
   */
  let { file, onclick }: { file: File; onclick: () => void } = $props();

  const dateFormat = new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
</script>

<button
  class="group flex flex-col gap-2 p-2 rounded-xl bg-base-3 hover:bg-overlay/30 active:scale-95 transition-all text-left min-w-0"
  {onclick}
  title={file.title}
>
  <div
    class="w-full aspect-[3/4] rounded-lg overflow-hidden bg-base-1 grid place-items-center shadow-sm"
  >
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
  <div class="flex flex-col min-w-0 px-1">
    <span class="font-semibold truncate">{file.title}</span>
    <span class="text-xs text-content-3 truncate">
      {dateFormat.format(new Date(Number(file.edited_at) * 1000))}
    </span>
  </div>
</button>
