/**
 * Geometry-level campus audit.
 *
 * Builds the real WorldEnvironment in Bun with a no-op canvas shim (no WebGL),
 * then flood-fills the walkable floor around each new interior. This verifies
 * that doorways are passable, interiors are connected, and the interaction
 * points are reachable without a browser or GPU.
 */
const gradient = { addColorStop() {} };
function makeCanvas(): any {
  const canvas: any = {
    width: 0,
    height: 0,
    getContext() {
      const ctx: any = new Proxy(
        {
          canvas,
          fillStyle: "",
          strokeStyle: "",
          lineWidth: 1,
          font: "",
          textAlign: "left",
          createLinearGradient: () => gradient,
          createRadialGradient: () => gradient,
          measureText: () => ({ width: 10 }),
        },
        {
          get(target, prop) {
            if (prop in target) return (target as any)[prop];
            return () => {};
          },
          set(target, prop, value) {
            (target as any)[prop] = value;
            return true;
          },
        },
      );
      return ctx;
    },
  };
  return canvas;
}

(globalThis as any).document = { createElement: () => makeCanvas() };
(globalThis as any).window = { devicePixelRatio: 1 };
(globalThis as any).requestAnimationFrame = (cb: (t: number) => void) => setTimeout(() => cb(0), 0);

const { WorldEnvironment } = await import("../src/game/world/WorldEnvironment");
const { InteractionSystem } = await import("../src/game/systems/InteractionSystem");

const world = new WorldEnvironment();
await world.build(() => {});
const interaction = new InteractionSystem(world);

const colliders = world.colliders;
const radius = 0.38;
function blocked(x: number, z: number): boolean {
  for (const c of colliders) {
    if (!c.active) continue;
    const cx = Math.max(c.minX, Math.min(x, c.maxX));
    const cz = Math.max(c.minZ, Math.min(z, c.maxZ));
    const dx = x - cx;
    const dz = z - cz;
    if (dx * dx + dz * dz < radius * radius) return true;
  }
  return false;
}

interface Room {
  name: string;
  outside: [number, number];
  inside: [number, number];
  points: Array<[number, number]>;
  doorLabels: string[];
}

const rooms: Room[] = [
  {
    name: "library",
    outside: [-24.5, -30],
    inside: [-29.2, -30],
    points: [
      [-29.2, -30],
      [-36, -28],
      [-38.4, -31.6],
      [-41.6, -25.6],
      [-31.8, -33.4],
    ],
    doorLabels: ["library"],
  },
  {
    name: "science labs",
    outside: [36, -30.4],
    inside: [36, -38],
    points: [
      [36, -38],
      [31.4, -38],
      [40.6, -41.8],
      [30.2, -38.2],
      [36, -39.4],
    ],
    doorLabels: ["science-lab-left", "science-lab-right"],
  },
  {
    name: "administration",
    outside: [13, 38.3],
    inside: [13, 43],
    points: [
      [13, 43],
      [15, 44.7],
      [16.2, 45.0],
      [12.4, 45.4],
      [12.4, 46.4],
      [16.3, 44.9],
    ],
    doorLabels: ["administration"],
  },
  {
    name: "dining hall",
    outside: [2, -30.2],
    inside: [2, -34.5],
    points: [
      [2, -34.5],
      [-8, -38],
      [12, -38],
      [2, -42.4],
      [-12.0, -37.5],
    ],
    doorLabels: ["dining-left", "dining-right"],
  },
  {
    name: "security cabin",
    outside: [-9.45, 47.1],
    inside: [-9.45, 45.4],
    points: [
      [-9.45, 45.4],
      [-10.2, 44.4],
      [-11.2, 43.6],
    ],
    doorLabels: ["security-cabin"],
  },
];

function reachable(start: [number, number], targets: Array<[number, number]>): Set<string> {
  const step = 0.18;
  const all = [start, ...targets];
  const minX = Math.min(...all.map((p) => p[0])) - 3;
  const maxX = Math.max(...all.map((p) => p[0])) + 3;
  const minZ = Math.min(...all.map((p) => p[1])) - 3;
  const maxZ = Math.max(...all.map((p) => p[1])) + 3;
  const cols = Math.ceil((maxX - minX) / step) + 1;
  const rows = Math.ceil((maxZ - minZ) / step) + 1;
  const index = (x: number, z: number) => Math.round((x - minX) / step) + Math.round((z - minZ) / step) * cols;
  const startKey = index(start[0], start[1]);
  const seen = new Set<number>([startKey]);
  const queue: Array<[number, number]> = [start];
  const found = new Set<string>();
  if (blocked(start[0], start[1])) return found;
  while (queue.length > 0) {
    const [x, z] = queue.pop()!;
    targets.forEach((target, i) => {
      if (Math.hypot(target[0] - x, target[1] - z) <= 0.55) found.add(`${i}`);
    });
    for (const [dx, dz] of [
      [step, 0],
      [-step, 0],
      [0, step],
      [0, -step],
    ]) {
      const nx = x + dx;
      const nz = z + dz;
      if (nx < minX || nx > maxX || nz < minZ || nz > maxZ) continue;
      const key = index(nx, nz);
      if (seen.has(key) || blocked(nx, nz)) continue;
      seen.add(key);
      queue.push([nx, nz]);
    }
  }
  return found;
}

let passed = 0;
let failed = 0;
function check(ok: boolean, message: string): void {
  if (ok) {
    passed += 1;
    console.log(`  PASS  ${message}`);
  } else {
    failed += 1;
    console.log(`  FAIL  ${message}`);
  }
}

const doorsByLabel = new Map(world.doors.map((door) => [door.label, door]));
console.log(`World: ${colliders.length} colliders, ${world.doors.length} doors, ${world.interactables.length} interactables`);
check(!blocked(0, 42), "player spawn in front of the gate is clear");

for (const room of rooms) {
  console.log(`\n${room.name}`);
  const doors = room.doorLabels.map((label) => doorsByLabel.get(label));
  check(doors.every(Boolean), `${room.doorLabels.length} door(s) present`);

  doors.forEach((door) => door?.setOpenInstant(false));
  const closed = reachable(room.outside, [room.inside]);
  check(closed.size === 0, "closed door seals the interior");

  doors.forEach((door) => door?.setOpenInstant(true));
  check(!blocked(room.outside[0], room.outside[1]), "approach point is walkable");
  check(!blocked(room.inside[0], room.inside[1]), "interior entry point is walkable");
  const open = reachable(room.outside, room.points);
  room.points.forEach((point, index) => {
    check(open.has(`${index}`), `interior point ${index} (${point[0]}, ${point[1]}) reachable from outside`);
  });
}

// Whole-campus connectivity from the gate to every new interior/court.
doorsByLabel.forEach((door) => door.setOpenInstant(true));
const campusTargets: Array<[string, number, number]> = [
  ["library door", -24.5, -30],
  ["science labs", 36, -30.4],
  ["administration", 13, 38.3],
  ["dining hall", 2, -30.2],
  ["security cabin", -9.45, 47.1],
  ["basketball court", 34, -50],
  ["volleyball court", 48, -50.8],
];
const campusStart: [number, number] = [0, 42];
const step = 0.36;
const minX = -53;
const maxX = 53;
const minZ = -53;
const maxZ = 53;
const cols = Math.ceil((maxX - minX) / step) + 1;
const campusIndex = (x: number, z: number) =>
  Math.round((x - minX) / step) + Math.round((z - minZ) / step) * cols;
const campusSeen = new Set<number>([campusIndex(campusStart[0], campusStart[1])]);
const campusQueue: Array<[number, number]> = [campusStart];
const campusFound = new Set<string>();
while (campusQueue.length > 0) {
  const [x, z] = campusQueue.pop()!;
  campusTargets.forEach(([name, tx, tz]) => {
    if (Math.hypot(tx - x, tz - z) <= 1.0) campusFound.add(name);
  });
  for (const [dx, dz] of [[step, 0], [-step, 0], [0, step], [0, -step]]) {
    const nx = x + dx;
    const nz = z + dz;
    if (nx < minX || nx > maxX || nz < minZ || nz > maxZ) continue;
    const key = campusIndex(nx, nz);
    if (campusSeen.has(key) || blocked(nx, nz)) continue;
    campusSeen.add(key);
    campusQueue.push([nx, nz]);
  }
}
console.log(`\nCampus connectivity (${campusSeen.size} walkable cells from the gate)`);
for (const [name, tx, tz] of campusTargets) {
  check(campusFound.has(name), `${name} reachable on foot from the main gate (${tx}, ${tz})`);
}

console.log("\nDoors, sight lines and interaction targets");
const libraryDoor = world.doors.find((door) => door.label === "library");
if (libraryDoor?.collider) {
  libraryDoor.setOpenInstant(false);
  check(libraryDoor.collider.active, "library door collider is active when closed");
  libraryDoor.toggle();
  check(!libraryDoor.collider.active, "Door.toggle() deactivates the collider");
  libraryDoor.toggle();
  check(libraryDoor.collider.active, "Door.toggle() restores the collider");
}
check(!world.hasLineOfSight(-46, -30, -40, -30), "sight is blocked through an exterior wall");
libraryDoor?.setOpenInstant(true);
check(world.hasLineOfSight(-30, -30, -36, -30), "sight is clear across the reading room");
libraryDoor?.setOpenInstant(false);
check(!world.hasLineOfSight(-25.5, -30, -30, -30), "sight is blocked through a closed door");
libraryDoor?.setOpenInstant(true);
check(world.hasLineOfSight(-25.5, -30, -30, -30), "sight passes through an open doorway");

const doorTarget = interaction.update({ x: -25.4, y: 0, z: -30 } as any);
check(doorTarget?.id === "library-door", "InteractionSystem targets the library door from outside");
libraryDoor?.setOpenInstant(true);
const shelfTarget = interaction.update({ x: -42.2, y: 0, z: -31.6 } as any);
check(shelfTarget?.id === "library-shelves", "InteractionSystem targets the shelves inside the library");
check(
  interaction.target ? interaction.promptFor(interaction.target).includes("shelves") : false,
  "bookshelf prompt is generated",
);

console.log("\nInterior interaction targets");
const roomByTarget: Record<string, string> = {
  "gate-cabin": "security cabin",
  "library-reading-room": "library",
  "science-lab-main": "science labs",
  "admin-reception": "administration",
  "admin-staff-room": "administration",
  "admin-principal-office": "administration",
  "dining-hall": "dining hall",
  "dining-service": "dining hall",
};
const testedRooms = new Map(rooms.map((room) => [room.name, room]));
for (const target of world.interactables.filter((item) => item.roomId)) {
  const roomName = roomByTarget[target.roomId ?? ""];
  check(Boolean(roomName), `${target.id} has a registered room id (${target.roomId})`);
  const room = roomName ? testedRooms.get(roomName) : undefined;
  check(Boolean(room), `${target.id} maps to a tested interior`);
  if (!room) continue;
  const doors = room.doorLabels.map((label) => doorsByLabel.get(label));
  doors.forEach((door) => door?.setOpenInstant(true));
  const reachableCells: Array<[number, number]> = [];
  const step = 0.3;
  for (let x = target.position.x - 2.4; x <= target.position.x + 2.4; x += step) {
    for (let z = target.position.z - 2.4; z <= target.position.z + 2.4; z += step) {
      if (!blocked(x, z)) reachableCells.push([x, z]);
    }
  }
  const stand = reachableCells.find(
    (cell) =>
      Math.hypot(cell[0] - target.position.x, cell[1] - target.position.z) < target.radius - 0.15 &&
      world.hasLineOfSight(cell[0], cell[1], target.position.x, target.position.z),
  );
  check(Boolean(stand), `${target.id} has a clear stand point inside its interaction radius`);
}

console.log(`\nResult: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
