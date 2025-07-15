<script lang="ts">
  import { invoke } from "@tauri-apps/api/core";

  async function greet(event: Event) {
    event.preventDefault();
    // Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
    greetMsg = await invoke("greet", { name });
  }
</script>

<h1 class="text-3xl">Welcome to RedNotes Plus!</h1>
<h3 class="text-xl">What would you like to work on?</h3>
