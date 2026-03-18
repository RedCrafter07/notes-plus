<script lang="ts">
  import { goto } from "$app/navigation";
  import { resolve } from "$app/paths";
  import { tabManager } from "$lib/state/tabManager.svelte";
  import { IconHome } from "@tabler/icons-svelte";

  function updateTab(index: number) {
    tabManager.activeTab = index;
  }
</script>

<div
  class={[
    "flex gap-2 flex-row  w-full bg-base-2 overflow-y-hidden px-2 transition-all",
    {
      "h-14 py-2": tabManager.tabs.length > 0,
      "h-0 py-0": tabManager.tabs.length === 0,
    },
  ]}
>
  <button
    class={[
      "aspect-square h-full transition-all cursor-pointer flex items-center justify-center text-content-2 hover:text-content-1 rounded-xl",
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
  {#each tabManager.tabs as tab, i (`tabs-${tab.id}`)}
    {@const active = tabManager.activeTab === i}
    <button
      class={[
        "h-full flex-1 transition-all rounded-xl",
        {
          "bg-overlay/5 hover:bg-overlay/20 text-content-2 hover:text-content-1":
            !active,
          "bg-overlay/10 hover:bg-overlay/20 text-content-2 hover:text-content-1":
            active,
        },
      ]}
      onclick={() => {
        updateTab(i);
        goto(resolve("/edit/[id]", { id: tabManager.tabs[i].id }));
      }}
    >
      {tab.content.title}
    </button>
  {/each}
</div>
