import { MessRunSimulation, type PickupKind } from "./game/messrun/MessRunSimulation";
import { computeMessRunScore } from "./game/messrun/messRunData";

let passed = 0;
let failed = 0;

function check(name: string, condition: boolean, detail = ""): void {
  if (condition) {
    passed += 1;
    console.log(`  PASS  ${name}`);
  } else {
    failed += 1;
    console.error(`  FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

function makeSim(mode: "classic" | "full-plate" | "delivery" = "classic", rng = 0.1) {
  return new MessRunSimulation({
    teacherId: "dinesh",
    mode,
    rng: () => rng,
  });
}

function firstObstacle(sim: MessRunSimulation) {
  for (let step = 0; step < 240 && sim.obstacles.length === 0; step += 1) {
    sim.update(1 / 60);
  }
  return sim.obstacles[0];
}

let pickupId = 10_000;
function collect(sim: MessRunSimulation, kind: PickupKind, lane = 1): void {
  sim.pickups.push({ id: pickupId++, lane, kind, z: 0, collected: false });
  sim.update(1 / 60);
}

console.log("MESS RUN mechanics audit");

{
  const sim = makeSim();
  check("starts with two full trays", sim.leftTray === 100 && sim.rightTray === 100);
  check("starts in the centre lane", sim.lane === 1);
  check("starts running", sim.phase === "running");
  check("starts with stable trays", sim.plateStability === 100);
}

{
  const sim = makeSim();
  sim.moveLeft();
  for (let index = 0; index < 60; index += 1) sim.update(1 / 60);
  check("swipe left selects left lane", sim.lane === 0);
  sim.moveRight();
  sim.moveRight();
  for (let index = 0; index < 60; index += 1) sim.update(1 / 60);
  check("lane changes clamp to three lanes", sim.lane === 2);
}

{
  const sim = makeSim();
  sim.jump();
  for (let index = 0; index < 8; index += 1) sim.update(1 / 60);
  check("jump leaves the ground", sim.playerY > 0.3 && !sim.grounded);
  for (let index = 0; index < 90; index += 1) sim.update(1 / 60);
  check("jump lands again", sim.playerY === 0 && sim.grounded);
  check("a normal jump keeps both trays level", sim.leftTray === 100 && sim.rightTray === 100);
}

{
  const sim = makeSim();
  sim.jump();
  for (let index = 0; index < 8; index += 1) sim.update(1 / 60);
  sim.slide();
  for (let index = 0; index < 60 && !sim.grounded; index += 1) sim.update(1 / 60);
  check("a forced dive landing spills food", sim.grounded && sim.foodLeft < 100);
}

{
  const sim = makeSim();
  sim.slide();
  for (let index = 0; index < 8; index += 1) sim.update(1 / 60);
  check("slide lowers the runner", sim.slideTimer > 0);
}

{
  const sim = makeSim();
  const obstacle = firstObstacle(sim);
  check("the first safe row spawns an obstacle", Boolean(obstacle));
  if (obstacle) {
    sim.lane = obstacle.lane;
    sim.playerX = [-2.05, 0, 2.05][obstacle.lane];
    obstacle.z = -1.25;
    const foodBefore = sim.foodLeft;
    sim.update(0.05);
    check("a same-lane collision spills food", sim.foodLeft < foodBefore);
    check("a collision brings the teacher closer", sim.teacherGap < 5.4);
    check("a collision shakes the trays", sim.plateStability < 100);
  }
}

{
  const sim = makeSim();
  const obstacle = firstObstacle(sim);
  if (obstacle && obstacle.kind === "low") {
    sim.lane = obstacle.lane;
    sim.playerX = [-2.05, 0, 2.05][obstacle.lane];
    obstacle.z = -3.2;
    sim.jump();
    for (let step = 0; step < 90 && !obstacle.resolved; step += 1) sim.update(1 / 60);
    check("jumping clears a low obstacle", obstacle.resolved && sim.foodLeft === 100);
    check("clearing a low obstacle counts a near miss", sim.nearMisses === 1);
  } else {
    check("deterministic low obstacle for jump test", false, obstacle?.kind ?? "none");
  }
}

{
  const sim = makeSim("classic", 0.6);
  const obstacle = firstObstacle(sim);
  if (obstacle && obstacle.kind === "high") {
    sim.lane = obstacle.lane;
    sim.playerX = [-2.05, 0, 2.05][obstacle.lane];
    obstacle.z = -2.1;
    sim.slide();
    for (let step = 0; step < 90 && !obstacle.resolved; step += 1) sim.update(1 / 60);
    check("sliding clears a high obstacle", obstacle.resolved && sim.foodLeft === 100);
  } else {
    check("deterministic high obstacle for slide test", false, obstacle?.kind ?? "none");
  }
}

{
  const sim = makeSim("delivery");
  sim.distance = 649.5;
  sim.update(0.05);
  sim.update(0.05);
  check("delivery mode ends at the destination", sim.phase === "delivered");
  check("delivery result keeps the mode", sim.result?.mode === "delivery");
}

{
  const sim = makeSim("full-plate");
  sim.leftTray = 10;
  sim.rightTray = 10;
  sim.update(0.02);
  check("full plate fails when the trays are nearly empty", sim.phase === "empty");
}

{
  const score = computeMessRunScore({
    distance: 250,
    foodLeft: 80,
    coins: 7,
    nearMisses: 3,
    mode: "classic",
  });
  check("score combines distance, food, tokens and near misses", score === 1680);
  const withFood = computeMessRunScore({
    distance: 250,
    foodLeft: 80,
    coins: 7,
    nearMisses: 3,
    mode: "classic",
    collectibles: { chicken: 1, fries: 1 },
  });
  check("collectible points extend the existing score", withFood === 1680 + 80 + 45);
}

{
  const sim = makeSim();
  collect(sim, "chicken");
  check("chicken awards a bonus score", sim.collectibles.chicken === 1 && sim.currentScore >= 80);
  collect(sim, "fries");
  check("fries are tracked separately", sim.collectibles.fries === 1);
}

{
  const sim = makeSim();
  sim.leftTray = 40;
  sim.rightTray = 40;
  collect(sim, "samosa");
  check("samosa restores both trays", sim.leftTray > 40 && sim.rightTray > 40);
}

{
  const sim = makeSim();
  sim.plateStability = 30;
  collect(sim, "coldDrink");
  check("cold drink restores plate stability", sim.plateStability > 30);
}

{
  const sim = makeSim();
  collect(sim, "burger");
  check("burger activates a temporary score multiplier", sim.scoreMultiplier === 1.5);
  check("burger multiplier has a visible timer", sim.snapshot().multiplierSeconds > 0);
}

{
  const sim = makeSim();
  collect(sim, "token");
  check("mess tokens still use the existing coin counter", sim.coins === 1);
}

{
  const sim = makeSim();
  collect(sim, "chicken", 0);
  check("a collectible in another lane is not collected", sim.collectibles.chicken === 0);
  sim.pickups.length = 0;
  sim.lane = 0;
  sim.playerX = -2.05;
  collect(sim, "chicken", 0);
  check("moving into the collectible lane collects it", sim.collectibles.chicken === 1);
}

{
  const sim = makeSim();
  for (let index = 0; index < 4; index += 1) collect(sim, "chicken");
  check("chicken feast waits for five pieces", sim.chickenFeasts === 0 && sim.snapshot().chickenFeastProgress === 4);
  collect(sim, "chicken");
  check("five chicken pieces activate the feast", sim.chickenFeasts === 1);
  check("the feast starts at 1.75×", sim.scoreMultiplier === 1.75);
  check("the feast resets combo progress", sim.snapshot().chickenFeastProgress === 0);
  for (let index = 0; index < 4; index += 1) collect(sim, "chicken");
  collect(sim, "chicken");
  check("a second set of five activates another feast without stacking multipliers", sim.chickenFeasts === 2 && sim.scoreMultiplier === 1.75);
}

{
  const sim = makeSim();
  let unsafe = false;
  let sawPickup = false;
  for (let step = 0; step < 1200; step += 1) {
    sim.update(1 / 60);
    if (sim.pickups.length > 0) sawPickup = true;
    for (const pickup of sim.pickups) {
      for (const obstacle of sim.obstacles) {
        if (
          pickup.lane === obstacle.lane &&
          !pickup.collected &&
          !obstacle.resolved &&
          Math.abs(pickup.z - obstacle.z) < 3
        ) {
          unsafe = true;
        }
      }
    }
    if (unsafe) break;
  }
  check("collectibles never spawn inside obstacle lanes", !unsafe);
  check("collectible spawning is populated during a run", sawPickup);
}

{
  const sim = makeSim();
  const result = sim.finish("caught");
  check("result freezes the selected teacher", result.teacherId === "dinesh");
  check("result score is computed from the run", result.score >= 0);
  check("a result cannot be overwritten", sim.finish("delivered").id === result.id);
}

console.log(`\nResult: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
