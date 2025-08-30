<script lang="ts">
  import type { UserPrefs } from "$lib/types/bindings/UserPrefs";
  import { IconDeviceFloppy, IconFolder, IconX } from "@tabler/icons-svelte";
  import { invoke } from "@tauri-apps/api/core";
  import { open } from "@tauri-apps/plugin-dialog";
  import { linear } from "svelte/easing";
  import { fade } from "svelte/transition";
  import Overlay from "./Overlay.svelte";

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

<Overlay title="Settings" {closeCb} {visible}>
  <div class="flex flex-col gap-4">
    <div class="flex flex-col gap-2">
      <h3 class="text-2xl">Storage Settings</h3>
      <div>
        <label for="#document-dir" class="text-xl">Document Directory</label>
        <p class="text-content-1/75">
          This is the main place your notes get stored. Imagine it like a folder
          containing your notebook.
        </p>
        <div class="flex flex-row gap-2 w-full py-2 px-3 rounded-xl bg-base-3">
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
          This is simply for temporary files; they will get deleted afterwards.
        </p>
        <div class="flex flex-row gap-2 w-full py-2 px-3 rounded-xl bg-base-3">
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
</Overlay>
