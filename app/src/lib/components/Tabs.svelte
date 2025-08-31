<script lang="ts">
  // The main tab display used in the page layout.

  import { goto } from "$app/navigation";
  import { tabManager } from "$lib/tabs/tabs.svelte";
  import { IconHome, IconX } from "@tabler/icons-svelte";
  import { circOut } from "svelte/easing";
  import { fly } from "svelte/transition";

  let nav = $state<HTMLDivElement>();

  $effect(() => {
    if (tabManager.tabs.length > 0) {
      setTimeout(() => {
        const { height } = nav!.getBoundingClientRect();

        if (tabManager.currentPage)
          tabManager.currentPage.canvas.setOffset(height);
      }, 110);
    }
  });
</script>

<div
  bind:this={nav}
  class={[
    "px-2 gap-1 w-full bg-base-3 h-0 overflow-hidden flex flex-row items-center transition-all",
    {
      "h-14 pt-1": tabManager.tabs.length > 0,
    },
  ]}
>
  <button
    class="p-2 mr-1 rounded-xl active:scale-90 bg-base-1/75 hover:bg-base-1 transition-all"
    onclick={() => {
      tabManager.unsetSelection();
      goto("/");
    }}
  >
    <IconHome />
  </button>
  {#each tabManager.tabs as tab, i (tab.id)}
    {@const data = tabManager.tabInfo(tab.id)}
    <div
      class={[
        "flex-1 flex items-center justify-center px-2 text-content-1/50 h-full transition-all border-x border-t rounded-t-md",
        {
          "bg-base-1 text-content-1/100 border-selection/25": data?.current,
          "bg-base-2 border-selection/10": !data?.current,
        },
      ]}
      in:fly={{ duration: 100, easing: circOut, y: -100 }}
      out:fly={{ duration: 100, easing: circOut, y: 100 }}
    >
      <button
        class="flex-1 text-center w-full h-full"
        onclick={() => {
          tabManager.currentTab = i;
          goto("/edit");
        }}
      >
        {data?.title}
        {data?.saved ? "" : "*"}
      </button>
      <IconX
        onclick={() => {
          if (tabManager.tabs.length === 1) {
            goto("/");
            console.log("Hi");
          }
          tabManager.deleteTab(i);
        }}
        size={18}
        class="hover:text-destructive hover:opacity-100 opacity-50 active:scale-95"
      />
    </div>
  {/each}
</div>
