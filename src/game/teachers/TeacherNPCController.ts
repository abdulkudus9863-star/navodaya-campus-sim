import * as THREE from "three";
import type { TeacherConfig, TeacherId, TeacherRouteArea } from "../data/teachers";
import type { BlockCollider, WorldInteractable } from "../world/WorldEnvironment";
import { damp, shortestAngle } from "../world/geometry";
import { TeacherNavigationController } from "./TeacherNavigationController";
import { TeacherDetectionSystem, type DetectionResult } from "./TeacherDetectionSystem";
import { createTeacherRig, type TeacherRig } from "./TeacherFactory";

export type TeacherActivity = "patrolling" | "idle" | "noticed" | "approaching" | "talking" | "cooldown";

export interface TeacherUpdateContext {
  playerX: number;
  playerZ: number;
  playerBusy: boolean;
  cooldownReady: boolean;
  lineOfSight: boolean;
  colliders: BlockCollider[];
  bounds: number;
  otherTeachers: THREE.Vector3[];
  talking: boolean;
  mood: "stern" | "calm" | "encouraging" | "amused";
}

export interface TeacherSnapshot {
  id: TeacherId;
  name: string;
  subject: string;
  personality: string;
  gender: string;
  activity: TeacherActivity;
  x: number;
  z: number;
  rotation: number;
  available: boolean;
  distance: number;
  moving: boolean;
  currentSpeed: number;
  idleTime: number;
  targetDistance: number | null;
  patrolArea: string;
  target: { x: number; z: number } | null;
  detected: boolean;
  routeLoops: number;
}

/**
 * One teacher in the live Three.js scene. Movement, detection, animation,
 * interaction availability and the nameplate all share this single position.
 */
export class TeacherNPCController {
  readonly config: TeacherConfig;
  readonly rig: TeacherRig;
  readonly navigation: TeacherNavigationController;
  readonly interactable: WorldInteractable;
  private detection = new TeacherDetectionSystem();
  private activityValue: TeacherActivity = "patrolling";
  private lastDetection: DetectionResult | null = null;
  private walkPhase = 0;
  private talkPhase = 0;
  private idlePhase = 0;
  private currentArea: TeacherRouteArea;
  private routeLoops = 0;
  private approachTimer = 0;
  private available = false;
  private facingPlayer = false;
  private mood: TeacherUpdateContext["mood"] = "calm";

  constructor(config: TeacherConfig, area: TeacherRouteArea, group: THREE.Group) {
    this.config = config;
    this.currentArea = area;
    const spawn = area.points[0] ?? { x: 0, z: 40 };
    this.navigation = new TeacherNavigationController(new THREE.Vector3(spawn.x, 0, spawn.z), Math.PI);
    this.navigation.setRoute(area.points, true);
    this.rig = createTeacherRig(config, spawn);
    this.rig.group.position.copy(this.navigation.position);
    group.add(this.rig.group, this.rig.tag, this.rig.indicator);
    this.interactable = {
      id: `teacher-${config.id}`,
      kind: "teacher",
      label: config.name,
      position: new THREE.Vector3(spawn.x, 0, spawn.z),
      radius: 3.2,
      active: false,
      studentId: config.id,
    };
  }

  get id(): TeacherId {
    return this.config.id;
  }

  get activity(): TeacherActivity {
    return this.activityValue;
  }

  get isAvailable(): boolean {
    return this.available;
  }

  get position(): THREE.Vector3 {
    return this.navigation.position;
  }

  get rotation(): number {
    return this.navigation.rotation;
  }

  get patrolArea(): string {
    return this.currentArea.label;
  }

  get lastDetected(): boolean {
    return this.lastDetection?.noticed ?? false;
  }

  setPatrolArea(area: TeacherRouteArea): void {
    this.currentArea = area;
    this.navigation.setRoute(area.points, true);
    this.activityValue = "patrolling";
  }

  startTalking(mood: TeacherUpdateContext["mood"]): void {
    this.activityValue = "talking";
    this.mood = mood;
    this.talkPhase = 0;
    this.available = false;
    this.interactable.active = false;
    this.rig.indicator.visible = false;
  }

  stopTalking(cooldown: boolean): void {
    this.activityValue = cooldown ? "cooldown" : "patrolling";
    this.approachTimer = 0;
  }

  update(dt: number, elapsed: number, context: TeacherUpdateContext): void {
    this.mood = context.mood;
    const distance = Math.hypot(context.playerX - this.position.x, context.playerZ - this.position.z);
    const previousLoops = this.navigation.completedLoops;

    const detection = this.detection.evaluate({
      playerX: context.playerX,
      playerZ: context.playerZ,
      teacherX: this.position.x,
      teacherZ: this.position.z,
      teacherRotation: this.navigation.rotation,
      detectionRadius: this.config.detectionRadius,
      approachRadius: this.config.approachRadius,
      lineOfSight: context.lineOfSight,
      cooldownReady: context.cooldownReady,
      talking: context.talking,
      playerBusy: context.playerBusy,
    });
    this.lastDetection = detection;

    if (context.talking) {
      this.activityValue = "talking";
      this.navigation.faceTowards(context.playerX, context.playerZ, dt, 8);
      this.animateTalking(dt, elapsed);
      this.updatePresentation(distance);
      this.syncTransform();
      return;
    }

    if (this.activityValue === "talking") this.activityValue = "patrolling";

    if (detection.noticed) {
      this.available = distance <= 4.05;
      this.interactable.active = this.available;
      if (detection.approach && this.approachTimer < 2.8) {
        this.activityValue = "approaching";
        this.approachTimer += dt;
        this.navigation.update(dt, this.config.speed * 1.15, context.colliders, {
          bounds: context.bounds,
          avoid: context.otherTeachers,
          approach: {
            x: context.playerX,
            z: context.playerZ,
            stopAt: this.config.approachRadius,
          },
        });
        this.animateWalk(dt, this.config.speed * 1.15);
      } else {
        this.activityValue = "noticed";
        this.navigation.faceTowards(context.playerX, context.playerZ, dt, 6);
        this.animateNotice(dt, elapsed);
      }
    } else {
      this.approachTimer = 0;
      this.available = false;
      this.interactable.active = false;
      if (this.activityValue === "cooldown") {
        const avoidPlayer = new THREE.Vector3(context.playerX, 0, context.playerZ);
        this.navigation.update(dt, this.config.speed * 0.86, context.colliders, {
          bounds: context.bounds,
          avoid: [...context.otherTeachers, avoidPlayer],
        });
        this.animateWalk(dt, this.config.speed * 0.86);
        if (distance > this.config.detectionRadius * 1.6) this.activityValue = "patrolling";
      } else {
        this.activityValue = this.navigation.idleTime > 0 ? "idle" : "patrolling";
        const avoidPlayer = new THREE.Vector3(context.playerX, 0, context.playerZ);
        this.navigation.update(dt, this.config.speed, context.colliders, {
          bounds: context.bounds,
          avoid: [...context.otherTeachers, avoidPlayer],
        });
        if (this.navigation.moving) this.animateWalk(dt, this.config.speed);
        else this.animateIdle(dt, elapsed);
      }
    }

    if (this.navigation.completedLoops > previousLoops) {
      this.routeLoops = this.navigation.completedLoops;
    }
    this.updatePresentation(distance);
    this.syncTransform();
  }

  /** During pause/dialogue the teacher keeps eye contact without walking. */
  updateTalkOnly(dt: number, elapsed: number, playerX: number, playerZ: number): void {
    this.navigation.faceTowards(playerX, playerZ, dt, 8);
    this.animateTalking(dt, elapsed);
    const distance = Math.hypot(playerX - this.position.x, playerZ - this.position.z);
    this.updatePresentation(distance);
    this.syncTransform();
  }

  get routeLoopCount(): number {
    return Math.max(this.routeLoops, this.navigation.completedLoops);
  }

  snapshot(): TeacherSnapshot {
    const target = this.navigation.target;
    return {
      id: this.id,
      name: this.config.name,
      subject: this.config.subject,
      personality: this.config.personality,
      gender: this.config.gender,
      activity: this.activityValue,
      x: Number(this.position.x.toFixed(2)),
      z: Number(this.position.z.toFixed(2)),
      rotation: Number(this.navigation.rotation.toFixed(3)),
      available: this.available,
      distance: Number((this.lastDetection?.distance ?? 0).toFixed(2)),
      moving: this.navigation.moving,
      currentSpeed: Number(this.navigation.currentSpeed.toFixed(2)),
      idleTime: Number(this.navigation.idleTime.toFixed(2)),
      targetDistance: target
        ? Number(Math.hypot(target.x - this.position.x, target.z - this.position.z).toFixed(2))
        : null,
      patrolArea: this.currentArea.label,
      target: target ? { x: target.x, z: target.z } : null,
      detected: this.lastDetection?.noticed ?? false,
      routeLoops: this.routeLoopCount,
    };
  }

  dispose(): void {
    const materials = new Set<THREE.Material>();
    this.rig.group.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      object.geometry.dispose();
      const list = Array.isArray(object.material) ? object.material : [object.material];
      for (const material of list) materials.add(material);
    });
    for (const material of materials) material.dispose();
    const tagMaterial = this.rig.tag.material as THREE.SpriteMaterial;
    tagMaterial.map?.dispose();
    tagMaterial.dispose();
    this.rig.indicator.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.geometry.dispose();
        const material = object.material as THREE.Material;
        material.dispose();
      }
    });
  }

  private updatePresentation(distance: number): void {
    this.rig.tag.position.set(this.position.x, 2.4, this.position.z);
    this.rig.indicator.position.set(this.position.x, 0.055, this.position.z);
    this.rig.indicator.visible = this.activityValue === "noticed" || this.activityValue === "approaching";
    const tagMaterial = this.rig.tag.material as THREE.SpriteMaterial;
    tagMaterial.opacity = THREE.MathUtils.clamp(1 - (distance - 13) / 20, 0, 1);
    if (this.rig.indicator.visible) {
      const ring = this.rig.indicator.userData.ring as THREE.Mesh | undefined;
      const material = ring?.material as THREE.MeshBasicMaterial | undefined;
      if (material) material.opacity = 0.48 + Math.sin(performance.now() * 0.004) * 0.18;
      this.rig.indicator.rotation.y += 0.01;
    }
    this.interactable.position.set(this.position.x, 0, this.position.z);
    this.interactable.active = this.available;
  }

  private syncTransform(): void {
    this.rig.group.position.set(this.position.x, this.rig.group.position.y, this.position.z);
    this.rig.group.rotation.y = this.navigation.rotation;
    this.rig.indicator.position.set(this.position.x, 0.055, this.position.z);
    this.rig.tag.position.set(this.position.x, 2.4, this.position.z);
    this.rig.indicator.rotation.y = this.navigation.rotation;
  }

  private animateWalk(dt: number, speed: number): void {
    const rig = this.rig;
    const intensity = Math.min(1, speed / 1.5);
    this.walkPhase += dt * (5.2 + intensity * 4.6);
    const swing = Math.sin(this.walkPhase) * (0.34 + intensity * 0.32);
    rig.leftLeg.rotation.x = swing;
    rig.rightLeg.rotation.x = -swing;
    const folded = this.config.personality === "strict";
    if (!folded) {
      rig.leftArm.rotation.x = -swing * 0.82;
      rig.rightArm.rotation.x = swing * 0.82;
      rig.leftArm.rotation.z = damp(rig.leftArm.rotation.z, 0, 8, dt);
      rig.rightArm.rotation.z = damp(rig.rightArm.rotation.z, 0, 8, dt);
    } else {
      // Confident, shoulders-back walk with arms held closer to the body.
      rig.leftArm.rotation.x = -swing * 0.48 - 0.12;
      rig.rightArm.rotation.x = swing * 0.48 - 0.12;
      rig.leftArm.rotation.z = damp(rig.leftArm.rotation.z, -0.12, 7, dt);
      rig.rightArm.rotation.z = damp(rig.rightArm.rotation.z, 0.12, 7, dt);
    }
    rig.torso.rotation.y = Math.sin(this.walkPhase) * 0.045;
    rig.torso.rotation.z = Math.sin(this.walkPhase * 0.5) * 0.008;
    rig.head.rotation.y = damp(rig.head.rotation.y, this.navigation.headLook(), 5, dt);
    rig.group.position.y = Math.abs(Math.sin(this.walkPhase)) * 0.028 * intensity;
  }

  private animateIdle(dt: number, elapsed: number): void {
    const rig = this.rig;
    this.idlePhase += dt;
    rig.leftLeg.rotation.x = damp(rig.leftLeg.rotation.x, 0, 7, dt);
    rig.rightLeg.rotation.x = damp(rig.rightLeg.rotation.x, 0, 7, dt);
    rig.torso.rotation.z = Math.sin(elapsed * 0.8) * 0.008;
    rig.torso.rotation.y = damp(rig.torso.rotation.y, 0, 6, dt);
    rig.group.position.y = Math.sin(elapsed * 1.2) * 0.006;
    rig.head.rotation.y = damp(rig.head.rotation.y, this.navigation.headLook(), 4, dt);
    rig.head.rotation.z = Math.sin(elapsed * 0.6) * 0.012;
    const armTarget = this.config.personality === "strict" ? -1.12 : -0.06;
    rig.leftArm.rotation.x = damp(rig.leftArm.rotation.x, armTarget, 5, dt);
    rig.rightArm.rotation.x = damp(rig.rightArm.rotation.x, armTarget, 5, dt);
    if (this.config.personality === "strict") {
      rig.leftArm.rotation.z = damp(rig.leftArm.rotation.z, -0.96, 6, dt);
      rig.rightArm.rotation.z = damp(rig.rightArm.rotation.z, 0.96, 6, dt);
    } else {
      rig.leftArm.rotation.z = damp(rig.leftArm.rotation.z, 0, 6, dt);
      rig.rightArm.rotation.z = damp(rig.rightArm.rotation.z, 0, 6, dt);
    }
    rig.parts.brows.forEach((brow, index) => {
      brow.rotation.z = (index === 0 ? 1 : -1) * this.browTilt(0.18);
    });
  }

  private animateNotice(dt: number, elapsed: number): void {
    const rig = this.rig;
    rig.leftLeg.rotation.x = damp(rig.leftLeg.rotation.x, 0, 8, dt);
    rig.rightLeg.rotation.x = damp(rig.rightLeg.rotation.x, 0, 8, dt);
    rig.torso.rotation.z = 0;
    rig.head.rotation.y = damp(rig.head.rotation.y, 0, 9, dt);
    rig.head.rotation.x = damp(rig.head.rotation.x, this.config.personality === "strict" ? 0.08 : 0.02, 6, dt);
    rig.group.position.y = Math.sin(elapsed * 1.4) * 0.004;
    if (this.config.personality === "strict") {
      rig.leftArm.rotation.x = damp(rig.leftArm.rotation.x, -1.16, 7, dt);
      rig.rightArm.rotation.x = damp(rig.rightArm.rotation.x, -1.16, 7, dt);
      rig.leftArm.rotation.z = damp(rig.leftArm.rotation.z, -0.98, 7, dt);
      rig.rightArm.rotation.z = damp(rig.rightArm.rotation.z, 0.98, 7, dt);
    } else {
      rig.leftArm.rotation.x = damp(rig.leftArm.rotation.x, -0.28, 7, dt);
      rig.rightArm.rotation.x = damp(rig.rightArm.rotation.x, -0.28, 7, dt);
      rig.leftArm.rotation.z = damp(rig.leftArm.rotation.z, 0, 7, dt);
      rig.rightArm.rotation.z = damp(rig.rightArm.rotation.z, 0, 7, dt);
    }
    rig.parts.brows.forEach((brow, index) => {
      brow.rotation.z = (index === 0 ? 1 : -1) * this.browTilt(0.22);
    });
  }

  private animateTalking(dt: number, elapsed: number): void {
    const rig = this.rig;
    this.talkPhase += dt;
    const gestureSpeed = this.mood === "amused" ? 2.9 : this.mood === "stern" ? 1.4 : 2.1;
    const gesture = Math.sin(this.talkPhase * gestureSpeed);
    rig.leftLeg.rotation.x = damp(rig.leftLeg.rotation.x, 0, 8, dt);
    rig.rightLeg.rotation.x = damp(rig.rightLeg.rotation.x, 0, 8, dt);
    rig.group.position.y = Math.sin(elapsed * 1.3) * 0.005;
    rig.head.rotation.y = damp(rig.head.rotation.y, Math.sin(this.talkPhase * 0.55) * 0.06, 5, dt);
    rig.head.rotation.x = Math.sin(this.talkPhase * 1.1) * 0.026;
    rig.torso.rotation.y = Math.sin(this.talkPhase * 0.5) * 0.012;
    if (this.mood === "stern" || this.config.personality === "strict") {
      rig.leftArm.rotation.x = damp(rig.leftArm.rotation.x, -1.05 + gesture * 0.06, 8, dt);
      rig.rightArm.rotation.x = damp(rig.rightArm.rotation.x, -0.18 + gesture * 0.22, 8, dt);
      rig.leftArm.rotation.z = damp(rig.leftArm.rotation.z, -0.94, 8, dt);
      rig.rightArm.rotation.z = damp(rig.rightArm.rotation.z, 0.08, 8, dt);
    } else if (this.mood === "amused") {
      rig.leftArm.rotation.x = damp(rig.leftArm.rotation.x, -0.55 + gesture * 0.55, 9, dt);
      rig.rightArm.rotation.x = damp(rig.rightArm.rotation.x, -0.3 - gesture * 0.45, 9, dt);
      rig.leftArm.rotation.z = damp(rig.leftArm.rotation.z, -0.2, 7, dt);
      rig.rightArm.rotation.z = damp(rig.rightArm.rotation.z, 0.2, 7, dt);
    } else {
      rig.leftArm.rotation.x = damp(rig.leftArm.rotation.x, -0.36 + gesture * 0.38, 8, dt);
      rig.rightArm.rotation.x = damp(rig.rightArm.rotation.x, -0.24 - gesture * 0.26, 8, dt);
      rig.leftArm.rotation.z = damp(rig.leftArm.rotation.z, 0, 7, dt);
      rig.rightArm.rotation.z = damp(rig.rightArm.rotation.z, 0, 7, dt);
    }
    rig.parts.brows.forEach((brow, index) => {
      brow.rotation.z = (index === 0 ? 1 : -1) * this.browTilt(0.16);
    });
  }

  /** Stern lowers the inner brows; friendly/funny lift them for expression. */
  private browTilt(strictTilt: number): number {
    if (this.mood === "stern") return strictTilt;
    if (this.config.personality === "friendly") return -0.05;
    if (this.config.personality === "funny") return -0.02;
    if (this.config.personality === "serious") return 0.1;
    return strictTilt * 0.4;
  }
}

