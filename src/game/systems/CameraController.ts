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
const FOLLOW_MIN_DISTANCE = 2.5;
const FOLLOW_MAX_DISTANCE = 9.5;
const OVERVIEW_MIN_DISTANCE = 38;
const OVERVIEW_MAX_DISTANCE = 118;

export class CameraController {
  readonly camera: THREE.PerspectiveCamera;
  yaw = 0;
  pitch = 0.19;
  /** User-selected follow distance. The rendered distance may be shorter when a wall is in the way. */
  distance = 4.9;

  private target = new THREE.Vector3();
  private currentLook = new THREE.Vector3();
  private smoothedYaw = 0;
  private smoothedPitch = 0.19;
  private currentDistance = 4.9;
  private dialogueAnchor: THREE.Vector3 | null = null;
  private hasFollowed = false;
  private manualLookCooldown = 0;
  private followSettle = 0;
  private wasMoving = false;

  private overviewYaw = 0;
  private overviewPitch = 0.62;
  private overviewDistance = 78;
  private overviewTargetDistance = 78;
  private followYaw = 0;
  private followPitch = 0.19;
  private followDistance = 4.9;

  mode: "follow" | "cinematic" | "dialogue" | "overview" = "cinematic";

  constructor(aspect: number) {
    this.camera = new THREE.PerspectiveCamera(55, aspect, 0.1, 400);
    this.camera.position.set(0, 3, 57);
  }

  get isOverview(): boolean {
    return this.mode === "overview";
  }

  resize(aspect: number): void {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }

  resetToPlayer(playerPosition: THREE.Vector3, playerRotationY: number): void {
    // Keep the player's chosen pitch and distance across doors, hostels and travel.
    this.yaw = playerRotationY + Math.PI;
    this.smoothedYaw = this.yaw;
    this.smoothedPitch = this.pitch;
    this.currentDistance = this.distance;
    this.manualLookCooldown = 0;
    this.followSettle = 0;
    this.wasMoving = false;
    this.hasFollowed = false;
    this.mode = "follow";
    this.updateFollow(0.016, playerPosition, playerRotationY, null, [], 1, false, false, true);
  }

  /** Multiplicative distance change used by pinch, wheel and on-screen controls. */
  zoomBy(factor: number): void {
    const safe = Number.isFinite(factor) ? Math.max(0.5, Math.min(2, factor)) : 1;
    if (this.mode === "overview") {
      this.overviewTargetDistance = THREE.MathUtils.clamp(
        this.overviewTargetDistance * safe,
        OVERVIEW_MIN_DISTANCE,
        OVERVIEW_MAX_DISTANCE,
      );
    } else {
      this.distance = THREE.MathUtils.clamp(this.distance * safe, FOLLOW_MIN_DISTANCE, FOLLOW_MAX_DISTANCE);
    }
  }

  /** Steps used by keyboard and on-screen +/- buttons. Positive steps zoom out. */
  zoomStep(direction: number): void {
    if (direction === 0) return;
    this.zoomBy(direction > 0 ? 1.16 : 0.86);
  }

  getDistance(): number {
    return this.mode === "overview" ? this.overviewTargetDistance : this.distance;
  }

  /** Orientation currently being rendered, including overview orbit. */
  getViewYaw(): number {
    return this.mode === "overview" ? this.overviewYaw : this.yaw;
  }

  /** Actual camera separation from the player focus, after collision/zoom smoothing. */
  getRenderedDistance(playerPosition: THREE.Vector3): number {
    const focus = new THREE.Vector3(playerPosition.x, playerPosition.y + 1.48, playerPosition.z);
    return this.camera.position.distanceTo(focus);
  }

  enterOverview(playerPosition: THREE.Vector3): void {
    if (this.mode === "overview") return;
    this.followYaw = this.yaw;
    this.followPitch = this.pitch;
    this.followDistance = this.distance;
    this.overviewYaw = this.yaw;
    this.overviewPitch = 0.62;
    this.overviewDistance = Math.max(this.currentDistance, 28);
    this.overviewTargetDistance = 78;
    this.mode = "overview";
    this.manualLookCooldown = 0;
    this.followSettle = 0;
    this.target.copy(playerPosition);
  }

  exitOverview(): void {
    if (this.mode !== "overview") return;
    this.yaw = this.followYaw;
    this.pitch = this.followPitch;
    this.distance = this.followDistance;
    this.manualLookCooldown = 0;
    this.followSettle = 0;
    this.mode = "follow";
    this.hasFollowed = true;
  }

  updateFollow(
    dt: number,
    playerPosition: THREE.Vector3,
    playerRotationY: number,
    input: InputController | null,
    occluders: THREE.Box3[],
    sensitivity: number,
    invertY: boolean,
    moving: boolean,
    snap = false,
  ): void {
    if (input) {
      const look = input.consumeLook();
      if (Math.abs(look.x) > 0.0001 || Math.abs(look.y) > 0.0001) {
        this.yaw -= look.x * 0.0026 * sensitivity;
        const pitchDelta = look.y * 0.0021 * sensitivity * (invertY ? -1 : 1);
        this.pitch = THREE.MathUtils.clamp(this.pitch + pitchDelta, 0.04, 1.05);
        this.manualLookCooldown = 1.15;
      } else if (this.manualLookCooldown > 0) {
        this.manualLookCooldown = Math.max(0, this.manualLookCooldown - dt);
      }
      const zoom = input.consumeZoom();
      if (zoom !== 0) {
        this.distance = THREE.MathUtils.clamp(
          this.distance + zoom * 0.7,
          FOLLOW_MIN_DISTANCE,
          FOLLOW_MAX_DISTANCE,
        );
      }
    }

    // Auto-follow only for forward/diagonal travel. Pure strafing and
    // backpedalling must not spin the camera (or the character) in a circle.
    // When travel stops, a short settle window eases the orbit behind the
    // character, so a 180° backpedal swings the camera around after release
    // instead of leaving it in front of the student.
    const move = input?.getMove();
    const forwardIntent = move ? move.y : 0;
    const behind = playerRotationY + Math.PI;
    const behindError = Math.abs(shortest(this.yaw, behind));
    if (!moving && this.wasMoving && this.manualLookCooldown <= 0 && behindError > 0.32) {
      this.followSettle = 1.5;
    }
    const aligningForward = moving && this.manualLookCooldown <= 0 && forwardIntent > 0.3;
    if (aligningForward) this.followSettle = 1.2;
    if (this.manualLookCooldown <= 0 && (aligningForward || (!moving && this.followSettle > 0))) {
      const rate = moving ? 3.2 : 5.5;
      this.yaw += shortest(this.yaw, behind) * Math.min(1, dt * rate);
      if (!moving) this.followSettle = Math.max(0, this.followSettle - dt);
    } else if (this.followSettle > 0) {
      this.followSettle = Math.max(0, this.followSettle - dt);
    }
    this.wasMoving = moving;

    this.smoothedYaw = snap
      ? this.yaw
      : this.smoothedYaw + shortest(this.smoothedYaw, this.yaw) * Math.min(1, dt * 16);
    this.smoothedPitch = snap
      ? this.pitch
      : this.smoothedPitch + (this.pitch - this.smoothedPitch) * Math.min(1, dt * 16);

    const targetY = playerPosition.y + 1.48;
    const target = new THREE.Vector3(playerPosition.x, targetY, playerPosition.z);
    const cosPitch = Math.cos(this.smoothedPitch);
    const direction = new THREE.Vector3(
      Math.sin(this.smoothedYaw) * cosPitch,
      Math.sin(this.smoothedPitch),
      Math.cos(this.smoothedYaw) * cosPitch,
    ).normalize();

    const requested = THREE.MathUtils.clamp(this.distance, FOLLOW_MIN_DISTANCE, FOLLOW_MAX_DISTANCE);
    let collisionDistance = requested;
    const ray = new THREE.Ray(target, direction);
    const hitPoint = new THREE.Vector3();
    for (const box of occluders) {
      const hit = ray.intersectBox(box, hitPoint);
      if (hit) {
        const distanceToHit = target.distanceTo(hit);
        if (distanceToHit < collisionDistance) collisionDistance = distanceToHit;
      }
    }
    collisionDistance = Math.max(1.05, collisionDistance - 0.22);
    const obstructed = collisionDistance < requested - 0.03;

    // Pull in immediately when a wall is hit, but ease back out when the view
    // clears. This avoids both wall clipping and a jarring zoom-out.
    if (snap || collisionDistance < this.currentDistance) {
      this.currentDistance = collisionDistance;
    } else {
      this.currentDistance += (requested - this.currentDistance) * Math.min(1, dt * 7);
    }
    const renderedDistance = Math.min(this.currentDistance, collisionDistance);
    const desired = target.clone().add(direction.multiplyScalar(renderedDistance));
    desired.y = Math.max(0.4, desired.y);

    if (snap || !this.hasFollowed) {
      this.camera.position.copy(desired);
      this.currentLook.copy(target);
      this.hasFollowed = true;
    } else {
      this.camera.position.lerp(desired, Math.min(1, dt * (obstructed ? 30 : 18)));
      this.currentLook.lerp(target, Math.min(1, dt * 15));
    }
    this.camera.lookAt(this.currentLook);
    this.dialogueAnchor = null;
  }

  updateOverview(
    dt: number,
    input: InputController | null,
    sensitivity: number,
    invertY: boolean,
  ): void {
    if (input) {
      const look = input.consumeLook();
      this.overviewYaw -= look.x * 0.0026 * sensitivity;
      const pitchDelta = look.y * 0.0021 * sensitivity * (invertY ? -1 : 1);
      this.overviewPitch = THREE.MathUtils.clamp(this.overviewPitch + pitchDelta, 0.28, 1.15);
      const zoom = input.consumeZoom();
      if (zoom !== 0) {
        this.overviewTargetDistance = THREE.MathUtils.clamp(
          this.overviewTargetDistance + zoom * 4.5,
          OVERVIEW_MIN_DISTANCE,
          OVERVIEW_MAX_DISTANCE,
        );
      }
    }

    this.smoothedYaw += shortest(this.smoothedYaw, this.overviewYaw) * Math.min(1, dt * 10);
    this.smoothedPitch += (this.overviewPitch - this.smoothedPitch) * Math.min(1, dt * 10);
    this.overviewDistance +=
      (this.overviewTargetDistance - this.overviewDistance) * Math.min(1, dt * 6);

    const focus = new THREE.Vector3(0, 2.2, 0);
    const cosPitch = Math.cos(this.smoothedPitch);
    const offset = new THREE.Vector3(
      Math.sin(this.smoothedYaw) * cosPitch,
      Math.sin(this.smoothedPitch),
      Math.cos(this.smoothedYaw) * cosPitch,
    ).multiplyScalar(this.overviewDistance);
    const desired = focus.clone().add(offset);
    desired.y = Math.max(8, desired.y);

    this.camera.position.lerp(desired, Math.min(1, dt * 3.2));
    this.currentLook.lerp(focus, Math.min(1, dt * 3.2));
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
