<script lang="ts">
  import { titleBar } from "#lib/state/titleBar.svelte.ts";
  import { goto } from "$app/navigation";
  import { resolve } from "$app/paths";
  import { handleSave } from "#lib/editor/handleSave.svelte.ts";
  import { lassoManager } from "#lib/editor/state/lassoManager.svelte.ts";
  import { editorComponents } from "#lib/state/editorComponents.svelte.ts";
  import { overlayManager } from "#lib/state/overlayManager.svelte.ts";
  import { tabManager } from "#lib/state/tabManager.svelte.ts";
  import WindowControls from "./WindowControls.svelte";
  import { presenter } from "#lib/present/presenter.svelte.ts";
  import {
    IconDeviceFloppy,
    IconFileExport,
    IconPresentation,
    IconPresentationOff,
    IconHome,
    IconNotebook,
    IconNotebookOff,
    IconSettings,
    IconX,
  } from "@tabler/icons-svelte";

  let tabs = $state<Record<string, HTMLDivElement>>({});

  function assignTab(element: HTMLDivElement, id: string) {
    tabs[id] = element;
  }

  $effect(() => {
    if (!tabManager.tab) return;
    const t = tabs[tabManager.tab.note.meta.id];
    if (t) t.scrollIntoView({ behavior: "instant" });
  });

  /** Tabs share the bar with the window controls unless the OS draws them. */
  const merged = $derived(!titleBar.system);
  const hasTabs = $derived(tabManager.tabs.length > 0);

  function updateTab(index: number) {
    lassoManager.reset();
    tabManager.activeTab = index;
  }
</script>

<!--
  data-tauri-drag-region makes empty parts of the bar move the window (and
  double-click maximise) when the title bar is merged. It only applies to the
  element itself, not its children, so buttons and tabs keep working.
-->
<div
  data-tauri-drag-region={merged ? true : undefined}
  class={[
    "flex gap-2 flex-row w-full bg-base-2 overflow-hidden px-2 transition-all shrink-0",
    hasTabs || merged ? "h-14 py-2" : "h-0 py-0",
  ]}
>
  {#if hasTabs}
  <button
    class={[
      "aspect-square h-full transition-all cursor-pointer flex items-center justify-center text-content-2 hover:text-content-1 rounded-xl sticky left-0 active:scale-90 border-2",
      {
        "bg-overlay/5 hover:bg-overlay/30 border-content-1/10":
          tabManager.activeTab !== -1,
        "bg-overlay/20 hover:bg-overlay/30 border-content-1/25":
          tabManager.activeTab === -1,
      },
    ]}
    onclick={() => {
      updateTab(-1);
      goto(resolve("/(dashboard)"));
    }}
    aria-label="Home"
  >
    <IconHome />
  </button>
  <div
    id="tab-bar"
    data-tauri-drag-region={merged ? true : undefined}
    class="flex gap-2 flex-row flex-1 min-w-0 h-full bg-base-2 overflow-y-hidden transition-all overflow-x-auto relative"
    onwheel={(e) => {
      const tabBarElement = e.currentTarget;
      if (!tabBarElement) return;
      e.preventDefault();

      tabBarElement.scrollLeft += e.deltaY + e.deltaX;
    }}
  >
    {#each tabManager.tabs as tab, i (`tabs-${tab.note.meta.id}`)}
      {@const active = tabManager.activeTab === i}
      <div
        class={[
          "h-full shrink-0 max-w-72 transition-all rounded-xl p-2 flex flex-row gap-2 z-0 group border-2 items-center font-semibold group",
          {
            "bg-overlay/5 hover:bg-overlay/30 text-content-2 hover:text-content-1 border-content-1/10":
              !active,
            "bg-overlay/20 hover:bg-overlay/30 text-content-2 hover:text-content-1 border-content-1/25":
              active,
          },
        ]}
        role="tab"
        use:assignTab={tab.note.meta.id}
      >
        <button
          class="flex-1 flex items-center w-full h-full min-w-0"
          onpointerdown={(e) => {
            if (e.button !== 1) return;
            e.preventDefault();
            tabManager.remove(i, e.shiftKey);
          }}
          onclick={() => {
            updateTab(i);
            goto(
              resolve("/edit/[id]", { id: tabManager.tabs[i].note.meta.id }),
            );
          }}
        >
          <p class="truncate" title={tab.note.meta.title}>
            {`${tab.note.meta.title}${tab.unsaved ? " *" : ""}`}
          </p>
        </button>
        {#if active && tab.unsaved}
          <button
            class="w-9 h-9 -my-1 grid place-items-center rounded-lg opacity-50 hover:opacity-100 hover:text-success hover:bg-overlay/30 transition-all"
            aria-label="Save"
            title="Save (Ctrl+S)"
            onclick={async () => {
              await handleSave(false);
            }}
          >
            <IconDeviceFloppy />
          </button>
        {/if}
        <button
          class="w-9 h-9 -my-1 -mr-1 grid place-items-center rounded-lg opacity-50 hover:opacity-100 hover:text-destructive hover:bg-overlay/30 transition-all"
          aria-label="Close {tab.note.meta.title}"
          onclick={() => {
            tabManager.remove(i);
          }}
        >
          <IconX />
        </button>
      </div>
    {/each}
  </div>
  <button
    class="aspect-square h-full transition-all cursor-pointer flex items-center justify-center text-content-2 hover:text-content-1 rounded-xl sticky left-0 bg-overlay/5 hover:bg-overlay/30 active:scale-90 border-2 border-content-1/10"
    onclick={() => {
      editorComponents.toggleRightBar();
    }}
    aria-label={editorComponents.rightBarOpen ? "Hide pages and layers" : "Show pages and layers"}
    title="Pages and layers"
  >
    {#if editorComponents.rightBarOpen}
      <IconNotebookOff />
    {:else}
      <IconNotebook />
    {/if}
  </button>
  <button
    class="aspect-square h-full transition-all cursor-pointer flex items-center justify-center text-content-2 hover:text-content-1 rounded-xl sticky left-0 bg-overlay/5 hover:bg-overlay/30 active:scale-90 border-2 border-content-1/10"
    onclick={() => {
      if (tabManager.tab)
        goto(resolve("/export/[id]", { id: tabManager.tab.note.meta.id }));
    }}
    aria-label="Export"
    title="Export (Ctrl+E)"
  >
    <IconFileExport />
  </button>
  <button
    class={[
      "aspect-square h-full transition-all cursor-pointer flex items-center justify-center rounded-xl sticky left-0 active:scale-90 border-2",
      presenter.active
        ? "bg-destructive/20 text-destructive border-destructive/50 hover:bg-destructive/30"
        : "text-content-2 hover:text-content-1 bg-overlay/5 hover:bg-overlay/30 border-content-1/10",
    ]}
    onclick={async () => {
      if (!presenter.active && tabManager.tab)
        await goto(resolve("/edit/[id]", { id: tabManager.tab.note.meta.id }));
      await presenter.toggle();
    }}
    aria-label={presenter.active ? "Stop presenting" : "Present on a second screen"}
    title={presenter.active ? "Stop presenting (F5)" : "Present on a second screen (F5)"}
  >
    {#if presenter.active}<IconPresentationOff />{:else}<IconPresentation />{/if}
  </button>
  <button
    class="aspect-square h-full transition-all cursor-pointer flex items-center justify-center text-content-2 hover:text-content-1 rounded-xl sticky left-0 bg-overlay/5 hover:bg-overlay/30 active:scale-90 border-2 border-content-1/10"
    onclick={() => {
      overlayManager.setOpen("notebook-settings");
    }}
    aria-label="Notebook settings and export"
    title="Notebook settings and export"
  >
    <IconSettings />
  </button>
  {/if}
  {#if merged}
    <!-- Always-free strip to grab the window, even when tabs fill the bar. -->
    <div
      data-tauri-drag-region
      class={["h-full shrink-0", hasTabs ? "w-14" : "flex-1"]}
      aria-hidden="true"
    ></div>
    <WindowControls />
  {/if}
</div>
