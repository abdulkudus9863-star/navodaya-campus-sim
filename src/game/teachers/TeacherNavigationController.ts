import * as THREE from "three";
import type { TeacherRoutePoint } from "../data/teachers";
import type { BlockCollider } from "../world/WorldEnvironment";
import { collidesAt } from "../systems/PlayerController";
import { shortestAngle } from "../world/geometry";

interface RouteState {
  points: TeacherRoutePoint[];
  index: number;
  idle: number;
  blockedFor: number;
  loops: number;
}

/**
 * Lightweight waypoint navigator with the same collider contract as the
 * player. It is not a full NavMesh, but it gives teachers safe authored routes,
 * wall sliding, obstacle separation and deterministic recovery if a waypoint
 * becomes obstructed.
 */
export class TeacherNavigationController {
  readonly position = new THREE.Vector3();
  rotation = 0;
  moving = false;
  currentSpeed = 0;
  private state: RouteState = { points: [], index: 0, idle: 0, blockedFor: 0, loops: 0 };
  private lookAround = 0;
  private lookPhase = 0;

  constructor(position: THREE.Vector3, rotation: number) {
    this.position.copy(position);
    this.rotation = rotation;
    this.lookPhase = position.x * 0.17 + position.z * 0.11;
  }

  setRoute(points: TeacherRoutePoint[], startAtNearest = true): void {
    if (points.length === 0) return;
    this.state = {
      points: points.map((point) => ({ ...point })),
      index: 0,
      idle: 0,
      blockedFor: 0,
      loops: 0,
    };
    if (startAtNearest) {
      let best = 0;
      let bestDistance = Number.POSITIVE_INFINITY;
      for (let index = 0; index < points.length; index += 1) {
        const point = points[index];
        const distance = Math.hypot(point.x - this.position.x, point.z - this.position.z);
        if (distance < bestDistance) {
          bestDistance = distance;
          best = index;
        }
      }
      this.state.index = best;
      if (bestDistance < 1.2) this.advance();
    } else {
      this.position.set(points[0].x, 0, points[0].z);
      this.state.index = 1 % points.length;
    }
  }

  get target(): TeacherRoutePoint | null {
    return this.state.points[this.state.index] ?? null;
  }

  get routePoints(): readonly TeacherRoutePoint[] {
    return this.state.points;
  }

  get completedLoops(): number {
    return this.state.loops;
  }

  get idleTime(): number {
    return this.state.idle;
  }

  /** Faces a target without moving; used when a teacher notices the player. */
  faceTowards(x: number, z: number, dt: number, rate = 7): void {
    const target = Math.atan2(x - this.position.x, z - this.position.z);
    this.rotation += shortestAngle(this.rotation, target) * Math.min(1, dt * rate);
    this.moving = false;
    this.currentSpeed = 0;
    this.lookAround = Math.max(0, this.lookAround - dt);
  }

  update(
    dt: number,
    speed: number,
    colliders: BlockCollider[],
    options: {
      bounds: number;
      avoid?: THREE.Vector3[];
      approach?: { x: number; z: number; stopAt: number };
      face?: { x: number; z: number };
    },
  ): void {
    if (options.face) {
      this.faceTowards(options.face.x, options.face.z, dt, 6);
      return;
    }
    if (this.state.idle > 0) {
      this.state.idle = Math.max(0, this.state.idle - dt);
      this.moving = false;
      this.currentSpeed = 0;
      this.lookAround = Math.max(0, this.lookAround - dt);
      if (this.state.idle <= 0) this.advance();
      return;
    }

    if (this.state.points.length === 0) {
      this.moving = false;
      return;
    }

    const target = this.state.points[this.state.index];
    if (!target) {
      this.state.index = 0;
      return;
    }

    let targetX = target.x;
    let targetZ = target.z;
    if (options.approach) {
      targetX = options.approach.x;
      targetZ = options.approach.z;
    }

    const dx = targetX - this.position.x;
    const dz = targetZ - this.position.z;
    const distance = Math.hypot(dx, dz);
    if (options.approach && distance <= options.approach.stopAt) {
      this.faceTowards(targetX, targetZ, dt, 6);
      return;
    }
    if (!options.approach && distance < 0.4) {
      this.state.idle = target.pause ?? 1.8;
      this.lookAround = 1.2;
      this.lookPhase = this.position.x * 0.3 + this.position.z * 0.2;
      this.moving = false;
      this.currentSpeed = 0;
      return;
    }

    let dirX = distance > 0.0001 ? dx / distance : 0;
    let dirZ = distance > 0.0001 ? dz / distance : 0;

    for (const other of options.avoid ?? []) {
      const ox = this.position.x - other.x;
      const oz = this.position.z - other.z;
      const od = Math.hypot(ox, oz);
      if (od > 0.001 && od < 1.15) {
        const push = (1.15 - od) / 1.15;
        dirX += (ox / od) * push * 0.9;
        dirZ += (oz / od) * push * 0.9;
      }
    }
    const length = Math.hypot(dirX, dirZ) || 1;
    dirX /= length;
    dirZ /= length;

    const step = Math.max(0.8, speed) * dt;
    const nextX = THREE.MathUtils.clamp(this.position.x + dirX * step, -options.bounds, options.bounds);
    const nextZ = THREE.MathUtils.clamp(this.position.z + dirZ * step, -options.bounds, options.bounds);
    let moved = false;

    if (!collidesAt(nextX, this.position.z, colliders, 0)) {
      this.position.x = nextX;
      moved = true;
    }
    if (!collidesAt(this.position.x, nextZ, colliders, 0)) {
      this.position.z = nextZ;
      moved = true;
    }

    if (!moved) {
      this.state.blockedFor += dt;
      // Try a safe sidestep around a chair, tree or character.
      const side = this.state.index % 2 === 0 ? 1 : -1;
      const sx = this.position.x + Math.cos(this.rotation) * step * side;
      const sz = this.position.z - Math.sin(this.rotation) * step * side;
      if (!collidesAt(sx, sz, colliders, 0)) {
        this.position.x = THREE.MathUtils.clamp(sx, -options.bounds, options.bounds);
        this.position.z = THREE.MathUtils.clamp(sz, -options.bounds, options.bounds);
        moved = true;
      }
      if (this.state.blockedFor > 2.2) {
        this.state.blockedFor = 0;
        this.advance();
      }
    } else {
      this.state.blockedFor = Math.max(0, this.state.blockedFor - dt * 0.5);
    }

    if (moved || distance > 0.001) {
      const targetRotation = Math.atan2(dirX, dirZ);
      this.rotation += shortestAngle(this.rotation, targetRotation) * Math.min(1, dt * 6.5);
    }
    this.moving = moved;
    this.currentSpeed = moved ? speed : 0;
    if (this.lookAround > 0) {
      this.lookAround = Math.max(0, this.lookAround - dt);
      this.lookPhase += dt * 0.8;
    }
  }

  headLook(): number {
    return this.lookAround > 0 ? Math.sin(this.lookPhase) * 0.36 : 0;
  }

  private advance(): void {
    if (this.state.points.length === 0) return;
    const next = this.state.index + 1;
    if (next >= this.state.points.length) {
      this.state.loops += 1;
      this.state.index = 0;
    } else {
      this.state.index = next;
    }
  }
}
