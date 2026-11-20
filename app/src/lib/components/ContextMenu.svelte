<script lang="ts">
  import { tick } from "svelte";
  import { scale } from "svelte/transition";
  import { quintOut } from "svelte/easing";
  import { contextMenuState } from "#lib/state/contextMenu.svelte.ts";

  /*
   * Rendered once in the app shell. Opens where it was requested, kept inside
   * the window. Closes on a choice, a tap elsewhere, Escape, scroll or resize.
   * Arrow keys move between items.
   */
  const menu = $derived(contextMenuState.menu);

  let panel = $state<HTMLDivElement>();
  let w = $state(0);
  let h = $state(0);
  const MARGIN = 8;
  const left = $derived(menu ? Math.max(MARGIN, Math.min(menu.x, window.innerWidth - w - MARGIN)) : 0);
  const top = $derived(menu ? Math.max(MARGIN, Math.min(menu.y, window.innerHeight - h - MARGIN)) : 0);

  // Focus the first item, so the keyboard works right away.
  $effect(() => {
    if (!menu) return;
    tick().then(() => panel?.querySelector<HTMLButtonElement>("button:not(:disabled)")?.focus());
  });

  function choose(i: number) {
    const item = menu?.items[i];
    contextMenuState.close();
    item?.onSelect();
  }

  function keydown(e: KeyboardEvent) {
    if (!menu) return;
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      contextMenuState.close();
      return;
    }
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    e.preventDefault();
    const buttons = [...(panel?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)") ?? [])];
    const at = buttons.indexOf(document.activeElement as HTMLButtonElement);
    const next = (at + (e.key === "ArrowDown" ? 1 : -1) + buttons.length) % buttons.length;
    buttons[next]?.focus();
  }
</script>

<svelte:window
  onkeydowncapture={keydown}
  onresize={() => contextMenuState.close()}
  onwheel={() => contextMenuState.close()}
/>

{#if menu}
  <!-- Transparent catcher: a tap anywhere else closes the menu. -->
  <div
    class="fixed inset-0 z-[60]"
    role="presentation"
    onpointerdown={() => contextMenuState.close()}
    oncontextmenu={(e) => {
      e.preventDefault();
      contextMenuState.close();
    }}
  ></div>
  <div
    bind:this={panel}
    bind:clientWidth={w}
    bind:clientHeight={h}
    transition:scale={{ duration: 120, start: 0.95, easing: quintOut }}
    class="fixed z-[61] min-w-52 max-w-80 p-1.5 rounded-xl bg-base-2 border border-content-1/10 shadow-2xl flex flex-col origin-top-left"
    style="left: {left}px; top: {top}px;"
    role="menu"
    tabindex="-1"
  >
    {#if menu.title}
      <p class="px-3 pt-1.5 pb-1 text-xs font-semibold text-content-3 truncate">{menu.title}</p>
    {/if}
    {#each menu.items as item, i (item.label)}
      {#if item.separator}
        <div class="h-px my-1 mx-2 bg-content-1/10" role="separator"></div>
      {/if}
      <button
        role="menuitem"
        class={[
          "h-10 px-3 flex flex-row gap-3 items-center rounded-lg text-left transition-colors focus:outline-none disabled:opacity-40",
          item.destructive
            ? "text-destructive hover:bg-destructive/15 focus:bg-destructive/15"
            : "text-content-1 hover:bg-overlay/30 focus:bg-overlay/30",
        ]}
        disabled={item.disabled}
        onclick={() => choose(i)}
      >
        {#if item.icon}<item.icon size={18} />{/if}
        <span class="truncate">{item.label}</span>
      </button>
    {/each}
  </div>
{/if}
