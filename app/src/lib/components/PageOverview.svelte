<script lang="ts">
  import { tick } from "svelte";
  import { fade } from "svelte/transition";
  import {
    IconArrowDown,
    IconArrowUp,
    IconArrowMerge,
    IconClipboard,
    IconScissors,
    IconBookmark,
    IconBookmarkOff,
    IconCheck,
    IconChevronDown,
    IconChevronRight,
    IconCopy,
    IconCursorText,
    IconDots,
    IconExternalLink,
    IconGripVertical,
    IconPlus,
    IconSettings,
    IconSquareCheck,
    IconTrash,
    IconX,
  } from "@tabler/icons-svelte";
  import {
    groupIntoSection,
    groups,
    moveGroup,
    movePages,
    nextSectionName,
    removeSection,
    renameSection,
    startSection,
    type PageGroup,
  } from "#lib/editor/sections.ts";
  import { contentManager } from "#lib/state/contentManager.svelte.ts";
  import { pageClipboard } from "#lib/state/pageClipboard.svelte.ts";
  import { contextMenu, contextMenuState, type MenuItem } from "#lib/state/contextMenu.svelte.ts";
  import { overlayManager } from "#lib/state/overlayManager.svelte.ts";
  import type { Page, PageSection } from "#lib/tauri/bindings.ts";
  import PageThumbnail from "./PageThumbnail.svelte";

  /*
   * Every page at a glance, grouped into sections. Tap a page to open it;
   * drag it (by its grip, or anywhere with a mouse) to move it, also into
   * another section; select several to duplicate, delete or group them.
   * Every change is one undo step (`contentManager.restructure`).
   *
   * Dragging uses pointer events rather than HTML drag-and-drop, which is
   * unreliable with pens and touch. The grip has `touch-action: none` so a
   * finger can drag it while the rest of the grid still scrolls.
   */

  const open = $derived(overlayManager.open === "pages");
  const pages = $derived(contentManager.pages);
  const gs = $derived(groups(pages));
  const hasSections = $derived(gs.some((g) => g.section));

  let selecting = $state(false);
  let selected = $state(new Set<string>());
  let renaming = $state<string>();
  let scroller = $state<HTMLElement>();

  const selectedIndices = $derived(pages.flatMap((p, i) => (selected.has(p.id) ? [i] : [])));

  $effect(() => {
    if (open) {
      // Start where the user is.
      tick().then(() =>
        scroller
          ?.querySelector(`[data-page-id="${contentManager.page.id}"]`)
          ?.scrollIntoView({ block: "center" }),
      );
    } else {
      selecting = false;
      selected = new Set();
      renaming = undefined;
    }
  });

  const close = () => overlayManager.close();

  /** Focuses a name field with its text selected, so typing replaces it. */
  function selectAll(node: HTMLInputElement) {
    requestAnimationFrame(() => {
      node.focus();
      node.select();
    });
  }

  function openPage(i: number) {
    contentManager.currentPage = i;
    close();
  }

  function toggle(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    selected = next;
  }

  function tap(page: Page, i: number) {
    if (suppressClick) {
      suppressClick = false;
      return;
    }
    if (selecting) toggle(page.id);
    else openPage(i);
  }

  /** Starts a section at page `i` and lets the user name it right away. */
  function sectionFrom(i: number) {
    contentManager.restructure("Start section", (p) => startSection(p, i, nextSectionName(p)));
    renaming = contentManager.pages[i]?.section?.id;
  }

  function groupSelection() {
    const first = selectedIndices[0];
    contentManager.restructure("Group into section", (p) =>
      groupIntoSection(p, selectedIndices, nextSectionName(p)),
    );
    renaming = contentManager.pages[first]?.section?.id;
    selecting = false;
    selected = new Set();
  }

  function deleteSelection() {
    contentManager.deletePages(selectedIndices);
    selected = new Set();
  }

  function duplicateSelection() {
    contentManager.duplicatePages(selectedIndices);
  }

  // Copy / cut / paste pages, also between notes (see pageClipboard).
  const clip = $derived(pageClipboard.pages.length);
  const clipLabel = $derived(clip === 1 ? "1 page" : `${clip} pages`);
  async function cutSelection() {
    const indices = selectedIndices;
    selecting = false;
    selected = new Set();
    await pageClipboard.cut(indices);
  }

  /** Everything on the selected pages onto the first of them (see movePage.ts). */
  function mergeSelection() {
    contentManager.mergePages(selectedIndices);
    selecting = false;
    selected = new Set();
  }

  function rename(id: string, name: string) {
    name = name.trim();
    renaming = undefined;
    if (!name) return;
    contentManager.restructure("Rename section", (p) => renameSection(p, id, name));
  }

  function pageMenu(page: Page, i: number): MenuItem[] {
    return [
      { label: "Open", icon: IconExternalLink, onSelect: () => openPage(i) },
      {
        label: "Page setup…",
        icon: IconSettings,
        onSelect: () => overlayManager.setOpen(`pagesettings-${i}`),
      },
      {
        label: "Select",
        icon: IconSquareCheck,
        onSelect: () => {
          selecting = true;
          selected = new Set([page.id]);
        },
      },
      { label: "Duplicate", icon: IconCopy, onSelect: () => contentManager.duplicatePages([i]) },
      { label: "Copy page", icon: IconClipboard, onSelect: () => pageClipboard.copy([i]) },
      { label: "Cut page", icon: IconScissors, onSelect: () => pageClipboard.cut([i]) },
      ...(clip
        ? [{ label: `Paste ${clipLabel} after this`, icon: IconClipboard, onSelect: () => pageClipboard.paste(i + 1) }]
        : []),
      ...(i < pages.length - 1
        ? [
            {
              label: "Merge with next page",
              icon: IconArrowMerge,
              onSelect: () => contentManager.mergePages([i, i + 1]),
            },
          ]
        : []),
      { label: "Start a section here", icon: IconBookmark, onSelect: () => sectionFrom(i) },
      {
        label: "Delete page",
        icon: IconTrash,
        destructive: true,
        separator: true,
        onSelect: () => contentManager.deletePages([i]),
      },
    ];
  }

  function sectionMenu(g: PageGroup, gi: number): MenuItem[] {
    const s = g.section!;
    const indices = g.pages.map((_, k) => g.start + k);
    return [
      { label: "Rename…", icon: IconCursorText, onSelect: () => (renaming = s.id) },
      {
        label: "Move section up",
        icon: IconArrowUp,
        disabled: gi === 0,
        onSelect: () => contentManager.restructure("Move section", (p) => moveGroup(p, g.start, -1)),
      },
      {
        label: "Move section down",
        icon: IconArrowDown,
        disabled: gi === gs.length - 1,
        onSelect: () => contentManager.restructure("Move section", (p) => moveGroup(p, g.start, 1)),
      },
      {
        label: "Select its pages",
        icon: IconSquareCheck,
        onSelect: () => {
          selecting = true;
          selected = new Set(g.pages.map((p) => p.id));
        },
      },
      {
        label: "Remove section (keep pages)",
        icon: IconBookmarkOff,
        separator: true,
        onSelect: () => contentManager.restructure("Remove section", (p) => removeSection(p, s.id)),
      },
      {
        label: `Delete section and ${g.pages.length === 1 ? "its page" : `its ${g.pages.length} pages`}`,
        icon: IconTrash,
        destructive: true,
        onSelect: () => contentManager.deletePages(indices),
      },
    ];
  }

  function showMenu(e: MouseEvent, items: MenuItem[], title?: string) {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    contextMenuState.show(r.left, r.bottom + 4, items, title);
  }

  // ------------------------------------------------------------------ drag

  const THRESHOLD = 6;
  const EDGE = 64;

  interface Drop {
    to: number;
    section: PageSection | null;
    /** Where to draw the insertion bar (viewport coordinates)... */
    bar?: { x: number; y: number; h: number };
    /** ...or the section header being dropped onto. */
    header?: number;
  }

  let drag = $state<{
    ids: string[];
    pointer: number;
    sx: number;
    sy: number;
    x: number;
    y: number;
    active: boolean;
  }>();
  let drop = $state<Drop>();
  let suppressClick = false;
  let frame = 0;

  function startDrag(e: PointerEvent, page: Page, fromGrip: boolean) {
    if (e.button !== 0 || renaming) return;
    // Away from the grip only a mouse drags; a finger or pen scrolls.
    if (!fromGrip && e.pointerType !== "mouse") return;
    e.stopPropagation();
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    const ids = selecting && selected.has(page.id) ? pages.filter((p) => selected.has(p.id)).map((p) => p.id) : [page.id];
    drag = { ids, pointer: e.pointerId, sx: e.clientX, sy: e.clientY, x: e.clientX, y: e.clientY, active: fromGrip };
    if (fromGrip) loop();
  }

  function moveDrag(e: PointerEvent) {
    if (!drag || e.pointerId !== drag.pointer) return;
    drag.x = e.clientX;
    drag.y = e.clientY;
    if (!drag.active && Math.hypot(drag.x - drag.sx, drag.y - drag.sy) > THRESHOLD) {
      drag.active = true;
      loop();
    }
    if (drag.active) drop = target(drag.x, drag.y) ?? drop;
  }

  function endDrag(e: PointerEvent) {
    if (!drag || e.pointerId !== drag.pointer) return;
    const { ids, active } = drag;
    const d = drop;
    drag = undefined;
    drop = undefined;
    cancelAnimationFrame(frame);
    if (!active) return;
    suppressClick = true;
    setTimeout(() => (suppressClick = false), 0);
    if (!d) return;
    const indices = ids.map((id) => pages.findIndex((p) => p.id === id)).filter((i) => i >= 0);
    contentManager.restructure(indices.length === 1 ? "Move page" : "Move pages", (p) =>
      movePages(p, indices, d.to, d.section),
    );
  }

  function cancelDrag() {
    drag = undefined;
    drop = undefined;
    cancelAnimationFrame(frame);
  }

  /** What is under the pointer: a page (drop before/after it) or a section header. */
  function target(x: number, y: number): Drop | undefined {
    for (const el of document.elementsFromPoint(x, y)) {
      if (!(el instanceof HTMLElement)) continue;
      const card = el.closest<HTMLElement>("[data-page-index]");
      if (card) {
        const i = Number(card.dataset.pageIndex);
        const r = card.getBoundingClientRect();
        const after = x > r.left + r.width / 2;
        return {
          to: after ? i + 1 : i,
          section: pages[i].section ?? null,
          bar: { x: after ? r.right + 6 : r.left - 6, y: r.top, h: r.height },
        };
      }
      const header = el.closest<HTMLElement>("[data-group-start]");
      if (header) {
        const start = Number(header.dataset.groupStart);
        const g = gs.find((x) => x.start === start);
        return { to: start, section: g?.section ?? null, header: start };
      }
    }
    return undefined;
  }

  /** Scrolls while the pointer is held near the top or bottom edge. */
  function loop() {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(function step() {
      if (!drag?.active || !scroller) return;
      const r = scroller.getBoundingClientRect();
      const dy =
        drag.y < r.top + EDGE ? -(r.top + EDGE - drag.y) / 4 : drag.y > r.bottom - EDGE ? (drag.y - (r.bottom - EDGE)) / 4 : 0;
      if (dy) {
        scroller.scrollBy(0, dy);
        drop = target(drag.x, drag.y) ?? drop;
      }
      frame = requestAnimationFrame(step);
    });
  }

  const dragged = $derived(drag?.active ? pages.find((p) => p.id === drag!.ids[0]) : undefined);

  const iconBtn =
    "w-10 h-10 shrink-0 grid place-items-center rounded-lg text-content-3 hover:text-content-1 hover:bg-overlay/30 active:scale-90 transition-all disabled:opacity-30 disabled:pointer-events-none";
  const barBtn =
    "h-10 px-3 shrink-0 flex flex-row items-center gap-2 rounded-xl hover:bg-overlay/30 active:scale-95 transition-all disabled:opacity-30 disabled:pointer-events-none";
</script>

{#snippet card(page: Page, i: number)}
  {@const current = contentManager.currentPage === i}
  {@const isSelected = selected.has(page.id)}
  {@const isDragged = drag?.active && drag.ids.includes(page.id)}
  <div
    data-page-index={i}
    data-page-id={page.id}
    role="group"
    aria-label={page.name}
    class={[
      "relative flex flex-col gap-1 p-2 rounded-xl border-2 transition-all select-none",
      isSelected ? "border-primary bg-primary/15" : current ? "border-primary/60 bg-base-2" : "border-transparent bg-base-2 hover:bg-overlay/20",
      isDragged && "opacity-40",
    ]}
    use:contextMenu={() => ({ items: pageMenu(page, i), title: page.name })}
    onpointerdown={(e) => startDrag(e, page, false)}
    onpointermove={moveDrag}
    onpointerup={endDrag}
    onpointercancel={cancelDrag}
  >
    <button
      class="w-full active:scale-[0.98] transition-transform"
      onclick={() => tap(page, i)}
      aria-label={selecting ? `Select ${page.name}` : `Open ${page.name}`}
      aria-pressed={selecting ? isSelected : undefined}
      aria-current={current ? "page" : undefined}
    >
      <PageThumbnail {page} />
    </button>
    <div class="flex flex-row items-center gap-1 min-w-0">
      <span
        class="w-8 h-8 shrink-0 grid place-items-center rounded-lg text-content-3 hover:text-content-1 hover:bg-overlay/30 cursor-grab touch-none"
        onpointerdown={(e) => startDrag(e, page, true)}
        onpointermove={moveDrag}
        onpointerup={endDrag}
        onpointercancel={cancelDrag}
        role="button"
        tabindex="-1"
        aria-label="Drag {page.name}"
        title="Drag to move"
      >
        <IconGripVertical size={18} />
      </span>
      <span class="text-sm text-content-3 tabular-nums">{i + 1}</span>
      <span class="flex-1 min-w-0 truncate text-sm font-medium">{page.name}</span>
      <button
        class="w-8 h-8 shrink-0 grid place-items-center rounded-lg text-content-3 hover:text-content-1 hover:bg-overlay/30 active:scale-90 transition-all"
        onclick={(e) => showMenu(e, pageMenu(page, i), page.name)}
        aria-label="More for {page.name}"
      >
        <IconDots size={18} />
      </button>
    </div>
    {#if selecting}
      <span
        class={[
          "absolute top-3 right-3 w-7 h-7 rounded-full grid place-items-center border-2 pointer-events-none",
          isSelected ? "bg-primary border-primary text-base-1" : "bg-base-1/80 border-content-1/40",
        ]}
      >
        {#if isSelected}<IconCheck size={16} stroke={3} />{/if}
      </span>
    {/if}
  </div>
{/snippet}

{#if open}
  <div
    class="fixed inset-0 z-50 flex flex-col bg-base-3/90 backdrop-blur-md"
    transition:fade={{ duration: 120 }}
    role="dialog"
    aria-modal="true"
    aria-label="Pages"
  >
    <header class="shrink-0 flex flex-row items-center gap-2 px-4 py-3 border-b border-content-1/10 bg-base-1/80">
      {#if selecting}
        <span class="text-lg font-semibold px-2">
          {selected.size} selected
        </span>
        <div class="flex-1"></div>
        <button class={barBtn} disabled={!selected.size} onclick={groupSelection}>
          <IconBookmark size={20} /> Make section
        </button>
        <button class={barBtn} disabled={!selected.size} onclick={duplicateSelection}>
          <IconCopy size={20} /> Duplicate
        </button>
        <button class={barBtn} disabled={!selected.size} onclick={() => pageClipboard.copy(selectedIndices)}>
          <IconClipboard size={20} /> Copy
        </button>
        <button class={barBtn} disabled={!selected.size} onclick={cutSelection}>
          <IconScissors size={20} /> Cut
        </button>
        <button
          class={barBtn}
          disabled={selected.size < 2}
          onclick={mergeSelection}
          title="Put everything on the selected pages onto the first of them"
        >
          <IconArrowMerge size={20} /> Merge
        </button>
        <button class={[barBtn, "text-destructive"]} disabled={!selected.size} onclick={deleteSelection}>
          <IconTrash size={20} /> Delete
        </button>
        <button
          class="{barBtn} bg-primary/15 text-primary font-semibold"
          onclick={() => {
            selecting = false;
            selected = new Set();
          }}
        >
          Done
        </button>
      {:else}
        <h1 class="text-2xl font-display font-medium px-2">Pages</h1>
        <span class="text-content-3 tabular-nums">{pages.length}</span>
        <div class="flex-1"></div>
        {#if clip}
          <button
            class="{barBtn} text-primary"
            onclick={() => pageClipboard.paste(pages.length)}
            title="Paste {clipLabel} from “{pageClipboard.source}” at the end (or use a page's menu to paste after it)"
          >
            <IconClipboard size={20} /> Paste {clipLabel}
          </button>
        {/if}
        <button class={barBtn} onclick={() => (selecting = true)}>
          <IconSquareCheck size={20} /> Select
        </button>
        <button
          class={barBtn}
          onclick={() => {
            const name = nextSectionName(pages);
            contentManager.addSection(name);
            renaming = contentManager.page.section?.id;
          }}
        >
          <IconBookmark size={20} /> New section
        </button>
        <button class={barBtn} onclick={() => contentManager.addPage(pages.length - 1)}>
          <IconPlus size={20} /> Add page
        </button>
        <button class={iconBtn} onclick={close} aria-label="Close" title="Close (Esc)">
          <IconX />
        </button>
      {/if}
    </header>

    <div bind:this={scroller} class="flex-1 min-h-0 overflow-y-auto px-4 py-4 flex flex-col gap-4">
      {#each gs as g, gi (g.section?.id ?? `none-${g.start}`)}
        {@const collapsed = !!g.section && contentManager.isCollapsed(g.section.id)}
        {#if g.section || (hasSections && gi > 0)}
          <div
            data-group-start={g.start}
            class={[
              "flex flex-row items-center gap-1 rounded-xl px-1 py-1 transition-colors",
              drop?.header === g.start ? "bg-primary/20 ring-2 ring-primary" : "",
            ]}
          >
            {#if g.section}
              {@const s = g.section}
              <button
                class={iconBtn}
                onclick={() => contentManager.toggleSection(s.id)}
                aria-expanded={!collapsed}
                aria-label={collapsed ? `Show ${s.name}` : `Hide ${s.name}`}
              >
                {#if collapsed}<IconChevronRight />{:else}<IconChevronDown />{/if}
              </button>
              {#if renaming === s.id}
                <input
                  class="h-10 px-3 rounded-lg bg-base-1 text-lg font-semibold focus:outline-none focus:ring-2 focus:ring-primary min-w-0 w-80"
                  value={s.name}
                  use:selectAll
                  onblur={(e) => rename(s.id, e.currentTarget.value)}
                  onkeydown={(e) => {
                    if (e.key === "Enter") e.currentTarget.blur();
                    if (e.key === "Escape") {
                      e.stopPropagation();
                      renaming = undefined;
                    }
                  }}
                />
              {:else}
                <button
                  class="h-10 px-2 rounded-lg text-lg font-semibold truncate hover:bg-overlay/30"
                  onclick={() => (renaming = s.id)}
                  title="Rename"
                >
                  {s.name}
                </button>
              {/if}
              <span class="text-sm text-content-3 tabular-nums px-1">
                {g.pages.length} {g.pages.length === 1 ? "page" : "pages"}
              </span>
              <button
                class={iconBtn}
                onclick={(e) => showMenu(e, sectionMenu(g, gi), s.name)}
                aria-label="More for {s.name}"
              >
                <IconDots size={20} />
              </button>
            {:else}
              <span class="h-10 px-3 flex items-center text-content-3 italic">No section</span>
            {/if}
            <div class="flex-1 h-px bg-content-1/10 ml-2"></div>
          </div>
        {/if}
        {#if !collapsed}
          <div class="grid grid-cols-[repeat(auto-fill,minmax(11rem,1fr))] items-start gap-4">
            {#each g.pages as page, k (page.id)}
              {@render card(page, g.start + k)}
            {/each}
          </div>
        {/if}
      {/each}
    </div>

    {#if drag?.active && drop?.bar}
      <div
        class="fixed w-1 rounded-full bg-primary pointer-events-none z-[55]"
        style="left: {drop.bar.x - 2}px; top: {drop.bar.y}px; height: {drop.bar.h}px;"
      ></div>
    {/if}
    {#if dragged && drag}
      <div
        class="fixed z-[56] w-36 pointer-events-none -translate-x-1/2 -translate-y-1/2 rotate-2 drop-shadow-2xl"
        style="left: {drag.x}px; top: {drag.y}px;"
      >
        <div class="p-1.5 rounded-xl bg-base-1 border-2 border-primary">
          <PageThumbnail page={dragged} />
        </div>
        {#if drag.ids.length > 1}
          <span class="absolute -top-2 -right-2 min-w-7 h-7 px-2 rounded-full bg-primary text-base-1 text-sm font-bold grid place-items-center">
            {drag.ids.length}
          </span>
        {/if}
      </div>
    {/if}
  </div>
{/if}
