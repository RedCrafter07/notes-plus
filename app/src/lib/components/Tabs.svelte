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
  class="w-full bg-base-3 h-0 overflow-hidden flex flex-row items-center transition-all"
  class:h-12={tabManager.tabs.length > 0}
>
  <button
    class="p-2 rounded-xl active:scale-90 bg-base-2 hover:bg-base-1 transition-all mx-2"
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
        "flex-1 flex items-center justify-center px-2 text-content-1/50 h-full transition-all",
        {
          "bg-base-2 text-content-1/100": data?.current,
          "bg-base-3": !data?.current,
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
