/**
 * Headless geometry audit for the new academic/indoor complex.
 * It builds the real WorldEnvironment with a no-op 2D canvas and pathfinds
 * through the actual colliders, floors and stair ramps.
 */

function fakeCanvas() {
  const canvas: any = { width: 0, height: 0 };
  const gradient = { addColorStop() {} };
  const ctx = new Proxy(
    { canvas },
    {
      get(target: any, prop: string) {
        if (prop === "canvas") return canvas;
        if (prop === "createLinearGradient" || prop === "createRadialGradient") {
          return () => gradient;
        }
        if (prop in target) return target[prop];
        return () => undefined;
      },
      set(target: any, prop: string, value: unknown) {
        target[prop] = value;
        return true;
      },
    },
  );
  canvas.getContext = () => ctx;
  return canvas;
}

(globalThis as any).document = {
  createElement: (tag: string) => (tag === "canvas" ? fakeCanvas() : { style: {} }),
};
(globalThis as any).requestAnimationFrame = (callback: (time: number) => void) => setTimeout(() => callback(0), 0);

const { WorldEnvironment } = await import("./game/world/WorldEnvironment");
const { collidesAt } = await import("./game/systems/PlayerController");

const world = new WorldEnvironment();
await world.build(() => {});
for (const door of world.doors) door.setOpenInstant(true);

type Point = { x: number; z: number; label: string; upper?: boolean };

const checks: Array<[boolean, string]> = [];
const check = (condition: boolean, label: string) => checks.push([condition, label]);

check(world.floors.length >= 3, `floor surfaces registered (${world.floors.length})`);
check(world.ramps.length >= 2, `stair ramps registered (${world.ramps.length})`);
check(world.walkHeightAt(-25, 0, 0) === 0, "ground floor under the first-floor slab is ground level");
check(Math.abs(world.walkHeightAt(-25, 0, 3.6) - 3.6) < 0.001, "first floor resolves at 3.6 m");
check(!collidesAt(-25, 0, world.colliders, 0), "ground corridor is clear at ground height");
check(!collidesAt(-25, 0, world.colliders, 3.6), "first-floor corridor is clear at first-floor height");
check(world.doors.some((door) => door.label === "classroom"), "academic main door exists");
check(world.doors.some((door) => door.label === "block-b"), "Block B door exists");
check(world.doors.some((door) => door.label === "indoor-sports"), "indoor sports door exists");

// Every house has one distinct, reachable shared food cupboard in its hostel.
for (const houseId of ["aravali", "nilgiri", "shivalik", "udaygiri"] as const) {
  const info = world.houseHostels[houseId];
  const cupboard = world.houseCupboards[houseId];
  const interactable = world.interactables.find(
    (item) => item.kind === "cupboard" && item.houseId === houseId,
  );
  check(Boolean(info), `${houseId} hostel registered`);
  check(Boolean(cupboard), `${houseId} cupboard geometry built`);
  check(Boolean(interactable), `${houseId} cupboard is interactable`);
  if (info && interactable) {
    const insideZone =
      interactable.position.x > info.zone.minX &&
      interactable.position.x < info.zone.maxX &&
      interactable.position.z > info.zone.minZ &&
      interactable.position.z < info.zone.maxZ;
    check(insideZone, `${houseId} cupboard stands inside the hostel common area`);
    check(
      !collidesAt(interactable.position.x, interactable.position.z, world.colliders, 0),
      `${houseId} cupboard approach is walkable`,
    );
  }
  if (cupboard) {
    world.setCupboardOpen(houseId, true);
    check(cupboard.target === 1, `${houseId} cupboard doors open`);
    world.setCupboardOpen(houseId, false);
    check(cupboard.target === 0, `${houseId} cupboard doors close`);
  }
}

const starts: Point[] = [
  { x: -12, z: 0, label: "academic portico" },
  { x: 23, z: -20.2, label: "Block B entrance" },
  { x: 49.3, z: -10, label: "indoor hall entrance" },
];
const goals: Point[] = [
  { x: -25, z: 0, label: "Academic Block A ground corridor" },
  { x: -30.5, z: -7, label: "Room 101" },
  { x: -39.5, z: -8.5, label: "academic washroom" },
  { x: -21, z: -7, label: "Room 102" },
  { x: -30.5, z: 7, label: "Room 103" },
  { x: -21, z: 7, label: "activity room" },
  { x: -25, z: 0, label: "Academic Block A first-floor corridor", upper: true },
  { x: -30.5, z: -7, label: "Room 201", upper: true },
  { x: -21, z: -7, label: "Room 202", upper: true },
  { x: -30.5, z: 7, label: "Room 203", upper: true },
  { x: -21, z: 6, label: "academic staff room", upper: true },
  { x: -14.5, z: 0, label: "first-floor balcony", upper: true },
  { x: 25.0, z: -23.5, label: "Block B computer laboratory" },
  { x: 36.0, z: -26.5, label: "Block B classroom" },
  { x: 26.2, z: -16.5, label: "Block B practical room" },
  { x: 36.0, z: -16.5, label: "Block B staff room" },
  { x: 49.3, z: -18, label: "indoor sports hall" },
  { x: 47.6, z: -26.0, label: "indoor equipment store" },
];

function pathfind(start: Point, goal: Point): Point[] | null {
  const step = 0.35;
  const minX = -46;
  const maxX = 55;
  const minZ = -31;
  const maxZ = 13;
  const cols = Math.ceil((maxX - minX) / step);
  const rows = Math.ceil((maxZ - minZ) / step);
  const startH = world.walkHeightAt(start.x, start.z, 0);
  const startKey = `${Math.round((start.x - minX) / step)},${Math.round((start.z - minZ) / step)},${startH.toFixed(2)}`;
  const queue: Array<{ ix: number; iz: number; h: number; g: number }> = [
    { ix: Math.round((start.x - minX) / step), iz: Math.round((start.z - minZ) / step), h: startH, g: 0 },
  ];
  const came = new Map<string, string | null>();
  const scores = new Map<string, number>([[startKey, 0]]);
  came.set(startKey, null);
  const goalKey = (ix: number, iz: number) =>
    `${Math.round((goal.x - minX) / step)},${Math.round((goal.z - minZ) / step)},${(goal.upper ? 3.6 : 0).toFixed(2)}`;

  while (queue.length) {
    queue.sort((a, b) => a.g - b.g);
    const current = queue.shift()!;
    const key = `${current.ix},${current.iz},${current.h.toFixed(2)}`;
    if (current.ix === Math.round((goal.x - minX) / step) && current.iz === Math.round((goal.z - minZ) / step)) {
      if (!goal.upper || current.h > 3.4) {
        const path: Point[] = [];
        let cursor: string | null = key;
        while (cursor) {
          const [ix, iz, h] = cursor.split(",").map(Number);
          path.push({ x: minX + ix * step, z: minZ + iz * step, label: cursor, upper: h > 3 });
          cursor = came.get(cursor) ?? null;
        }
        return path.reverse();
      }
    }
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const ix = current.ix + dx;
      const iz = current.iz + dz;
      if (ix < 0 || iz < 0 || ix >= cols || iz >= rows) continue;
      const x = minX + ix * step;
      const z = minZ + iz * step;
      if (collidesAt(x, z, world.colliders, current.h)) continue;
      const height = world.walkHeightAt(x, z, current.h);
      if (height > current.h + 0.56) continue;
      const nextKey = `${ix},${iz},${height.toFixed(2)}`;
      const cost = current.g + step + Math.abs(height - current.h) * 2;
      if ((scores.get(nextKey) ?? Infinity) <= cost) continue;
      scores.set(nextKey, cost);
      came.set(nextKey, key);
      queue.push({ ix, iz, h: height, g: cost });
    }
  }
  void goalKey;
  return null;
}

for (const goal of goals) {
  const start = goal.label.includes("Block B")
    ? starts[1]
    : goal.label.includes("indoor")
      ? starts[2]
      : starts[0];
  const path = pathfind(start, goal);
  check(Boolean(path), `walkable route: ${start.label} -> ${goal.label}`);
  if (path) {
    const heights = Array.from(new Set(path.map((point) => Math.round((point as any).upper ? 3.6 : 0))));
    console.log(`    route ${goal.label}: ${path.length} nodes (${heights.join("/")})`);
  }
}

// Closed doors must stop movement; opened doors must not.
const academicDoor = world.doors.find((door) => door.label === "classroom")!;
academicDoor.setOpenInstant(false);
check(collidesAt(-16, 0, world.colliders, 0), "closed academic door blocks the entrance");
academicDoor.setOpenInstant(true);
check(!collidesAt(-16, 0, world.colliders, 0), "open academic door clears the entrance");

// Drive the real PlayerController through both stair flights. This catches
// cases that a grid audit can miss, such as floor snapping or rail clipping.
const THREE = await import("three");
const { PlayerController } = await import("./game/systems/PlayerController");
const { DEFAULT_CHARACTER } = await import("./game/core/types");
const player = new PlayerController(DEFAULT_CHARACTER, "#2563EB");
player.placeAt(new THREE.Vector3(-36.2, 0, 3.2), 0);
const fakeInput: any = {
  running: false,
  getMove: () => ({ x: 0, y: 1 }),
  consumeJump: () => false,
};
const drive = (seconds: number, yaw: number, stop?: () => boolean) => {
  for (let index = 0; index < seconds * 60; index += 1) {
    player.update(1 / 60, fakeInput, yaw, world.colliders, world.bounds, world.walkHeightAt);
    if (stop?.()) break;
  }
};
// West up the first flight, north across the half-landing, east up the second
// flight, then south into the first-floor corridor.
drive(3, Math.PI / 2, () => player.position.x < -42.6);
const halfway = player.position.y;
drive(3, 0, () => player.position.z < -3.0);
drive(3, -Math.PI / 2, () => player.position.x > -36.3);
drive(2, Math.PI, () => player.position.z > -0.6);
drive(3, -Math.PI / 2, () => player.position.x > -25);
check(halfway > 1.6 && halfway < 2.0, `player reaches the half-landing (y ${halfway.toFixed(2)})`);
check(Math.abs(player.position.y - 3.6) < 0.08, `player reaches the first floor (y ${player.position.y.toFixed(2)})`);
check(player.position.x > -25.2, `player walks the first-floor corridor (x ${player.position.x.toFixed(2)})`);
check(player.grounded, "player is grounded on the first floor");

let failed = 0;
for (const [ok, label] of checks) {
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}`);
  if (!ok) failed += 1;
}
console.log(`\nResult: ${checks.length - failed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
