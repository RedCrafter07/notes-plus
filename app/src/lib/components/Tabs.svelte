<script lang="ts">
  import { goto } from "$app/navigation";
  import { resolve } from "$app/paths";
  import { tabManager } from "$lib/state/tabManager.svelte";
  import { IconHome, IconX } from "@tabler/icons-svelte";

  let tabs = $state<Record<string, HTMLDivElement>>({});

  function assignTab(element: HTMLDivElement, id: string) {
    tabs[id] = element;
  }

  $effect(() => {
    if (!tabManager.activeNote) return;
    const t = tabs[tabManager.activeNote.id];
    if (t) t.scrollIntoView({ behavior: "instant" });
  });

  function updateTab(index: number) {
    tabManager.activeTab = index;
  }
</script>

<div
  class={[
    "flex gap-2 flex-row w-full bg-base-2 overflow-hidden px-2 transition-all",
    {
      "h-14 py-2": tabManager.tabs.length > 0,
      "h-0 py-0": tabManager.tabs.length === 0,
    },
  ]}
>
  <button
    id="tab-bar"
    class={[
      "aspect-square h-full transition-all cursor-pointer flex items-center justify-center text-content-2 hover:text-content-1 rounded-xl sticky left-0",
      {
        "bg-overlay/5 hover:bg-overlay/20": tabManager.activeTab !== -1,
        "bg-overlay/10 hover:bg-overlay/20": tabManager.activeTab === -1,
      },
    ]}
    onclick={() => {
      updateTab(-1);
      goto(resolve("/"));
    }}
  >
    <IconHome />
  </button>
  <div
    id="tab-bar"
    class="flex gap-2 flex-row w-full h-full bg-base-2 overflow-y-hidden transition-all overflow-x-auto relative"
    onwheel={(e) => {
      const tabBarElement = e.currentTarget;
      if (!tabBarElement) return;
      e.preventDefault();

      tabBarElement.scrollLeft += e.deltaY + e.deltaX;
    }}
  >
    {#each tabManager.tabs as tab, i (`tabs-${tab.id}`)}
      {@const active = tabManager.activeTab === i}
      <div
        class={[
          "h-full flex-1 transition-all rounded-xl p-2 flex flex-row gap-2 min-w-max z-0",
          {
            "bg-overlay/5 hover:bg-overlay/20 text-content-2 hover:text-content-1":
              !active,
            "bg-overlay/10 hover:bg-overlay/20 text-content-2 hover:text-content-1":
              active,
          },
        ]}
        role="tab"
        use:assignTab={tab.id}
      >
        <button
          class="flex-1 flex items-center w-full h-full min-w-max"
          onpointerdown={(e) => {
            if (e.button !== 1) return;
            e.preventDefault();
            tabManager.remove(i, e.shiftKey);
          }}
          onclick={() => {
            updateTab(i);
            goto(resolve("/edit/[id]", { id: tabManager.tabs[i].id }));
          }}
        >
          <p class="min-w-max">
            {`${tab.content.title}${tab.unsaved ? " *" : ""}`}
          </p>
        </button>
        <button
          class="opacity-50 hover:opacity-100 hover:text-destructive transition-all"
          onclick={() => {
            tabManager.remove(i);
          }}
        >
          <IconX />
        </button>
      </div>
    {/each}
  </div>
</div>
