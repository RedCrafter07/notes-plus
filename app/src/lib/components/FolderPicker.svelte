<script lang="ts">
  import { fly } from "svelte/transition";
  import Input from "./Input.svelte";
  import { fsStore } from "$lib/state/fsStore.svelte";
  import { fuzzySearch } from "$lib/util/fuzzySearch";
  import { IconFolder, IconPlus, IconQuestionMark } from "@tabler/icons-svelte";

  let {
    id,
    value = $bindable(),
    type,
    submitCb,
  }: {
    id: string;
    value?: string | null;
    type: "select" | "browse";
    submitCb?: () => void;
  } = $props();

  let inputHeight = $state(0);
  let popupOffset = $derived(inputHeight + 16);
  let focused = $state(false);

  let inputContent = $state(value ?? "");

  let folders = $derived(fsStore.store.allFolders);
  let folderResults = $derived(fuzzySearch(inputContent, folders).slice(0, 4));

  // No selection: -1
  // Represents the index of folderResults
  let selectedIndex = $state(-1);

  $effect(() => {
    if (!focused) {
      inputContent = value ?? "";
    }
  });

  $effect(() => {
    if (!focused) {
      if (inputContent.at(-1) === "/") inputContent = inputContent.slice(0, -1);
      if (inputContent.at(0) === "/") inputContent = inputContent.slice(1);

      inputContent = inputContent.replace(/(\/){2,}/g, "/");
    }
    if (value !== undefined) {
      if (inputContent.length > 0) value = inputContent;
      else value = null;
    }
    focused;
  });

  $effect(() => {
    folderResults;
    selectedIndex = -1;
  });

  function handleKeybinds(
    e: KeyboardEvent & { currentTarget: HTMLInputElement },
  ) {
    switch (e.key) {
      case "/":
        if (e.currentTarget.selectionStart === 0) {
          e.preventDefault();
        } else {
        }
        break;
      case "Escape":
        {
          e.currentTarget.blur();
        }
        break;
      case "ArrowUp":
        {
          e.preventDefault();
          if (selectedIndex - 1 >= 0) selectedIndex--;
          else selectedIndex = folderResults.length - 1;
        }
        break;
      case "ArrowDown":
        {
          e.preventDefault();
          if (selectedIndex + 1 < folderResults.length) selectedIndex++;
          else selectedIndex = 0;
        }
        break;
      case "Tab":
        {
          e.preventDefault();
          if (selectedIndex !== -1) {
            inputContent = folderResults[selectedIndex].item;
          }
        }
        break;
      case "Enter":
        {
          e.preventDefault();
          focused = false;
          e.currentTarget.blur();
          submitCb?.();
        }
        break;
    }
  }
</script>

<div class="flex flex-col gap-4 relative">
  <div bind:clientHeight={inputHeight}>
    <Input
      {id}
      bind:value={inputContent}
      onFocus={() => {
        focused = true;
      }}
      onBlur={() => {
        focused = false;
      }}
      onKeyDown={handleKeybinds}
      placeholder="No folder"
    />
  </div>
  {#if focused}
    <div
      transition:fly={{ duration: 200, y: 20 }}
      id="{id}-suggestions"
      class="p-2 rounded-xl bg-base-3 absolute w-full flex flex-col gap-2"
      style="top: {popupOffset}px;"
    >
      {#each folderResults as folder, i (folder.item)}
        <!-- {@const matches = fuzzyMatches(folder)} -->
        <div
          class={[
            "rounded-xl border-2 p-2 transition-all flex flex-row gap-2",
            selectedIndex === i
              ? "bg-base-1 border-content-1/50"
              : "bg-base-2 border-content-1/10 text-content-3",
          ]}
        >
          <IconFolder />
          <p>
            {#each [...folder.item] as letter, i}
              {#if folder.indices.includes(i)}
                <span class="bg-warning text-warning-content">{letter}</span>
              {:else}
                {letter}
              {/if}
            {/each}
          </p>
        </div>
      {:else}
        {#if type === "select"}
          <div
            class="rounded-xl border-2 p-2 transition-all flex flex-row gap-4 bg-base-2 border-content-1/10 text-content-3"
          >
            <IconPlus />
            <p>Create folder {inputContent}</p>
          </div>
        {:else}
          <div
            class="rounded-xl border-2 p-2 transition-all flex flex-row gap-4 bg-base-2 border-content-1/10 text-content-3"
          >
            <IconQuestionMark />
            <p>No folder found at {inputContent}</p>
          </div>
        {/if}
      {/each}
    </div>
  {/if}
</div>
