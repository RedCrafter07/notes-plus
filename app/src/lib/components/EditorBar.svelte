<script lang="ts">
  import { contentManager } from "$lib/state/contentManager.svelte";
  import { defaultsStore } from "$lib/state/defaultsStore.svelte";
  import { editorComponents } from "$lib/state/editorComponents.svelte";
  import { overlayManager } from "$lib/state/overlayManager.svelte";
  import { IconPlus, IconSettings } from "@tabler/icons-svelte";
  import { fade } from "svelte/transition";
</script>

<div
  class={[
    "overflow-x-hidden transition-all bg-base-1 py-2 h-full shrink-0 flex flex-col gap-4",
    {
      "w-1/4 px-2": editorComponents.rightBarOpen,
      "w-0": !editorComponents.rightBarOpen,
    },
  ]}
>
  <div class="w-full p-2 rounded-xl bg-base-2">
    <div
      class="w-full h-max relative flex flex-row tracking-wide text-center font-semibold"
    >
      <div
        class={[
          "rounded-xl bg-overlay/10 absolute h-full w-1/2 transition-all duration-100",
          {
            "left-0": editorComponents.rightBarOption === "pages",
            "left-1/2": editorComponents.rightBarOption === "layers",
          },
        ]}
      ></div>
      <button
        class="rounded-xl p-1 flex-1"
        onclick={() => {
          editorComponents.rightBarOption = "pages";
        }}>Pages</button
      >
      <button
        class="rounded-xl p-1 flex-1"
        onclick={() => {
          editorComponents.rightBarOption = "layers";
        }}>Layers</button
      >
    </div>
  </div>

  <div class="relative w-full h-full">
    {#key editorComponents.rightBarOption}
      <div
        transition:fade={{ duration: 100 }}
        class="absolute top-0 h-full w-full text-center"
      >
        {#if editorComponents.rightBarOption === "pages"}
          <div class="grid grid-cols-2 w-full gap-4">
            {#each contentManager.pages as page, i (`page-${i}`)}
              <!-- svelte-ignore a11y_click_events_have_key_events -->
              <div
                onclick={() => {
                  contentManager.activePage = i;
                }}
                class={[
                  "p-2 rounded-xl border-2 bg-base-2 w-full cursor-pointer",
                  contentManager.activePage === i
                    ? "border-accent"
                    : "border-transparent",
                ]}
                role="button"
                tabindex="0"
              >
                <div></div>
                <div class="flex flex-row items-center justify-between">
                  <p>
                    {page.name}
                  </p>
                  <button
                    onclick={() => {
                      overlayManager.setOpen(`pagesettings-${i}`);
                    }}
                    class="text-content-3 hover:text-content-1 active:scale-90 transition-all"
                  >
                    <IconSettings />
                  </button>
                </div>
              </div>
            {/each}
            <button
              class="p-2 bg-base-2 rounded-xl flex items-center justify-center border-2 border-transparent hover:border-content-1/50 transition-all active:scale-95"
              onclick={() => {
                const total = contentManager.pages.length;
                contentManager.pages.push({
                  ...defaultsStore.store.page,
                  name: `Page ${total + 1}`,
                });
                contentManager.activePage = total;
              }}
            >
              <IconPlus />
            </button>
          </div>
        {:else}
          <h3 class="text-xl">Todo</h3>
        {/if}
      </div>
    {/key}
  </div>
</div>
