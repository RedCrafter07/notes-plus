<script lang="ts">
  import { IconPlus, IconSettings } from "@tabler/icons-svelte";

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
    <div class="grid grid-cols-2 w-full">
      <div
        class:col-span-2={recentFiles.length % 2 === 0}
        class="rounded-xl bg-base-2 group text-content-3 active:scale-95 transition-all"
      >
        <div
          class="m-4 border-dashed border-4 border-content-3 group-hover:border-content-3/80 p-4 rounded-2xl group-hover:rounded-3xl group-active:rounded-4xl flex transition-all"
        >
          <IconPlus
            size={48}
            class="mx-auto group-hover:opacity-80 transition-all group-active:scale-90"
          />
        </div>
      </div>
    </div>
  </div>
</main>
