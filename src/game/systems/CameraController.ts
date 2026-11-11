import * as THREE from "three";
import type { InputController } from "../core/InputController";
import { easeInOutCubic } from "../world/geometry";

const CINEMATIC_SHOTS: Array<{ position: THREE.Vector3; look: THREE.Vector3 }> = [
  { position: new THREE.Vector3(0, 2.6, 57), look: new THREE.Vector3(0, 4.2, 36) },
  { position: new THREE.Vector3(12, 4.2, 33), look: new THREE.Vector3(-4, 2.6, 8) },
  { position: new THREE.Vector3(-17, 4.4, 25), look: new THREE.Vector3(-24, 3, 1) },
  { position: new THREE.Vector3(22, 5.2, 22), look: new THREE.Vector3(15, 3, 7) },
  { position: new THREE.Vector3(4, 8.4, 39), look: new THREE.Vector3(0, 2.2, -2) },
  { position: new THREE.Vector3(30, 5.4, 24), look: new THREE.Vector3(38, 1.5, 38) },
  { position: new THREE.Vector3(-8, 6.2, 27), look: new THREE.Vector3(-24, 3, 6) },
];

const CINEMATIC_DURATION = 56;

export class CameraController {
  readonly camera: THREE.PerspectiveCamera;
  yaw = 0;
  pitch = 0.19;
  distance = 4.9;

  private target = new THREE.Vector3();
  private currentLook = new THREE.Vector3();
  private smoothedYaw = 0;
  private smoothedPitch = 0.19;
  private currentDistance = 4.9;
  private dialogueAnchor: THREE.Vector3 | null = null;
  mode: "follow" | "cinematic" | "dialogue" = "cinematic";
  private hasFollowed = false;

  constructor(aspect: number) {
    this.camera = new THREE.PerspectiveCamera(55, aspect, 0.1, 400);
    this.camera.position.set(0, 3, 57);
  }

  resize(aspect: number): void {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }

  resetToPlayer(playerPosition: THREE.Vector3, playerRotationY: number): void {
    // Camera sits behind the player's facing direction.
    this.yaw = playerRotationY + Math.PI;
    this.pitch = 0.19;
    this.currentDistance = this.distance;
    this.smoothedYaw = this.yaw;
    this.smoothedPitch = this.pitch;
    this.hasFollowed = false;
    this.mode = "follow";
    this.updateFollow(0.016, playerPosition, null, [], 1, false, true);
  }

  updateFollow(
    dt: number,
    playerPosition: THREE.Vector3,
    input: InputController | null,
    occluders: THREE.Box3[],
    sensitivity: number,
    invertY: boolean,
    snap = false,
  ): void {
    if (input) {
      const look = input.consumeLook();
      this.yaw -= look.x * 0.0026 * sensitivity;
      const pitchDelta = look.y * 0.0021 * sensitivity * (invertY ? -1 : 1);
      this.pitch = THREE.MathUtils.clamp(this.pitch + pitchDelta, 0.02, 1.12);
    }

    this.smoothedYaw = snap ? this.yaw : this.smoothedYaw + shortest(this.smoothedYaw, this.yaw) * Math.min(1, dt * 18);
    this.smoothedPitch = snap ? this.pitch : this.smoothedPitch + (this.pitch - this.smoothedPitch) * Math.min(1, dt * 18);

    const targetY = playerPosition.y + 1.48;
    const target = new THREE.Vector3(playerPosition.x, targetY, playerPosition.z);
    const cosPitch = Math.cos(this.smoothedPitch);
    const offset = new THREE.Vector3(
      Math.sin(this.smoothedYaw) * cosPitch,
      Math.sin(this.smoothedPitch),
      Math.cos(this.smoothedYaw) * cosPitch,
    ).multiplyScalar(this.distance);

    let allowed = this.distance;
    const direction = offset.clone().normalize();
    const ray = new THREE.Ray(target, direction);
    const hitPoint = new THREE.Vector3();
    for (const box of occluders) {
      const hit = ray.intersectBox(box, hitPoint);
      if (hit) {
        const distanceToHit = target.distanceTo(hit);
        if (distanceToHit < allowed) allowed = distanceToHit;
      }
    }
    allowed = Math.max(1.15, allowed - 0.22);

    const desiredDistance = allowed;
    this.currentDistance = snap
      ? desiredDistance
      : this.currentDistance + (desiredDistance - this.currentDistance) * Math.min(1, dt * 14);

    const desired = target.clone().add(direction.multiplyScalar(this.currentDistance));
    desired.y = Math.max(0.4, desired.y);

    if (snap || !this.hasFollowed) {
      this.camera.position.copy(desired);
      this.currentLook.copy(target);
      this.hasFollowed = true;
    } else {
      this.camera.position.lerp(desired, Math.min(1, dt * 18));
      this.currentLook.lerp(target, Math.min(1, dt * 14));
    }
    this.camera.lookAt(this.currentLook);
    this.dialogueAnchor = null;
  }

  updateDialogue(dt: number, playerPosition: THREE.Vector3, npcPosition: THREE.Vector3): void {
    const midpoint = playerPosition.clone().add(npcPosition).multiplyScalar(0.5);
    const axis = npcPosition.clone().sub(playerPosition).setY(0);
    if (axis.lengthSq() < 0.01) axis.set(0, 0, 1);
    axis.normalize();
    const side = new THREE.Vector3(-axis.z, 0, axis.x);
    const desired = midpoint.clone().add(side.multiplyScalar(3.1));
    desired.y = playerPosition.y + 1.85;
    const look = new THREE.Vector3(
      (playerPosition.x + npcPosition.x) / 2,
      playerPosition.y + 1.35,
      (playerPosition.z + npcPosition.z) / 2,
    );
    this.camera.position.lerp(desired, Math.min(1, dt * 3.2));
    this.currentLook.lerp(look, Math.min(1, dt * 4.5));
    this.camera.lookAt(this.currentLook);
    this.dialogueAnchor = look;
  }

  updateCinematic(elapsed: number): void {
    const t = (elapsed % CINEMATIC_DURATION) / CINEMATIC_DURATION;
    const scaled = t * CINEMATIC_SHOTS.length;
    const index = Math.floor(scaled) % CINEMATIC_SHOTS.length;
    const nextIndex = (index + 1) % CINEMATIC_SHOTS.length;
    const local = easeInOutCubic(scaled - Math.floor(scaled));
    const from = CINEMATIC_SHOTS[index];
    const to = CINEMATIC_SHOTS[nextIndex];

    const position = from.position.clone().lerp(to.position, local);
    position.y += Math.sin(elapsed * 0.25) * 0.12;
    const look = from.look.clone().lerp(to.look, local);

    this.camera.position.copy(position);
    this.currentLook.copy(look);
    this.camera.lookAt(look);
  }

  dispose(): void {
    /* nothing to release */
  }
}

function shortest(from: number, to: number): number {
  let delta = (to - from) % (Math.PI * 2);
  if (delta > Math.PI) delta -= Math.PI * 2;
  if (delta < -Math.PI) delta += Math.PI * 2;
  return delta;
}
