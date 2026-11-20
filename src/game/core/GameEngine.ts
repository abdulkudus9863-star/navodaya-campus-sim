import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { FXAAShader } from "three/examples/jsm/shaders/FXAAShader.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { AudioSystem } from "./AudioSystem";
import { GameStore } from "./GameStore";
import { InputController } from "./InputController";
import { SaveSystem, sanitizeCharacter, sanitizeSettings } from "./SaveSystem";
import {
  QUALITY_PROFILES,
  clampNumber,
  nextLowerQuality,
  qualityProfile,
  resolveAutoQuality,
} from "./graphics";
import {
  DEFAULT_CHARACTER,
  MISSION_STEPS,
  UNIFORM_COLORS,
  emptyNightSave,
  type CharacterSettings,
  type DialogueView,
  type DisciplineView,
  type GameSettings,
  type GardenDutyView,
  type NightResultView,
  type NoticeView,
  type PlayerProfileSave,
  type Quality,
  type QualityPreference,
  type SaveData,
  type ShadowQuality,
} from "./types";
import { CameraController } from "../systems/CameraController";
import { InteractionSystem } from "../systems/InteractionSystem";
import { MissionSystem } from "../systems/MissionSystem";
import { NightMissionSystem } from "../systems/NightMissionSystem";
import { ExplorationSystem } from "../systems/ExplorationSystem";
import { NPCSystem } from "../systems/NPCSystem";
import { TeacherSystem } from "../teachers/TeacherSystem";
import { emptyTeacherSave, isTeacherId, type TeacherId } from "../data/teachers";
import { PrincipalReferralSystem } from "../systems/PrincipalReferralSystem";
import { PrincipalDialogue } from "../systems/PrincipalDialogue";
import { ClassBunkSystem } from "../systems/ClassBunkSystem";
import { MessMealSystem } from "../systems/MessMealSystem";
import {
  MESS_MEAL_CAUGHT_FOLLOW_UP,
  MESS_MEAL_CAUGHT_LINE,
  MESS_MEAL_DIFFICULTIES,
  isMessMealDifficulty,
  type MessMealDifficulty,
} from "../data/messMeal";
import {
  CLASS_BUNK_CAUGHT_LINE,
  CLASS_BUNK_DIFFICULTIES,
  isClassBunkDifficulty,
  type ClassBunkDifficulty,
} from "../data/classBunk";
import { PRINCIPAL } from "../data/principal";
import { PlayerController, collidesAt } from "../systems/PlayerController";
import { WorldEnvironment, type WorldZone } from "../world/WorldEnvironment";
import { MultiplayerLayer } from "../world/MultiplayerLayer";
import {
  MP_START_POINT,
  MP_SYNC_INTERVAL,
  MP_VEGETABLE_COUNT,
  isInsideSafeZone,
  type MultiplayerAdapter,
  type MultiplayerLocalState,
  type MultiplayerRemotePlayer,
} from "../data/multiplayer";
import { DEFAULT_HOUSE_ID, HOUSES, getHouse, type HouseId } from "../data/houses";
import type { LiveMapSnapshot } from "../data/liveMap";
import {
  STUDENT_ROSTER,
  getStudent,
  getStudentsForHouse,
  inspectRosterIntegrity,
  validateCharacterSelection,
} from "../data/students";
import { awardProgress, newPlayerProfile, toProfileView } from "../data/profile";
import { GARDEN_ITEMS, NIGHT_STEPS, gardenItem, type GardenItemId } from "../data/night";
import {
  ESCAPE_LEVELS,
  buildEscapeCourse,
  calculateEscapeScore,
  emptyEscapeSave,
  escapeAchievementsForRun,
  getEscapeLevel,
  getEscapeRecord,
  isEscapeDifficulty,
  isEscapeLevelId,
  sanitizeEscape,
  type EscapeCheckpointSave,
  type EscapeDifficulty,
  type EscapeLevelId,
  type EscapeRunResult,
  type EscapeSave,
} from "../data/escape";

export const NOTICE_CONTENT: NoticeView = {
  title: "Navodaya Vidyalaya",
  subtitle: "Notice Board · Term II · All Houses",
  items: [
    {
      heading: "Morning Assembly",
      body: "All residents on the assembly ground by 6:20 AM. House colours compulsory from Monday.",
    },
    {
      heading: "Class VII-A",
      body: "Report to Room 12 in the academic block after assembly. Bring your geography notebook.",
    },
    {
      heading: "Library",
      body: "Reading room stays open until 8:00 PM. Return borrowed books before Friday evening.",
    },
    {
      heading: "Mess Committee",
      body: "The new menu is posted beside the dining hall door. Feedback slips go to your house prefect.",
    },
  ],
};

const SHADOW_QUALITY_TO_SIZE: Record<ShadowQuality, number> = {
  off: 0,
  low: 512,
  medium: 1024,
  high: 2048,
};

export class GameEngine {
  private container: HTMLElement;
  private store: GameStore;
  private saveSystem = new SaveSystem();
  private scene = new THREE.Scene();
  private renderer: THREE.WebGLRenderer | null = null;
  private composer: EffectComposer | null = null;
  private fxaaPass: ShaderPass | null = null;
  private environmentTexture: THREE.Texture | null = null;
  private cameraController: CameraController;
  private world: WorldEnvironment;
  private player: PlayerController;
  private input: InputController;
  private interaction: InteractionSystem;
  private npc = new NPCSystem();
  private teachers: TeacherSystem | null = null;
  private principalReferral: PrincipalReferralSystem | null = null;
  private principalDialogue = new PrincipalDialogue();
  private principalReferralTimer = 0;
  private classBunk = new ClassBunkSystem();
  private classBunkHudTimer = 0;
  private classBunkCompleted = 0;
  private bunkPrincipalAutoOpened = false;
  private messMeal = new MessMealSystem();
  private messMealHudTimer = 0;
  private messMealCompleted = 0;
  private messPrincipalAutoOpened = false;
  private messCaughtStage: "approach" | null = null;
  private messCaughtTeacherId: TeacherId | null = null;
  private messCaughtTimer = 0;
  private mission = new MissionSystem();
  private night = new NightMissionSystem();
  private exploration = new ExplorationSystem();
  private mapReturnScreen: "playing" | "paused" = "playing";
  private gardenDuty: { active: boolean; watered: Set<GardenItemId>; total: number } | null = null;
  private gardenDutyTimer: number | null = null;
  private audio = new AudioSystem();
  private profile: PlayerProfileSave | null = null;
  private identityProgressSink: ((achievementId: string) => void) | null = null;
  private escapeData: EscapeSave | null = null;
  private nightMode = false;
  private nightCaughtHandled = false;
  private suspicion = 0;
  private nightHudTimer = 0;
  private disciplineHudTimer = 0;
  private crouching = false;
  private dialogueSource:
    | "meera"
    | "night"
    | "caught"
    | "teacher"
    | "principal"
    | "bunk-caught"
    | "mess-caught"
    | null = null;
  private teacherDialogueId: TeacherId | null = null;
  private lastDiscipline: DisciplineView | null = null;
  private dialogueAnchor = new THREE.Vector3();

  private multiplayer: {
    adapter: MultiplayerAdapter;
    layer: MultiplayerLayer;
    syncTimer: number;
    idleTimer: number;
    lastSync: MultiplayerLocalState | null;
    collectedCount: number;
    extractionRequested: boolean;
    collectCooldown: number;
    frozen: boolean;
  } | null = null;

  private clock = new THREE.Clock();
  private raf = 0;
  private elapsed = 0;
  private playtime = 0;
  private quality: Quality;
  private autoQuality: Quality;
  private autoAdjusted = false;
  private highFpsSeconds = 0;
  private lastRenderWidth = 0;
  private lastRenderHeight = 0;
  private lastRenderRatio = 0;
  private lastShadowType: THREE.ShadowMapType | null = null;
  private disposed = false;
  private initialized = false;
  private initError: string | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private toastTimer: number | null = null;
  private endingTimer: number | null = null;
  private pointerLockArmed = false;
  private debugApi: Record<string, unknown> | null = null;

  private fpsTime = 0;
  private fpsFrames = 0;
  private lowFpsSeconds = 0;

  constructor(container: HTMLElement, store: GameStore) {
    this.container = container;
    this.store = store;
    const state = store.getState();
    this.quality =
      state.settings.quality === "auto"
        ? resolveAutoQuality()
        : state.settings.quality;
    this.autoQuality = this.quality;
    const initialSettings = { ...state.settings };
    if (!state.hasSave && initialSettings.quality === "auto") {
      const profile = qualityProfile(this.quality);
      initialSettings.shadowQuality =
        this.quality === "low" ? "low" : this.quality === "medium" ? "medium" : "high";
      initialSettings.textureQuality = profile.texture;
      initialSettings.antialias = profile.antialias;
      initialSettings.effectsQuality = profile.effects;
      initialSettings.renderScale = 1;
      initialSettings.viewDistance = 1;
      store.setSettings(initialSettings);
    }

    this.world = new WorldEnvironment(initialSettings.textureQuality);
    this.scene.add(this.world.group);
    this.player = new PlayerController(state.character);
    this.scene.add(this.player.rig.group);
    this.cameraController = new CameraController(this.aspect());
    this.interaction = new InteractionSystem(this.world);
    this.input = new InputController(state.isTouch);
    this.input.onPointerLockChange = (locked) => {
      this.store.patch({ pointerLocked: locked });
      if (locked) this.pointerLockArmed = true;
      if (!locked && this.pointerLockArmed) {
        const current = this.store.getState();
        if (current.screen === "playing" && !current.settingsOpen) this.pause();
      }
    };

    this.scene.background = new THREE.Color("#c6b69a");
    this.scene.fog = new THREE.FogExp2(0xccb591, qualityProfile(this.quality).fogDensity);

    try {
      // MSAA is handled by the FXAA post pass so antialiasing can be toggled at
      // runtime and weak phones can skip the extra full-screen pass entirely.
      const renderer = new THREE.WebGLRenderer({
        antialias: false,
        powerPreference: "high-performance",
        stencil: false,
      });
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.info.autoReset = false;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.06;
      renderer.shadowMap.enabled = initialSettings.shadowQuality !== "off";
      renderer.shadowMap.type =
        initialSettings.shadowQuality === "high"
          ? THREE.PCFSoftShadowMap
          : initialSettings.shadowQuality === "medium"
            ? THREE.PCFShadowMap
            : THREE.BasicShadowMap;
      renderer.domElement.style.display = "block";
      renderer.domElement.style.width = "100%";
      renderer.domElement.style.height = "100%";
      renderer.domElement.style.touchAction = "none";
      renderer.domElement.style.outline = "none";
      renderer.domElement.setAttribute("aria-label", "Navodaya campus, interactive 3D view");
      this.renderer = renderer;
      container.appendChild(renderer.domElement);

      // A neutral image-based light layer gives glass, brass and painted metal
      // a believable response without shipping HDR files.
      try {
        const pmrem = new THREE.PMREMGenerator(renderer);
        const room = new RoomEnvironment();
        const target = pmrem.fromScene(room, 0.04);
        this.environmentTexture = target.texture;
        this.scene.environment = target.texture;
        this.scene.environmentIntensity = 0.42;
        room.traverse((object) => {
          if (object instanceof THREE.Mesh) {
            object.geometry.dispose();
            const materials = Array.isArray(object.material) ? object.material : [object.material];
            for (const material of materials) material.dispose();
          }
        });
        pmrem.dispose();
      } catch {
        /* environment lighting is an enhancement; direct lights still work */
      }
    } catch (error) {
      this.initError = error instanceof Error ? error.message : "WebGL could not start";
    }

    this.setupComposer();
    this.cameraController.setViewDistance(initialSettings.viewDistance);
    this.applySize();
    this.input.attach(rendererCanvas(this.renderer));
    this.input.setEnabled(false);
    this.world.setGraphics(
      this.quality,
      initialSettings.shadowQuality,
      initialSettings.textureQuality,
    );
    this.applyRenderState();
    window.addEventListener("keydown", this.handleGlobalKeyDown);
    window.addEventListener("pagehide", this.handlePageHide);
    document.addEventListener("visibilitychange", this.handleVisibility);
  }

  private aspect(): number {
    const width = this.container.clientWidth || 1;
    const height = this.container.clientHeight || 1;
    return width / height;
  }

  private setupComposer(): void {
    if (!this.renderer) return;
    const composer = new EffectComposer(this.renderer);
    composer.addPass(new RenderPass(this.scene, this.cameraController.camera));
    composer.addPass(new OutputPass());
    const fxaa = new ShaderPass(FXAAShader);
    fxaa.material.uniforms.resolution.value.set(1, 1);
    composer.addPass(fxaa);
    this.composer = composer;
    this.fxaaPass = fxaa;
  }

  private applySize(): void {
    const width = this.container.clientWidth || 1;
    const height = this.container.clientHeight || 1;
    if (!this.renderer) return;
    const settings = this.store.getState().settings;
    const profile = qualityProfile(this.quality);
    const scale = clampNumber(settings.renderScale, 0.6, 1);
    // Antialiasing works as a supersampling ceiling as well as an FXAA toggle;
    // disabling it lets the weakest phones render at native CSS pixels.
    const antialiasCap = settings.antialias ? profile.dprCap : 1;
    const ratio = Math.min(window.devicePixelRatio || 1, antialiasCap) * scale;
    const unchanged =
      width === this.lastRenderWidth &&
      height === this.lastRenderHeight &&
      Math.abs(ratio - this.lastRenderRatio) < 0.0001;
    if (unchanged) return;
    this.lastRenderWidth = width;
    this.lastRenderHeight = height;
    this.lastRenderRatio = ratio;
    this.renderer.setPixelRatio(ratio);
    this.renderer.setSize(width, height, false);
    if (this.composer) {
      this.composer.setPixelRatio(ratio);
      this.composer.setSize(width, height);
      this.fxaaPass?.material.uniforms.resolution.value.set(
        1 / Math.max(1, width * ratio),
        1 / Math.max(1, height * ratio),
      );
    }
    this.cameraController.resize(width / height);
  }

  private applyRenderState(): void {
    if (!this.renderer) return;
    const settings = this.store.getState().settings;
    const shadowEnabled = settings.shadowQuality !== "off";
    const shadowType =
      settings.shadowQuality === "high"
        ? THREE.PCFSoftShadowMap
        : settings.shadowQuality === "medium"
          ? THREE.PCFShadowMap
          : THREE.BasicShadowMap;
    if (
      this.renderer.shadowMap.enabled !== shadowEnabled ||
      this.lastShadowType !== shadowType
    ) {
      this.renderer.shadowMap.enabled = shadowEnabled;
      this.renderer.shadowMap.type = shadowType;
      this.lastShadowType = shadowType;
      this.scene.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          for (const material of materials) material.needsUpdate = true;
        }
      });
    }
    this.renderer.toneMappingExposure =
      settings.effectsQuality === "high" ? 1.06 : settings.effectsQuality === "medium" ? 1.04 : 1.01;
    if (this.fxaaPass) this.fxaaPass.enabled = settings.antialias;
    this.cameraController.setViewDistance(settings.viewDistance);
    this.world.setEffectsQuality(settings.effectsQuality);
  }

  private renderFrame(): void {
    if (!this.renderer) return;
    const settings = this.store.getState().settings;
    this.renderer.info.reset();
    if (this.composer && settings.antialias) {
      this.composer.render();
    } else {
      this.renderer.render(this.scene, this.cameraController.camera);
    }
  }

  async init(): Promise<void> {
    if (this.initError) {
      this.store.setLoad({
        status: "error",
        progress: 0,
        stage: "Unable to start",
        error: this.initError,
      });
      return;
    }

    this.store.setLoad({ status: "loading", progress: 0, stage: "Preparing the campus" });
    try {
      this.store.patch({ quality: this.quality });
      await this.world.build((progress, stage) => {
        if (this.disposed) return;
        this.store.setLoad({ status: "loading", progress, stage });
      });
      if (this.disposed) return;

      this.teachers = new TeacherSystem(this.world);
      this.teachers.attach(this.scene);
      this.principalReferral = new PrincipalReferralSystem(this.world.colliders);

      if (this.renderer) {
        try {
          await this.renderer.compileAsync(this.scene, this.cameraController.camera);
        } catch {
          /* compileAsync is an optimisation only */
        }
      }
      this.applySize();

      this.resizeObserver = new ResizeObserver(() => this.applySize());
      this.resizeObserver.observe(this.container);

      const saved = this.saveSystem.load();
      if (saved.ok) {
        this.profile = saved.data.profile;
        this.escapeData = saved.data.escape;
        this.store.hydrateSave(saved.data);
        this.store.patch({
          playtime: Math.round(saved.data.playtime),
          profile: toProfileView(saved.data.profile),
          escapeSave: saved.data.escape,
        });
        this.applySettings(saved.data.settings, { announce: false });
        this.store.setCharacter(saved.data.character);
        const house = getHouse(saved.data.profile.houseId);
        this.player.setCharacter(saved.data.character, house?.color);
        this.world.setHouse(saved.data.profile.houseId);
        this.world.setPlayerCharacterId(saved.data.profile.characterId);
        this.mission.setHouseName(house?.shortName ?? "your house");
        this.exploration.restore(saved.data.exploration);
        this.teachers?.reset(saved.data.teachers);
        this.principalReferral?.restore(saved.data.principalReferral, saved.data.player.position);
        this.store.patch({ principalReferral: this.principalReferral?.view(this.player.position) ?? null });
        this.refreshExploration();
      } else {
        this.store.patch({ hasSave: false });
        if (saved.reason === "corrupt") {
          this.showToast("A damaged save was discarded. Starting fresh.");
        }
      }

      this.world.showMarker(null, true);
      this.initialized = true;
      this.store.setLoad({ status: "ready", progress: 1, stage: "Ready" });
      this.store.setScreen("menu");
      this.store.setMission(this.mission.view());
      this.installDebugApi();
      this.syncDisciplineHud(true);
      this.clock.start();
      this.raf = requestAnimationFrame(this.tick);
    } catch (error) {
      this.store.setLoad({
        status: "error",
        progress: 0,
        stage: "Unable to build the campus",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  /**
   * Development-only hooks used by the automated browser smoke test. They are
   * stripped from production builds and never expose account or network data.
   */
  private installDebugApi(): void {
    if (!import.meta.env.DEV) return;
    const engine = this;
    const api = {
      teleport(x: number, z: number, rotationY = Math.PI) {
        engine.player.placeAt(new THREE.Vector3(x, 0, z), rotationY);
        engine.cameraController.resetToPlayer(engine.player.position, rotationY);
      },
      snapshot() {
        const state = engine.store.getState();
        return {
          screen: state.screen,
          step: engine.mission.stepIndex,
          done: engine.mission.done,
          prompt: state.prompt,
          fps: state.fps,
          quality: {
            preference: state.settings.quality,
            effective: engine.quality,
            shadow: state.settings.shadowQuality,
            renderScale: state.settings.renderScale,
            viewDistance: state.settings.viewDistance,
            texture: state.settings.textureQuality,
            antialias: state.settings.antialias,
            effects: state.settings.effectsQuality,
          },
          render: engine.renderer
            ? {
                calls: engine.renderer.info.render.calls,
                triangles: engine.renderer.info.render.triangles,
                geometries: engine.renderer.info.memory.geometries,
                textures: engine.renderer.info.memory.textures,
                pixelRatio: Number(engine.renderer.getPixelRatio().toFixed(3)),
                shadowMap: engine.renderer.shadowMap.type,
                fxaa: Boolean(engine.composer && state.settings.antialias),
              }
            : null,
          position: { x: engine.player.position.x, y: engine.player.position.y, z: engine.player.position.z },
          playerRotation: engine.player.rotationY,
          grounded: engine.player.grounded,
          moving: engine.player.moving,
          running: engine.player.running,
          speed: Number(engine.player.currentSpeed.toFixed(2)),
          character: engine.store.getState().character,
          camera: {
            yaw: engine.cameraController.yaw,
            viewYaw: engine.cameraController.getViewYaw(),
            pitch: engine.cameraController.pitch,
            distance: engine.cameraController.distance,
            viewDistance: engine.cameraController.getDistance(),
            renderedDistance: engine.cameraController.getRenderedDistance(engine.player.position),
            overview: engine.cameraController.isOverview,
          },
          ending: Boolean(state.ending),
          profileOpen: state.profileOpen,
          planOpen: state.planOpen,
          campusMapOpen: state.campusMapOpen,
          discovered: engine.exploration.toSave().discovered,
          crouching: engine.crouching,
          gardenDuty: engine.gardenDuty
            ? {
                active: engine.gardenDuty.active,
                watered: [...engine.gardenDuty.watered],
                total: engine.gardenDuty.total,
              }
            : null,
          houseId: engine.profile?.houseId ?? null,
          characterId: engine.profile?.characterId ?? null,
          xp: engine.profile?.xp ?? 0,
          multiplayer: engine.multiplayer
            ? {
                collected: engine.multiplayer.collectedCount,
                frozen: engine.multiplayer.frozen,
                remotes: engine.multiplayer.layer.snapshot(),
              }
            : null,
          teachers: engine.teachers?.snapshot() ?? null,
          principalReferral:
            engine.principalReferral?.isActive
              ? engine.principalReferral.view(engine.player.position)
              : null,
          principalChamber: engine.world.isInsidePrincipalChamber(engine.player.position),
          night: {
            mode: engine.nightMode,
            active: engine.night.active,
            step: engine.night.stepIndex,
            collected: [...engine.night.collected],
            suspicion: Number(engine.suspicion.toFixed(2)),
            hidden: engine.world.patrolDetection.hidden,
            caught: engine.night.caught,
            success: engine.night.success,
          },
        };
      },
      assign(houseId: string, characterId: string) {
        return engine.startNewGameWith(houseId, characterId);
      },
      escape: {
        open() {
          return engine.openEscape();
        },
        close() {
          engine.closeEscape();
        },
        select(levelId: string, difficulty: string) {
          if (!isEscapeLevelId(levelId) || !isEscapeDifficulty(difficulty)) return false;
          engine.setEscapeSelection(levelId, difficulty);
          return true;
        },
        snapshot() {
          const data = engine.escapeData;
          return {
            screen: engine.store.getState().screen,
            difficulty: data?.difficulty ?? null,
            lastLevelId: data?.lastLevelId ?? null,
            records: data?.records ? [...data.records] : [],
            achievements: data?.achievements ? [...data.achievements] : [],
            checkpoint: data?.checkpoint ? { ...data.checkpoint } : null,
            profileAchievements: engine.profile ? [...engine.profile.achievements] : [],
            xp: engine.profile?.xp ?? 0,
            houseId: engine.profile?.houseId ?? null,
          };
        },
      },
      save() {
        return engine.saveGame(false);
      },
      graphics(preset?: string, patch?: Partial<GameSettings>) {
        if (preset) {
          const allowed: QualityPreference[] = ["low", "medium", "high", "ultra", "auto"];
          if (!allowed.includes(preset as QualityPreference)) return false;
          engine.setGraphicsPreset(preset as QualityPreference);
        }
        if (patch) engine.setSettings({ ...engine.store.getState().settings, ...patch });
        return { ...engine.store.getState().settings, effective: engine.quality };
      },
      choosePlan(choice: "explore" | "stealth" | "later") {
        return engine.choosePlan(choice);
      },
      openMap() {
        return engine.openCampusMap();
      },
      closeMap() {
        engine.closeCampusMap();
      },
      travel(id: string) {
        return engine.travelToCampusLocation(id);
      },
      exploration() {
        return {
          save: engine.exploration.toSave(),
          map: engine.profile
            ? engine.exploration.mapView(
                engine.profile.houseId,
                engine.player.position.x,
                engine.player.position.z,
              )
            : null,
        };
      },
      worldState() {
        return engine.world.inspect();
      },
      teachers: {
        snapshot() {
          return engine.teachers?.snapshot() ?? null;
        },
        identity() {
          return engine.teachers?.playerIdentity(engine.profile) ?? null;
        },
        clearCooldown(id: string) {
          if (!isTeacherId(id)) return false;
          engine.teachers?.clearCooldown(id);
          return true;
        },
        simulatePatrol(seconds: number) {
          return engine.teachers?.simulatePatrol(seconds) ?? null;
        },
        seedMemory(id: string, input: Record<string, unknown>) {
          if (!isTeacherId(id)) return false;
          engine.teachers?.seedMemory(id, input);
          return true;
        },
        configure(id: string, patch: Record<string, unknown>) {
          if (!engine.teachers || !isTeacherId(id)) return false;
          return engine.teachers.configure(id, patch);
        },
        setPhase(phase: string | null) {
          const allowed = [
            "assembly",
            "class",
            "break",
            "lunch",
            "games",
            "prep",
            "dinner",
            "hostel",
          ];
          if (phase !== null && !allowed.includes(phase)) return false;
          engine.teachers?.setTimetablePhase(phase as Parameters<TeacherSystem["setTimetablePhase"]>[0]);
          return true;
        },
        teleport(id: string) {
          const controller = engine.teachers?.teacher(id as TeacherId);
          if (!controller || !engine.teachers) return false;
          const offset = 2.45;
          const x = controller.position.x + Math.sin(controller.rotation) * offset;
          const z = controller.position.z + Math.cos(controller.rotation) * offset;
          engine.player.placeAt(new THREE.Vector3(x, 0, z), controller.rotation + Math.PI);
          engine.cameraController.resetToPlayer(engine.player.position, engine.player.rotationY);
          return true;
        },
        talk(id: string) {
          if (!engine.teachers) return false;
          const teacherId = id as TeacherId;
          if (!engine.teachers.teacher(teacherId)) return false;
          engine.openTeacherDialogue(teacherId);
          return engine.store.getState().screen === "dialogue";
        },
        choose(index: number) {
          engine.chooseDialogue(index);
          return engine.store.getState().dialogue;
        },
        advance() {
          engine.advanceDialogue();
          return engine.store.getState().dialogue;
        },
        close() {
          engine.closeDialogue();
          return engine.store.getState().screen;
        },
      },
      principal: {
        snapshot() {
          return {
            save: engine.principalReferral?.toSave() ?? null,
            view: engine.principalReferral?.view(engine.player.position) ?? null,
            chamber: engine.world.isInsidePrincipalChamber(engine.player.position),
            screen: engine.store.getState().screen,
          };
        },
        assign(teacherId = "dinesh") {
          const teacher = engine.teachers?.teacher(teacherId as TeacherId);
          if (!engine.principalReferral || !engine.profile) return false;
          const ok = engine.principalReferral.assign({
            teacherId,
            teacherName: teacher?.config.name ?? "Dinesh Sir",
            reason: "Disrespectful reply during class",
            player: engine.player.position,
            now: Date.now(),
          });
          if (ok) {
            engine.principalReferral.update(engine.player.position, 0);
            engine.store.patch({ principalReferral: engine.principalReferral.view(engine.player.position) });
          }
          return ok;
        },
        refresh() {
          if (!engine.principalReferral?.isActive) return null;
          engine.principalReferral.update(engine.player.position, 10);
          const view = engine.principalReferral.view(engine.player.position);
          engine.store.patch({ principalReferral: view });
          return view;
        },
        teleportToDoor() {
          engine.player.placeAt(new THREE.Vector3(15.35, 0, 42.8), 0);
          engine.cameraController.resetToPlayer(engine.player.position, 0);
        },
        teleportInside() {
          engine.player.placeAt(new THREE.Vector3(16.3, 0, 44.45), Math.PI);
          engine.cameraController.resetToPlayer(engine.player.position, Math.PI);
        },
        talk() {
          engine.openPrincipalDialogue();
          return engine.store.getState().dialogue;
        },
        choose(index: number) {
          engine.chooseDialogue(index);
          return engine.store.getState().dialogue;
        },
        advance() {
          engine.advanceDialogue();
          return engine.store.getState().screen;
        },
        close() {
          engine.closeDialogue();
          return engine.store.getState().screen;
        },
      },
      classBunk: {
        start(difficulty = "normal") {
          if (!isClassBunkDifficulty(difficulty)) return false;
          return engine.startClassBunk(difficulty);
        },
        snapshot() {
          return engine.classBunk.view();
        },
        teleport(id: string) {
          const objective = engine.classBunk.view().objectives.find((entry) => entry.id === id);
          if (!objective) return false;
          engine.player.placeAt(new THREE.Vector3(objective.x, 0, objective.z), 0);
          engine.cameraController.resetToPlayer(engine.player.position, 0);
          return true;
        },
        forceCatch(id = "dinesh") {
          if (!isTeacherId(id)) return false;
          const teacher = engine.teachers?.teacher(id);
          engine.classBunk.markCaught(id, teacher?.config.name ?? "A teacher");
          engine.handleClassBunkCaught(id);
          return true;
        },
        dismiss() {
          engine.dismissClassBunk();
        },
      },
      messMeal: {
        start(difficulty = "normal") {
          if (!isMessMealDifficulty(difficulty)) return false;
          return engine.startMessMeal(difficulty);
        },
        snapshot() {
          return engine.messMeal.view();
        },
        teleport(where = "next") {
          const view = engine.messMeal.view();
          const target =
            where === "meal"
              ? { x: -4, z: -42.2 }
              : where === "hostel"
                ? { x: engine.messMeal.targetPoint()?.x ?? -18, z: 36.8 }
                : where === "principal"
                  ? { x: 16.3, z: 44.45 }
                  : view.target;
          if (!target) return false;
          engine.player.placeAt(new THREE.Vector3(target.x, 0, target.z), 0);
          engine.cameraController.resetToPlayer(engine.player.position, 0);
          return true;
        },
        forceCatch(id = "dinesh") {
          if (!isTeacherId(id)) return false;
          const teacher = engine.teachers?.teacher(id);
          engine.messMeal.markCaught(id, teacher?.config.name ?? "A teacher");
          engine.handleMessCaught(id);
          return true;
        },
        finishApproach() {
          engine.openMessCaughtDialogue();
          return engine.store.getState().dialogue;
        },
        collect() {
          engine.collectMessMeal();
          return engine.messMeal.view();
        },
        dismiss() {
          engine.dismissMessMeal();
        },
      },
      roster() {
        return {
          count: STUDENT_ROSTER.length,
          integrity: inspectRosterIntegrity(),
          houses: HOUSES.map((house) => ({
            id: house.id,
            name: house.name,
            ids: getStudentsForHouse(house.id).map((student) => student.id),
            names: getStudentsForHouse(house.id).map((student) => student.displayName),
          })),
          surajs: STUDENT_ROSTER.filter((student) => student.displayName === "Suraj").map(
            (student) => ({ id: student.id, houseId: student.houseId, name: student.displayName }),
          ),
        };
      },
    };
    this.debugApi = api;
    (window as unknown as Record<string, unknown>).__navodaya = api;
  }

  private removeDebugApi(): void {
    if (!this.debugApi) return;
    const host = window as unknown as Record<string, unknown>;
    if (host.__navodaya === this.debugApi) delete host.__navodaya;
    this.debugApi = null;
  }

  // --------------------------------------------------------------- public API

  newGame(): void {
    void this.audio.unlock();
    this.audio.uiClick();
    this.audio.setNight(false);
    this.world.setNight(false);
    this.applyAtmosphere(false);
    this.nightMode = false;
    this.cancelGardenDuty(false);
    this.night = new NightMissionSystem();
    this.classBunk = new ClassBunkSystem();
    this.messMeal = new MessMealSystem();
    this.messCaughtStage = null;
    this.messCaughtTeacherId = null;
    this.messCaughtTimer = 0;
    this.messPrincipalAutoOpened = false;
    this.nightCaughtHandled = false;
    this.suspicion = 0;
    this.escapeData = null;
    this.teachers?.reset();
    this.principalReferral?.reset();
    this.principalDialogue.end();
    this.syncDisciplineHud(true);
    this.setCrouching(false);
    this.store.patch({
      screen: "creation",
      settingsOpen: false,
      profileOpen: false,
      dialogue: null,
      notice: null,
      ending: null,
      prompt: null,
      night: null,
      nightResult: null,
      gardenDuty: null,
      principalReferral: null,
      classBunk: null,
      messMeal: null,
      escapeSave: null,
    });
    this.input.setEnabled(false);
    this.input.reset();
    this.releasePointerLock();
    this.world.hideMarker();
  }

  cancelCreation(): void {
    if (this.store.getState().screen !== "creation") return;
    this.store.patch({ screen: "menu", profileOpen: false });
    this.input.setEnabled(false);
    this.input.reset();
    this.releasePointerLock();
    this.audio.uiClick();
  }

  /**
   * Commits an explicit house/student confirmation. This is the only entry to a
   * new game, so an invalid or mismatched house can never be persisted.
   */
  startNewGameWith(houseId: string, characterId: string): { ok: boolean; error?: string } {
    const validation = validateCharacterSelection(characterId, houseId);
    if (!validation.ok) return { ok: false, error: validation.error };
    const house = getHouse(houseId);
    if (!house) return { ok: false, error: "Unknown house." };
    void this.audio.unlock();
    const profile = newPlayerProfile(characterId, houseId, { achievements: ["house-colours"] });
    this.profile = profile;
    this.escapeData = emptyEscapeSave(profile.playerId);
    const view = toProfileView(profile);
    this.night = new NightMissionSystem();
    this.classBunk = new ClassBunkSystem();
    this.messMeal = new MessMealSystem();
    this.messCaughtStage = null;
    this.messCaughtTeacherId = null;
    this.messCaughtTimer = 0;
    this.messPrincipalAutoOpened = false;
    this.exploration.reset();
    this.nightMode = false;
    this.cancelGardenDuty(false);
    this.nightCaughtHandled = false;
    this.suspicion = 0;
    this.setCrouching(false);
    this.audio.setNight(false);
    this.world.setNight(false);
    this.applyAtmosphere(false);
    this.world.setHouse(house.id);
    this.world.setPlayerCharacterId(characterId);
    this.mission.setHouseName(house.shortName);
    const character = this.store.getState().character;
    this.player.setCharacter(character, house.color);
    this.player.resetToSpawn(this.world.spawn);
    this.mission.startNew();
    this.store.setMission(this.mission.view());
    this.principalReferral?.reset();
    this.principalDialogue.end();
    this.playtime = 0;
    for (const door of this.world.doors) door.setOpenInstant(false);
    this.store.patch({
      profile: view,
      playtime: 0,
      ending: null,
      night: null,
      nightResult: null,
      profileOpen: false,
      crouching: false,
      gardenDuty: null,
      principalReferral: null,
      classBunk: null,
      messMeal: null,
      exploration: this.explorationView(),
      planOpen: false,
      campusMapOpen: false,
      campusMap: null,
      cameraOverview: false,
      escapeSave: this.escapeData,
    });
    this.enterPlaying(true);
    this.saveGame(false);
    this.showToast(
      `Welcome, ${validation.student.displayName} — ${house.name}. Your hostel is on the south lawn.`,
    );
    this.openPlan();
    return { ok: true };
  }

  continueGame(): boolean {
    void this.audio.unlock();
    const saved = this.saveSystem.load();
    if (!saved.ok) {
      this.store.patch({ hasSave: false });
      this.showToast(
        saved.reason === "corrupt"
          ? "That save was damaged and has been cleared. Start a new game."
          : "No saved game was found.",
      );
      return false;
    }
    const data = saved.data;
    const profileView = toProfileView(data.profile);
    if (!profileView) {
      this.store.patch({ hasSave: false, profile: null });
      this.showToast("That save has an invalid house assignment. Start a new game.");
      this.newGame();
      return false;
    }
    this.profile = data.profile;
    this.escapeData = data.escape;
    this.applySettings(data.settings, { announce: false });
    this.store.setCharacter(data.character);
    const house = getHouse(data.profile.houseId);
    this.player.setCharacter(data.character, house?.color);
    this.world.setHouse(data.profile.houseId);
    this.world.setPlayerCharacterId(data.profile.characterId);
    this.mission.setHouseName(house?.shortName ?? "your house");
    const restoredPosition = new THREE.Vector3(
      data.player.position.x,
      data.player.position.y,
      data.player.position.z,
    );
    let restoredRotation = data.player.rotationY;
    if (collidesAt(restoredPosition.x, restoredPosition.z, this.world.colliders)) {
      restoredPosition.copy(this.world.spawn);
      restoredRotation = Math.PI;
      this.showToast("The saved position was obstructed; restarting at the main gate.");
    }
    this.player.placeAt(restoredPosition, restoredRotation);
    this.mission.restore(data.mission);
    this.store.setMission(this.mission.view());
    this.playtime = data.playtime;
    this.night.restore(data.night);
    this.classBunk = new ClassBunkSystem(data.classBunk);
    this.messMeal = new MessMealSystem(data.messMeal);
    this.messCaughtStage = null;
    this.messCaughtTeacherId = null;
    this.messCaughtTimer = 0;
    this.messPrincipalAutoOpened = false;
    const savedHostel = this.world.houseHostels[data.profile.houseId];
    if (savedHostel) {
      this.messMeal.setReturnPoint(
        savedHostel.interiorPoint.x,
        savedHostel.interiorPoint.z,
        "your hostel",
      );
    }
    this.exploration.restore(data.exploration);
    this.teachers?.reset(data.teachers);
    this.principalReferral?.restore(data.principalReferral, restoredPosition);
    this.principalDialogue.end();
    if (this.classBunk.isActive) {
      this.teachers?.setActiveSubset(this.classBunk.teacherIds);
      this.teachers?.setTimetablePhase("class");
    } else if (this.messMeal.isActive) {
      this.teachers?.setActiveSubset(this.messMeal.teacherIds);
      this.teachers?.setSpeedScale(this.messMeal.teacherSpeed);
      this.teachers?.setTimetablePhase("hostel");
    }
    this.syncDisciplineHud(true);
    this.cancelGardenDuty(false);
    this.nightCaughtHandled = false;
    this.suspicion = 0;
    this.setCrouching(false);
    this.nightMode = data.night.active;
    const messNight = this.messMeal.isActive || Boolean(this.messMeal.view().result);
    this.audio.setNight(this.nightMode || messNight);
    this.world.setNight(this.nightMode || messNight);
    this.applyAtmosphere(this.nightMode || messNight);
    this.world.setGardenInteractablesActive(this.nightMode);
    this.world.setMealInteractableActive(
      this.messMeal.isActive && this.messMeal.status === "to-mess" && !this.messMeal.mealCollected,
    );
    if (this.messMeal.view().status === "completed") this.world.setRoommateCelebration(true);
    for (const door of this.world.doors) door.setOpenInstant(false);
    if (insideZone(this.world.zones.classroom, restoredPosition)) {
      this.world.doors.find((door) => door.label === "classroom")?.setOpenInstant(true);
    }
    if (this.world.isInsideHouseHostel(data.profile.houseId, restoredPosition)) {
      this.world.houseHostels[data.profile.houseId]?.door.setOpenInstant(true);
    }
    this.store.patch({
      playtime: Math.round(data.playtime),
      hasSave: true,
      ending: null,
      profile: profileView,
      profileOpen: false,
      night: this.nightMode ? this.night.view(this.suspicion, this.world.patrolDetection.hidden) : null,
      nightResult: null,
      gardenDuty: null,
      exploration: this.explorationView(),
      discipline: this.teachers?.disciplineView() ?? null,
      principalReferral: this.principalReferral?.isActive
        ? this.principalReferral.view(restoredPosition)
        : null,
      classBunk: this.classBunk.isActive ? this.classBunk.view() : null,
      messMeal:
        this.messMeal.isActive || this.messMeal.view().result ? this.messMeal.view() : null,
      planOpen: false,
      campusMapOpen: false,
      campusMap: null,
      crouching: false,
      escapeSave: this.escapeData,
    });
    this.enterPlaying(true);
    this.audio.uiClick();
    this.showToast("Welcome back to campus.");
    if (this.nightMode) {
      this.updateNightMarker();
    } else if (this.messMeal.isActive) {
      this.updateMessMarker();
    } else if (this.mission.done) {
      this.world.showMarker(null, true);
    }
    if (!this.nightMode && !this.exploration.hasSeenPlan) {
      this.openPlan();
    }
    return true;
  }

  pause(): void {
    // Multiplayer uses the room overlay, not the single-player pause menu.
    if (this.multiplayer) return;
    const state = this.store.getState();
    if (state.screen !== "playing" || state.profileOpen) return;
    if (state.cameraOverview) {
      this.cameraController.exitOverview();
      this.store.patch({ cameraOverview: false });
    }
    this.store.setScreen("paused");
    this.store.setPrompt(null);
    this.input.setEnabled(false);
    this.saveGame(false);
    this.releasePointerLock();
  }

  resume(): void {
    if (this.store.getState().screen !== "paused") return;
    this.store.patch({
      screen: "playing",
      settingsOpen: false,
      profileOpen: false,
      planOpen: false,
      campusMapOpen: false,
      campusMap: null,
      cameraOverview: false,
    });
    this.input.reset();
    this.input.setEnabled(true);
    this.requestPointerLock();
    this.audio.uiClick();
  }

  /** Opens the after-entry choice without tearing down the current run. */
  openPlan(): void {
    if (!this.profile) return;
    if (this.nightMode) {
      this.showToast("Finish Operation Midnight Mischief before choosing another activity.");
      return;
    }
    const state = this.store.getState();
    if (state.screen === "playing") this.pause();
    if (this.store.getState().screen !== "paused") return;
    this.store.patch({
      screen: "paused",
      planOpen: true,
      campusMapOpen: false,
      campusMap: null,
      settingsOpen: false,
      profileOpen: false,
      prompt: null,
    });
    this.input.setEnabled(false);
    this.input.reset();
    this.releasePointerLock();
    this.audio.uiClick();
  }

  choosePlan(choice: "explore" | "stealth" | "later"): boolean {
    if (!this.profile || !this.store.getState().planOpen) return false;
    this.exploration.markPlanSeen();
    if (choice === "explore") this.exploration.startTour();
    this.store.patch({ planOpen: false });
    this.saveGame(false);
    if (choice === "explore") {
      this.openCampusMap("playing");
      return true;
    }
    if (choice === "stealth") return this.openAdventure();
    this.resume();
    return true;
  }

  /* ----------------------------------------------------------- multiplayer */

  isMultiplayerActive(): boolean {
    return this.multiplayer !== null;
  }

  /**
   * Enters the shared night mission. All multiplayer network calls go through
   * the adapter; the engine itself never trusts or invents mission state.
   */
  startMultiplayerMission(adapter: MultiplayerAdapter): boolean {
    if (!this.profile) return false;
    if (this.multiplayer) this.stopMultiplayerMission(false);

    const layer = new MultiplayerLayer(this.scene);
    this.multiplayer = {
      adapter,
      layer,
      syncTimer: 0,
      idleTimer: 0,
      lastSync: null,
      collectedCount: 0,
      extractionRequested: false,
      collectCooldown: 0,
      frozen: false,
    };

    void this.audio.unlock();
    this.nightMode = false;
    this.nightCaughtHandled = false;
    this.suspicion = 0;
    this.cancelGardenDuty(false);
    this.setCrouching(false);
    this.world.setNight(true);
    this.world.hideRoommate();
    this.world.setGardenInteractablesActive(false);
    this.world.setGardenPlotVerb(null);
    this.world.hideMarker();
    this.audio.setNight(true);
    this.applyAtmosphere(true);

    const start = new THREE.Vector3(MP_START_POINT.x, 0, MP_START_POINT.z);
    this.player.placeAt(start, MP_START_POINT.rotationY);
    this.cameraController.resetToPlayer(start, MP_START_POINT.rotationY);

    this.store.patch({
      screen: "playing",
      settingsOpen: false,
      profileOpen: false,
      dialogue: null,
      notice: null,
      ending: null,
      night: null,
      nightResult: null,
      gardenDuty: null,
      planOpen: false,
      campusMapOpen: false,
      campusMap: null,
      crouching: false,
      prompt: null,
    });
    this.input.reset();
    this.input.setEnabled(true);
    this.requestPointerLock();
    this.showToast("Co-op mission live. Stay together, collect ten crates, then reach the garden gate.");
    return true;
  }

  applyMultiplayerPlayers(players: readonly MultiplayerRemotePlayer[]): void {
    this.multiplayer?.layer.setPlayers(players);
  }

  private interactionMenuOpen = false;

  /**
   * Presentation-only pause for the UI SDK interaction menu. The world keeps
   * animating, but movement, jump and interact are disabled until the menu
   * closes. Pointer lock is released first so the engine does not mistake it
   * for an Esc pause.
   */
  setInteractionMenuOpen(open: boolean): void {
    if (this.disposed) return;
    if (this.interactionMenuOpen === open) return;
    this.interactionMenuOpen = open;
    if (open) {
      this.releasePointerLock();
      this.input.reset();
      this.input.setEnabled(false);
      return;
    }
    const state = this.store.getState();
    if (
      state.screen === "playing" &&
      !state.settingsOpen &&
      !state.profileOpen &&
      !state.planOpen &&
      !state.campusMapOpen &&
      !state.dialogue
    ) {
      this.input.reset();
      this.input.setEnabled(true);
      this.requestPointerLock();
    }
  }

  /**
   * Live presentation snapshot for the mini-map and expanded map. It reuses
   * the authoritative player position and already-synchronised remote players;
   * no parallel position system is introduced.
   */
  getMapSnapshot(): LiveMapSnapshot {
    return {
      playerX: this.player.position.x,
      playerZ: this.player.position.z,
      rotationY: this.player.rotationY,
      remotes: this.multiplayer?.layer.markers() ?? [],
      teachers:
        this.teachers?.allTeachers().flatMap((teacher) =>
          teacher.rig.group.visible
            ? [
                {
                  id: teacher.id,
                  name: teacher.config.name,
                  x: teacher.position.x,
                  z: teacher.position.z,
                },
              ]
            : [],
        ) ?? [],
    };
  }

  /** Stops WASD/joystick input while a chat sheet or panel owns the keyboard. */
  setMultiplayerUiOpen(open: boolean): void {
    if (!this.multiplayer) return;
    if (open) {
      this.input.setEnabled(false);
      this.input.reset();
      this.releasePointerLock();
    } else if (this.store.getState().screen === "playing") {
      this.input.reset();
      this.input.setEnabled(true);
    }
  }

  applyMultiplayerProgress(collectedIds: readonly string[], collectedCount: number): void {
    const mp = this.multiplayer;
    if (!mp) return;
    mp.layer.setCollected(collectedIds);
    const previous = mp.collectedCount;
    mp.collectedCount = collectedCount;
    if (previous < MP_VEGETABLE_COUNT && collectedCount >= MP_VEGETABLE_COUNT) {
      this.audio.chime();
      this.showToast("All ten crates collected. Get the team back to the garden gate.");
    }
  }

  freezeMultiplayer(): void {
    if (this.multiplayer) this.multiplayer.frozen = true;
  }

  stopMultiplayerMission(returnToTitle = true): void {
    const mp = this.multiplayer;
    if (!mp) return;
    mp.layer.dispose();
    this.multiplayer = null;

    this.world.setNight(false);
    this.world.setGardenInteractablesActive(false);
    this.world.setGardenPlotVerb(null);
    this.audio.setNight(false);
    this.applyAtmosphere(false);
    this.setCrouching(false);
    this.suspicion = 0;
    this.input.setEnabled(false);
    this.input.reset();
    this.releasePointerLock();
    this.store.patch({
      screen: "menu",
      settingsOpen: false,
      profileOpen: false,
      dialogue: null,
      notice: null,
      ending: null,
      night: null,
      nightResult: null,
      gardenDuty: null,
      planOpen: false,
      campusMapOpen: false,
      campusMap: null,
      prompt: null,
    });
    this.player.resetToSpawn(this.world.spawn);
    this.cameraController.resetToPlayer(this.world.spawn, Math.PI);
    this.world.showMarker(null, true);
    if (returnToTitle) this.audio.uiClick();
  }

  private updateMultiplayer(dt: number): void {
    const mp = this.multiplayer;
    if (!mp) return;
    mp.layer.update(dt);
    if (mp.collectCooldown > 0) mp.collectCooldown = Math.max(0, mp.collectCooldown - dt);
    if (mp.frozen) return;

    mp.syncTimer += dt;
    if (mp.syncTimer >= MP_SYNC_INTERVAL) {
      mp.syncTimer = 0;
      const state: MultiplayerLocalState = {
        x: Number(this.player.position.x.toFixed(2)),
        y: Number(this.player.position.y.toFixed(2)),
        z: Number(this.player.position.z.toFixed(2)),
        rotationY: Number(this.player.rotationY.toFixed(3)),
        moving: this.player.moving,
        crouching: this.crouching,
        anim: !this.player.grounded
          ? "jump"
          : this.crouching
            ? "crouch"
            : this.player.running
              ? "run"
              : this.player.moving
                ? "walk"
                : "idle",
      };
      const previous = mp.lastSync;
      const changed =
        !previous ||
        Math.abs(previous.x - state.x) > 0.015 ||
        Math.abs(previous.y - state.y) > 0.015 ||
        Math.abs(previous.z - state.z) > 0.015 ||
        Math.abs(previous.rotationY - state.rotationY) > 0.02 ||
        previous.anim !== state.anim;
      mp.idleTimer += MP_SYNC_INTERVAL;
      if (changed || mp.idleTimer >= 1) {
        mp.idleTimer = 0;
        mp.lastSync = state;
        mp.adapter.onLocalMove(state);
      }
    }

    if (
      mp.collectedCount >= MP_VEGETABLE_COUNT &&
      !mp.extractionRequested &&
      isInsideSafeZone(this.player.position.x, this.player.position.z)
    ) {
      mp.extractionRequested = true;
      mp.adapter.onReturnToSafe(this.player.position.x, this.player.position.z);
    }
  }

  /* --------------------------------------------------------- campus escape */

  private escapeState(): EscapeSave {
    if (!this.profile) throw new Error("Campus Escape requires a player profile.");
    if (!this.escapeData || this.escapeData.playerId !== this.profile.playerId) {
      this.escapeData = emptyEscapeSave(this.profile.playerId);
    }
    return this.escapeData;
  }

  openAdventure(): boolean {
    const state = this.store.getState();
    if (!this.profile) return false;
    if (this.night.active) return false;
    if (state.screen === "playing") this.pause();
    if (this.store.getState().screen !== "paused" && this.store.getState().screen !== "escape") {
      return false;
    }
    this.store.patch({
      screen: "adventure",
      planOpen: false,
      campusMapOpen: false,
      campusMap: null,
      settingsOpen: false,
      profileOpen: false,
      prompt: null,
      escapeSave: this.escapeState(),
    });
    this.input.setEnabled(false);
    this.input.reset();
    this.releasePointerLock();
    this.exploration.markPlanSeen();
    this.saveGame(false);
    this.audio.uiClick();
    return true;
  }

  closeAdventure(): void {
    if (this.store.getState().screen !== "adventure") return;
    this.store.patch({ screen: "paused", planOpen: false, campusMapOpen: false });
    this.audio.uiClick();
  }

  openEscape(): boolean {
    if (this.classBunk.isActive) {
      this.showToast("Finish or abandon CLASS BUNK before opening the obstacle course.");
      return false;
    }
    if (!this.profile) return false;
    const data = this.escapeState();
    const state = this.store.getState();
    if (state.screen === "playing") this.pause();
    this.store.patch({
      screen: "escape",
      planOpen: false,
      campusMapOpen: false,
      campusMap: null,
      settingsOpen: false,
      profileOpen: false,
      prompt: null,
      nightResult: null,
      escapeSave: { ...data, records: [...data.records], achievements: [...data.achievements] },
    });
    this.input.setEnabled(false);
    this.input.reset();
    this.releasePointerLock();
    this.audio.uiClick();
    this.saveGame(false);
    return true;
  }

  closeEscape(): void {
    if (this.store.getState().screen !== "escape") return;
    const data = this.escapeData;
    this.store.patch({
      screen: "adventure",
      prompt: null,
      escapeSave: data
        ? { ...data, records: [...data.records], achievements: [...data.achievements] }
        : null,
    });
    this.saveGame(false);
    this.audio.uiClick();
  }

  exitEscape(): void {
    this.closeEscape();
  }

  setEscapeSelection(levelId: EscapeLevelId, difficulty: EscapeDifficulty): void {
    if (!this.profile || !isEscapeLevelId(levelId) || !isEscapeDifficulty(difficulty)) return;
    const data = this.escapeState();
    this.escapeData = { ...data, lastLevelId: levelId, difficulty };
    this.store.patch({
      escapeSave: {
        ...this.escapeData,
        records: [...this.escapeData.records],
        achievements: [...this.escapeData.achievements],
      },
    });
    this.saveGame(false);
  }

  saveEscapeCheckpoint(checkpoint: EscapeCheckpointSave): void {
    if (!this.profile) return;
    if (!isEscapeLevelId(checkpoint.levelId) || !isEscapeDifficulty(checkpoint.difficulty)) return;
    if (!Number.isFinite(checkpoint.checkpointIndex) || !Number.isFinite(checkpoint.x)) return;
    const data = this.escapeState();
    const safe = sanitizeEscape(
      {
        ...data,
        checkpoint: {
          ...checkpoint,
          checkpointIndex: Math.max(0, Math.floor(checkpoint.checkpointIndex)),
          elapsed: Math.max(0, checkpoint.elapsed),
          tokens: Array.isArray(checkpoint.tokens)
            ? checkpoint.tokens.filter((id): id is string => typeof id === "string")
            : [],
          collisions: Math.max(0, Math.floor(checkpoint.collisions)),
          falls: Math.max(0, Math.floor(checkpoint.falls)),
          savedAt: Date.now(),
        },
      },
      this.profile.playerId,
    );
    this.escapeData = safe;
    this.store.patch({ escapeSave: safe });
    this.saveGame(false);
  }

  clearEscapeCheckpoint(): void {
    if (!this.profile) return;
    const data = this.escapeState();
    if (!data.checkpoint) return;
    this.escapeData = { ...data, checkpoint: null };
    this.store.patch({ escapeSave: this.escapeData });
    this.saveGame(false);
  }

  /**
   * Re-scores the run locally before writing a record. The browser save is not
   * an authoritative anti-cheat boundary, but every value is validated and the
   * client can never award house points through this game.
   */
  recordEscapeResult(result: EscapeRunResult): {
    newAchievements: string[];
    isBest: boolean;
  } {
    if (!this.profile || !isEscapeLevelId(result.levelId) || !isEscapeDifficulty(result.difficulty)) {
      return { newAchievements: [], isBest: false };
    }
    const course = buildEscapeCourse(result.levelId, result.difficulty);
    const safe = calculateEscapeScore({
      course,
      completed: result.completed === true,
      elapsed: result.elapsed,
      tokens: result.tokens,
      checkpoints: result.checkpoints,
      collisions: result.collisions,
      falls: result.falls,
    });
    const data = this.escapeState();
    const existing = getEscapeRecord(data, safe.levelId, safe.difficulty);
    const newAchievementIds: string[] = [];
    let records = data.records;
    let isBest = false;

    if (safe.completed) {
      isBest = !existing || safe.score > existing.bestScore;
      const nextRecord = {
        levelId: safe.levelId,
        difficulty: safe.difficulty,
        bestScore: Math.max(existing?.bestScore ?? 0, safe.score),
        bestTime: Math.min(existing?.bestTime ?? Number.POSITIVE_INFINITY, safe.elapsed),
        completions: (existing?.completions ?? 0) + 1,
        updatedAt: Date.now(),
      };
      records = existing
        ? data.records.map((record) =>
            record.levelId === safe.levelId && record.difficulty === safe.difficulty
              ? nextRecord
              : record,
          )
        : [...data.records, nextRecord];
    }

    const completedLevels = new Set(records.map((record) => record.levelId)).size;
    const earned = escapeAchievementsForRun({ result: safe, completedLevels }).filter(
      (id) => !data.achievements.includes(id) && Boolean(getEscapeLevel(safe.levelId)),
    );
    for (const id of earned) {
      if (!this.profile) break;
      const award = awardProgress(this.profile, 0, id);
      this.profile = award.profile;
      if (award.achievementAdded) {
        newAchievementIds.push(id);
        this.identityProgressSink?.(id);
      }
    }

    const achievements = Array.from(new Set([...data.achievements, ...newAchievementIds]));
    this.escapeData = {
      ...data,
      difficulty: safe.difficulty,
      lastLevelId: safe.levelId,
      records,
      achievements,
      checkpoint: safe.completed ? null : data.checkpoint,
    };
    this.store.patch({
      escapeSave: this.escapeData,
      profile: this.profile ? toProfileView(this.profile) : null,
    });
    this.saveGame(false);
    if (newAchievementIds.length > 0) {
      this.showToast(`Campus Escape achievement unlocked · ${newAchievementIds.length} new.`);
    }
    return { newAchievements: newAchievementIds, isBest };
  }

  /** Small audio hooks kept separate from the three.js scene. */
  escapeSound(kind: "start" | "token" | "checkpoint" | "hit" | "fall" | "win" | "fail"): void {
    if (kind === "token" || kind === "checkpoint" || kind === "win") this.audio.chime();
    else this.audio.uiClick();
  }

  openCampusMap(returnTo?: "playing" | "paused"): boolean {
    const state = this.store.getState();
    if (!this.profile) return false;
    if (this.nightMode || this.night.active) {
      this.showToast("The campus map is closed during nighttime activities.");
      return false;
    }
    if (this.multiplayer) {
      this.showToast("The expanded campus map is unavailable during co-op. The mini-map stays live.");
      return false;
    }
    if (!state.profile) return false;
    this.mapReturnScreen = returnTo ?? (state.screen === "playing" ? "playing" : "paused");
    if (state.screen === "playing") this.pause();
    else if (state.screen !== "paused") this.store.patch({ screen: "paused" });
    this.exploration.markPlanSeen();
    this.store.patch({
      screen: "paused",
      planOpen: false,
      campusMapOpen: true,
      campusMap: this.exploration.mapView(
        this.profile.houseId,
        this.player.position.x,
        this.player.position.z,
      ),
      settingsOpen: false,
      profileOpen: false,
      prompt: null,
    });
    this.input.setEnabled(false);
    this.input.reset();
    this.releasePointerLock();
    this.saveGame(false);
    this.audio.uiClick();
    return true;
  }

  closeCampusMap(): void {
    if (!this.store.getState().campusMapOpen) return;
    this.store.patch({ campusMapOpen: false, campusMap: null });
    if (this.mapReturnScreen === "playing") {
      this.resume();
    } else {
      this.store.patch({ screen: "paused" });
      this.audio.uiClick();
    }
  }

  travelToCampusLocation(locationId: string): boolean {
    if (!this.profile) return false;
    if (this.nightMode || this.night.active) {
      this.showToast("Travel is unavailable during the midnight caper.");
      return false;
    }
    const location = this.exploration
      .mapView(this.profile.houseId, this.player.position.x, this.player.position.z)
      .locations.find((candidate) => candidate.id === locationId);
    if (!location) return false;
    if (!location.unlocked) {
      this.showToast(
        `Discover ${location.unlockAt} campus stops to add ${location.shortName} to the map.`,
      );
      return false;
    }
    const point = this.safeTravelPoint(location.x, location.z, location.radius);
    if (!point) {
      this.showToast("That entrance is blocked right now. Walk around to the front.");
      return false;
    }
    this.exploration.markPlanSeen();
    this.cancelGardenDuty(false);
    this.player.placeAt(point, Math.PI);
    this.cameraController.resetToPlayer(point, Math.PI);
    this.store.patch({
      screen: "playing",
      planOpen: false,
      campusMapOpen: false,
      campusMap: null,
      settingsOpen: false,
      profileOpen: false,
      prompt: null,
      ending: null,
    });
    this.input.reset();
    this.input.setEnabled(true);
    this.requestPointerLock();
    this.saveGame(false);
    this.refreshExploration();
    this.showToast(`Arrived at ${location.name}. ${location.story}`);
    return true;
  }

  private safeTravelPoint(x: number, z: number, radius: number): THREE.Vector3 | null {
    const limit = this.world.bounds - 2;
    const candidates = [new THREE.Vector3(x, 0, z)];
    for (const distance of [radius * 0.6, radius * 0.8]) {
      for (let index = 0; index < 8; index += 1) {
        const angle = (index / 8) * Math.PI * 2;
        candidates.push(
          new THREE.Vector3(x + Math.cos(angle) * distance, 0, z + Math.sin(angle) * distance),
        );
      }
    }
    return (
      candidates.find(
        (point) =>
          Math.abs(point.x) < limit &&
          Math.abs(point.z) < limit &&
          !collidesAt(point.x, point.z, this.world.colliders),
      ) ?? null
    );
  }

  private explorationView() {
    if (!this.profile) return null;
    const map = this.exploration.mapView(
      this.profile.houseId,
      this.player.position.x,
      this.player.position.z,
    );
    return {
      discovered: map.discovered,
      total: map.total,
      nextUnlock: map.nextUnlock
        ? `Discover ${map.nextUnlock.count} stops to unlock ${map.nextUnlock.names.join(", ")}`
        : "Every route stop is unlocked",
      tourStarted: this.exploration.started,
    };
  }

  private refreshExploration(): void {
    if (!this.profile) return;
    const view = this.explorationView();
    this.store.patch({
      exploration: view,
      ...(this.store.getState().campusMapOpen
        ? {
            campusMap: this.exploration.mapView(
              this.profile.houseId,
              this.player.position.x,
              this.player.position.z,
            ),
          }
        : {}),
    });
  }

  private updateExploration(): void {
    if (!this.profile || this.nightMode || this.gardenDuty || this.multiplayer) return;
    const result = this.exploration.discoverNearby(
      this.player.position.x,
      this.player.position.z,
      this.profile.houseId,
    );
    if (!result.discovered) return;
    this.audio.chime();
    this.showToast(`Campus discovered · ${result.discovered.name}. ${result.discovered.story}`);
    if (result.milestone) {
      const award = this.grantProgress(result.milestone.xp, result.milestone.id);
      if (award.xpAwarded > 0) {
        this.showToast(
          `Exploration milestone · ${result.milestone.count} stops · +${award.xpAwarded} XP.`,
        );
      }
    }
    this.refreshExploration();
    this.saveGame(false);
  }

  openProfile(): void {
    const state = this.store.getState();
    if (!state.profile) return;
    if (
      state.screen !== "playing" &&
      state.screen !== "paused" &&
      state.screen !== "menu" &&
      state.screen !== "adventure"
    ) {
      return;
    }
    if (state.settingsOpen) return;
    this.store.patch({ profileOpen: true });
    this.store.setPrompt(null);
    this.input.setEnabled(false);
    this.releasePointerLock();
    this.audio.uiClick();
  }

  closeProfile(): void {
    const state = this.store.getState();
    if (!state.profileOpen) return;
    this.store.patch({ profileOpen: false });
    if (state.screen === "playing") {
      this.input.reset();
      this.input.setEnabled(true);
      this.requestPointerLock();
    }
    this.audio.uiClick();
  }

  toggleCrouch(): void {
    const state = this.store.getState();
    if (state.screen !== "playing" || state.profileOpen) return;
    this.setCrouching(!this.crouching);
    this.audio.uiClick();
  }

  private setCrouching(crouching: boolean): void {
    this.crouching = crouching;
    this.player.setCrouching(crouching);
    this.store.patch({ crouching });
  }

  openSettings(): void {
    const state = this.store.getState();
    if (state.screen === "menu") {
      this.store.patch({ settingsOpen: true });
      this.audio.uiClick();
      return;
    }
    this.store.patch({ settingsOpen: true, screen: "paused" });
    this.input.setEnabled(false);
    this.store.setPrompt(null);
    this.releasePointerLock();
    this.audio.uiClick();
    this.saveGame(false);
  }

  closeSettings(): void {
    const state = this.store.getState();
    this.store.patch({ settingsOpen: false });
    if (state.screen !== "menu") {
      this.store.patch({ screen: "paused" });
      this.input.setEnabled(false);
      this.store.setPrompt(null);
      this.releasePointerLock();
    }
    this.audio.uiClick();
    if (this.mission.started) this.saveGame(false);
  }

  quitToMenu(): void {
    if (this.mission.started) this.saveGame(false);
    this.store.patch({
      screen: "menu",
      settingsOpen: false,
      profileOpen: false,
      dialogue: null,
      notice: null,
      ending: null,
      prompt: null,
      night: null,
      nightResult: null,
      gardenDuty: null,
      exploration: null,
      planOpen: false,
      campusMapOpen: false,
      campusMap: null,
      crouching: false,
      playtime: Math.round(this.playtime),
    });
    this.npc.end();
    this.multiplayer?.layer.dispose();
    this.multiplayer = null;
    this.cancelGardenDuty(false);
    this.setCrouching(false);
    if (this.world.night) {
      this.world.setNight(false);
      this.world.setGardenInteractablesActive(false);
      this.audio.setNight(false);
      this.applyAtmosphere(false);
    } else if (this.nightMode) {
      this.nightMode = false;
      this.world.setNight(false);
      this.audio.setNight(false);
      this.applyAtmosphere(false);
    }
    this.input.setEnabled(false);
    this.input.reset();
    this.releasePointerLock();
    this.world.showMarker(null, true);
    this.audio.uiClick();
  }

  restart(): void {
    this.newGame();
  }

  saveGame(announce: boolean): boolean {
    // Multiplayer never writes room state into the local single-player save.
    if (this.multiplayer) return false;
    if (!this.mission.started || !this.profile) return false;
    const state = this.store.getState();
    const data: SaveData = {
      version: 2,
      savedAt: Date.now(),
      playtime: Math.round(this.playtime),
      player: {
        position: { x: this.player.position.x, y: this.player.position.y, z: this.player.position.z },
        rotationY: this.player.rotationY,
      },
      settings: state.settings,
      character: state.character,
      mission: this.mission.toSave(),
      profile: this.profile,
      night: this.night.toSave(),
      exploration: this.exploration.toSave(),
      escape: this.escapeData ?? emptyEscapeSave(this.profile.playerId),
      teachers: this.teachers?.toSave() ?? emptyTeacherSave(),
      principalReferral: this.principalReferral?.toSave() ?? {
        active: false,
        status: "completed",
        teacherId: null,
        teacherName: null,
        reason: null,
        assignedAt: 0,
        completedAt: null,
      },
      classBunk: this.classBunk.toSave(),
      messMeal: this.messMeal.toSave(),
    };
    const ok = this.saveSystem.save(data);
    if (ok) {
      this.store.patch({ hasSave: true });
      if (announce) this.showToast("Progress saved locally.");
    } else if (announce) {
      this.showToast("This browser blocked local storage — progress could not be saved.");
    }
    return ok;
  }

  deleteSave(): void {
    this.saveSystem.clear();
    this.npc.end();
    this.mission = new MissionSystem();
    this.night = new NightMissionSystem();
    this.exploration.reset();
    this.profile = null;
    this.escapeData = null;
    this.teachers?.reset();
    this.principalReferral?.reset();
    this.classBunk = new ClassBunkSystem();
    this.messMeal = new MessMealSystem();
    this.messCaughtStage = null;
    this.messCaughtTeacherId = null;
    this.messCaughtTimer = 0;
    this.messPrincipalAutoOpened = false;
    this.world.setMealInteractableActive(false);
    this.world.setRoommateCelebration(false);
    this.principalDialogue.end();
    this.lastDiscipline = null;
    this.nightMode = false;
    this.cancelGardenDuty(false);
    this.nightCaughtHandled = false;
    this.suspicion = 0;
    this.playtime = 0;
    this.setCrouching(false);
    this.world.setNight(false);
    this.world.setPlayerCharacterId(null);
    this.audio.setNight(false);
    this.applyAtmosphere(false);
    this.store.patch({
      hasSave: false,
      screen: "menu",
      settingsOpen: false,
      profileOpen: false,
      profile: null,
      night: null,
      nightResult: null,
      gardenDuty: null,
      principalReferral: null,
      classBunk: null,
      messMeal: null,
      exploration: null,
      planOpen: false,
      campusMapOpen: false,
      campusMap: null,
      dialogue: null,
      notice: null,
      ending: null,
      prompt: null,
      playtime: 0,
      escapeSave: null,
    });
    this.store.setMission(this.mission.view());
    this.input.setEnabled(false);
    this.input.reset();
    this.releasePointerLock();
    this.player.resetToSpawn(this.world.spawn);
    this.player.setCharacter(DEFAULT_CHARACTER, getHouse(DEFAULT_HOUSE_ID)?.color);
    this.world.showMarker(null, true);
    this.showToast("Saved game deleted. The campus is fresh again.");
    this.audio.uiClick();
  }

  setSettings(raw: GameSettings): void {
    const settings = sanitizeSettings(raw);
    this.applySettings(settings, { announce: false });
    this.audio.uiClick();
  }

  /**
   * Applies a complete graphics tier. Individual graphics sliders can then be
   * adjusted on top of it without changing the rest of the player's setup.
   */
  setGraphicsPreset(preference: QualityPreference): void {
    const resolved = preference === "auto" ? resolveAutoQuality() : preference;
    this.autoQuality = resolved;
    const profile = QUALITY_PROFILES[resolved];
    const current = this.store.getState().settings;
    const shadowQuality: ShadowQuality =
      resolved === "low" ? "low" : resolved === "medium" ? "medium" : "high";
    this.applySettings(
      {
        ...current,
        quality: preference,
        shadowQuality,
        renderScale: 1,
        viewDistance: 1,
        textureQuality: profile.texture,
        antialias: profile.antialias,
        effectsQuality: profile.effects,
      },
      { announce: true },
    );
    this.store.patch({ autoAdjusted: false });
    this.audio.uiClick();
  }

  setCharacter(raw: CharacterSettings): void {
    const character = sanitizeCharacter(raw);
    this.store.setCharacter(character);
    const house = this.profile ? getHouse(this.profile.houseId) : undefined;
    this.player.setCharacter(character, house?.color ?? UNIFORM_COLORS[character.uniform]);
    this.audio.uiClick();
  }

  /**
   * Connects verified in-game achievement events to the account identity layer.
   * The sink cannot award arbitrary XP; the backend maps the achievement ID to
   * its canonical reward and records it once.
   */
  setIdentityProgressSink(sink: ((achievementId: string) => void) | null): void {
    this.identityProgressSink = sink;
  }

  getCharacter(): CharacterSettings {
    return this.store.getState().character;
  }

  zoomCamera(factor: number): void {
    this.cameraController.zoomBy(factor);
  }

  /** Raw pixel orbit used by the overview gesture layer and touch controls. */
  orbitCamera(dx: number, dy: number): void {
    this.input.addLook(dx * 1.9, dy * 1.9);
  }

  enterCameraOverview(): boolean {
    const state = this.store.getState();
    if (state.screen !== "playing" || state.settingsOpen || state.profileOpen) return false;
    if (this.multiplayer || this.nightMode || this.messMeal.isActive) {
      this.showToast("Campus overview is available in the single-player daytime campus.");
      return false;
    }
    this.cameraController.enterOverview(this.player.position);
    this.input.reset();
    this.store.patch({ cameraOverview: true });
    this.store.setPrompt(null);
    this.audio.uiClick();
    return true;
  }

  exitCameraOverview(): void {
    if (!this.store.getState().cameraOverview) return;
    this.cameraController.exitOverview();
    this.input.reset();
    this.store.patch({ cameraOverview: false });
    this.audio.uiClick();
  }

  startClassBunk(difficulty: ClassBunkDifficulty = "normal"): boolean {
    if (!this.profile) return false;
    if (!isClassBunkDifficulty(difficulty)) return false;
    if (this.classBunk.isActive) {
      this.showToast("You are already in the middle of a class bunk. Finish it or abandon it from the pause menu.");
      return false;
    }
    if (this.messMeal.isActive) {
      this.showToast("Finish or leave the mess meal run before skipping class.");
      return false;
    }
    if (this.nightMode && this.night.active) {
      this.showToast("Finish or leave the midnight caper before skipping class.");
      return false;
    }
    if (this.principalReferral?.isActive) {
      this.showToast("Report to the Principal's Chamber before starting another caper.");
      return false;
    }
    void this.audio.unlock();
    this.cancelGardenDuty(false);
    this.classBunk.start(difficulty);
    this.classBunkCompleted = 0;
    this.classBunkHudTimer = 0;
    this.bunkPrincipalAutoOpened = false;
    this.nightMode = false;
    this.nightCaughtHandled = false;
    this.suspicion = 0;
    this.setCrouching(false);
    this.world.setNight(false);
    this.audio.setNight(false);
    this.applyAtmosphere(false);
    this.world.setGardenInteractablesActive(false);
    this.teachers?.setEnabled(true);
    this.teachers?.setActiveSubset(this.classBunk.teacherIds);
    this.teachers?.setTimetablePhase("class");
    const start = this.classBunk.startPoint;
    const point = new THREE.Vector3(start.x, 0, start.z);
    this.player.placeAt(point, start.rotation);
    this.cameraController.resetToPlayer(point, start.rotation);
    this.world.showMarker(null, true);
    this.world.hideMarker();
    for (const door of this.world.doors) door.setOpenInstant(false);
    this.world.doors.find((door) => door.label === "classroom")?.setOpenInstant(true);
    this.store.patch({
      screen: "playing",
      settingsOpen: false,
      profileOpen: false,
      dialogue: null,
      notice: null,
      ending: null,
      prompt: null,
      planOpen: false,
      campusMapOpen: false,
      campusMap: null,
      cameraOverview: false,
      night: null,
      nightResult: null,
      gardenDuty: null,
      discipline: null,
      principalReferral: null,
      crouching: false,
      classBunk: this.classBunk.view(),
    });
    this.input.reset();
    this.input.setEnabled(true);
    this.requestPointerLock();
    this.saveGame(false);
    this.audio.chime();
    this.showToast(
      `${CLASS_BUNK_DIFFICULTIES[difficulty].label} CLASS BUNK. Room 101 is behind you; the bell is already counting.`,
    );
    return true;
  }

  dismissClassBunk(): void {
    const view = this.classBunk.view();
    if (!view.result) return;
    this.classBunk.dismissResult();
    this.teachers?.setActiveSubset(null);
    this.teachers?.setTimetablePhase(null);
    this.store.patch({ classBunk: null, principalReferral: this.principalReferral?.isActive ? this.principalReferral.view(this.player.position) : null });
    this.saveGame(false);
    this.audio.uiClick();
  }

  abandonClassBunk(): boolean {
    if (!this.classBunk.isActive) return false;
    this.classBunk.finish("ended");
    this.teachers?.setActiveSubset(null);
    this.teachers?.setTimetablePhase(null);
    this.store.patch({ classBunk: this.classBunk.view() });
    this.saveGame(false);
    this.audio.uiClick();
    return true;
  }

  private handleClassBunkCaught(teacherId: TeacherId): void {
    const teacher = this.teachers?.teacher(teacherId);
    const name = teacher?.config.name ?? "A teacher";
    const player = this.player.position;
    if (this.principalReferral && !this.principalReferral.isActive) {
      this.principalReferral.assign({
        teacherId,
        teacherName: name,
        reason: "Skipping class and wandering the campus without a pass",
        player,
        now: this.elapsed * 1000,
      });
      this.principalReferral.update(player, 0);
    }
    this.input.setEnabled(false);
    this.input.reset();
    this.store.setPrompt(null);
    this.releasePointerLock();
    this.dialogueSource = "bunk-caught";
    this.bunkPrincipalAutoOpened = false;
    this.teacherDialogueId = teacherId;
    if (teacher) this.dialogueAnchor.copy(teacher.position);
    this.store.setDialogue({
      speaker: name,
      role: `${teacher?.config.subject ?? "Staff"} · Navodaya Vidyalaya`,
      text: CLASS_BUNK_CAUGHT_LINE,
      choices: [],
      canAdvance: true,
    });
    this.store.patch({
      screen: "dialogue",
      classBunk: this.classBunk.view(),
      principalReferral: this.principalReferral?.view(player) ?? null,
    });
    this.audio.chime();
    this.showToast("Caught out of class. Follow the highlighted route to the Principal's Chamber.");
  }

  private updateClassBunk(dt: number): void {
    if (!this.classBunk.isActive) return;
    const view = this.classBunk.view();
    if (view.status === "caught" || view.result) return;
    const teachers = this.classBunk.teacherIds.flatMap((id) => {
      const controller = this.teachers?.teacher(id);
      if (!controller || !controller.rig.group.visible) return [];
      return [
        {
          id,
          name: controller.config.name,
          x: controller.position.x,
          z: controller.position.z,
          rotation: controller.rotation,
          detectionRadius: controller.config.detectionRadius,
          lineOfSight: this.world.hasLineOfSight(
            controller.position.x,
            controller.position.z,
            this.player.position.x,
            this.player.position.z,
          ),
        },
      ];
    });
    const caughtBy = this.classBunk.update({
      playerX: this.player.position.x,
      playerZ: this.player.position.z,
      crouching: this.crouching,
      dt,
      teachers,
    });
    if (caughtBy) {
      this.handleClassBunkCaught(caughtBy);
      return;
    }
    const next = this.classBunk.view();
    if (next.completed > this.classBunkCompleted) {
      this.classBunkCompleted = next.completed;
      this.showToast(
        next.status === "return"
          ? "Every stop covered. Get back to Room 101 before the bell."
          : `Stop cleared · ${next.completed}/${next.total}. Keep moving.`,
      );
      this.audio.chime();
    }
    this.classBunkHudTimer += dt;
    if (this.classBunkHudTimer >= 0.2 || next.status !== view.status || next.result) {
      this.classBunkHudTimer = 0;
      this.store.patch({ classBunk: next });
      if (next.result) this.saveGame(false);
    }
  }

  startMessMeal(difficulty: MessMealDifficulty = "normal"): boolean {
    if (!this.profile) return false;
    if (!isMessMealDifficulty(difficulty)) return false;
    if (this.messMeal.isActive) {
      this.showToast("Your mess meal run is already underway. Finish it or abandon it from the pause menu.");
      return false;
    }
    if (this.classBunk.isActive) {
      this.showToast("Finish or leave CLASS BUNK before starting the mess run.");
      return false;
    }
    if (this.nightMode && this.night.active) {
      this.showToast("Finish or leave the midnight caper before starting another night mission.");
      return false;
    }
    if (this.principalReferral?.isActive) {
      this.showToast("Report to the Principal's Chamber before starting another caper.");
      return false;
    }
    const hostel = this.world.houseHostels[this.profile.houseId];
    if (!hostel) return false;
    void this.audio.unlock();
    this.cancelGardenDuty(false);
    this.messMeal.start(difficulty);
    this.messMeal.setReturnPoint(hostel.interiorPoint.x, hostel.interiorPoint.z, "your hostel");
    this.messMealCompleted = 0;
    this.messMealHudTimer = 0;
    this.messPrincipalAutoOpened = false;
    this.messCaughtStage = null;
    this.messCaughtTeacherId = null;
    this.messCaughtTimer = 0;
    this.nightMode = false;
    this.nightCaughtHandled = false;
    this.suspicion = 0;
    this.setCrouching(false);
    for (const door of this.world.doors) door.setOpenInstant(false);
    this.world.doors.find((door) => door.label === `house-${this.profile?.houseId}`)?.setOpenInstant(true);
    this.world.setNight(true);
    this.world.setGardenInteractablesActive(false);
    this.world.setGardenPlotVerb(null);
    this.world.setMealInteractableActive(true);
    this.world.setRoommateCelebration(false);
    this.world.hideMarker();
    this.audio.setNight(true);
    this.applyAtmosphere(true);
    this.teachers?.setEnabled(true);
    this.teachers?.setActiveSubset(this.messMeal.teacherIds);
    this.teachers?.setSpeedScale(this.messMeal.teacherSpeed);
    this.teachers?.setTimetablePhase("hostel");
    this.player.placeAt(hostel.interiorPoint, Math.PI);
    this.cameraController.resetToPlayer(hostel.interiorPoint, Math.PI);
    this.store.patch({
      screen: "playing",
      settingsOpen: false,
      profileOpen: false,
      dialogue: null,
      notice: null,
      ending: null,
      prompt: null,
      planOpen: false,
      campusMapOpen: false,
      campusMap: null,
      cameraOverview: false,
      night: null,
      nightResult: null,
      gardenDuty: null,
      discipline: null,
      principalReferral: null,
      classBunk: null,
      messMeal: this.messMeal.view(),
      crouching: false,
    });
    this.input.reset();
    this.input.setEnabled(true);
    this.updateMessMarker();
    this.requestPointerLock();
    this.saveGame(false);
    this.audio.chime();
    this.showToast(
      `${MESS_MEAL_DIFFICULTIES[difficulty].label} MESS MEAL SNEAK. Reach the serving counter, collect the food and get back before a patrol finds you.`,
    );
    return true;
  }

  private updateMessMarker(): void {
    const target = this.messMeal.isActive ? this.messMeal.targetPoint() : null;
    if (!target) {
      this.world.hideMarker();
      return;
    }
    this.world.showMarkerAt(new THREE.Vector3(target.x, 0, target.z));
  }

  collectMessMeal(): void {
    if (!this.messMeal.isActive) return;
    const result = this.messMeal.collectMeal();
    if (!result.ok) {
      this.showToast(result.reason ?? "You cannot collect the meal yet.");
      return;
    }
    this.world.setMealInteractableActive(false);
    this.audio.chime();
    this.updateMessMarker();
    this.store.patch({ messMeal: this.messMeal.view() });
    this.saveGame(false);
    this.showToast("Meal collected. Keep it steady and get back to your hostel.");
  }

  private handleMessCaught(teacherId: TeacherId): void {
    const teacher = this.teachers?.teacher(teacherId);
    this.messCaughtStage = "approach";
    this.messCaughtTeacherId = teacherId;
    this.messCaughtTimer = 0;
    this.input.setEnabled(false);
    this.input.reset();
    this.store.setPrompt(null);
    this.releasePointerLock();
    this.world.hideMarker();
    this.store.patch({
      messMeal: this.messMeal.view(),
      principalReferral: null,
      prompt: null,
    });
    this.showToast(
      `${teacher?.config.name ?? "A teacher"} spotted you. Stay where you are — they are walking over.`,
    );
    this.audio.chime();
  }

  private openMessCaughtDialogue(): void {
    const teacherId = this.messCaughtTeacherId;
    if (!teacherId) return;
    const teacher = this.teachers?.teacher(teacherId);
    const name = teacher?.config.name ?? "A teacher";
    const player = this.player.position;
    if (this.principalReferral && !this.principalReferral.isActive) {
      this.principalReferral.assign({
        teacherId,
        teacherName: name,
        reason: "Sneaking to the mess after lights-out to bring food to the hostel",
        player,
        now: this.elapsed * 1000,
      });
      this.principalReferral.update(player, 0);
    }
    this.messCaughtStage = null;
    this.messCaughtTimer = 0;
    this.messPrincipalAutoOpened = false;
    this.teacherDialogueId = teacherId;
    if (teacher) {
      this.dialogueAnchor.copy(teacher.position);
      teacher.startTalking("stern");
    }
    this.dialogueSource = "mess-caught";
    this.store.setDialogue({
      speaker: name,
      role: `${teacher?.config.subject ?? "Staff"} · Night duty`,
      text: `${MESS_MEAL_CAUGHT_LINE}\\n\\n${MESS_MEAL_CAUGHT_FOLLOW_UP}`,
      choices: [],
      canAdvance: true,
    });
    this.store.patch({
      screen: "dialogue",
      messMeal: this.messMeal.view(),
      principalReferral: this.principalReferral?.view(player) ?? null,
    });
    this.saveGame(false);
    this.audio.chime();
    this.showToast("Report to the Principal's Chamber. Your meal and progress are preserved.");
  }

  private updateMessMeal(dt: number): void {
    if (!this.messMeal.isActive) return;
    const before = this.messMeal.view();
    if (before.status === "caught" || before.result) return;
    const teachers = this.messMeal.teacherIds.flatMap((id) => {
      const controller = this.teachers?.teacher(id);
      if (!controller || !controller.rig.group.visible) return [];
      return [
        {
          id,
          name: controller.config.name,
          x: controller.position.x,
          z: controller.position.z,
          rotation: controller.rotation,
          detectionRadius: controller.config.detectionRadius,
          lineOfSight: this.world.hasLineOfSight(
            controller.position.x,
            controller.position.z,
            this.player.position.x,
            this.player.position.z,
          ),
        },
      ];
    });
    const caughtBy = this.messMeal.update({
      playerX: this.player.position.x,
      playerZ: this.player.position.z,
      crouching: this.crouching,
      dt,
      teachers,
    });
    if (caughtBy) {
      this.handleMessCaught(caughtBy);
      return;
    }
    const next = this.messMeal.view();
    if (next.completed > this.messMealCompleted) {
      this.messMealCompleted = next.completed;
      if (next.status !== "return") {
        this.showToast(`Night route cleared · ${next.completed}/${next.total}. Keep moving.`);
        this.audio.chime();
      }
    }
    if (next.result) {
      if (next.result.outcome === "completed") {
        this.world.setRoommateCelebration(true);
        this.audio.chime();
      }
      this.world.setMealInteractableActive(false);
      this.world.hideMarker();
      this.teachers?.setActiveSubset(null);
      this.teachers?.setSpeedScale(1);
      this.teachers?.setTimetablePhase(null);
      this.teachers?.setEnabled(false);
      this.store.patch({ messMeal: next });
      this.saveGame(false);
      return;
    }
    this.messMealHudTimer += dt;
    if (this.messMealHudTimer >= 0.2 || next.status !== before.status) {
      this.messMealHudTimer = 0;
      this.updateMessMarker();
      this.store.patch({ messMeal: next });
    }
  }

  dismissMessMeal(): void {
    const view = this.messMeal.view();
    if (!view.result) return;
    this.messMeal.dismissResult();
    this.world.setRoommateCelebration(false);
    this.world.setMealInteractableActive(false);
    this.world.hideMarker();
    this.world.setNight(false);
    this.audio.setNight(false);
    this.applyAtmosphere(false);
    this.nightMode = false;
    this.messCaughtStage = null;
    this.messCaughtTeacherId = null;
    this.messCaughtTimer = 0;
    this.teachers?.setActiveSubset(null);
    this.teachers?.setSpeedScale(1);
    this.teachers?.setTimetablePhase(null);
    this.teachers?.setEnabled(true);
    this.store.patch({
      messMeal: null,
      principalReferral: this.principalReferral?.isActive
        ? this.principalReferral.view(this.player.position)
        : null,
    });
    this.saveGame(false);
    this.audio.uiClick();
    this.showToast(
      view.result.outcome === "completed"
        ? "The food is shared. The hostel settles down for the night."
        : "The night caper is over. The campus returns to its usual morning.",
    );
  }

  abandonMessMeal(): boolean {
    if (!this.messMeal.isActive) return false;
    this.messMeal.finish("ended");
    this.messCaughtStage = null;
    this.messCaughtTeacherId = null;
    this.messCaughtTimer = 0;
    this.world.setRoommateCelebration(false);
    this.world.setMealInteractableActive(false);
    this.world.hideMarker();
    this.teachers?.setActiveSubset(null);
    this.teachers?.setSpeedScale(1);
    this.teachers?.setTimetablePhase(null);
    this.teachers?.setEnabled(false);
    this.store.patch({
      screen: "playing",
      messMeal: this.messMeal.view(),
      principalReferral: this.principalReferral?.isActive
        ? this.principalReferral.view(this.player.position)
        : null,
    });
    this.input.reset();
    this.input.setEnabled(true);
    this.saveGame(false);
    this.audio.uiClick();
    return true;
  }

  private returnMessToHostelAfterPrincipal(): void {
    const houseId = this.profile?.houseId;
    const hostel = houseId ? this.world.houseHostels[houseId] : undefined;
    this.messMeal.finishAfterPrincipalReturning();
    const view = this.messMeal.view();
    if (hostel) {
      const point = new THREE.Vector3(hostel.interiorPoint.x, 0, 36.15);
      this.player.placeAt(point, view.status === "completed" ? 0 : Math.PI);
      this.cameraController.resetToPlayer(this.player.position, this.player.rotationY);
    }
    this.world.setMealInteractableActive(false);
    this.world.hideMarker();
    this.world.setRoommateCelebration(view.status === "completed");
    this.teachers?.setActiveSubset(null);
    this.teachers?.setSpeedScale(1);
    this.teachers?.setTimetablePhase(null);
    this.teachers?.setEnabled(false);
    this.store.patch({ messMeal: view });
    if (view.status === "completed") {
      this.audio.chime();
      this.showToast("You made it back. Your roommates are already gathering around the food.");
    } else {
      this.showToast("You returned to the hostel empty-handed.");
    }
    this.saveGame(false);
  }

  startNight(): boolean {
    if (!this.profile) return false;
    if (this.night.active) return false;
    if (this.classBunk.isActive) {
      this.showToast("Finish or leave CLASS BUNK before starting another caper.");
      return false;
    }
    if (this.messMeal.isActive) {
      this.showToast("Finish or leave the mess meal run before starting another night caper.");
      return false;
    }
    const house = getHouse(this.profile.houseId);
    const hostel = this.world.houseHostels[this.profile.houseId];
    if (!house || !hostel) return false;
    void this.audio.unlock();
    this.cancelGardenDuty(false);
    this.night.startNew(this.night.toSave());
    this.nightMode = true;
    this.nightCaughtHandled = false;
    this.suspicion = 0;
    this.setCrouching(false);
    for (const door of this.world.doors) door.setOpenInstant(false);
    this.world.setNight(true);
    this.world.setGardenInteractablesActive(true);
    this.world.setGardenPlotVerb("Search");
    this.audio.setNight(true);
    this.applyAtmosphere(true);
    this.player.placeAt(hostel.interiorPoint, 0);
    this.cameraController.resetToPlayer(hostel.interiorPoint, 0);
    this.store.patch({
      screen: "playing",
      settingsOpen: false,
      profileOpen: false,
      dialogue: null,
      notice: null,
      ending: null,
      nightResult: null,
      night: this.night.view(0, false),
      gardenDuty: null,
      planOpen: false,
      campusMapOpen: false,
      campusMap: null,
      crouching: false,
    });
    this.store.setPrompt(null);
    this.input.reset();
    this.input.setEnabled(true);
    this.updateNightMarker();
    this.requestPointerLock();
    this.saveGame(false);
    this.showToast("Operation Midnight Mischief is live. Your roommate is waiting inside the hostel.");
    return true;
  }

  retryNight(): void {
    if (this.store.getState().screen !== "night-result") return;
    this.store.patch({ nightResult: null });
    this.startNight();
  }

  finishNight(): void {
    if (!this.nightMode) return;
    const houseId = this.profile?.houseId;
    const hostel = houseId ? this.world.houseHostels[houseId] : undefined;
    this.nightMode = false;
    this.suspicion = 0;
    this.nightCaughtHandled = false;
    this.setCrouching(false);
    this.world.setNight(false);
    this.world.setGardenInteractablesActive(false);
    this.audio.setNight(false);
    this.applyAtmosphere(false);
    if (hostel) {
      const returnPoint = new THREE.Vector3(hostel.center.x, 0, 33.4);
      this.player.placeAt(returnPoint, 0);
      this.cameraController.resetToPlayer(returnPoint, 0);
    }
    this.world.hideMarker();
    this.store.patch({
      screen: "playing",
      settingsOpen: false,
      profileOpen: false,
      dialogue: null,
      ending: null,
      night: null,
      nightResult: null,
      crouching: false,
    });
    this.input.reset();
    this.input.setEnabled(true);
    this.requestPointerLock();
    this.saveGame(false);
    this.showToast("The corridor lights are back on. It is a normal campus morning.");
  }

  startGardenDuty(): boolean {
    if (!this.profile) return false;
    if (this.classBunk.isActive) {
      this.showToast("Finish or abandon CLASS BUNK before taking on garden duty.");
      return false;
    }
    if (this.messMeal.isActive) {
      this.showToast("Finish or leave the mess meal run before taking on garden duty.");
      return false;
    }
    if (!this.profile.achievements.includes("caught-in-the-act")) {
      this.showToast("Mr. Barua only assigns garden duty after a certain midnight incident.");
      return false;
    }
    if (this.profile.achievements.includes("garden-duty")) {
      this.showToast("The beds are already looked after. Mr. Barua has signed your card.");
      return false;
    }
    if (this.nightMode && this.night.active) return false;
    void this.audio.unlock();
    this.nightMode = false;
    this.world.setNight(false);
    this.world.setGardenInteractablesActive(true);
    this.world.setGardenPlotVerb("Water");
    this.audio.setNight(false);
    this.applyAtmosphere(false);
    this.nightCaughtHandled = false;
    this.suspicion = 0;
    this.setCrouching(false);
    const point = new THREE.Vector3(-38, 0, 30.5);
    this.player.placeAt(point, 0);
    this.cameraController.resetToPlayer(point, 0);
    this.gardenDuty = { active: true, watered: new Set(), total: 3 };
    if (this.gardenDutyTimer) {
      window.clearTimeout(this.gardenDutyTimer);
      this.gardenDutyTimer = null;
    }
    this.store.patch({
      screen: "playing",
      settingsOpen: false,
      profileOpen: false,
      dialogue: null,
      notice: null,
      ending: null,
      prompt: null,
      night: null,
      nightResult: null,
      gardenDuty: this.gardenDutyView(),
      planOpen: false,
      campusMapOpen: false,
      campusMap: null,
      crouching: false,
    });
    this.world.hideMarker();
    this.input.reset();
    this.input.setEnabled(true);
    this.requestPointerLock();
    this.saveGame(false);
    this.showToast("Mr. Barua hands you a watering can. Three beds, no shortcuts.");
    return true;
  }

  private gardenDutyView(): GardenDutyView {
    return {
      active: this.gardenDuty?.active ?? false,
      watered: this.gardenDuty?.watered.size ?? 0,
      total: this.gardenDuty?.total ?? 3,
      complete: this.profile?.achievements.includes("garden-duty") ?? false,
    };
  }

  private waterGardenPlot(itemId: GardenItemId): void {
    if (!this.gardenDuty?.active) return;
    if (this.gardenDuty.watered.has(itemId)) {
      this.showToast("That bed is already watered.");
      return;
    }
    this.gardenDuty.watered.add(itemId);
    this.audio.uiClick();
    const remaining = this.gardenDuty.total - this.gardenDuty.watered.size;
    if (remaining > 0) {
      this.store.patch({ gardenDuty: this.gardenDutyView() });
      this.saveGame(false);
      this.showToast(
        `${gardenItem(itemId).name} watered. ${remaining} bed${remaining === 1 ? "" : "s"} left.`,
      );
      return;
    }
    this.gardenDuty.active = false;
    this.world.setGardenInteractablesActive(false);
    this.world.setGardenPlotVerb(null);
    this.grantProgress(0, "garden-duty");
    this.store.patch({ gardenDuty: this.gardenDutyView() });
    this.saveGame(false);
    this.showToast("Garden duty complete. Mr. Barua signs your card and points you toward breakfast.");
    if (this.gardenDutyTimer) window.clearTimeout(this.gardenDutyTimer);
    this.gardenDutyTimer = window.setTimeout(() => {
      if (this.disposed) return;
      this.store.patch({ gardenDuty: null });
      this.gardenDutyTimer = null;
    }, 5000);
  }

  private cancelGardenDuty(clearStore = true): void {
    if (this.gardenDutyTimer) {
      window.clearTimeout(this.gardenDutyTimer);
      this.gardenDutyTimer = null;
    }
    this.gardenDuty = null;
    if (!this.world.night) {
      this.world.setGardenInteractablesActive(false);
      this.world.setGardenPlotVerb(null);
    } else {
      this.world.setGardenPlotVerb(null);
    }
    if (clearStore && this.store.getState().gardenDuty !== null) {
      this.store.patch({ gardenDuty: null });
    }
  }

  interact(): void {
    const state = this.store.getState();
    if (state.screen !== "playing" || state.settingsOpen) return;
    if (this.multiplayer) {
      const crate = this.multiplayer.layer.nearestCrate(
        this.player.position.x,
        this.player.position.z,
      );
      if (crate) {
        if (this.multiplayer.collectCooldown > 0) return;
        this.multiplayer.collectCooldown = 0.45;
        this.multiplayer.adapter.onCollect(
          crate.id,
          this.player.position.x,
          this.player.position.z,
        );
        this.player.playInteract();
        this.audio.uiClick();
        return;
      }
    }
    const target = this.interaction.target;
    if (!target) return;
    this.player.playInteract();
    if (target.kind === "meal") {
      this.collectMessMeal();
      return;
    }
    if (target.kind === "teacher") {
      if (this.messMeal.isActive) {
        this.showToast("Do not stop to chat. A teacher who sees you out here will send you to the Principal.");
        return;
      }
      const teacherId = this.teachers?.teacherForInteractable(target.id);
      if (teacherId) this.openTeacherDialogue(teacherId);
      return;
    }
    if (target.kind === "principal") {
      this.openPrincipalDialogue();
      return;
    }
    if (target.kind === "student") {
      return;
    }
    if (target.kind === "npc") {
      this.openDialogue();
      return;
    }
    if (target.kind === "roommate") {
      if (this.messMeal.isActive) {
        this.showToast("Your roommates are waiting quietly. Get the food first.");
      } else if (this.nightMode && this.night.active && this.night.currentStepId === "meet-roommate") {
        this.openNightChallenge(target.position);
      } else if (this.nightMode && this.night.active) {
        this.showToast("Your roommate is pretending to be asleep. The garden is waiting.");
      } else {
        this.showToast("The roommate is asleep. Lights-out is over.");
      }
      return;
    }
    if (target.kind === "garden" && target.itemId) {
      if (this.gardenDuty?.active) {
        this.waterGardenPlot(target.itemId);
        return;
      }
      if (!this.nightMode || !this.night.active) return;
      if (this.night.currentStepId !== "collect-vegetables") {
        this.showToast("Not before the challenge. Your roommate has the plan.");
        return;
      }
      const result = this.night.collect(target.itemId);
      if (!result.ok) {
        this.showToast(result.reason ?? "You cannot pick that yet.");
        return;
      }
      this.audio.uiClick();
      this.saveGame(false);
      this.store.patch({ night: this.night.view(this.suspicion, this.world.patrolDetection.hidden) });
      if (result.completed) {
        this.showToast("All four fictional markers found. Return them to the hostel before the next sweep.");
        this.updateNightMarker();
      } else {
        this.showToast(`${gardenItem(target.itemId).markerName} found. Keep low.`);
      }
      return;
    }
    if (target.kind === "notice" || target.kind === "book") {
      this.openNotice(target.notice ?? NOTICE_CONTENT, target.id === "notice-board");
      return;
    }
    if (target.kind === "door" && target.door) {
      if (target.door.isOpen) {
        const distance = Math.hypot(
          this.player.position.x - target.position.x,
          this.player.position.z - target.position.z,
        );
        if (distance < 1.25) {
          this.showToast("Step clear of the doorway before closing the door.");
          return;
        }
      }
      target.door.toggle();
      this.audio.door();
      this.store.setPrompt(this.interaction.promptFor(target));
      return;
    }
  }

  advanceDialogue(): void {
    if (this.store.getState().screen !== "dialogue") return;
    if (this.dialogueSource === "principal") {
      const ended = this.principalDialogue.advance();
      if (ended) {
        this.finishPrincipalDialogue();
      } else {
        this.store.setDialogue(this.principalDialogue.currentView());
        this.audio.uiClick();
      }
      return;
    }
    if (this.dialogueSource === "teacher") {
      const ended = this.teachers?.advance() ?? true;
      if (ended) {
        this.finishTeacherDialogue();
      } else if (this.teachers) {
        this.store.setDialogue(this.teachers.currentDialogueView());
        this.audio.uiClick();
      }
      return;
    }
    if (this.dialogueSource === "night" || this.dialogueSource === "caught") {
      const ended = this.night.advanceDialogue();
      if (ended) {
        if (this.dialogueSource === "night") this.finishNightChallenge();
        else this.finishCaughtDialogue();
      } else {
        this.store.setDialogue(this.night.currentView());
        this.audio.uiClick();
      }
      return;
    }
    const ended = this.npc.advance();
    if (ended) {
      this.finishDialogue();
    } else {
      this.store.setDialogue(this.npc.currentView());
      this.audio.uiClick();
    }
  }

  chooseDialogue(index: number): void {
    if (this.store.getState().screen !== "dialogue") return;
    if (this.dialogueSource === "principal") {
      if (this.principalDialogue.choose(index)) {
        this.store.setDialogue(this.principalDialogue.currentView());
        this.audio.uiClick();
      }
      return;
    }
    if (this.dialogueSource === "teacher") {
      const result = this.teachers?.choose(index);
      if (!result) return;
      if (result.principalReferral) {
        this.assignPrincipalReferral(result.referralReason);
      }
      if (result.ended) {
        this.syncDisciplineHud(true);
        if (result.disciplineStarted) {
          this.showToast("Discipline task assigned. Report to your house hostel before the timer ends.");
        }
        this.finishTeacherDialogue();
        return;
      }
      this.store.setDialogue(result.view);
      this.audio.uiClick();
      if (result.warning) this.audio.chime();
      if (result.principalReferral) {
        this.assignPrincipalReferral(result.referralReason);
      }
      this.syncDisciplineHud(true);
      if (result.disciplineStarted) {
        this.showToast("Discipline task assigned. Report to your house hostel before the timer ends.");
      }
      return;
    }
    if (this.dialogueSource === "night") {
      if (this.night.chooseDialogue(index)) {
        this.store.setDialogue(this.night.currentView());
        this.audio.uiClick();
      }
      return;
    }
    if (this.npc.choose(index)) {
      this.store.setDialogue(this.npc.currentView());
      this.audio.uiClick();
    }
  }

  closeNotice(): void {
    if (this.store.getState().screen !== "notice") return;
    this.store.setNotice(null);
    this.store.patch({ screen: "playing" });
    this.input.reset();
    this.input.setEnabled(true);
    this.audio.uiClick();
  }

  continueExploring(): void {
    if (this.store.getState().screen !== "ending") return;
    this.store.patch({ screen: "playing", ending: null });
    this.input.reset();
    this.input.setEnabled(true);
    this.requestPointerLock();
    this.audio.uiClick();
  }

  setJoystick(x: number, y: number): void {
    this.input.setJoystick(x, y);
  }

  addLook(dx: number, dy: number): void {
    this.input.addLook(dx, dy);
  }

  setTouchRunning(running: boolean): void {
    this.input.setTouchRunning(running);
  }

  jump(): void {
    this.input.queueJump();
  }

  uiClick(): void {
    this.audio.uiClick();
  }

  requestPointerLock(): void {
    if (this.store.getState().isTouch) return;
    this.input.requestPointerLock();
  }

  releasePointerLock(): void {
    this.pointerLockArmed = false;
    this.input.releasePointerLock();
  }

  dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    if (this.resizeObserver) this.resizeObserver.disconnect();
    if (this.toastTimer) window.clearTimeout(this.toastTimer);
    if (this.endingTimer) window.clearTimeout(this.endingTimer);
    if (this.gardenDutyTimer) window.clearTimeout(this.gardenDutyTimer);
    window.removeEventListener("keydown", this.handleGlobalKeyDown);
    window.removeEventListener("pagehide", this.handlePageHide);
    document.removeEventListener("visibilitychange", this.handleVisibility);
    this.input.detach();
    this.audio.dispose();
    this.multiplayer?.layer.dispose();
    this.multiplayer = null;
    this.player.dispose();
    this.teachers?.dispose();
    this.teachers = null;
    this.world.dispose();
    this.removeDebugApi();
    this.scene.clear();
    this.composer?.dispose();
    this.composer = null;
    this.fxaaPass = null;
    this.environmentTexture?.dispose();
    this.environmentTexture = null;
    if (this.renderer) {
      this.renderer.dispose();
      this.renderer.forceContextLoss();
      this.renderer.domElement.remove();
      this.renderer = null;
    }
  }

  // ------------------------------------------------------------- game actions

  private enterPlaying(snapCamera: boolean): void {
    this.store.patch({
      screen: "playing",
      settingsOpen: false,
      profileOpen: false,
      planOpen: false,
      campusMapOpen: false,
      campusMap: null,
      prompt: null,
      ending: null,
    });
    this.store.setMission(this.mission.view());
    this.input.reset();
    this.input.setEnabled(true);
    if (snapCamera) this.cameraController.resetToPlayer(this.player.position, this.player.rotationY);
    if (this.nightMode && this.night.active) this.updateNightMarker();
    else if (this.messMeal.isActive) this.updateMessMarker();
    else this.world.showMarker(this.mission.currentStepId, this.mission.done);
    this.requestPointerLock();
  }

  private updateNightMarker(): void {
    if (!this.nightMode || !this.night.active || !this.profile) {
      this.world.hideMarker();
      return;
    }
    const hostel = this.world.houseHostels[this.profile.houseId];
    if (!hostel) {
      this.world.hideMarker();
      return;
    }
    switch (this.night.currentStepId) {
      case "meet-roommate":
      case "garden-challenge":
        this.world.showMarkerAt(hostel.roommatePoint);
        break;
      case "reach-garden":
      case "collect-vegetables":
        this.world.showMarkerAt(this.world.gardenCenter);
        break;
      case "return-home":
        this.world.showMarkerAt(hostel.markerPoint);
        break;
      default:
        this.world.hideMarker();
    }
  }

  private syncNightHud(): void {
    if (!this.nightMode || !this.night.active) {
      if (this.store.getState().night !== null) this.store.patch({ night: null });
      return;
    }
    this.store.patch({
      night: this.night.view(this.suspicion, this.world.patrolDetection.hidden),
    });
  }

  private updateNightProgress(dt: number, noise: number): void {
    if (!this.nightMode || !this.night.active) return;
    const detection = this.world.patrolDetection;
    if (detection.hidden) {
      this.suspicion -= dt * 0.55;
    } else if (detection.seen) {
      const proximity = 1 - Math.min(1, detection.distance / 9);
      this.suspicion += dt * (0.3 + noise * 0.55 + proximity * 0.32);
    } else {
      this.suspicion -= dt * 0.24;
    }
    this.suspicion = THREE.MathUtils.clamp(this.suspicion, 0, 1);

    if (this.suspicion >= 1 && !this.nightCaughtHandled) {
      this.nightCaughtHandled = true;
      this.night.fail();
      this.syncNightHud();
      this.saveGame(false);
      this.input.setEnabled(false);
      this.input.reset();
      this.releasePointerLock();
      this.dialogueSource = "caught";
      this.dialogueAnchor.copy(this.player.position);
      this.store.setPrompt(null);
      this.store.setDialogue(this.night.startCaught());
      this.store.setScreen("dialogue");
      this.audio.chime();
      return;
    }

    if (this.night.currentStepId === "reach-garden" && this.world.isInsideGarden(this.player.position)) {
      this.night.reachGarden();
      this.saveGame(false);
      this.updateNightMarker();
      this.showToast("The garden game zone. Four marker beds, one marker each. Watch the torchlight.");
      this.audio.chime();
    }

    if (
      this.night.currentStepId === "return-home" &&
      this.profile &&
      this.world.isInsideHouseHostel(this.profile.houseId, this.player.position)
    ) {
      this.night.returnHome();
      this.saveGame(false);
      this.showNightResult("success");
      return;
    }

    this.nightHudTimer += dt;
    if (this.nightHudTimer >= 0.1) {
      this.nightHudTimer = 0;
      this.syncNightHud();
    }
  }

  private teacherContext(mode: "playing" | "dialogue" | "frozen") {
    const hostel = this.profile ? this.world.houseHostels[this.profile.houseId] : null;
    return {
      profile: this.profile,
      player: this.player.position,
      playtime: this.playtime,
      houseHostel: hostel ? { x: hostel.center.x, z: hostel.center.z } : null,
      insideHouseHostel: this.profile
        ? this.world.isInsideHouseHostel(this.profile.houseId, this.player.position)
        : false,
      mode,
      crouching: this.crouching,
    };
  }

  private syncDisciplineHud(force = false): void {
    if (!this.teachers) return;
    const view = this.teachers.disciplineView();
    const signature = view ? `${view.teacherName}:${view.secondsLeft}` : null;
    const previous = this.lastDiscipline ? `${this.lastDiscipline.teacherName}:${this.lastDiscipline.secondsLeft}` : null;
    if (force || signature !== previous) {
      this.lastDiscipline = view;
      this.store.patch({ discipline: view });
    }
    if (this.teachers.consumeDisciplineAssignment()) {
      this.showToast("Discipline task assigned. Report to your house hostel before the timer ends.");
    }
    const resolution = this.teachers.consumeDisciplineResolution();
    if (resolution === "completed") {
      this.lastDiscipline = null;
      this.store.patch({ discipline: null });
      this.showToast("House hostel check complete. Your conduct has been noted positively.");
    } else if (resolution === "missed") {
      this.showToast("The hostel check was missed. Your conduct record now shows another warning.");
    }
  }

  private openTeacherDialogue(id: TeacherId): void {
    if (!this.teachers || !this.profile) return;
    const time = Math.floor(this.playtime);
    const hostel = this.world.houseHostels[this.profile.houseId];
    const view = this.teachers.startConversation(id, {
      profile: this.profile,
      player: this.player.position,
      playtime: time,
      houseHostel: hostel ? { x: hostel.center.x, z: hostel.center.z } : null,
      insideHouseHostel: this.world.isInsideHouseHostel(this.profile.houseId, this.player.position),
      mode: "playing",
      crouching: this.crouching,
    });
    if (!view) {
      this.showToast("That teacher is not ready to talk just now.");
      return;
    }
    this.input.setEnabled(false);
    this.store.setPrompt(null);
    this.releasePointerLock();
    this.dialogueSource = "teacher";
    this.teacherDialogueId = id;
    const controller = this.teachers.teacher(id);
    if (controller) this.dialogueAnchor.copy(controller.position);
    this.store.setDialogue(view);
    this.store.setScreen("dialogue");
    this.audio.uiClick();
  }

  private finishTeacherDialogue(): void {
    this.dialogueSource = null;
    this.teacherDialogueId = null;
    this.store.setDialogue(null);
    this.store.patch({ screen: "playing" });
    this.input.reset();
    this.input.setEnabled(true);
    this.playtime = Math.max(this.playtime, 0);
    this.syncDisciplineHud(true);
    this.saveGame(false);
    this.requestPointerLock();
  }

  private assignPrincipalReferral(reason: string | null): void {
    if (!this.profile || !this.principalReferral) return;
    const teacherId = this.teacherDialogueId;
    const teacher = teacherId ? this.teachers?.teacher(teacherId) : undefined;
    const assigned = this.principalReferral.assign({
      teacherId: teacherId ?? "faculty",
      teacherName: teacher?.config.name ?? "A teacher",
      reason: reason ?? "Referred by a teacher for indiscipline",
      player: this.player.position,
      now: this.elapsed * 1000,
    });
    if (!assigned) return;
    this.principalReferral.update(this.player.position, 0);
    this.store.patch({ principalReferral: this.principalReferral.view(this.player.position) });
    this.showToast("Principal referral issued. Follow the highlighted route to Principal Moinm Rahman.");
    this.audio.chime();
  }

  private openPrincipalDialogue(): void {
    if (!this.profile) return;
    this.input.setEnabled(false);
    this.store.setPrompt(null);
    this.releasePointerLock();
    this.dialogueSource = "principal";
    this.dialogueAnchor.set(PRINCIPAL.interactionPoint.x, 0, PRINCIPAL.interactionPoint.z);
    if (this.principalReferral?.isActive) {
      this.principalReferral.update(this.player.position, 0);
      this.store.patch({ principalReferral: this.principalReferral.view(this.player.position) });
    }
    const student = getStudent(this.profile.characterId);
    const referral = this.principalReferral?.isActive ? this.principalReferral.toSave() : null;
    this.store.setDialogue(
      this.principalDialogue.start({
        studentName: student?.displayName ?? "Student",
        referralActive: Boolean(referral?.active),
        teacherName: referral?.teacherName ?? null,
        reason: referral?.reason ?? null,
        bunkActive: this.classBunk.isActive && this.classBunk.view().status === "caught",
        messMealActive: this.messMeal.isActive && this.messMeal.status === "caught",
        mealCollected: this.messMeal.mealCollected,
      }),
    );
    this.store.setScreen("dialogue");
    this.audio.uiClick();
  }

  private completePrincipalReferral(): void {
    if (!this.principalReferral?.isActive) return;
    this.principalReferral.complete();
    this.store.patch({ principalReferral: null });
    this.showToast("Referral resolved. Principal Moinm Rahman has closed the matter.");
    this.audio.chime();
    this.saveGame(false);
  }

  private finishPrincipalDialogue(): void {
    const resolved = this.principalDialogue.isResolved;
    const bunkOutcome = this.principalDialogue.classBunkOutcome;
    const messOutcome = this.principalDialogue.messMealOutcome;
    const bunkCaught = this.classBunk.isActive && this.classBunk.view().status === "caught";
    const messCaught = this.messMeal.isActive && this.messMeal.status === "caught";
    this.principalDialogue.end();
    this.dialogueSource = null;
    this.store.setDialogue(null);
    this.store.patch({ screen: "playing" });
    this.input.reset();
    this.input.setEnabled(true);
    if (resolved) this.completePrincipalReferral();
    if (bunkCaught) {
      this.bunkPrincipalAutoOpened = true;
      if (bunkOutcome === "resume" || (resolved && bunkOutcome === null)) {
        this.classBunk.resumeAfterCaught();
        this.showToast("Back to the corridors. Your completed stops are still on record.");
      } else if (bunkOutcome === "end") {
        this.classBunk.endAfterCaught();
        this.teachers?.setActiveSubset(null);
        this.teachers?.setTimetablePhase(null);
        this.showToast("Principal Moinm Rahman has ended the class bunk attempt.");
      }
      this.store.patch({ classBunk: this.classBunk.view() });
    }
    if (messCaught) {
      this.messPrincipalAutoOpened = resolved;
      if (resolved && messOutcome === "resume") {
        this.messMeal.resumeAfterCaught();
        this.teachers?.setEnabled(true);
        this.teachers?.setActiveSubset(this.messMeal.teacherIds);
        this.teachers?.setSpeedScale(this.messMeal.teacherSpeed);
        this.teachers?.setTimetablePhase("hostel");
        this.world.setMealInteractableActive(!this.messMeal.mealCollected);
        this.updateMessMarker();
        this.showToast(
          this.messMeal.mealCollected
            ? "Back to the night route. Get the food home and stay clear of the patrols."
            : "Back to the night route. The serving counter is still waiting.",
        );
        this.store.patch({ messMeal: this.messMeal.view() });
        this.audio.uiClick();
      } else if (resolved && messOutcome === "return") {
        this.returnMessToHostelAfterPrincipal();
      } else {
        // Closing before the decision leaves the referral and mission paused.
        this.store.patch({ messMeal: this.messMeal.view() });
      }
    }
    this.saveGame(false);
    this.requestPointerLock();
  }

  closeDialogue(): void {
    if (this.store.getState().screen !== "dialogue") return;
    if (this.dialogueSource === "principal") {
      this.finishPrincipalDialogue();
      return;
    }
    if (this.dialogueSource === "teacher") {
      this.teachers?.closeConversation();
      this.finishTeacherDialogue();
      return;
    }
    if (this.dialogueSource === "bunk-caught") {
      this.dialogueSource = null;
      this.store.setDialogue(null);
      this.store.patch({
        screen: "playing",
        classBunk: this.classBunk.view(),
        principalReferral: this.principalReferral?.view(this.player.position) ?? null,
      });
      this.input.reset();
      this.input.setEnabled(true);
      this.saveGame(false);
      this.requestPointerLock();
      return;
    }
    if (this.dialogueSource === "mess-caught") {
      if (this.messCaughtTeacherId) {
        this.teachers?.teacher(this.messCaughtTeacherId)?.stopTalking(true);
      }
      this.dialogueSource = null;
      this.messCaughtTeacherId = null;
      this.store.setDialogue(null);
      this.store.patch({
        screen: "playing",
        messMeal: this.messMeal.view(),
        principalReferral: this.principalReferral?.view(this.player.position) ?? null,
      });
      this.input.reset();
      this.input.setEnabled(true);
      this.saveGame(false);
      this.requestPointerLock();
      return;
    }
    if (this.dialogueSource === "night" || this.dialogueSource === "caught") {
      this.night.endDialogue();
      this.dialogueSource = null;
      this.store.setDialogue(null);
      this.store.patch({ screen: "playing" });
      this.input.reset();
      this.input.setEnabled(true);
      this.requestPointerLock();
      return;
    }
    this.npc.end();
    this.dialogueSource = null;
    this.store.setDialogue(null);
    this.store.patch({ screen: "playing" });
    this.input.reset();
    this.input.setEnabled(true);
    this.requestPointerLock();
  }

  private openDialogue(): void {
    this.input.setEnabled(false);
    this.store.setPrompt(null);
    this.releasePointerLock();
    this.dialogueSource = "meera";
    this.dialogueAnchor.copy(this.world.npcPosition);
    this.store.setDialogue(this.npc.start({ step: this.mission.stepIndex, done: this.mission.done }));
    this.store.setScreen("dialogue");
    this.audio.uiClick();
  }

  private finishDialogue(): void {
    this.npc.end();
    this.dialogueSource = null;
    this.store.setDialogue(null);
    this.store.patch({ screen: "playing" });
    this.input.reset();
    this.input.setEnabled(true);
    if (this.mission.currentStepId === "meet-meera") {
      this.completeStep("meet-meera");
    }
    this.requestPointerLock();
  }

  private openNightChallenge(anchor: THREE.Vector3): void {
    if (!this.profile) return;
    this.input.setEnabled(false);
    this.store.setPrompt(null);
    this.releasePointerLock();
    this.dialogueSource = "night";
    this.dialogueAnchor.copy(anchor);
    this.store.setDialogue(this.night.startChallenge(this.profile.houseId));
    this.store.setScreen("dialogue");
    this.audio.uiClick();
  }

  private finishNightChallenge(): void {
    this.night.endDialogue();
    this.night.meetRoommate();
    this.dialogueSource = null;
    this.store.setDialogue(null);
    this.store.patch({
      screen: "playing",
      night: this.night.view(this.suspicion, this.world.patrolDetection.hidden),
    });
    this.input.reset();
    this.input.setEnabled(true);
    this.updateNightMarker();
    this.saveGame(false);
    this.showToast("South lawn, garden game zone. Four markers, then back. Crouch near the hedge.");
    this.requestPointerLock();
  }

  private finishCaughtDialogue(): void {
    this.night.endDialogue();
    this.dialogueSource = null;
    this.store.setDialogue(null);
    this.showNightResult("caught");
  }

  private grantProgress(
    xpAmount: number,
    achievementId: string | null,
  ): { xpAwarded: number; alreadyClaimed: boolean } {
    if (!this.profile) return { xpAwarded: 0, alreadyClaimed: true };
    const alreadyClaimed = achievementId ? this.profile.achievements.includes(achievementId) : false;
    const result = awardProgress(this.profile, xpAmount, achievementId);
    this.profile = result.profile;
    const view = toProfileView(this.profile);
    if (view) this.store.patch({ profile: view });
    if (achievementId && result.achievementAdded) {
      this.identityProgressSink?.(achievementId);
    }
    return { xpAwarded: result.awardedXp, alreadyClaimed };
  }

  private showNightResult(outcome: "success" | "caught"): void {
    const house = this.profile ? getHouse(this.profile.houseId) : undefined;
    let xpAwarded = 0;
    let alreadyClaimed = false;
    let achievementId: string | null = null;
    if (outcome === "success" && this.night.success) {
      const result = this.grantProgress(60, "midnight-garden");
      xpAwarded = result.xpAwarded;
      alreadyClaimed = result.alreadyClaimed;
      achievementId = "midnight-garden";
    } else if (outcome === "caught") {
      const result = this.grantProgress(0, "caught-in-the-act");
      alreadyClaimed = result.alreadyClaimed;
      achievementId = "caught-in-the-act";
    }
    const collected = outcome === "success" ? this.night.collected : [];
    const resultView: NightResultView = {
      outcome,
      title: outcome === "success" ? "Mischief managed" : "Caught on the lawn",
      message:
        outcome === "success"
          ? `You made it back to ${house?.hostelName ?? "the hostel"} with all four fictional markers and no torchlight on your heels. The club gets them back tomorrow. Your roommate is already pretending to be asleep.`
          : "Mr. Barua confiscated the painted markers and delivered a short, devastating lecture about running through the botany beds after lights-out. No real produce was taken. Your roommate claims to have been asleep.",
      xpAwarded,
      rewardAlreadyClaimed: alreadyClaimed,
      achievementId,
      collected: [...collected],
      attempts: this.night.attempts,
    };
    this.store.patch({
      screen: "night-result",
      nightResult: resultView,
      night: null,
      prompt: null,
    });
    this.input.setEnabled(false);
    this.input.reset();
    this.releasePointerLock();
    this.saveGame(false);
    this.audio.chime();
  }

  private openNotice(notice: NoticeView = NOTICE_CONTENT, countsForMission = false): void {
    this.input.setEnabled(false);
    this.releasePointerLock();
    this.store.setNotice(notice);
    this.store.setScreen("notice");
    this.store.setPrompt(null);
    if (countsForMission) this.completeStep("notice-board");
    this.audio.uiClick();
  }

  private completeStep(stepId: string): void {
    const result = this.mission.completeStep(stepId);
    if (!result.changed) return;
    this.store.setMission(this.mission.view());
    this.world.showMarker(this.mission.currentStepId, this.mission.done);
    this.audio.chime();
    if (result.allDone) {
      this.grantProgress(120, "first-day");
    }
    this.saveGame(false);
    if (result.allDone) {
      this.showToast("Welcome home. Open the campus map, or start Operation Midnight Mischief from the pause menu.");
      this.scheduleEnding();
    } else {
      const view = this.mission.view();
      this.showToast(`Objective complete · ${view.objective}`);
    }
  }

  private scheduleEnding(): void {
    if (this.endingTimer) window.clearTimeout(this.endingTimer);
    this.endingTimer = window.setTimeout(() => {
      if (this.disposed) return;
      if (this.store.getState().screen !== "playing") return;
      this.store.patch({
        screen: "ending",
        ending: {
          minutes: Math.max(1, Math.round(this.playtime / 60)),
          steps: MISSION_STEPS.length,
        },
      });
      this.input.setEnabled(false);
      this.store.setPrompt(null);
      this.releasePointerLock();
      this.saveGame(false);
      this.audio.chime();
    }, 1800);
  }

  private applyAtmosphere(night: boolean): void {
    this.scene.background = new THREE.Color(night ? "#070b14" : "#c6b69a");
    const viewDistance = Math.max(0.6, this.store.getState().settings.viewDistance);
    this.scene.fog = new THREE.FogExp2(
      night ? 0x08101d : 0xccb591,
      (qualityProfile(this.quality).fogDensity / viewDistance) * (night ? 1.55 : 1),
    );
  }

  private autoTunedSettings(base: GameSettings, quality: Quality): GameSettings {
    const profile = QUALITY_PROFILES[quality];
    return {
      ...base,
      shadowQuality:
        quality === "low" ? "low" : quality === "medium" ? "medium" : "high",
      textureQuality: profile.texture,
      antialias: profile.antialias,
      effectsQuality: profile.effects,
    };
  }

  private applySettings(settings: GameSettings, options: { announce: boolean }): void {
    this.store.setSettings(settings);
    this.audio.setSettings(settings);
    const effective =
      settings.quality === "auto"
        ? (this.autoQuality ?? resolveAutoQuality())
        : settings.quality;
    if (settings.quality !== "auto") this.autoQuality = effective;
    this.quality = effective;
    this.world.setGraphics(effective, settings.shadowQuality, settings.textureQuality);
    this.applyRenderState();
    this.applyAtmosphere(this.nightMode);
    this.applySize();
    this.store.patch({ quality: effective });
    if (options.announce) {
      const label = settings.quality === "auto" ? `Auto — ${QUALITY_PROFILES[effective].label}` : QUALITY_PROFILES[effective].label;
      this.store.toast(`Graphics set to ${label}.`);
    }
  }

  private showToast(message: string): void {
    if (this.toastTimer) window.clearTimeout(this.toastTimer);
    this.store.toast(message);
    this.toastTimer = window.setTimeout(() => {
      this.store.toast("");
      this.store.patch({ toast: null });
    }, 3600);
  }

  private handleGlobalKeyDown = (event: KeyboardEvent): void => {
    // The UI SDK interaction menu owns the keyboard while it is open, and its
    // own Escape dismissal may complete before this window listener runs.
    if (this.interactionMenuOpen) return;
    const target = event.target;
    if (target instanceof HTMLElement && target.closest("[data-navodaya-interaction-menu]")) return;
    const state = this.store.getState();
    // Campus Escape owns its keyboard controls while it is mounted.
    if (state.screen === "escape") return;
    if (state.screen === "adventure") {
      if (event.code === "Escape") this.closeAdventure();
      return;
    }
    if (event.code === "Escape") {
      if (state.cameraOverview) {
        this.exitCameraOverview();
        return;
      }
      if (state.planOpen) {
        this.choosePlan("later");
        return;
      }
      if (state.campusMapOpen) {
        this.closeCampusMap();
        return;
      }
      if (state.profileOpen) {
        this.closeProfile();
        return;
      }
      if (state.settingsOpen) {
        this.closeSettings();
        return;
      }
      if (state.screen === "notice") {
        this.closeNotice();
        return;
      }
      if (state.screen === "creation") {
        this.cancelCreation();
        return;
      }
      if (state.screen === "playing") this.pause();
      else if (state.screen === "paused") this.resume();
      return;
    }
    if (state.screen === "playing" && event.code === "KeyC" && !event.repeat) {
      event.preventDefault();
      this.toggleCrouch();
      return;
    }
    if (state.screen === "playing" && event.code === "KeyO" && !event.repeat) {
      event.preventDefault();
      if (state.cameraOverview) this.exitCameraOverview();
      else this.enterCameraOverview();
      return;
    }
    if (state.screen === "dialogue") {
      if (event.code === "Space" || event.code === "Enter" || event.code === "KeyE") {
        if (state.dialogue && !state.dialogue.canAdvance) return;
        event.preventDefault();
        this.advanceDialogue();
      }
      return;
    }
    if (state.screen === "notice" && (event.code === "Enter" || event.code === "Space")) {
      event.preventDefault();
      this.closeNotice();
    }
  };

  private handlePageHide = (): void => {
    if (this.mission.started) this.saveGame(false);
  };

  private handleVisibility = (): void => {
    if (document.hidden && this.store.getState().screen === "playing") this.pause();
  };

  // -------------------------------------------------------------------- loop

  private tick = (): void => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.tick);
    const dt = Math.min(this.clock.getDelta(), 0.05);
    this.elapsed += dt;

    const state = this.store.getState();
    const simulating =
      state.screen === "playing" &&
      !state.settingsOpen &&
      !state.profileOpen &&
      !state.cameraOverview;

    this.audio.update(dt);

    if (state.cameraOverview) {
      this.cameraController.updateOverview(
        dt,
        this.input,
        state.settings.sensitivity,
        state.settings.invertY,
      );
      this.store.setPrompt(null);
    } else if (simulating) {
      this.playtime += dt;
      if (this.input.consumeInteract()) this.interact();
      this.player.update(
        dt,
        this.input,
        this.cameraController.yaw,
        this.world.colliders,
        this.world.bounds,
        this.world.walkHeightAt,
      );
      this.cameraController.updateFollow(
        dt,
        this.player.position,
        this.player.rotationY,
        this.input,
        this.world.occluders,
        state.settings.sensitivity,
        state.settings.invertY,
        this.player.moving,
        false,
        this.player.running ? 1 : this.player.moving ? 0.35 : 0,
      );

      const teachersEnabled =
        !this.multiplayer &&
        (!this.nightMode || this.messMeal.isActive) &&
        !this.messMeal.view().result;
      this.teachers?.setEnabled(teachersEnabled);
      if (teachersEnabled) {
        if (this.messCaughtStage === "approach" && this.messCaughtTeacherId) {
          const arrived =
            this.teachers?.approachCaughtPlayer(
              this.messCaughtTeacherId,
              dt,
              this.player.position.x,
              this.player.position.z,
            ) ?? false;
          this.messCaughtTimer += dt;
          if ((arrived && this.messCaughtTimer >= 0.65) || this.messCaughtTimer >= 6) {
            this.openMessCaughtDialogue();
          }
        } else {
          this.teachers?.update(dt, this.elapsed, this.teacherContext("playing"));
          this.disciplineHudTimer += dt;
          if (this.disciplineHudTimer >= 0.25) {
            this.disciplineHudTimer = 0;
            this.syncDisciplineHud();
          }
          if (this.messMeal.isActive) this.updateMessMeal(dt);
          else this.updateClassBunk(dt);
        }
      }
      if (!this.multiplayer && this.principalReferral?.isActive) {
        this.principalReferralTimer += dt;
        if (this.principalReferralTimer >= 0.5) {
          this.principalReferralTimer = 0;
          this.principalReferral.update(this.player.position, this.elapsed);
          this.store.patch({ principalReferral: this.principalReferral.view(this.player.position) });
        }
        if (
          !this.bunkPrincipalAutoOpened &&
          this.classBunk.view().status === "caught" &&
          this.world.isInsidePrincipalChamber(this.player.position)
        ) {
          this.bunkPrincipalAutoOpened = true;
          this.openPrincipalDialogue();
        } else if (
          !this.messPrincipalAutoOpened &&
          this.messMeal.isActive &&
          this.messMeal.status === "caught" &&
          this.world.isInsidePrincipalChamber(this.player.position)
        ) {
          this.messPrincipalAutoOpened = true;
          this.openPrincipalDialogue();
        }
      }

      const target = this.interaction.update(this.player.position);
      const crate = this.multiplayer
        ? this.multiplayer.layer.nearestCrate(this.player.position.x, this.player.position.z)
        : null;
      if (this.messCaughtStage) {
        this.store.setPrompt(null);
      } else if (crate) {
        this.store.setPrompt(`Collect ${crate.name}`);
      } else {
        this.store.setPrompt(target ? this.interaction.promptFor(target) : null);
      }

      if (this.multiplayer) {
        this.updateMultiplayer(dt);
      } else {
        if (this.mission.currentStepId === "classroom" && insideZone(this.world.zones.classroom, this.player.position)) {
          this.completeStep("classroom");
        } else if (
          this.mission.currentStepId === "hostel" &&
          this.profile &&
          this.world.isInsideHouseHostel(this.profile.houseId, this.player.position)
        ) {
          this.completeStep("hostel");
        }
        this.updateExploration();
      }

      const seconds = Math.floor(this.playtime);
      if (seconds !== state.playtime) this.store.patch({ playtime: seconds });
    } else if (state.screen === "dialogue") {
      this.cameraController.updateDialogue(dt, this.player.position, this.dialogueAnchor);
      if (this.dialogueSource === "teacher" && this.teachers && !this.multiplayer && !this.nightMode) {
        this.teachers.setEnabled(true);
        this.teachers.update(dt, this.elapsed, this.teacherContext("dialogue"));
        this.syncDisciplineHud();
      } else {
        this.teachers?.setEnabled(false);
      }
      this.store.setPrompt(null);
    } else if (state.screen === "menu" || state.screen === "creation") {
      this.teachers?.setEnabled(false);
      this.cameraController.updateCinematic(this.elapsed);
      this.store.setPrompt(null);
    } else {
      this.teachers?.setEnabled(false);
      this.store.setPrompt(null);
    }

    const visibleScreens = ["playing", "paused", "dialogue", "notice", "ending", "night-result"];
    this.player.rig.group.visible = visibleScreens.includes(state.screen);
    const canvasOverlay = state.screen === "escape" || state.screen === "adventure";
    if (!canvasOverlay) {
      const noise =
        simulating && this.player.moving
          ? this.crouching
            ? 0.05
            : this.player.running
              ? 1
              : 0.45
          : 0;
      this.world.update(dt, this.elapsed, this.player.position, this.crouching, noise);
      if (simulating && this.nightMode && this.night.active) {
        this.updateNightProgress(dt, noise);
      }
    }
    this.measurePerformance(dt, simulating);

    // The 2.5D escape canvas is a complete presentation layer. Freezing the
    // three.js loop behind it keeps mid-range phones and software WebGL stable.
    if (!this.renderer || canvasOverlay) return;
    this.renderFrame();
  };

  private measurePerformance(dt: number, simulating: boolean): void {
    // Measure wall-clock rendering throughput, not capped simulation dt. On a
    // slow device dt is clamped to 50 ms, which would otherwise hide a 10 FPS
    // renderer and keep Auto from ever reacting.
    const now = performance.now();
    if (this.fpsTime <= 0) this.fpsTime = now;
    this.fpsFrames += 1;
    const sampleSeconds = (now - this.fpsTime) / 1000;
    if (sampleSeconds < 0.5) return;
    const fps = this.fpsFrames / sampleSeconds;
    this.fpsTime = now;
    this.fpsFrames = 0;
    this.store.patch({ fps: Math.round(fps) });

    const preference = this.store.getState().settings.quality;
    if (!simulating || preference !== "auto") {
      this.lowFpsSeconds = 0;
      this.highFpsSeconds = 0;
      return;
    }

    if (fps < 45) {
      this.lowFpsSeconds += sampleSeconds;
      this.highFpsSeconds = 0;
      const next = nextLowerQuality(this.quality);
      if (this.lowFpsSeconds >= 5 && next) {
        this.lowFpsSeconds = 0;
        this.autoQuality = next;
        this.autoAdjusted = true;
        const settings = this.autoTunedSettings(this.store.getState().settings, next);
        this.applySettings(settings, { announce: false });
        this.store.patch({ autoAdjusted: true });
        this.showToast(
          `Low frame rate detected — Auto graphics moved to ${QUALITY_PROFILES[next].label}. You can lock a tier in Settings.`,
        );
      }
    } else {
      this.lowFpsSeconds = Math.max(0, this.lowFpsSeconds - sampleSeconds);
      // Recover one tier after a sustained smooth stretch, but never climb past
      // the tier Auto picked at startup for this device.
      if (fps > 57) this.highFpsSeconds += sampleSeconds;
      else this.highFpsSeconds = Math.max(0, this.highFpsSeconds - sampleSeconds);
      if (this.autoAdjusted && this.highFpsSeconds >= 15) {
        const startTier = resolveAutoQuality();
        const order: Quality[] = ["low", "medium", "high", "ultra"];
        const currentIndex = order.indexOf(this.quality);
        const ceilingIndex = order.indexOf(startTier);
        if (currentIndex >= 0 && currentIndex < ceilingIndex) {
          this.highFpsSeconds = 0;
          const nextQuality = order[currentIndex + 1];
          this.autoQuality = nextQuality;
          this.applySettings(
            this.autoTunedSettings(this.store.getState().settings, nextQuality),
            { announce: false },
          );
        }
      }
    }
  }
}

function rendererCanvas(renderer: THREE.WebGLRenderer | null): HTMLElement {
  if (!renderer) {
    const fallback = document.createElement("div");
    fallback.tabIndex = 0;
    return fallback;
  }
  renderer.domElement.tabIndex = 0;
  return renderer.domElement;
}

function insideZone(zone: WorldZone, position: THREE.Vector3): boolean {
  const inset = 0.35;
  return (
    position.x > zone.minX + inset &&
    position.x < zone.maxX - inset &&
    position.z > zone.minZ + inset &&
    position.z < zone.maxZ - inset
  );
}
