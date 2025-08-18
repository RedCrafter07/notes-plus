<script lang="ts">
  import {
    IconFileArrowLeft,
    IconPlus,
    IconSettings,
  } from "@tabler/icons-svelte";
  import { open } from "@tauri-apps/plugin-dialog";
  import { goto } from "$app/navigation";
  import { tabManager } from "$lib/tabs/tabs.svelte";

  let recentFiles = $state([]);

  async function getRecentFiles() {}
</script>

<main class="w-full flex-col gap-4 select-none">
  <div class="bg-base-2 w-full py-2 px-4 items-center flex flex-row gap-2">
    <div class="text-xl font-display font-black">RedNotes Plus</div>
    <div
      class="ml-auto p-2 rounded-xl bg-base-3 aspect-square active:scale-90 active:opacity-90 transition-all group"
    >
      <IconSettings
        size={24}
        class="group-hover:opacity-100 opacity-90 transition-opacity"
      />
    </div>
  </div>
  <div class="container mx-auto p-2 flex flex-col lg:gap-4 gap-2">
    <div>
      <h1 class="text-3xl font-display">Welcome to RedNotes Plus!</h1>
      <h3 class="text-xl">What would you like to work on?</h3>
    </div>
    <div class="grid grid-cols-2 w-full gap-4">
      <a
        href="/edit"
        class="group rounded-xl bg-base-2 text-content-1 active:scale-95 transition-all border-content-1/50 border-2 hover:border-content-1 p-4"
        onclick={(e) => {
          e.preventDefault();

          tabManager.addTab("new", true);

          goto(e.currentTarget.href);
        }}
      >
        <IconPlus
          size={48}
          class="mx-auto transition-all opacity-80 group-hover:opacity-100"
        />
      </a>
      <button
        class="cursor-pointer group rounded-xl bg-base-2 text-content-1 active:scale-95 transition-all border-content-1/50 border-2 hover:border-content-1 p-4"
        onclick={async () => {
          const path = await open({
            directory: false,
            multiple: false,
            filters: [{ name: "RedNotes Plus File", extensions: ["rnpf"] }],
          });

          if (!path) return;

          await tabManager.loadFile(path, true);
        }}
      >
        <IconFileArrowLeft
          size={48}
          class="mx-auto transition-all opacity-80 group-hover:opacity-100"
        />
      </button>
    </div>
  </div>
</main>
