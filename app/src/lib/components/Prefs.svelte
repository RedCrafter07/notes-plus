<script lang="ts">
  import type { UserPrefs } from "$lib/types/bindings/UserPrefs";
  import { IconDeviceFloppy, IconFolder, IconX } from "@tabler/icons-svelte";
  import { invoke } from "@tauri-apps/api/core";
  import { open } from "@tauri-apps/plugin-dialog";
  import Overlay from "./Overlay.svelte";
  import Input from "./Input.svelte";

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
        <Input
          id="document-dir"
          label="Document Directory"
          description="This is the main place your notes get stored. Imagine it like a folder containing your notebook."
          value={prefs?.default_document_dir}
          onBlur={(e) => {
            if (!prefs) return;
            prefs.default_document_dir = e.currentTarget.value;
          }}
        >
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
        </Input>
      </div>
      <div>
        <Input
          id="workdir"
          label="Working Directory"
          description="This is simply for temporary files; they will get deleted afterwards."
          value={prefs?.workdir}
          onBlur={(e) => {
            if (!prefs) return;
            prefs.workdir = e.currentTarget.value;
          }}
        >
          <button
            class="aspect-square h-full rounded-xl text-content-1/50 hover:text-content-1 active:scale-95 transition-all"
            type="button"
            onclick={async () => {
              if (!prefs) return;

              const dir = await open({
                directory: true,
                defaultPath: prefs.workdir,
                canCreateDirectories: true,
                title: "Select the working directory.",
                multiple: false,
              });

              if (!dir) return;

              prefs.workdir = dir;
            }}
          >
            <IconFolder />
          </button>
        </Input>
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
