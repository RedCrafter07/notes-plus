<script lang="ts">
  import { IconSettings } from "@tabler/icons-svelte";
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
  <div class="container mx-auto p-2">
    <h1 class="text-3xl font-display">Welcome to RedNotes Plus!</h1>
    <h3 class="text-xl">What would you like to work on?</h3>
  </div>
</main>
