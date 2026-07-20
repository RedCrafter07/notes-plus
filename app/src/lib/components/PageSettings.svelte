<script lang="ts">
  import BackgroundPatterns from "$lib/editor/BackgroundPatterns.svelte";
  import { contentManager } from "$lib/state/contentManager.svelte";
  import { overlayManager } from "$lib/state/overlayManager.svelte";
  import type { BackgroundPattern } from "$lib/tauri/bindings";
  import { IconCheck, IconClipboard, IconTrash } from "@tabler/icons-svelte";
  import Input from "./Input.svelte";
  import Overlay from "./Overlay.svelte";
  import ColorInput from "./ColorInput.svelte";

  let visible = $derived(
    overlayManager.open?.startsWith("pagesettings-") ?? false,
  );

  let pageIndex = $derived(parseInt(overlayManager.open?.split("-")[1] ?? "0"));

  function closeCb() {
    overlayManager.close();
  }

  // svelte-ignore state_referenced_locally
  let bgColor = $state("#ffffff");
  // svelte-ignore state_referenced_locally
  let patternColor = $state("#dddddd");
  // svelte-ignore state_referenced_locally
  let pattern = $state<BackgroundPattern | null>(null);
  // svelte-ignore state_referenced_locally
  let patternScale = $state(16);
  // svelte-ignore state_referenced_locally
  let pageName = $state("Page 0");

  $effect(() => {
    if (contentManager.pages[pageIndex]) {
      bgColor = contentManager.pages[pageIndex].background_color;
      patternColor = contentManager.pages[pageIndex].pattern_color;
      patternScale = contentManager.pages[pageIndex].pattern_scale;
      pageName = contentManager.pages[pageIndex].name;
      pattern = contentManager.pages[pageIndex].pattern;
    }
  });

  function save(page: number = pageIndex) {
    contentManager.pages[page].name = pageName;
    contentManager.pages[page].pattern_color = patternColor;
    contentManager.pages[page].pattern_scale = patternScale;
    contentManager.pages[page].background_color = bgColor;
    contentManager.pages[page].pattern = pattern;

    overlayManager.close();
  }

  function saveAll() {
    contentManager.pages.forEach((_, i) => {
      save(i);
    });
  }
</script>

{#snippet backgroundType(type: BackgroundPattern | "Blank")}
  {@const active = pattern === (type === "Blank" ? null : type)}
  <button
    onclick={() => {
      if (type === "Blank") pattern = null;
      else pattern = type;
    }}
    class={[
      "aspect-square rounded-xl overflow-hidden transition-all active:scale-95 relative",
    ]}
  >
    <div
      class="absolute top-0 w-full h-full"
      style="background-color: {bgColor};"
    >
      {#if type !== "Blank"}
        <BackgroundPatterns
          uuid
          pattern={type}
          color={patternColor}
          scale={patternScale}
        />
      {/if}
    </div>
    <div
      class={[
        "absolute w-full h-full border-4 top-0 rounded-xl transition-all",
        active ? "border-primary" : "border-transparent",
      ]}
    ></div>
  </button>
{/snippet}

{#if contentManager.pages.length > 0}
  <Overlay {visible} {closeCb} title="Page Settings">
    <div class="flex flex-col">
      <div class="flex flex-row gap-2">
        <Input id="page-name" placeholder="Page 1" bind:value={pageName} />
        <button
          class="border-2 border-destructive text-destructive hover:bg-destructive hover:text-destructive-content active:scale-95 transition-all aspect-square p-2 rounded-xl"
          onclick={() => {
            contentManager.deletePage(pageIndex);
          }}
        >
          <IconTrash />
        </button>
      </div>
    </div>
    <div class="grid grid-cols-4 w-full gap-4 items-center">
      {@render backgroundType("Squares")}
      {@render backgroundType("Dots")}
      {@render backgroundType("Lines")}
      {@render backgroundType("Blank")}
    </div>

    <div class="flex flex-col gap-1">
      <ColorInput id="bg-color" bind:value={bgColor} label="Page Background" />
    </div>
    <div class="flex flex-col gap-1">
      <ColorInput
        id="pattern-color"
        bind:value={patternColor}
        label="Pattern color"
      />
    </div>

    <div class="sticky bottom-0 flex flex-row gap-4 rounded-xl bg-base-1">
      <button
        class="p-2 rounded-xl border-2 border-success text-success hover:bg-success bg-base-1 hover:text-success-content transition-all flex flex-row gap-2 items-center justify-center font-bold tracking-wider active:scale-95 w-full flex-1"
        onclick={() => save()}
      >
        <IconCheck />
        <p>Apply</p>
      </button>
      <button
        class="p-2 rounded-xl border-2 border-warning text-warning hover:bg-warning bg-base-1 hover:text-warning-content transition-all flex flex-row gap-2 items-center justify-center font-bold tracking-wider active:scale-95"
        onclick={() => saveAll()}
      >
        <IconClipboard />
        <p>Apply to all</p>
      </button>
    </div>
  </Overlay>
{/if}
