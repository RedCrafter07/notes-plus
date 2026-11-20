<script lang="ts">
  import { tick } from "svelte";
  import { fly } from "svelte/transition";
  import {
    IconCheck,
    IconChevronDown,
    IconChevronRight,
    IconFolder,
    IconFolderPlus,
    IconInbox,
  } from "@tabler/icons-svelte";
  import { fsStore } from "#lib/state/fsStore.svelte.ts";
  import { fuzzySearch } from "#lib/util/fuzzySearch.ts";

  /*
   * Picks the folder a notebook lives in. The button shows the current folder
   * as a path; the panel lists every folder as a tree, filters as you type,
   * and offers to create the typed folder when it doesn't exist yet. Every
   * row is tappable (pen/touch), and the keyboard works too: type, arrows,
   * Enter, Escape.
   *
   * Folders exist only as the `folder` of the notes in them, so "creating"
   * one just means choosing a path nothing uses yet.
   */
  let {
    id,
    value = $bindable(),
    onchange,
  }: {
    id: string;
    value?: string | null;
    onchange?: (folder: string | null) => void;
  } = $props();

  type Option =
    | { kind: "none" }
    | { kind: "folder"; path: string; indices: number[] }
    | { kind: "create"; path: string };

  let open = $state(false);
  let query = $state("");
  let active = $state(0);
  let root = $state<HTMLDivElement>();
  let search = $state<HTMLInputElement>();

  const normalize = (s: string) =>
    s.split("/").map((p) => p.trim()).filter(Boolean).join("/");

  const folders = $derived.by(() => {
    const all = new Set(fsStore.store.allFolders);
    if (value) all.add(value); // a just-created folder has no notes yet
    return [...all].sort((a, b) => a.localeCompare(b));
  });

  const options = $derived.by((): Option[] => {
    const q = normalize(query);
    if (!q) {
      return [
        { kind: "none" },
        ...folders.map((path) => ({ kind: "folder" as const, path, indices: [] })),
      ];
    }
    const found: Option[] = fuzzySearch(q, folders)
      .slice(0, 30)
      .map((r) => ({ kind: "folder" as const, path: r.item, indices: r.indices }));
    if (!folders.some((f) => f.toLowerCase() === q.toLowerCase()))
      found.push({ kind: "create", path: q });
    return found;
  });

  $effect(() => {
    void options;
    active = 0;
  });

  async function show() {
    open = true;
    query = "";
    await tick();
    search?.focus();
  }

  function pick(o: Option) {
    const next = o.kind === "none" ? null : o.path;
    open = false;
    if (next !== value) {
      value = next;
      onchange?.(next);
    }
  }

  function keydown(e: KeyboardEvent) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const d = e.key === "ArrowDown" ? 1 : -1;
      active = (active + d + options.length) % options.length;
      root?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (options[active]) pick(options[active]);
    } else if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      open = false;
    }
  }

  const depth = (p: string) => p.split("/").length - 1;
  const leaf = (p: string) => p.split("/").at(-1);
</script>

<svelte:window
  onpointerdown={(e) => {
    if (open && root && !root.contains(e.target as Node)) open = false;
  }}
/>

<!-- The panel opens in the flow (not floating), so it is never clipped by a
     scrolling dialog and simply pushes the content below it down. -->
<div bind:this={root}>
  <button
    {id}
    type="button"
    class={[
      "w-full h-11 px-3 flex flex-row items-center gap-2 rounded-xl bg-base-3 border-2 text-left transition-all",
      open ? "border-primary" : "border-transparent hover:border-content-1/15",
    ]}
    aria-haspopup="listbox"
    aria-expanded={open}
    onclick={() => (open ? (open = false) : show())}
  >
    {#if value}
      <IconFolder size={20} class="shrink-0 text-primary" />
      <span class="flex-1 min-w-0 flex flex-row items-center gap-1 truncate">
        {#each value.split("/") as part, i (i)}
          {#if i > 0}<IconChevronRight size={14} class="shrink-0 text-content-3" />{/if}
          <span class={["truncate", i === value.split("/").length - 1 ? "font-semibold" : "text-content-2"]}>
            {part}
          </span>
        {/each}
      </span>
    {:else}
      <IconInbox size={20} class="shrink-0 text-content-3" />
      <span class="flex-1 text-content-3">No folder</span>
    {/if}
    <IconChevronDown size={18} class="shrink-0 text-content-3 transition-transform {open ? 'rotate-180' : ''}" />
  </button>

  {#if open}
    <div
      transition:fly={{ duration: 150, y: -6 }}
      class="mt-2 p-2 rounded-xl bg-base-2 border border-content-1/10 shadow-lg flex flex-col gap-2"
    >
      <input
        bind:this={search}
        bind:value={query}
        onkeydown={keydown}
        placeholder="Search, or type a new folder like Uni/Physics"
        class="h-10 px-3 rounded-lg bg-base-3 focus:outline-none focus:ring-2 focus:ring-primary"
        aria-label="Search or create a folder"
        aria-controls="{id}-options"
        autocomplete="off"
      />
      <div id="{id}-options" role="listbox" class="max-h-64 overflow-y-auto flex flex-col gap-0.5">
        {#each options as o, i (o.kind === "none" ? "#none" : o.kind + o.path)}
          {@const selected = o.kind === "none" ? !value : o.kind === "folder" && o.path === value}
          <button
            type="button"
            role="option"
            aria-selected={selected}
            data-index={i}
            class={[
              "min-h-10 px-2 flex flex-row items-center gap-2 rounded-lg text-left transition-colors",
              i === active ? "bg-overlay/30" : "hover:bg-overlay/20",
            ]}
            onpointerenter={() => (active = i)}
            onclick={() => pick(o)}
          >
            {#if o.kind === "none"}
              <IconInbox size={18} class="shrink-0 text-content-3" />
              <span class="flex-1 text-content-2">No folder</span>
            {:else if o.kind === "create"}
              <IconFolderPlus size={18} class="shrink-0 text-success" />
              <span class="flex-1 min-w-0 truncate">
                Create <span class="font-semibold">{o.path}</span>
              </span>
            {:else if !query}
              <!-- Tree: indent by depth, show the last segment. -->
              <span class="shrink-0" style="width: {depth(o.path) * 16}px;"></span>
              <IconFolder size={18} class="shrink-0 text-primary/80" />
              <span class="flex-1 min-w-0 truncate" title={o.path}>{leaf(o.path)}</span>
            {:else}
              <IconFolder size={18} class="shrink-0 text-primary/80" />
              <span class="flex-1 min-w-0 truncate" title={o.path}>
                {#each [...o.path] as ch, j (j)}
                  {#if o.indices.includes(j)}<span class="text-primary font-semibold">{ch}</span>{:else}{ch}{/if}
                {/each}
              </span>
            {/if}
            {#if selected}<IconCheck size={18} class="shrink-0 text-primary" />{/if}
          </button>
        {/each}
      </div>
    </div>
  {/if}
</div>
