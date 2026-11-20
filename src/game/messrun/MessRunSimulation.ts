import {
  computeMessRunScore,
  messRunMode,
  messRunTeacher,
  type MessRunMode,
  type MessRunModeId,
  type MessRunResult,
  type MessRunTeacher,
  type MessRunTeacherId,
} from "./messRunData";

export type RunnerPhase = "running" | "caught" | "empty" | "delivered";
export type ObstacleKind = "low" | "high" | "full";
export type PickupKind = "token" | "shield" | "food";

export interface SimObstacle {
  id: number;
  lane: number;
  kind: ObstacleKind;
  variant: number;
  z: number;
  resolved: boolean;
}

export interface SimPickup {
  id: number;
  lane: number;
  kind: PickupKind;
  z: number;
  collected: boolean;
}

export type SimEvent =
  | { type: "hit"; amount: number; tray: "left" | "right" }
  | { type: "shield"; amount: number }
  | { type: "near-miss" }
  | { type: "token" }
  | { type: "food-bonus"; amount: number }
  | { type: "jump" }
  | { type: "slide" }
  | { type: "land"; impact: number }
  | { type: "sharp-turn" }
  | { type: "caught" }
  | { type: "empty" }
  | { type: "delivered" };

export interface MessRunSnapshot {
  phase: RunnerPhase;
  score: number;
  distance: number;
  elapsedMs: number;
  leftTray: number;
  rightTray: number;
  foodLeft: number;
  foodMultiplier: number;
  coins: number;
  nearMisses: number;
  obstaclesAvoided: number;
  speed: number;
  teacherGap: number;
  shieldSeconds: number;
  lane: number;
  targetDistance: number | null;
  mode: MessRunModeId;
  teacherId: MessRunTeacherId;
  teacherName: string;
  paused: boolean;
}

export interface MessRunSimulationOptions {
  teacherId: MessRunTeacherId;
  mode: MessRunModeId;
  rng?: () => number;
}

const LANE_POSITIONS = [-2.05, 0, 2.05] as const;
const START_GAP = 5.4;
const CATCH_GAP = 1.28;
const START_SPEED = 8.4;
const MAX_SPEED = 20;
const GRAVITY = 22;
const JUMP_VELOCITY = 7.25;
const SLIDE_SECONDS = 0.72;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function rounded(value: number): number {
  return Math.round(value);
}

/**
 * Engine-independent runner logic. Rendering, sound and React never decide
 * collisions or rewards, which keeps the mechanics testable without WebGL.
 */
export class MessRunSimulation {
  readonly teacher: MessRunTeacher;
  readonly mode: MessRunMode;
  readonly obstacles: SimObstacle[] = [];
  readonly pickups: SimPickup[] = [];

  phase: RunnerPhase = "running";
  paused = false;
  lane = 1;
  playerX = 0;
  playerY = 0;
  velocityY = 0;
  grounded = true;
  slideTimer = 0;
  distance = 0;
  elapsedSeconds = 0;
  speed = START_SPEED;
  leftTray = 100;
  rightTray = 100;
  coins = 0;
  nearMisses = 0;
  obstaclesAvoided = 0;
  teacherGap = START_GAP;
  shieldSeconds = 0;
  result: MessRunResult | null = null;

  private readonly rng: () => number;
  private nextObstacleId = 1;
  private nextPickupId = 1;
  private nextRowDistance = 11;
  private nextPickupDistance = 20;
  private nextPowerupDistance = 58;
  private hitCooldown = 0;
  private recoveryDelay = 0;
  private lastLaneChangeAt = -10;
  private lastLaneDirection = 0;
  private events: SimEvent[] = [];

  constructor(options: MessRunSimulationOptions) {
    this.teacher = messRunTeacher(options.teacherId);
    this.mode = messRunMode(options.mode);
    this.rng = options.rng ?? Math.random;
  }

  get foodLeft(): number {
    return rounded((this.leftTray + this.rightTray) / 2);
  }

  get foodMultiplier(): number {
    return 1 + this.foodLeft / 200;
  }

  get currentScore(): number {
    return computeMessRunScore({
      distance: this.distance,
      foodLeft: this.foodLeft,
      coins: this.coins,
      nearMisses: this.nearMisses,
      mode: this.mode.id,
    });
  }

  get isRunning(): boolean {
    return this.phase === "running" && !this.paused;
  }

  moveLeft(): void {
    this.shiftLane(-1);
  }

  moveRight(): void {
    this.shiftLane(1);
  }

  jump(): void {
    if (!this.isRunning || !this.grounded) return;
    this.slideTimer = 0;
    this.velocityY = JUMP_VELOCITY;
    this.grounded = false;
    this.events.push({ type: "jump" });
  }

  slide(): void {
    if (!this.isRunning) return;
    if (!this.grounded) {
      this.velocityY = Math.min(this.velocityY, -10.5);
      return;
    }
    this.slideTimer = SLIDE_SECONDS;
    this.events.push({ type: "slide" });
  }

  update(dt: number): SimEvent[] {
    this.events = [];
    if (this.phase !== "running" || this.paused) return this.events;

    const step = clamp(dt, 0, 0.05);
    this.elapsedSeconds += step;
    this.speed = Math.min(MAX_SPEED, START_SPEED + this.elapsedSeconds * 0.085);
    this.distance += this.speed * step;
    this.hitCooldown = Math.max(0, this.hitCooldown - step);
    this.recoveryDelay = Math.max(0, this.recoveryDelay - step);
    this.shieldSeconds = Math.max(0, this.shieldSeconds - step);
    this.slideTimer = Math.max(0, this.slideTimer - step);
    this.playerX += (LANE_POSITIONS[this.lane] - this.playerX) * Math.min(1, step * 13);

    if (this.grounded) {
      this.playerY = 0;
    } else {
      this.velocityY -= GRAVITY * step;
      this.playerY += this.velocityY * step;
      if (this.playerY <= 0) {
        const impact = Math.min(1, Math.abs(this.velocityY) / 9);
        this.playerY = 0;
        this.velocityY = 0;
        this.grounded = true;
        this.events.push({ type: "land", impact });
        if (impact > 0.66) {
          const loss = 2.2 + impact * 2.4;
          this.leftTray = Math.max(0, this.leftTray - loss * 0.7);
          this.rightTray = Math.max(0, this.rightTray - loss);
        }
      }
    }

    this.teacherGap = Math.max(
      CATCH_GAP,
      this.teacherGap -
        this.mode.teacherPressure * this.teacher.aggression * 0.004 * step +
        (this.recoveryDelay <= 0 ? 0.022 * step : 0),
    );

    for (const obstacle of this.obstacles) {
      obstacle.z += this.speed * step;
      if (!obstacle.resolved && obstacle.z >= -0.85) {
        this.resolveObstacle(obstacle);
      }
    }
    for (const pickup of this.pickups) {
      pickup.z += this.speed * step;
      if (!pickup.collected && Math.abs(pickup.z) < 1.05) {
        this.tryCollect(pickup);
      }
    }

    this.obstacles.splice(0, this.obstacles.length, ...this.obstacles.filter((item) => item.z < 11));
    this.pickups.splice(0, this.pickups.length, ...this.pickups.filter((item) => item.z < 11));

    if (this.distance >= this.nextRowDistance) {
      this.spawnRow();
      this.nextRowDistance =
        this.distance +
        Math.max(10.5, 17 - Math.min(5.5, this.elapsedSeconds * 0.026)) +
        this.rng() * 3;
    }
    if (this.distance >= this.nextPickupDistance) {
      this.spawnTokenLine();
      this.nextPickupDistance = this.distance + 17 + this.rng() * 6;
    }
    if (this.distance >= this.nextPowerupDistance) {
      this.spawnPowerup();
      this.nextPowerupDistance = this.distance + 48 + this.rng() * 13;
    }

    if (this.teacherGap <= CATCH_GAP) {
      this.finish("caught");
    } else if (this.mode.foodFailureAt > 0 && this.foodLeft <= this.mode.foodFailureAt) {
      this.finish("empty");
    } else if (this.mode.targetDistance !== null && this.distance >= this.mode.targetDistance) {
      this.finish(this.foodLeft >= this.mode.minimumFood ? "delivered" : "empty");
    }

    return this.events;
  }

  snapshot(paused = false): MessRunSnapshot {
    return {
      phase: this.phase,
      score: this.result?.score ?? this.currentScore,
      distance: this.distance,
      elapsedMs: Math.round(this.elapsedSeconds * 1000),
      leftTray: Math.round(this.leftTray),
      rightTray: Math.round(this.rightTray),
      foodLeft: this.foodLeft,
      foodMultiplier: Number(this.foodMultiplier.toFixed(2)),
      coins: this.coins,
      nearMisses: this.nearMisses,
      obstaclesAvoided: this.obstaclesAvoided,
      speed: this.speed,
      teacherGap: this.teacherGap,
      shieldSeconds: Math.ceil(this.shieldSeconds),
      lane: this.lane,
      targetDistance: this.mode.targetDistance,
      mode: this.mode.id,
      teacherId: this.teacher.id,
      teacherName: this.teacher.name,
      paused,
    };
  }

  finish(outcome: MessRunResult["outcome"] = "caught"): MessRunResult {
    if (this.result) return this.result;
    this.phase = outcome;
    const foodLeft = clamp(this.foodLeft, 0, 100);
    this.result = {
      id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`,
      teacherId: this.teacher.id,
      teacherName: this.teacher.name,
      mode: this.mode.id,
      outcome,
      score: computeMessRunScore({
        distance: this.distance,
        foodLeft,
        coins: this.coins,
        nearMisses: this.nearMisses,
        mode: this.mode.id,
      }),
      distance: Math.round(this.distance),
      durationMs: Math.round(this.elapsedSeconds * 1000),
      foodLeft,
      leftTray: clamp(Math.round(this.leftTray), 0, 100),
      rightTray: clamp(Math.round(this.rightTray), 0, 100),
      coins: this.coins,
      nearMisses: this.nearMisses,
      obstaclesAvoided: this.obstaclesAvoided,
    };
    this.events.push({ type: outcome });
    return this.result;
  }

  private shiftLane(direction: number): void {
    if (!this.isRunning) return;
    const next = clamp(this.lane + direction, 0, LANE_POSITIONS.length - 1);
    if (next === this.lane) return;
    const now = this.elapsedSeconds;
    const quickReverse =
      now - this.lastLaneChangeAt < 0.3 && this.lastLaneDirection === -direction;
    this.lane = next;
    this.lastLaneChangeAt = now;
    this.lastLaneDirection = direction;
    if (quickReverse) {
      this.leftTray = Math.max(0, this.leftTray - 0.6);
      this.rightTray = Math.max(0, this.rightTray - 0.9);
      this.events.push({ type: "sharp-turn" });
    }
  }

  private resolveObstacle(obstacle: SimObstacle): void {
    obstacle.resolved = true;
    const sameLane = Math.abs(this.playerX - LANE_POSITIONS[obstacle.lane]) < 0.86;
    if (!sameLane) {
      this.obstaclesAvoided += 1;
      return;
    }

    const clearedLow = obstacle.kind === "low" && this.playerY > 0.62;
    const clearedHigh = obstacle.kind === "high" && this.slideTimer > 0 && this.playerY < 0.46;
    if (clearedLow || clearedHigh) {
      this.obstaclesAvoided += 1;
      this.nearMisses += 1;
      this.teacherGap = Math.min(7.2, this.teacherGap + 0.09);
      this.events.push({ type: "near-miss" });
      return;
    }

    this.obstaclesAvoided += 0;
    if (this.hitCooldown > 0) return;
    this.hitCooldown = 0.68;
    this.recoveryDelay = 2.2;
    this.slideTimer = 0;

    if (this.shieldSeconds > 0) {
      this.shieldSeconds = 0;
      this.teacherGap = Math.min(7.4, this.teacherGap + 1.45);
      this.events.push({ type: "shield", amount: 0 });
      return;
    }

    const primaryRight = this.rng() > 0.48;
    const baseLoss = (12.5 + this.rng() * 4.5) * this.mode.foodLossMultiplier;
    const leftLoss = baseLoss * (primaryRight ? 0.55 : 1.15);
    const rightLoss = baseLoss * (primaryRight ? 1.15 : 0.55);
    this.leftTray = Math.max(0, this.leftTray - leftLoss);
    this.rightTray = Math.max(0, this.rightTray - rightLoss);
    this.teacherGap = Math.max(CATCH_GAP, this.teacherGap - 1.08 * this.teacher.aggression);
    this.events.push({
      type: "hit",
      amount: Math.round(baseLoss),
      tray: primaryRight ? "right" : "left",
    });
  }

  private tryCollect(pickup: SimPickup): void {
    if (Math.abs(this.playerX - LANE_POSITIONS[pickup.lane]) > 0.86) return;
    pickup.collected = true;
    if (pickup.kind === "token") {
      this.coins += 1;
      this.teacherGap = Math.min(7.2, this.teacherGap + 0.018);
      this.events.push({ type: "token" });
      return;
    }
    if (pickup.kind === "shield") {
      this.shieldSeconds = 9;
      this.events.push({ type: "shield", amount: 9 });
      return;
    }
    const bonus = 8;
    this.leftTray = Math.min(100, this.leftTray + bonus);
    this.rightTray = Math.min(100, this.rightTray + bonus);
    this.events.push({ type: "food-bonus", amount: bonus });
  }

  private spawnRow(): void {
    const laneCount = 3;
    const freeLane = Math.floor(this.rng() * laneCount);
    const twoLane = this.elapsedSeconds > 16 && this.rng() < 0.22;
    const blocked = new Set<number>();
    if (twoLane) {
      for (let lane = 0; lane < laneCount; lane += 1) {
        if (lane !== freeLane) blocked.add(lane);
      }
    } else {
      blocked.add(Math.floor(this.rng() * laneCount));
    }
    for (const lane of blocked) {
      const roll = this.rng();
      const kind: ObstacleKind = roll < 0.4 ? "low" : roll < 0.72 ? "high" : "full";
      this.obstacles.push({
        id: this.nextObstacleId++,
        lane,
        kind,
        variant: Math.floor(this.rng() * 3),
        z: -78,
        resolved: false,
      });
    }
  }

  private spawnTokenLine(): void {
    const lane = Math.floor(this.rng() * 3);
    if (!this.laneFreeNear(lane, -72, 4)) return;
    for (let index = 0; index < 3; index += 1) {
      this.pickups.push({
        id: this.nextPickupId++,
        lane,
        kind: "token",
        z: -68 - index * 3.4,
        collected: false,
      });
    }
  }

  private spawnPowerup(): void {
    const lane = Math.floor(this.rng() * 3);
    if (!this.laneFreeNear(lane, -72, 7)) return;
    this.pickups.push({
      id: this.nextPickupId++,
      lane,
      kind: this.rng() < 0.58 ? "shield" : "food",
      z: -71,
      collected: false,
    });
  }

  private laneFreeNear(lane: number, z: number, radius: number): boolean {
    return !this.obstacles.some(
      (obstacle) =>
        obstacle.lane === lane && Math.abs(obstacle.z - z) < radius && !obstacle.resolved,
    );
  }
}
