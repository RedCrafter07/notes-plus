<script lang="ts">
  import { IconEraser, IconLasso, IconPencil } from "@tabler/icons-svelte";
  import { canvasManager, type Tool } from "./state/canvasManager.svelte";
  import PenToolbar from "./PenToolbar.svelte";
  import { toRadian } from "$lib/util/geometry";

  let color = $state(canvasManager.color);

  const tools: {
    id: Tool;
    icon: typeof IconEraser;
  }[] = [
    {
      id: "pen",
      icon: IconPencil,
    },
    {
      id: "eraser",
      icon: IconEraser,
    },
    {
      id: "lasso",
      icon: IconLasso,
    },
  ];

  $effect(() => {
    canvasManager.color = color;
  });

  const R = 80;

  function iconPos(i: number, n: number) {
    const angle = toRadian(270 - ((i + 0.5) / n) * 180); // halfway between start and end of the angle
    const x = R + R * Math.cos(angle) * 0.62;
    const y = R + R * Math.sin(angle) * 0.62;
    return { x, y };
  }

  function slicePath(i: number, n: number) {
    // since y is down in svg opposed to up in math, the degrees are flipped (180°). We also need to add 90° because the orientation would otherwise be horizontal.
    const startDeg = toRadian(270 - (i / n) * 180);
    const endDeg = toRadian(270 - ((i + 1) / n) * 180); // ends where the next one starts

    // R is the center and also the radius (since the height of the menu is 2R)
    const x1 = R + R * Math.cos(startDeg);
    const y1 = R + R * Math.sin(startDeg);
    const x2 = R + R * Math.cos(endDeg);
    const y2 = R + R * Math.sin(endDeg);

    return `M ${R} ${R} L ${x1} ${y1} A ${R} ${R} 0 0 0 ${x2} ${y2} Z`;
  }
</script>

<PenToolbar radius={R} />
<svg
  class="absolute right-0 top-1/2 -translate-y-1/2 pointer-events-none z-10"
  width={R}
  height={R * 2}
>
  <path d={slicePath(0, 1)} class="fill-base-1" />
  {#each tools as tool, i}
    {@const Icon = tool.icon}
    {@const pos = iconPos(i, tools.length)}
    {@const active = canvasManager.tool === tool.id}

    <g
      role="button"
      tabindex="0"
      aria-label="{tool.id} tool"
      aria-pressed={active}
      class="cursor-pointer pointer-events-auto"
      onclick={() => {
        canvasManager.tool = tool.id;
      }}
      onkeydown={(e) => {
        e.preventDefault();
      }}
    >
      <path
        d={slicePath(i, tools.length)}
        class={[
          "transition-colors",
          active
            ? "fill-content-2 hover:fill-content-3"
            : "fill-base-1 hover:fill-base-2",
        ]}
      />
      <foreignObject
        x={pos.x - 12.5}
        y={pos.y - 12.5}
        width="25"
        height="25"
        class="pointer-events-none overflow-visible"
      >
        <div
          class={[
            active ? "text-base-1" : "",
            "w-full h-full flex items-center justify-center transition-colors",
          ]}
        >
          <Icon />
        </div>
      </foreignObject>
    </g>
  {/each}
</svg>
