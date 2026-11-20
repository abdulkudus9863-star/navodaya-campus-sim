import * as THREE from "three";
import type { DisciplineView, DialogueView, PlayerProfileSave, TeacherSave } from "../core/types";
import { TEACHER_IDS, type TeacherId } from "../data/teachers";
import type { WorldEnvironment } from "../world/WorldEnvironment";
import { collidesAt } from "../systems/PlayerController";
import { TeacherDialogueManager } from "./TeacherDialogueManager";
import { classifyCampusArea, areaLabel } from "./TeacherDetectionSystem";
import { TeacherMemoryManager } from "./TeacherMemoryManager";
import { TeacherNPCController } from "./TeacherNPCController";
import { TeacherPatrolManager, type TeacherConfigPatch } from "./TeacherPatrolManager";
import { TeacherPersonalityManager } from "./TeacherPersonalityManager";
import { SchoolTimetableManager, type SchoolTime } from "./SchoolTimetableManager";
import { StudentIdentityManager, type StudentIdentity } from "./StudentIdentityManager";
import {
  allNpcProfiles,
  npcProfileAt,
  npcProfileForTeacher,
  npcScheduleFor,
} from "../npcs/NpcRegistry";

export interface TeacherSystemContext {
  profile: PlayerProfileSave | null;
  player: THREE.Vector3;
  playtime: number;
  houseHostel: { x: number; z: number } | null;
  insideHouseHostel: boolean;
  mode: "playing" | "dialogue" | "frozen";
  crouching: boolean;
}

/**
 * Owns every teacher controller, detection gating, shared memory, the
 * timetable and the one active conversation. It is deliberately a scene-level
 * system, not a parallel mini-game, so the normal camera, colliders, HUD and
 * mobile controls all keep working around it.
 */
export class TeacherSystem {
  private group = new THREE.Group();
  private controllers = new Map<TeacherId, TeacherNPCController>();
  private patrol = new TeacherPatrolManager();
  private memory: TeacherMemoryManager;
  private identity = new StudentIdentityManager();
  private timetable = new SchoolTimetableManager();
  private personality = new TeacherPersonalityManager();
  private dialogue: TeacherDialogueManager;
  private world: WorldEnvironment;
  private lastLoops: Record<TeacherId, number> = Object.fromEntries(
    TEACHER_IDS.map((id) => [id, 0]),
  ) as Record<TeacherId, number>;
  private farUpdate: Record<TeacherId, number> = Object.fromEntries(
    TEACHER_IDS.map((id) => [id, 0]),
  ) as Record<TeacherId, number>;
  private active: TeacherId | null = null;
  private lastArea = "the campus";
  private lastViolation = false;
  private lastTime: SchoolTime;
  private disciplineAnnounced = false;
  private disciplineResolution: "completed" | "missed" | null = null;
  private enabled = true;

  constructor(world: WorldEnvironment, saved?: TeacherSave) {
    this.world = world;
    this.memory = new TeacherMemoryManager(saved);
    this.dialogue = new TeacherDialogueManager(this.memory, this.personality);
    this.group.name = "teacher-npcs";
    this.lastTime = this.timetable.at(0);
    for (const config of this.patrol.all()) {
      const area = this.patrol.areaFor(config.id);
      const controller = new TeacherNPCController(config, area, this.group);
      this.controllers.set(config.id, controller);
      world.interactables.push(controller.interactable);
    }
  }

  attach(scene: THREE.Scene): void {
    scene.add(this.group);
  }

  get groupRoot(): THREE.Group {
    return this.group;
  }

  get activeTeacherId(): TeacherId | null {
    return this.active;
  }

  get currentTime(): SchoolTime {
    return this.lastTime;
  }

  teacher(id: TeacherId): TeacherNPCController | undefined {
    return this.controllers.get(id);
  }

  allTeachers(): TeacherNPCController[] {
    return [...this.controllers.values()];
  }

  /** Routes a normal world interaction target to the right teacher. */
  teacherForInteractable(targetId: string): TeacherId | null {
    if (!targetId.startsWith("teacher-")) return null;
    const id = targetId.slice("teacher-".length) as TeacherId;
    return this.controllers.has(id) ? id : null;
  }

  interactableFor(id: TeacherId) {
    return this.controllers.get(id)?.interactable;
  }

  clearCooldown(id: TeacherId): void {
    this.memory.startCooldown(id, 0);
  }

  /** Development hook used to exercise the authored memory branches. */
  seedMemory(
    id: TeacherId,
    input: { encounters?: number; warnings?: number; lastOutcome?: "positive" | "neutral" | "warning" | "disciplined" },
  ): void {
    const memory = this.memory.memoryFor(id);
    if (typeof input.encounters === "number" && Number.isFinite(input.encounters)) {
      memory.encounters = Math.max(0, Math.min(9_999, Math.floor(input.encounters)));
    }
    if (typeof input.warnings === "number" && Number.isFinite(input.warnings)) {
      memory.warnings = Math.max(0, Math.min(999, Math.floor(input.warnings)));
    }
    if (input.lastOutcome) memory.lastOutcome = input.lastOutcome;
  }

  configure(id: TeacherId, patch: TeacherConfigPatch): boolean {
    const controller = this.controllers.get(id);
    if (!controller) return false;
    const config = this.patrol.configure(id, patch);
    controller.config.personality = config.personality;
    controller.config.gender = config.gender;
    controller.config.speed = config.speed;
    controller.config.patrolAreas = [...config.patrolAreas];
    if (patch.patrolAreas) {
      controller.setPatrolArea(this.patrol.areaFor(id));
    }
    return true;
  }

  setTimetablePhase(phase: SchoolTime["phase"] | null): void {
    this.timetable.setPinned(phase);
  }

  /** CLASS BUNK difficulty selects who is actually on patrol. */
  setActiveSubset(ids: readonly TeacherId[] | null): void {
    const allowed = ids ? new Set<TeacherId>(ids) : null;
    for (const controller of this.controllers.values()) {
      const active = !allowed || allowed.has(controller.id);
      controller.rig.group.visible = active;
      controller.interactable.active = active;
      controller.rig.indicator.visible = false;
    }
    this.group.visible = this.enabled;
  }

  /** Night difficulty scales the real patrol speed of every active teacher. */
  setSpeedScale(scale: number): void {
    const safe = Math.max(0.4, Math.min(2, scale));
    for (const controller of this.controllers.values()) controller.speedScale = safe;
  }

  /** Public catch-approach used by MESS MEAL SNEAK while the player is frozen. */
  approachCaughtPlayer(id: TeacherId, dt: number, x: number, z: number): boolean {
    const controller = this.controllers.get(id);
    if (!controller) return false;
    return controller.approachCaughtPlayer(dt, x, z, this.world.colliders, this.world.bounds).arrived;
  }

  setEnabled(enabled: boolean): void {
    if (this.enabled === enabled) return;
    this.enabled = enabled;
    this.group.visible = enabled;
    if (!enabled) {
      for (const controller of this.controllers.values()) {
        controller.interactable.active = false;
        controller.rig.indicator.visible = false;
      }
    }
  }

  update(dt: number, elapsed: number, context: TeacherSystemContext): void {
    if (!this.enabled) return;
    const time = this.timetable.at(context.playtime);
    this.lastTime = time;
    const area = classifyCampusArea(context.player.x, context.player.z, context.houseHostel);
    this.lastArea = areaLabel(area);
    const violation = !this.timetable.allows(time.phase, area);
    this.lastViolation = violation;

    if (context.mode === "dialogue" && this.active) {
      const controller = this.controllers.get(this.active);
      controller?.updateTalkOnly(dt, elapsed, context.player.x, context.player.z);
      this.syncDiscipline(context);
      return;
    }

    if (context.mode === "frozen") return;

    const positions = [...this.controllers.values()].map((controller) => controller.position);
    for (const controller of this.controllers.values()) {
      // Hidden challenge subsets must not expose an invisible interaction.
      if (!controller.rig.group.visible) {
        controller.interactable.active = false;
        continue;
      }
      const isTalking = this.active === controller.id;
      if (isTalking) {
        controller.updateTalkOnly(dt, elapsed, context.player.x, context.player.z);
        continue;
      }
      // Supporting NPCs far from the player update at 4 Hz, while keeping
      // accumulated time so their patrol speed does not depend on frame rate.
      const dx = controller.position.x - context.player.x;
      const dz = controller.position.z - context.player.z;
      let stepDt = dt;
      if (dx * dx + dz * dz > 30 * 30) {
        this.farUpdate[controller.id] += dt;
        if (this.farUpdate[controller.id] < 0.25) continue;
        stepDt = this.farUpdate[controller.id];
        this.farUpdate[controller.id] = 0;
      } else {
        this.farUpdate[controller.id] = 0;
      }
      const cooldownReady = this.memory.canEncounter(controller.id);
      const lineOfSight = this.world.hasLineOfSight(
        controller.position.x,
        controller.position.z,
        context.player.x,
        context.player.z,
      );
      const others = positions.filter((position) => position !== controller.position);
      const routine = npcScheduleFor(npcProfileForTeacher(controller.id), time.phase);
      controller.update(stepDt, elapsed, {
        playerX: context.player.x,
        playerZ: context.player.z,
        playerBusy: Boolean(this.active),
        cooldownReady,
        lineOfSight,
        colliders: this.world.colliders,
        bounds: this.world.bounds,
        otherTeachers: others,
        talking: false,
        mood: controller.config.personality === "strict" ? "stern" : "calm",
        routineActivity: routine.activity,
        routineArea: routine.area,
      });

      const loops = controller.routeLoopCount;
      if (loops > this.lastLoops[controller.id]) {
        this.lastLoops[controller.id] = loops;
        if (controller.config.patrolAreas.length > 1) {
          controller.setPatrolArea(this.patrol.advanceArea(controller.id));
        }
      }
    }

    this.syncDiscipline(context);
  }

  startConversation(id: TeacherId, context: TeacherSystemContext): DialogueView | null {
    const controller = this.controllers.get(id);
    const identity = this.identity.fromProfile(context.profile);
    if (!controller || !identity) return null;
    if (this.active) return null;
    if (!this.memory.canEncounter(id)) return null;
    const time = this.timetable.at(context.playtime);
    const area = classifyCampusArea(context.player.x, context.player.z, context.houseHostel);
    this.active = id;
    this.lastArea = areaLabel(area);
    this.lastViolation = !this.timetable.allows(time.phase, area);
    controller.startTalking(controller.config.personality === "strict" ? "stern" : "calm");
    controller.interactable.active = false;
    controller.rig.indicator.visible = false;
    return this.dialogue.start({
      config: controller.config,
      identity,
      area,
      time,
      violation: this.lastViolation,
      warningsBefore: this.memory.warningsFor(id),
    });
  }

  choose(index: number): {
    view: DialogueView;
    ended: boolean;
    warning: boolean;
    disciplineStarted: boolean;
    reputationDelta: number;
    notice: string | null;
    answer: string;
    principalReferral: boolean;
    referralReason: string | null;
  } | null {
    if (!this.active) return null;
    const result = this.dialogue.choose(index);
    if (!result) return null;
    const controller = this.controllers.get(this.active);
    if (controller) {
      const mood = result.view.teacher?.mood ?? "calm";
      controller.startTalking(mood);
    }
    return result;
  }

  advance(): boolean {
    const ended = this.dialogue.advance();
    if (ended) this.finishConversation();
    return ended;
  }

  currentDialogueView(): DialogueView {
    return this.dialogue.currentView();
  }

  closeConversation(): void {
    if (!this.active) return;
    this.finishConversation();
  }

  private finishConversation(): void {
    const id = this.active;
    if (!id) return;
    this.dialogue.end();
    this.active = null;
    const controller = this.controllers.get(id);
    if (controller) {
      controller.stopTalking(true);
      this.memory.startCooldown(id, 40_000);
    }
  }

  toSave(): TeacherSave {
    return this.memory.toSave();
  }

  reset(saved?: TeacherSave): void {
    this.memory = new TeacherMemoryManager(saved);
    this.dialogue = new TeacherDialogueManager(this.memory, this.personality);
    this.active = null;
    this.disciplineAnnounced = false;
    this.disciplineResolution = null;
    for (const controller of this.controllers.values()) {
      controller.stopTalking(false);
    }
  }

  disciplineView(now = Date.now()): DisciplineView | null {
    const save = this.memory.toSave();
    const discipline = save.discipline;
    if (!discipline.active || !discipline.task) {
      this.disciplineAnnounced = false;
      return null;
    }
    const controller = this.controllers.get(discipline.teacherId as TeacherId);
    const secondsLeft = Math.max(0, Math.ceil((discipline.deadlineAt - now) / 1000));
    return {
      active: true,
      teacherName: controller?.config.name ?? "Teacher",
      task: "Report to your house hostel",
      secondsLeft,
    };
  }

  /** Engine drains this to produce one clear, non-punitive HUD notice. */
  consumeDisciplineResolution(): "completed" | "missed" | null {
    const result = this.disciplineResolution;
    this.disciplineResolution = null;
    return result;
  }

  /** True once when a new task is assigned, so the engine can announce it. */
  consumeDisciplineAssignment(): boolean {
    const view = this.disciplineView();
    if (view && !this.disciplineAnnounced) {
      this.disciplineAnnounced = true;
      return true;
    }
    return false;
  }

  snapshot() {
    return {
      activeTeacherId: this.active,
      area: this.lastArea,
      violation: this.lastViolation,
      time: {
        phase: this.lastTime.phase,
        label: this.lastTime.label,
        clock: this.lastTime.clock,
        pinned: this.timetable.pinnedPhase,
      },
      reputation: this.memory.reputation,
      reputationLabel: this.memory.reputationLabel(),
      warnings: Object.fromEntries(
        TEACHER_IDS.map((id) => [id, this.memory.warningsFor(id)]),
      ),
      cooldowns: Object.fromEntries(
        TEACHER_IDS.map((id) => [id, this.memory.cooldownRemaining(id)]),
      ),
      discipline: this.disciplineView(),
      npcProfiles: allNpcProfiles().map((profile) => {
        const at = npcProfileAt(profile, this.lastTime.phase);
        return {
          npcId: at.npcId,
          name: at.name,
          role: at.role,
          subject: at.subject,
          personality: at.personality,
          patrolArea: at.patrolArea,
          currentActivity: at.currentActivity,
          activeStatus: at.activeStatus,
          missionReferences: at.missionReferences,
        };
      }),
      teachers: this.allTeachers().map((teacher) => teacher.snapshot()),
      dialogue: this.active ? this.dialogue.currentView() : null,
    };
  }

  playerIdentity(profile: PlayerProfileSave | null): StudentIdentity | null {
    return this.identity.fromProfile(profile);
  }

  /**
   * Development-only fixed-step patrol audit. It runs the same controller and
   * real campus colliders without waiting for render frames, then reports
   * whether any teacher ever ended a step inside geometry.
   */
  simulatePatrol(seconds = 60): { steps: number; collisions: number; loops: Record<string, number> } {
    const steps = Math.max(1, Math.min(6_000, Math.round(seconds * 30)));
    let collisions = 0;
    const far = new THREE.Vector3(999, 0, 999);
    for (let step = 0; step < steps; step += 1) {
      const positions = this.allTeachers().map((teacher) => teacher.position);
      for (const controller of this.controllers.values()) {
        const others = positions.filter((position) => position !== controller.position);
        controller.update(1 / 30, step / 30, {
          playerX: far.x,
          playerZ: far.z,
          playerBusy: false,
          cooldownReady: false,
          lineOfSight: false,
          colliders: this.world.colliders,
          bounds: this.world.bounds,
          otherTeachers: others,
          talking: false,
          mood: controller.config.personality === "strict" ? "stern" : "calm",
          routineActivity: "patrolling",
          routineArea: controller.patrolArea,
        });
        if (collidesAt(controller.position.x, controller.position.z, this.world.colliders)) {
          collisions += 1;
        }
      }
    }
    return {
      steps,
      collisions,
      loops: Object.fromEntries(
        this.allTeachers().map((controller) => [controller.id, controller.routeLoopCount]),
      ),
    };
  }

  dispose(): void {
    for (const controller of this.controllers.values()) {
      const index = this.world.interactables.indexOf(controller.interactable);
      if (index >= 0) this.world.interactables.splice(index, 1);
      controller.dispose();
      this.group.remove(controller.rig.group, controller.rig.tag, controller.rig.indicator);
    }
    this.controllers.clear();
    this.group.parent?.remove(this.group);
  }

  private syncDiscipline(context: TeacherSystemContext): void {
    const view = this.disciplineView();
    if (!view) return;
    if (context.insideHouseHostel) {
      this.memory.completeDiscipline();
      this.disciplineResolution = "completed";
      this.disciplineAnnounced = false;
      return;
    }
    if (view.secondsLeft <= 0) {
      this.memory.failDiscipline();
      this.disciplineResolution = "missed";
      this.disciplineAnnounced = false;
    }
  }
}
