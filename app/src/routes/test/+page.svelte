<script lang="ts">
  import {
    buildPath,
    generateData,
    type OutlinePoint,
    type Point,
  } from "$lib/functions/stroke";

  let type = $state("N/A");

  let pointerId = $state(0);
  let button = $state(0);
  let pressure = $state(0);
  let tiltX = $state(0);
  let tiltY = $state(0);
  let width = $state(0);
  let height = $state(0);

  let draw = $state(false);
  let currentPoints = $state<Point[]>([]);
  let currentData = $state<string>();
  let outlinePoints = $state<OutlinePoint[]>([]);
  let allPoints = $state<OutlinePoint[][]>([]);
  let allData = $state<string[]>([]);

  function handlePointerUp() {
    draw = false;

    allPoints.push(outlinePoints);
    if (currentData) allData.push(currentData);
    currentPoints = [];
    outlinePoints = [];
    currentData = "";
  }

  function handlePointerDown(e: PointerEvent) {
    e.preventDefault();
    draw = true;
  }

  function handlePointerMove(e: PointerEvent) {
    if (!draw) return;
    let pressure = 0.5;
    if (e.pointerType === "pen") pressure = e.pressure;

    currentPoints.push({ x: e.clientX, y: e.clientY, pressure });

    if (currentPoints) {
      outlinePoints = generateData(currentPoints, 20);
      currentData = buildPath(outlinePoints);
    }
  }
</script>

<div class="top-4 left-4 absolute z-20">
  <p>{type}</p>
  <p>pointerId: {pointerId}</p>
  <p>button: {button}</p>
  <p>width: {width}</p>
  <p>height: {height}</p>
  <p>tiltX: {tiltX}</p>
  <p>tiltY {tiltY}</p>
  <p>pressure: {pressure}</p>
  <a href="/test/new">New test</a>
  <button
    class="cursor-pointer"
    onclick={() => {
      allData = [];
      allPoints = [];
      currentData = undefined;
      currentPoints = [];
    }}>Clear</button
  >
</div>

<div
  class="w-full h-full absolute top-0 left-0 z-10"
  onpointermove={(e) => {
    type = e.pointerType;

    switch (e.pointerType) {
      case "mouse":
      case "touch":
        break;
      case "pen":
        {
          pointerId = e.pointerId;
          button = e.buttons;
          pressure = e.pressure;
          tiltX = e.tiltX;
          tiltY = e.tiltY;
          width = e.width;
          height = e.height;

          e.preventDefault();
        }
        break;
    }
  }}
>
  <svg
    width="100%"
    height="100%"
    onpointerdown={handlePointerDown}
    onpointerup={handlePointerUp}
    onpointerleave={handlePointerUp}
    onpointermove={handlePointerMove}
    stroke="none"
    fill="#ffffff"
    class="touch-none"
  >
    <path d={currentData} />
    {#each [...allData].reverse() as path}
      <path d={path} />
    {/each}
  </svg>
</div>
