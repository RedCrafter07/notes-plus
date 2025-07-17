<script>
  import "@fontsource-variable/funnel-sans";
  import "@fontsource-variable/funnel-display";
  import "../app.css";
  import "../mocha.css";

  const { children } = $props();
</script>

<div class="w-full min-h-screen text-content-1 bg-base-1">
  {@render children()}
</div>
