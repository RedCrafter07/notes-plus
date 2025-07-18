<script lang="ts">
  let type = $state("N/A");

  let pointerId = $state(0);
  let button = $state(0);
  let pressure = $state(0);
  let tiltX = $state(0);
  let tiltY = $state(0);
  let width = $state(0);
  let height = $state(0);

  let draw = $state(false);
  let currentIndex = $state(0);
  let paths = $state<[number, number][][]>([]);
  let pathString = $derived(
    paths
      .map((p) => {
        return p
          .map((d, i) => {
            if (i == 0) return `M ${d[0]} ${d[1]}`;
            else return `L ${d[0]} ${d[1]}`;
          })
          .join(" ");
      })
      .join(" "),
  );
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
</div>

<div
  class="w-full h-full absolute top-0 left-0 z-10 bg-black"
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

          console.log(e);

          e.preventDefault();
        }
        break;
    }
  }}
>
  <svg
    width="100%"
    height="100%"
    onpointerdown={(e) => {
      e.preventDefault();
      if (!paths[currentIndex]) paths[currentIndex] = [];
      draw = true;
    }}
    onpointerup={() => {
      currentIndex += 1;
      draw = false;
    }}
    onpointermove={(e) => {
      if (!draw) return;

      paths[currentIndex].push([e.clientX, e.clientY]);
    }}
    stroke="#ffffff"
  >
    <path d={pathString}></path>
  </svg>
</div>
