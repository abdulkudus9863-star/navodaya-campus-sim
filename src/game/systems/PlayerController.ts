import * as THREE from "three";
import type { CharacterSettings } from "../core/types";
import { SKIN_TONES, UNIFORM_COLORS } from "../core/types";
import type { InputController } from "../core/InputController";
import { createCharacter, setRigSkin, setRigUniform, type CharacterRig } from "../world/CharacterFactory";
import { damp, shortestAngle } from "../world/geometry";
import type { BlockCollider } from "../world/WorldEnvironment";

const WALK_SPEED = 3.7;
const RUN_SPEED = 6.1;
const CROUCH_SPEED = 1.85;
const GRAVITY = 18;
const JUMP_VELOCITY = 5.4;
const PLAYER_RADIUS = 0.38;

export function collidesAt(x: number, z: number, colliders: BlockCollider[], y = 0): boolean {
  for (const collider of colliders) {
    if (!collider.active) continue;
    // The player is a 1.7 m capsule. Vertical limits keep first-floor walls
    // from blocking the ground-floor corridor below them, and vice versa.
    if (collider.maxY !== undefined && collider.maxY <= y + 0.12) continue;
    if (collider.minY !== undefined && collider.minY >= y + 1.7) continue;
    const closestX = Math.max(collider.minX, Math.min(x, collider.maxX));
    const closestZ = Math.max(collider.minZ, Math.min(z, collider.maxZ));
    const dx = x - closestX;
    const dz = z - closestZ;
    if (dx * dx + dz * dz < PLAYER_RADIUS * PLAYER_RADIUS) return true;
  }
  return false;
}

export class PlayerController {
  readonly rig: CharacterRig;
  readonly position = new THREE.Vector3();
  rotationY = Math.PI;
  velocityY = 0;
  grounded = true;
  moving = false;
  running = false;
  crouching = false;
  currentSpeed = 0;
  private houseColor: string;

  onFootstep: (() => void) | null = null;

  private walkPhase = 0;
  private stepTimer = 0;

  constructor(character: CharacterSettings, houseColor?: string) {
    this.houseColor = houseColor ?? UNIFORM_COLORS[character.uniform];
    this.rig = createCharacter({
      uniform: this.houseColor,
      skin: SKIN_TONES[character.skin],
    });
    this.rig.group.name = "player";
  }

  setCharacter(character: CharacterSettings, houseColor: string = this.houseColor): void {
    this.houseColor = houseColor;
    setRigUniform(this.rig, houseColor);
    setRigSkin(this.rig, SKIN_TONES[character.skin]);
  }

  setCrouching(crouching: boolean): void {
    this.crouching = crouching;
    if (crouching) this.running = false;
  }

  setHouseColor(color: string): void {
    this.houseColor = color;
    setRigUniform(this.rig, color);
  }

  placeAt(position: THREE.Vector3, rotationY: number): void {
    this.position.set(position.x, Math.max(0, position.y), position.z);
    this.rotationY = rotationY;
    this.velocityY = 0;
    this.grounded = true;
    this.rig.group.position.copy(this.position);
    this.rig.group.rotation.y = rotationY;
  }

  /** Drops the player back at the main gate facing the campus. */
  resetToSpawn(spawn: THREE.Vector3): void {
    this.placeAt(spawn, Math.PI);
  }

  update(
    dt: number,
    input: InputController,
    cameraYaw: number,
    colliders: BlockCollider[],
    bounds: number,
    heightAt?: (x: number, z: number, currentY: number) => number,
  ): void {
    const move = input.getMove();
    const magnitude = Math.min(1, Math.hypot(move.x, move.y));
    const baseSpeed = this.crouching ? CROUCH_SPEED : input.running ? RUN_SPEED : WALK_SPEED;
    const wantedSpeed = magnitude * baseSpeed;
    this.currentSpeed = wantedSpeed;

    const forwardX = -Math.sin(cameraYaw);
    const forwardZ = -Math.cos(cameraYaw);
    const rightX = Math.cos(cameraYaw);
    const rightZ = -Math.sin(cameraYaw);

    let dirX = forwardX * move.y + rightX * move.x;
    let dirZ = forwardZ * move.y + rightZ * move.x;
    const dirLength = Math.hypot(dirX, dirZ);
    if (dirLength > 0.0001) {
      dirX /= dirLength;
      dirZ /= dirLength;
    }

    this.moving = magnitude > 0.08;
    this.running = this.moving && input.running && !this.crouching;

    if (input.consumeJump() && this.grounded) {
      this.velocityY = JUMP_VELOCITY;
      this.grounded = false;
    }

    const groundAt = (x: number, z: number): number =>
      heightAt ? heightAt(x, z, this.position.y) : 0;

    // Axis-separated movement gives natural wall sliding.
    const stepX = dirX * wantedSpeed * dt;
    const stepZ = dirZ * wantedSpeed * dt;
    if (stepX !== 0) {
      const nextX = THREE.MathUtils.clamp(this.position.x + stepX, -bounds, bounds);
      if (!collidesAt(nextX, this.position.z, colliders, this.position.y)) this.position.x = nextX;
    }
    if (stepZ !== 0) {
      const nextZ = THREE.MathUtils.clamp(this.position.z + stepZ, -bounds, bounds);
      if (!collidesAt(this.position.x, nextZ, colliders, this.position.y)) this.position.z = nextZ;
    }

    let groundY = groundAt(this.position.x, this.position.z);
    if (this.grounded) {
      // Stairs are ramps: follow small rises and descents. A larger drop
      // becomes a fall instead of snapping the player through a floor.
      if (groundY >= this.position.y - 0.55) {
        this.position.y = groundY;
        this.velocityY = 0;
      } else {
        this.grounded = false;
      }
    }

    this.velocityY -= GRAVITY * dt;
    this.position.y += this.velocityY * dt;
    groundY = groundAt(this.position.x, this.position.z);
    if (this.position.y <= groundY) {
      this.position.y = groundY;
      this.velocityY = 0;
      this.grounded = true;
    }

    if (this.moving) {
      const targetRotation = Math.atan2(dirX, dirZ);
      this.rotationY += shortestAngle(this.rotationY, targetRotation) * Math.min(1, dt * 12);
    }

    this.rig.group.position.copy(this.position);
    this.rig.group.rotation.y = this.rotationY;
    const crouchScale = this.crouching ? 0.78 : 1;
    this.rig.group.scale.y = damp(this.rig.group.scale.y, crouchScale, 10, dt);
    this.animate(dt, wantedSpeed);
  }

  private animate(dt: number, speed: number): void {
    const rig = this.rig;
    const intensity = Math.min(1, speed / RUN_SPEED);
    if (this.moving) {
      this.walkPhase += dt * (6 + intensity * 6);
      const swing = Math.sin(this.walkPhase) * (0.35 + intensity * 0.45);
      rig.leftLeg.rotation.x = swing;
      rig.rightLeg.rotation.x = -swing;
      rig.leftArm.rotation.x = -swing * 0.8;
      rig.rightArm.rotation.x = swing * 0.8;
      rig.torso.rotation.y = Math.sin(this.walkPhase) * 0.05;
      rig.group.position.y = this.position.y + Math.abs(Math.sin(this.walkPhase)) * 0.035 * intensity;
      rig.head.rotation.z = Math.sin(this.walkPhase) * 0.015;
      this.stepTimer -= dt * (this.running ? 1.7 : 1);
      if (this.stepTimer <= 0) {
        this.stepTimer = 0.34;
        this.onFootstep?.();
      }
    } else {
      rig.leftLeg.rotation.x = damp(rig.leftLeg.rotation.x, 0, 8, dt);
      rig.rightLeg.rotation.x = damp(rig.rightLeg.rotation.x, 0, 8, dt);
      rig.leftArm.rotation.x = damp(rig.leftArm.rotation.x, 0, 8, dt);
      rig.rightArm.rotation.x = damp(rig.rightArm.rotation.x, 0, 8, dt);
      rig.torso.rotation.y = damp(rig.torso.rotation.y, 0, 8, dt);
      this.walkPhase = 0;
      this.stepTimer = 0;
    }

    if (!this.grounded) {
      const tuck = Math.min(0.55, Math.abs(this.velocityY) * 0.04);
      rig.leftLeg.rotation.x = damp(rig.leftLeg.rotation.x, 0.5, 10, dt);
      rig.rightLeg.rotation.x = damp(rig.rightLeg.rotation.x, 0.3, 10, dt);
      rig.leftArm.rotation.x = damp(rig.leftArm.rotation.x, -0.6 - tuck, 10, dt);
      rig.rightArm.rotation.x = damp(rig.rightArm.rotation.x, -0.6 - tuck, 10, dt);
    }

    rig.head.rotation.y = damp(rig.head.rotation.y, 0, 6, dt);
  }

  dispose(): void {
    this.rig.group.traverse((object) => {
      if (object instanceof THREE.Mesh) object.geometry.dispose();
    });
  }
}
