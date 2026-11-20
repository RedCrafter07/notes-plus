<script lang="ts">
  import { contentManager } from "#lib/state/contentManager.svelte.ts";
  import { editorComponents } from "#lib/state/editorComponents.svelte.ts";
  import { overlayManager } from "#lib/state/overlayManager.svelte.ts";
  import {
    IconArrowDown,
    IconArrowUp,
    IconChevronDown,
    IconChevronUp,
    IconDots,
    IconEye,
    IconEyeOff,
    IconFileTypePdf,
    IconLock,
    IconLockOpen,
    IconPlus,
    IconTrash,
  } from "@tabler/icons-svelte";
  import PageThumbnail from "./PageThumbnail.svelte";
  import { pickFiles } from "#lib/editor/import/image.ts";
  import { pdfImport } from "#lib/editor/import/pdfImport.svelte.ts";

  const iconBtn =
    "w-10 h-10 shrink-0 grid place-items-center rounded-lg text-content-3 hover:text-content-1 hover:bg-overlay/30 active:scale-90 transition-all disabled:opacity-30 disabled:pointer-events-none";

  let renaming = $state<number | null>(null);

  async function insertPdf() {
    const [file] = await pickFiles("application/pdf,.pdf");
    if (file) await pdfImport.start(file);
  }
</script>

<aside
  class={[
    "overflow-x-hidden transition-all bg-base-1 h-full shrink-0 flex flex-col gap-3",
    {
      "w-72 max-w-[40%] p-2": editorComponents.rightBarOpen,
      "w-0": !editorComponents.rightBarOpen,
    },
  ]}
  aria-label="Pages and layers"
>
  <div class="w-full p-1 rounded-xl bg-base-2 shrink-0" role="tablist">
    <div class="w-full relative flex flex-row tracking-wide text-center font-semibold">
      <div
        class={[
          "rounded-lg bg-overlay/20 absolute h-full w-1/2 transition-all duration-100",
          editorComponents.rightBarOption === "pages" ? "left-0" : "left-1/2",
        ]}
      ></div>
      {#each [["pages", "Pages"], ["layers", "Layers"]] as const as [id, label] (id)}
        <button
          role="tab"
          aria-selected={editorComponents.rightBarOption === id}
          class="relative rounded-lg p-2 flex-1"
          onclick={() => (editorComponents.rightBarOption = id)}>{label}</button
        >
      {/each}
    </div>
  </div>

  <div class="flex-1 overflow-y-auto min-h-0">
    {#if editorComponents.rightBarOption === "pages"}
      <ol class="flex flex-col gap-3 pb-2">
        {#each contentManager.pages as page, i (page)}
          {@const active = contentManager.currentPage === i}
          <li
            class={[
              "rounded-xl border-2 transition-all",
              active ? "border-primary bg-primary/10" : "border-transparent hover:bg-overlay/20",
            ]}
          >
            <button
              class="w-full p-2 pb-0 active:scale-[0.98] transition-all"
              onclick={() => (contentManager.currentPage = i)}
              aria-current={active ? "page" : undefined}
              aria-label="Open {page.name}"
            >
              <PageThumbnail {page} />
            </button>
            <div class="flex flex-row items-center gap-1 px-2 py-1">
              <span class="text-sm text-content-3 tabular-nums w-5">{i + 1}</span>
              <span class="flex-1 truncate text-left text-sm font-medium">{page.name}</span>
              <button
                class={iconBtn}
                disabled={i === 0}
                onclick={() => contentManager.movePage(i, i - 1)}
                aria-label="Move {page.name} up"
                title="Move up"
              >
                <IconArrowUp size={18} />
              </button>
              <button
                class={iconBtn}
                disabled={i === contentManager.pages.length - 1}
                onclick={() => contentManager.movePage(i, i + 1)}
                aria-label="Move {page.name} down"
                title="Move down"
              >
                <IconArrowDown size={18} />
              </button>
              <button
                class={iconBtn}
                onclick={() => overlayManager.setOpen(`pagesettings-${i}`)}
                aria-label="Page setup for {page.name}"
                title="Page setup"
              >
                <IconDots size={18} />
              </button>
            </div>
          </li>
        {/each}
      </ol>
      <div class="flex flex-col gap-2 sticky bottom-0 bg-base-1 pt-1">
        <button
          class="p-3 bg-base-2 rounded-xl flex flex-row gap-2 items-center justify-center border-2 border-content-1/15 hover:bg-overlay/30 transition-all active:scale-95 font-semibold"
          onclick={() => contentManager.addPage(contentManager.pages.length - 1)}
        >
          <IconPlus /> Add page
        </button>
        <button
          class="p-3 bg-base-2 rounded-xl flex flex-row gap-2 items-center justify-center border-2 border-content-1/15 hover:bg-overlay/30 transition-all active:scale-95"
          onclick={insertPdf}
        >
          <IconFileTypePdf /> Import PDF
        </button>
      </div>
    {:else}
      <p class="text-sm text-content-3 px-1 pb-2">
        New ink goes to the highlighted layer. The top of the list is drawn on top.
      </p>
      <ol class="flex flex-col-reverse gap-2">
        {#each contentManager.layers as layer, i (layer.id)}
          {@const active = contentManager.activeLayer === i}
          <li
            class={[
              "rounded-xl border-2 flex flex-row items-center gap-1 p-1 transition-all",
              active ? "border-primary bg-primary/10" : "border-transparent bg-base-2",
            ]}
          >
            <button
              class={iconBtn}
              onclick={() => contentManager.setLayerProps(i, { visible: !layer.visible })}
              aria-label={layer.visible ? `Hide ${layer.name}` : `Show ${layer.name}`}
              aria-pressed={!layer.visible}
              title={layer.visible ? "Hide" : "Show"}
            >
              {#if layer.visible}<IconEye size={18} />{:else}<IconEyeOff size={18} />{/if}
            </button>
            <button
              class={iconBtn}
              onclick={() => contentManager.setLayerProps(i, { locked: !layer.locked })}
              aria-label={layer.locked ? `Unlock ${layer.name}` : `Lock ${layer.name}`}
              aria-pressed={layer.locked}
              title={layer.locked ? "Unlock" : "Lock"}
            >
              {#if layer.locked}<IconLock size={18} />{:else}<IconLockOpen size={18} />{/if}
            </button>
            {#if renaming === i}
              <!-- svelte-ignore a11y_autofocus -->
              <input
                class="flex-1 min-w-0 bg-base-3 rounded-lg px-2 h-10 focus:outline-none"
                value={layer.name}
                autofocus
                onblur={(e) => {
                  const name = e.currentTarget.value.trim();
                  if (name && name !== layer.name) contentManager.setLayerProps(i, { name });
                  renaming = null;
                }}
                onkeydown={(e) => {
                  if (e.key === "Enter") e.currentTarget.blur();
                  if (e.key === "Escape") renaming = null;
                }}
              />
            {:else}
              <button
                class="flex-1 min-w-0 h-10 px-2 text-left truncate rounded-lg"
                onclick={() => (contentManager.activeLayer = i)}
                ondblclick={() => (renaming = i)}
                aria-current={active}
                title="Select layer (double-click to rename)"
              >
                {layer.name}
              </button>
            {/if}
            <div class="flex flex-col">
              <button
                class="w-8 h-5 grid place-items-center text-content-3 hover:text-content-1 disabled:opacity-30"
                disabled={i === contentManager.layers.length - 1}
                onclick={() => contentManager.moveLayer(i, i + 1)}
                aria-label="Move {layer.name} up"
              >
                <IconChevronUp size={16} />
              </button>
              <button
                class="w-8 h-5 grid place-items-center text-content-3 hover:text-content-1 disabled:opacity-30"
                disabled={i === 0}
                onclick={() => contentManager.moveLayer(i, i - 1)}
                aria-label="Move {layer.name} down"
              >
                <IconChevronDown size={16} />
              </button>
            </div>
            <button
              class={iconBtn}
              disabled={contentManager.layers.length <= 1}
              onclick={() => contentManager.deleteLayer(i)}
              aria-label="Delete {layer.name}"
              title="Delete layer"
            >
              <IconTrash size={18} />
            </button>
          </li>
        {/each}
      </ol>
      <button
        class="mt-3 w-full p-3 bg-base-2 rounded-xl flex flex-row gap-2 items-center justify-center border-2 border-content-1/15 hover:bg-overlay/30 transition-all active:scale-95 font-semibold"
        onclick={() => contentManager.addLayer()}
      >
        <IconPlus /> Add layer
      </button>
    {/if}
  </div>
</aside>
