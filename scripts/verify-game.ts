/* Temporary verification harness — run with `bun scripts/verify-game.ts`. */
import assert from "node:assert/strict";
import * as THREE from "three";

// ------------------------------------------------------------------ DOM stubs
const gradient = { addColorStop: () => undefined };

function makeCanvas() {
  const canvas: Record<string, unknown> = { width: 512, height: 512 };
  const ctx = new Proxy(canvas, {
    get(target, prop) {
      if (prop === "canvas") return canvas;
      if (prop in target) return target[prop as string];
      if (prop === "createLinearGradient" || prop === "createRadialGradient") return () => gradient;
      if (prop === "measureText") return () => ({ width: 10 });
      return () => undefined;
    },
    set(target, prop, value) {
      target[prop as string] = value;
      return true;
    },
  });
  canvas.getContext = () => ctx;
  return canvas;
}

const storageData = new Map<string, string>();
const storage = {
  getItem: (key: string) => storageData.get(key) ?? null,
  setItem: (key: string, value: string) => {
    storageData.set(key, String(value));
  },
  removeItem: (key: string) => {
    storageData.delete(key);
  },
};

(globalThis as unknown as { document: unknown }).document = {
  createElement: (tag: string) => {
    if (tag !== "canvas") throw new Error(`Unexpected element: ${tag}`);
    return makeCanvas();
  },
};
(globalThis as unknown as { window: unknown }).window = {
  localStorage: storage,
  devicePixelRatio: 1,
};
(globalThis as unknown as { requestAnimationFrame: unknown }).requestAnimationFrame = (cb: (t: number) => void) =>
  setTimeout(() => cb(Date.now()), 0) as unknown as number;

const { SaveSystem } = await import("../src/game/core/SaveSystem");
const { MissionSystem } = await import("../src/game/systems/MissionSystem");
const { NPCSystem } = await import("../src/game/systems/NPCSystem");
const { PlayerController } = await import("../src/game/systems/PlayerController");
const { CameraController } = await import("../src/game/systems/CameraController");
const { WorldEnvironment } = await import("../src/game/world/WorldEnvironment");
const { DEFAULT_CHARACTER, DEFAULT_SETTINGS, MISSION_STEPS } = await import("../src/game/core/types");

const results: string[] = [];
function pass(name: string, detail = "") {
  results.push(`PASS  ${name}${detail ? ` — ${detail}` : ""}`);
}

// ------------------------------------------------------------------- saves
{
  const saves = new SaveSystem();
  assert.equal(saves.load().ok, false);
  pass("save: missing header handled");

  const valid = {
    version: 1 as const,
    savedAt: Date.now(),
    playtime: 125,
    player: { position: { x: 3, y: 0, z: 12 }, rotationY: 1.2 },
    settings: { ...DEFAULT_SETTINGS, quality: "medium" as const, sensitivity: 1.4 },
    character: { ...DEFAULT_CHARACTER, uniform: "olive" as const },
    mission: { started: true, step: 1, completed: ["meet-meera"] },
  };
  assert.equal(saves.save(valid), true);
  const loaded = saves.load();
  assert.equal(loaded.ok, true);
  if (loaded.ok) {
    assert.deepEqual(loaded.data.player.position, { x: 3, y: 0, z: 12 });
    assert.equal(loaded.data.mission.completed.length, 1);
  }
  pass("save: round-trip preserves position, mission, settings");

  storageData.set("navodaya.campus.save.v1", "{broken json");
  const corrupt = saves.load();
  assert.equal(corrupt.ok, false);
  if (!corrupt.ok) assert.equal(corrupt.reason, "corrupt");
  assert.equal(storageData.has("navodaya.campus.save.v1"), false);
  pass("save: corrupt JSON discarded safely");

  storageData.set(
    "navodaya.campus.save.v1",
    JSON.stringify({ ...valid, player: { position: { x: 9000, y: 0, z: 0 }, rotationY: 0 } }),
  );
  const outOfBounds = saves.load();
  assert.equal(outOfBounds.ok, false);
  pass("save: out-of-world position rejected");

  storageData.set(
    "navodaya.campus.save.v1",
    JSON.stringify({
      ...valid,
      settings: { quality: "ultra", sensitivity: 99, volume: -3, music: "yes" },
      character: { uniform: "orange", skin: 9 },
      mission: { started: true, step: 999, completed: ["meet-meera", "nonsense"] },
    }),
  );
  const sanitized = saves.load();
  assert.equal(sanitized.ok, true);
  if (sanitized.ok) {
    assert.equal(sanitized.data.settings.quality, "high");
    assert.equal(sanitized.data.settings.sensitivity, 2.5);
    assert.equal(sanitized.data.settings.volume, 0);
    assert.equal(sanitized.data.character.uniform, "navy");
    assert.equal(sanitized.data.mission.completed.length, 1);
    assert.equal(sanitized.data.mission.step, 4);
  }
  pass("save: hostile settings/character/mission values clamped");
}

// ----------------------------------------------------------------- mission
{
  const mission = new MissionSystem();
  mission.startNew();
  assert.equal(mission.currentStepId, "meet-meera");
  assert.equal(mission.completeStep("classroom").changed, false);
  pass("mission: out-of-order objective ignored");

  const events: string[] = [];
  mission.onStepComplete = (id) => events.push(id);
  MISSION_STEPS.forEach((step) => {
    const result = mission.completeStep(step.id);
    assert.equal(result.changed, true);
  });
  assert.deepEqual(events, ["meet-meera", "notice-board", "classroom", "hostel"]);
  assert.equal(mission.done, true);
  assert.equal(mission.view().objective.includes("Day one complete"), true);
  pass("mission: four objectives complete in order");

  mission.restore({ started: true, step: 2, completed: ["meet-meera", "notice-board"] });
  assert.equal(mission.currentStepId, "classroom");
  pass("mission: restore resumes at the right objective");
}

// --------------------------------------------------------------------- NPC
{
  const npc = new NPCSystem();
  const first = npc.start({ step: 0, done: false });
  assert.equal(first.canAdvance, true);
  assert.match(first.text, /Meera/);
  assert.equal(npc.advance(), false);
  const withChoices = npc.currentView();
  assert.equal(withChoices.choices.length, 2);
  assert.equal(npc.advance(), false, "cannot advance past a choice node");
  assert.equal(npc.choose(1), true);
  assert.match(npc.currentView().text, /notice board/);
  assert.equal(npc.advance(), true);
  assert.equal(npc.isActive, false);
  pass("npc: branching intro runs to completion");

  const reminder = new NPCSystem().start({ step: 2, done: false });
  assert.match(reminder.text, /Room 12/);
  const after = new NPCSystem().start({ step: 4, done: true });
  assert.match(after.text, /belong/);
  pass("npc: reminder and post-mission dialogue adapt to progress");
}

// ---------------------------------------------------------------- movement
{
  const player = new PlayerController(DEFAULT_CHARACTER);
  const fakeInput = (move: { x: number; y: number }, jump = false) => {
    let jumpQueued = jump;
    return {
      getMove: () => move,
      running: false,
      consumeJump: () => {
        const value = jumpQueued;
        jumpQueued = false;
        return value;
      },
      consumeInteract: () => false,
      consumeLook: () => ({ x: 0, y: 0 }),
    } as unknown as InstanceType<typeof import("../src/game/core/InputController").InputController>;
  };

  player.placeAt(new THREE.Vector3(0, 0, 0), Math.PI);
  const walk = fakeInput({ x: 0, y: 1 });
  for (let i = 0; i < 60; i += 1) player.update(1 / 60, walk, 0, [], 60);
  assert.ok(player.position.z < -2, `expected forward motion, got z=${player.position.z}`);
  pass("player: moves forward relative to camera", `z=${player.position.z.toFixed(2)} after 1s`);

  player.placeAt(new THREE.Vector3(0, 0, 0), Math.PI);
  const wall = { minX: -5, maxX: 5, minZ: -3, maxZ: -2, active: true, label: "wall" };
  for (let i = 0; i < 120; i += 1) player.update(1 / 60, fakeInput({ x: 0, y: 1 }), 0, [wall], 60);
  assert.ok(player.position.z > -1.7, `walked through wall: z=${player.position.z}`);
  pass("player: solid wall blocks movement", `stopped at z=${player.position.z.toFixed(2)}`);

  player.placeAt(new THREE.Vector3(0, 0, 0), Math.PI);
  const diagonal = fakeInput({ x: 1, y: 1 });
  for (let i = 0; i < 90; i += 1) player.update(1 / 60, diagonal, 0, [wall], 60);
  assert.ok(player.position.x > 0.5, "wall should allow sliding on the other axis");
  pass("player: slides along a wall instead of sticking");

  player.placeAt(new THREE.Vector3(0, 0, 0), Math.PI);
  let jumpInput = fakeInput({ x: 0, y: 0 }, true);
  player.update(1 / 60, jumpInput, 0, [], 60);
  assert.ok(player.position.y > 0, "jump should leave the ground");
  jumpInput = fakeInput({ x: 0, y: 0 });
  for (let i = 0; i < 120; i += 1) player.update(1 / 60, jumpInput, 0, [], 60);
  assert.equal(player.grounded, true);
  assert.ok(Math.abs(player.position.y) < 0.001);
  pass("player: jump arc returns to the ground");
}

// -------------------------------------------------------------------- world
const consoleErrors: string[] = [];
const originalError = console.error;
console.error = (...args: unknown[]) => {
  consoleErrors.push(args.map(String).join(" "));
};
const world = new WorldEnvironment();
const buildStart = performance.now();
await world.build(() => undefined);
const buildMs = Math.round(performance.now() - buildStart);
const mergedGroup = world.group.getObjectByName("merged-campus");
const mergedMeshes = mergedGroup ? mergedGroup.children.length : 0;
console.error = originalError;

consoleErrors.forEach((message) => console.log(`[build console.error] ${message}`));
assert.equal(world.interactables.length, 4);
assert.equal(world.doors.length, 2);
assert.ok(world.colliders.length > 25, `only ${world.colliders.length} colliders`);
assert.ok(mergedMeshes > 10, `only ${mergedMeshes} merged meshes`);
let meshes = 0;
let triangles = 0;
world.group.traverse((object) => {
  if (object instanceof THREE.Mesh) {
    meshes += 1;
    const geometry = object.geometry;
    const count = geometry.index ? geometry.index.count : geometry.attributes.position.count;
    triangles += count / 3;
  }
});
pass(
  "world: campus builds",
  `${world.colliders.length} colliders, ${mergedMeshes} merged meshes, ${world.doors.length} doors, ${world.interactables.length} interactables`,
);
console.log(
  `scene stats: ${buildMs}ms build, ${meshes} meshes, ${Math.round(triangles)} triangles, ${world.group.children.length} root objects`,
);

const radius = 0.38;
function blocked(x: number, z: number): boolean {
  for (const collider of world.colliders) {
    if (!collider.active) continue;
    const cx = Math.max(collider.minX, Math.min(x, collider.maxX));
    const cz = Math.max(collider.minZ, Math.min(z, collider.maxZ));
    if ((x - cx) ** 2 + (z - cz) ** 2 < radius * radius) return true;
  }
  return false;
}

assert.equal(blocked(world.spawn.x, world.spawn.z), false, "spawn must be clear");
for (const interactable of world.interactables) {
  assert.equal(
    blocked(interactable.position.x, interactable.position.z),
    false,
    `interactable ${interactable.id} is inside a collider`,
  );
}
pass("world: spawn and every interaction point are standable");

function reachable(
  start: THREE.Vector3,
  goal: THREE.Vector3,
  goalTolerance: number,
): { found: boolean; visited: number } {
  const step = 0.4;
  const limit = 54;
  const size = Math.floor((limit * 2) / step) + 1;
  const toIndex = (x: number, z: number) =>
    Math.round((x + limit) / step) * size + Math.round((z + limit) / step);
  const queue: number[] = [];
  const seen = new Set<number>();
  const startIndex = toIndex(start.x, start.z);
  queue.push(startIndex);
  seen.add(startIndex);
  let head = 0;
  let visited = 0;
  const goalX = goal.x;
  const goalZ = goal.z;

  while (head < queue.length) {
    const current = queue[head];
    head += 1;
    visited += 1;
    const gx = Math.floor(current / size);
    const gz = current % size;
    const x = gx * step - limit;
    const z = gz * step - limit;
    if (Math.hypot(x - goalX, z - goalZ) <= goalTolerance) return { found: true, visited };
    for (const [dx, dz] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const nx = x + dx * step;
      const nz = z + dz * step;
      if (Math.abs(nx) > limit || Math.abs(nz) > limit) continue;
      const index = toIndex(nx, nz);
      if (seen.has(index)) continue;
      seen.add(index);
      if (blocked(nx, nz)) continue;
      queue.push(index);
    }
  }
  return { found: false, visited };
}

const spawn = world.spawn;
const targets = [
  { name: "Meera", position: world.npcPosition, tolerance: 2.8 },
  { name: "notice board", position: world.interactables.find((item) => item.id === "notice-board")!.position, tolerance: 2.2 },
  { name: "classroom door", position: world.interactables.find((item) => item.id === "classroom-door")!.position, tolerance: 2 },
  { name: "hostel door", position: world.interactables.find((item) => item.id === "hostel-door")!.position, tolerance: 2 },
];
for (const target of targets) {
  const result = reachable(spawn, target.position, target.tolerance);
  assert.equal(result.found, true, `${target.name} not reachable from spawn`);
  console.log(`route: ${target.name} reachable (${result.visited} cells explored)`);
}
pass("world: all four objectives are walkable from the gate");

const interiorClassroom = new THREE.Vector3(-23, 0, 0);
const interiorHostel = new THREE.Vector3(23, 0, 9);
assert.equal(reachable(spawn, interiorClassroom, 1.1).found, false, "classroom open while doors closed");
assert.equal(reachable(spawn, interiorHostel, 1.1).found, false, "hostel open while doors closed");
pass("world: closed doors actually seal both interiors");

world.doors.forEach((door) => door.setOpenInstant(true));
assert.equal(reachable(spawn, interiorClassroom, 1.1).found, true);
assert.equal(reachable(spawn, interiorHostel, 1.1).found, true);
pass("world: opening the doors makes both rooms enterable");

// ----------------------------------------------------------------- camera
{
  const camera = new CameraController(1.6);
  const player = new THREE.Vector3(0, 0, 0);
  camera.resetToPlayer(player, Math.PI);
  assert.ok(camera.camera.position.z > 4, "camera should start behind the player");
  const wallBox = new THREE.Box3(new THREE.Vector3(-3, 0.4, 1.8), new THREE.Vector3(3, 3.2, 2.4));
  for (let i = 0; i < 30; i += 1) {
    camera.updateFollow(1 / 60, player, null, [wallBox], 1, false, i === 0);
  }
  assert.ok(camera.camera.position.z < 2.4, `camera clipped through wall at z=${camera.camera.position.z}`);
  pass("camera: pulls in front of occluding geometry", `z=${camera.camera.position.z.toFixed(2)}`);
  const groundCheck = camera.camera.position.y;
  assert.ok(groundCheck > 0.3, "camera should stay above the ground");
  pass("camera: never drops below the ground plane");
}

console.log("\n" + results.join("\n"));
console.log(`\n${results.length} checks passed.`);
