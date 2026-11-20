import * as THREE from "three";
import type { CharacterSettings } from "../core/types";
import { SKIN_TONES, UNIFORM_COLORS } from "../core/types";
import type { InputController } from "../core/InputController";
import {
  applyCharacterOptions,
  characterOptions,
  createCharacter,
  setRigUniform,
  type CharacterRig,
} from "../world/CharacterFactory";
import { damp, shortestAngle } from "../world/geometry";
import type { BlockCollider } from "../world/WorldEnvironment";

const WALK_SPEED = 3.7;
const RUN_SPEED = 6.1;
const CROUCH_SPEED = 1.85;
const GRAVITY = 18;
const JUMP_VELOCITY = 5.4;
const PLAYER_RADIUS = 0.38;
const ACCELERATION = 14;
const DECELERATION = 18;
const TURN_RATE = 13;

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
  private character: CharacterSettings;

  onFootstep: (() => void) | null = null;

  private walkPhase = 0;
  private stepTimer = 0;
  private landingImpact = 0;
  private interactPulse = 0;
  private eatPulse = 0;

  constructor(character: CharacterSettings, houseColor?: string) {
    this.character = character;
    this.houseColor = houseColor ?? UNIFORM_COLORS[character.uniform];
    this.rig = createCharacter(
      characterOptions(character, this.houseColor, SKIN_TONES[character.skin], "high"),
    );
    this.rig.group.name = "player";
  }

  setCharacter(character: CharacterSettings, houseColor: string = this.houseColor): void {
    this.character = character;
    this.houseColor = houseColor;
    applyCharacterOptions(
      this.rig,
      characterOptions(character, houseColor, SKIN_TONES[character.skin], "high"),
    );
  }

  getCharacter(): CharacterSettings {
    return this.character;
  }

  setCrouching(crouching: boolean): void {
    this.crouching = crouching;
    if (crouching) this.running = false;
  }

  setHouseColor(color: string): void {
    this.houseColor = color;
    setRigUniform(this.rig, color);
  }

  /** Brief reach gesture used for doors, pickups and interaction prompts. */
  playInteract(): void {
    this.interactPulse = 1;
  }

  /** Hand-to-mouth gesture used when eating from the house cupboard. */
  playEat(): void {
    this.eatPulse = 1;
    this.currentSpeed = 0;
    this.moving = false;
  }

  /** Advances the eat/reach gesture while the cupboard panel pauses movement. */
  tickGesture(dt: number): void {
    this.animate(dt);
  }

  placeAt(position: THREE.Vector3, rotationY: number): void {
    this.position.set(position.x, Math.max(0, position.y), position.z);
    this.rotationY = rotationY;
    this.velocityY = 0;
    this.grounded = true;
    this.currentSpeed = 0;
    this.landingImpact = 0;
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
    this.currentSpeed = damp(
      this.currentSpeed,
      wantedSpeed,
      wantedSpeed > this.currentSpeed ? ACCELERATION : DECELERATION,
      dt,
    );
    if (this.currentSpeed < 0.03) this.currentSpeed = 0;

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

    const wasGrounded = this.grounded;
    const fallSpeed = this.velocityY;
    if (input.consumeJump() && this.grounded) {
      this.velocityY = JUMP_VELOCITY;
      this.grounded = false;
    }

    const groundAt = (x: number, z: number): number =>
      heightAt ? heightAt(x, z, this.position.y) : 0;

    // Axis-separated movement gives natural wall sliding.
    const stepX = dirX * this.currentSpeed * dt;
    const stepZ = dirZ * this.currentSpeed * dt;
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
      if (!wasGrounded && fallSpeed < -1.5) {
        this.landingImpact = Math.min(1, -fallSpeed / 8.5);
      }
      this.grounded = true;
    }

    if (this.moving) {
      const targetRotation = Math.atan2(dirX, dirZ);
      const turnRate = TURN_RATE - Math.min(4, this.currentSpeed * 0.5);
      this.rotationY += shortestAngle(this.rotationY, targetRotation) * Math.min(1, dt * turnRate);
    }

    this.rig.group.position.copy(this.position);
    this.rig.group.rotation.y = this.rotationY;
    const crouchScale = this.crouching ? 0.78 : 1 - this.landingImpact * 0.075;
    const groundScale = 1 + this.landingImpact * 0.035;
    this.rig.group.scale.y = damp(this.rig.group.scale.y, crouchScale, 14, dt);
    this.rig.group.scale.x = damp(this.rig.group.scale.x, groundScale, 14, dt);
    this.rig.group.scale.z = damp(this.rig.group.scale.z, groundScale, 14, dt);
    this.animate(dt);
  }

  private animate(dt: number): void {
    const rig = this.rig;
    this.landingImpact = Math.max(0, this.landingImpact - dt * 3.8);
    this.interactPulse = Math.max(0, this.interactPulse - dt * 2.4);
    this.eatPulse = Math.max(0, this.eatPulse - dt * 0.9);
    const intensity = Math.min(1, this.currentSpeed / RUN_SPEED);
    const land = this.landingImpact;
    const stride = this.currentSpeed > 0.12 ? this.currentSpeed : 0;

    if (this.moving && stride > 0) {
      this.walkPhase += dt * (5.4 + intensity * 7.2);
      const swingAmount = 0.3 + intensity * 0.52;
      const swing = Math.sin(this.walkPhase) * swingAmount;
      rig.leftLeg.rotation.x = swing + land * 0.18;
      rig.rightLeg.rotation.x = -swing + land * 0.18;
      rig.leftArm.rotation.x = -swing * 0.85;
      rig.rightArm.rotation.x = swing * 0.85;
      rig.torso.rotation.y = damp(rig.torso.rotation.y, Math.sin(this.walkPhase) * 0.055, 12, dt);
      // The feet stay planted on the ground plane; only the torso and head bob.
      rig.group.position.y = this.position.y;
      const bob = Math.abs(Math.sin(this.walkPhase)) * 0.02 * intensity;
      rig.torso.position.y = 1.02 + bob;
      rig.head.position.y = 1.52 + bob * 0.75 - land * 0.035;
      rig.head.rotation.z = Math.sin(this.walkPhase) * 0.018;
      if (this.grounded) {
        this.stepTimer -= dt;
        if (this.stepTimer <= 0) {
          this.stepTimer = this.running ? 0.28 : 0.42;
          this.onFootstep?.();
        }
      }
    } else {
      rig.leftLeg.rotation.x = damp(rig.leftLeg.rotation.x, land * 0.28, 9, dt);
      rig.rightLeg.rotation.x = damp(rig.rightLeg.rotation.x, land * 0.28, 9, dt);
      rig.leftArm.rotation.x = damp(rig.leftArm.rotation.x, 0, 9, dt);
      rig.rightArm.rotation.x = damp(rig.rightArm.rotation.x, 0, 9, dt);
      rig.torso.rotation.y = damp(rig.torso.rotation.y, 0, 9, dt);
      rig.torso.position.y = damp(rig.torso.position.y, 1.02 - land * 0.03, 12, dt);
      rig.head.position.y = damp(rig.head.position.y, 1.52 - land * 0.055, 12, dt);
      rig.head.rotation.z = damp(rig.head.rotation.z, 0, 8, dt);
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

    if (this.grounded && this.interactPulse > 0) {
      const reach = Math.sin((1 - this.interactPulse) * Math.PI);
      rig.rightArm.rotation.x = damp(rig.rightArm.rotation.x, -1.05 * reach, 18, dt);
      rig.rightArm.rotation.z = damp(rig.rightArm.rotation.z, -0.18 * reach, 18, dt);
    } else {
      rig.rightArm.rotation.z = damp(rig.rightArm.rotation.z, 0, 10, dt);
    }

    if (this.eatPulse > 0) {
      const progress = 1 - this.eatPulse;
      const lift = Math.min(1, progress * 3.2);
      const chew = Math.sin(progress * Math.PI * 8) * 0.09;
      rig.rightArm.rotation.x = damp(rig.rightArm.rotation.x, -1.62 * lift + chew, 18, dt);
      rig.rightArm.rotation.z = damp(rig.rightArm.rotation.z, -0.42 * lift, 18, dt);
      rig.head.rotation.x = damp(rig.head.rotation.x, 0.1 + chew * 0.45, 14, dt);
      rig.head.rotation.z = damp(rig.head.rotation.z, Math.sin(progress * Math.PI * 4) * 0.035, 12, dt);
    } else {
      rig.head.rotation.x = damp(rig.head.rotation.x, 0, 8, dt);
    }

    const lean = this.grounded
      ? this.running
        ? 0.09
        : this.moving
          ? 0.035
          : 0
      : -0.04;
    rig.torso.rotation.x = damp(rig.torso.rotation.x, lean, 9, dt);
    rig.head.rotation.y = damp(rig.head.rotation.y, 0, 6, dt);
  }

  dispose(): void {
    this.rig.group.traverse((object) => {
      if (object instanceof THREE.Mesh) object.geometry.dispose();
    });
  }
}
