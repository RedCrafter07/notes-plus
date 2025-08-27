<script lang="ts">
  import { enhance } from "$app/forms";
  import type { UserPrefs } from "$lib/types/bindings/UserPrefs";
  import { IconDeviceFloppy, IconFolder, IconX } from "@tabler/icons-svelte";
  import { invoke } from "@tauri-apps/api/core";
  import { open } from "@tauri-apps/plugin-dialog";
  import { linear } from "svelte/easing";
  import { fade } from "svelte/transition";

  const { closeCb, visible }: { closeCb: () => void; visible: boolean } =
    $props();

  let prefs = $state<UserPrefs>();

  $effect(() => {
    if (visible) {
      (async () => {
        prefs = await getPrefs();
      })();
    }
  });

  $inspect(prefs);

  async function getPrefs() {
    return await invoke<UserPrefs>("get_prefs");
  }
</script>

{#if visible}
  <div
    class="absolute top-0 left-0 z-50 w-full h-screen"
    transition:fade={{ duration: 200, easing: linear }}
  >
    <div class="w-full h-full relative">
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div
        class="absolute top-0 pointer-events-auto w-full h-full backdrop-blur-3xl bg-base-1/75"
        onclick={closeCb}
      ></div>

      <div
        class="absolute top-0 pointer-events-none w-full h-full grid place-items-center"
      >
        <div
          class="pointer-events-auto w-3/4 h-3/4 rounded-xl bg-base-2 drop-shadow-lg p-4 flex flex-col gap-4"
        >
          <div class="flex flex-row items-center w-full">
            <h1 class="text-3xl font-display font-medium">Settings</h1>
            <button
              class="ml-auto text-content-1 opacity-50 hover:text-destructive hover:opacity-100 active:scale-90 transition-all"
              onclick={() => {
                closeCb();
              }}
            >
              <IconX />
            </button>
          </div>
          <div class="flex flex-col gap-4">
            <div class="flex flex-col gap-2">
              <h3 class="text-2xl">Storage Settings</h3>
              <div>
                <label for="#document-dir" class="text-xl"
                  >Document Directory</label
                >
                <p class="text-content-1/75">
                  This is the main place your notes get stored. Imagine it like
                  a folder containing your notebook.
                </p>
                <div
                  class="flex flex-row gap-2 w-full py-2 px-3 rounded-xl bg-base-3"
                >
                  <input
                    type="text"
                    id="document-dir"
                    class="w-full flex-1 focus:outline-none"
                    value={prefs?.default_document_dir}
                    onblur={(e) => {
                      if (!prefs) return;
                      prefs.default_document_dir = e.currentTarget.value;
                    }}
                  />
                  <button
                    class="aspect-square h-full rounded-xl text-content-1/50 hover:text-content-1 active:scale-95 transition-all"
                    type="button"
                    onclick={async () => {
                      if (!prefs) return;

                      const dir = await open({
                        directory: true,
                        defaultPath: prefs.default_document_dir,
                        canCreateDirectories: true,
                        title: "Select the primary document directory.",
                        multiple: false,
                      });

                      if (!dir) return;

                      prefs.default_document_dir = dir;
                    }}
                  >
                    <IconFolder />
                  </button>
                </div>
              </div>
              <div>
                <label for="#workdir" class="text-xl">Working Directory</label>
                <p class="text-content-1/75">
                  This is simply for temporary files; they will get deleted
                  afterwards.
                </p>
                <div
                  class="flex flex-row gap-2 w-full py-2 px-3 rounded-xl bg-base-3"
                >
                  <input
                    type="text"
                    id="workdir"
                    class="w-full flex-1 focus:outline-none"
                    value={prefs?.workdir}
                    onblur={(e) => {
                      if (!prefs) return;
                      prefs.workdir = e.currentTarget.value;
                    }}
                  />
                  <button
                    class="aspect-square h-full rounded-xl text-content-1/50 hover:text-content-1 active:scale-95 transition-all"
                    type="button"
                    onclick={async () => {
                      if (!prefs) return;

                      const dir = await open({
                        directory: true,
                        defaultPath: prefs.workdir,
                        canCreateDirectories: true,
                        title: "Select the primary document directory.",
                        multiple: false,
                      });

                      if (!dir) return;

                      prefs.workdir = dir;
                    }}
                  >
                    <IconFolder />
                  </button>
                </div>
              </div>
              <button
                class="flex flex-row gap-4 justify-center w-max border-success text-success border hover:text-success-content hover:bg-success transition-all py-2 px-3 rounded-xl cursor-pointer"
                onclick={async () => {
                  await invoke("set_prefs", {
                    newPrefs: prefs,
                  });
                }}
              >
                <IconDeviceFloppy /> <span>Save</span>
              </button>
            </div>

            <hr class="text-content-1/50" />

            <p>More settings soon!</p>
          </div>
        </div>
      </div>
    </div>
  </div>
{/if}
