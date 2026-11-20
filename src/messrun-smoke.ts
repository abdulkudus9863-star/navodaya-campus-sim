import { MessRunSimulation } from "./game/messrun/MessRunSimulation";
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

console.log("MESS RUN mechanics audit");

{
  const sim = makeSim();
  check("starts with two full trays", sim.leftTray === 100 && sim.rightTray === 100);
  check("starts in the centre lane", sim.lane === 1);
  check("starts running", sim.phase === "running");
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
