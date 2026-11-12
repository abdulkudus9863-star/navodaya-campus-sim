import * as THREE from "three";
import { AudioSystem } from "./AudioSystem";
import { GameStore } from "./GameStore";
import { InputController } from "./InputController";
import { SaveSystem, sanitizeCharacter, sanitizeSettings } from "./SaveSystem";
import {
  DEFAULT_CHARACTER,
  MISSION_STEPS,
  UNIFORM_COLORS,
  emptyNightSave,
  type CharacterSettings,
  type DialogueView,
  type GameSettings,
  type NightResultView,
  type NoticeView,
  type PlayerProfileSave,
  type Quality,
  type SaveData,
} from "./types";
import { CameraController } from "../systems/CameraController";
import { InteractionSystem } from "../systems/InteractionSystem";
import { MissionSystem } from "../systems/MissionSystem";
import { NightMissionSystem } from "../systems/NightMissionSystem";
import { NPCSystem } from "../systems/NPCSystem";
import { PlayerController, collidesAt } from "../systems/PlayerController";
import { WorldEnvironment, type WorldZone } from "../world/WorldEnvironment";
import { DEFAULT_HOUSE_ID, HOUSES, getHouse, type HouseId } from "../data/houses";
import {
  STUDENT_ROSTER,
  getStudent,
  getStudentsForHouse,
  inspectRosterIntegrity,
  validateCharacterSelection,
} from "../data/students";
import { awardProgress, newPlayerProfile, toProfileView } from "../data/profile";
import { GARDEN_ITEMS, NIGHT_STEPS, gardenItem, type GardenItemId } from "../data/night";

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

const SKY_FOG: Record<Quality, number> = { low: 0.0095, medium: 0.0074, high: 0.0058 };

export class GameEngine {
  private container: HTMLElement;
  private store: GameStore;
  private saveSystem = new SaveSystem();
  private scene = new THREE.Scene();
  private renderer: THREE.WebGLRenderer | null = null;
  private cameraController: CameraController;
  private world: WorldEnvironment;
  private player: PlayerController;
  private input: InputController;
  private interaction: InteractionSystem;
  private npc = new NPCSystem();
  private mission = new MissionSystem();
  private night = new NightMissionSystem();
  private audio = new AudioSystem();
  private profile: PlayerProfileSave | null = null;
  private nightMode = false;
  private nightCaughtHandled = false;
  private suspicion = 0;
  private nightHudTimer = 0;
  private crouching = false;
  private dialogueSource: "meera" | "night" | "caught" | null = null;
  private dialogueAnchor = new THREE.Vector3();

  private clock = new THREE.Clock();
  private raf = 0;
  private elapsed = 0;
  private playtime = 0;
  private quality: Quality;
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
  private autoAdjusted = false;

  constructor(container: HTMLElement, store: GameStore) {
    this.container = container;
    this.store = store;
    const state = store.getState();
    this.quality = state.settings.quality;

    this.world = new WorldEnvironment();
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
    this.scene.fog = new THREE.FogExp2(0xccb591, SKY_FOG[this.quality]);

    try {
      const renderer = new THREE.WebGLRenderer({
        antialias: this.quality !== "low",
        powerPreference: "high-performance",
      });
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.02;
      renderer.shadowMap.enabled = this.quality !== "low";
      renderer.shadowMap.type = THREE.PCFShadowMap;
      renderer.domElement.style.display = "block";
      renderer.domElement.style.width = "100%";
      renderer.domElement.style.height = "100%";
      renderer.domElement.style.touchAction = "none";
      renderer.domElement.style.outline = "none";
      renderer.domElement.setAttribute("aria-label", "Navodaya campus, interactive 3D view");
      this.renderer = renderer;
      container.appendChild(renderer.domElement);
    } catch (error) {
      this.initError = error instanceof Error ? error.message : "WebGL could not start";
    }

    this.applySize();
    this.input.attach(rendererCanvas(this.renderer));
    this.input.setEnabled(false);
    this.world.setQuality(this.quality);
    window.addEventListener("keydown", this.handleGlobalKeyDown);
    window.addEventListener("pagehide", this.handlePageHide);
    document.addEventListener("visibilitychange", this.handleVisibility);
  }

  private aspect(): number {
    const width = this.container.clientWidth || 1;
    const height = this.container.clientHeight || 1;
    return width / height;
  }

  private applySize(): void {
    const width = this.container.clientWidth || 1;
    const height = this.container.clientHeight || 1;
    if (!this.renderer) return;
    const ratio = Math.min(
      window.devicePixelRatio || 1,
      this.quality === "high" ? 2 : this.quality === "medium" ? 1.5 : 1,
    );
    this.renderer.setPixelRatio(ratio);
    this.renderer.setSize(width, height, false);
    this.cameraController.resize(width / height);
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
        this.store.hydrateSave(saved.data);
        this.store.patch({ playtime: Math.round(saved.data.playtime), profile: toProfileView(saved.data.profile) });
        this.applySettings(saved.data.settings, { announce: false });
        this.store.setCharacter(saved.data.character);
        const house = getHouse(saved.data.profile.houseId);
        this.player.setCharacter(saved.data.character, house?.color);
        this.world.setHouse(saved.data.profile.houseId);
        this.mission.setHouseName(house?.shortName ?? "your house");
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
          position: { x: engine.player.position.x, z: engine.player.position.z },
          camera: { yaw: engine.cameraController.yaw, pitch: engine.cameraController.pitch },
          ending: Boolean(state.ending),
          profileOpen: state.profileOpen,
          crouching: engine.crouching,
          houseId: engine.profile?.houseId ?? null,
          characterId: engine.profile?.characterId ?? null,
          xp: engine.profile?.xp ?? 0,
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
      worldState() {
        return engine.world.inspect();
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
    this.night = new NightMissionSystem();
    this.nightCaughtHandled = false;
    this.suspicion = 0;
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
    const view = toProfileView(profile);
    this.night = new NightMissionSystem();
    this.nightMode = false;
    this.nightCaughtHandled = false;
    this.suspicion = 0;
    this.setCrouching(false);
    this.audio.setNight(false);
    this.world.setNight(false);
    this.applyAtmosphere(false);
    this.world.setHouse(house.id);
    this.mission.setHouseName(house.shortName);
    const character = this.store.getState().character;
    this.player.setCharacter(character, house.color);
    this.player.resetToSpawn(this.world.spawn);
    this.mission.startNew();
    this.store.setMission(this.mission.view());
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
    });
    this.enterPlaying(true);
    this.saveGame(false);
    this.showToast(
      `Welcome, ${validation.student.displayName} — ${house.name}. Your hostel is on the south lawn.`,
    );
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
    this.applySettings(data.settings, { announce: false });
    this.store.setCharacter(data.character);
    const house = getHouse(data.profile.houseId);
    this.player.setCharacter(data.character, house?.color);
    this.world.setHouse(data.profile.houseId);
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
    this.nightCaughtHandled = false;
    this.suspicion = 0;
    this.setCrouching(false);
    this.nightMode = data.night.active;
    this.audio.setNight(this.nightMode);
    this.world.setNight(this.nightMode);
    this.applyAtmosphere(this.nightMode);
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
      crouching: false,
    });
    this.enterPlaying(true);
    this.audio.uiClick();
    this.showToast("Welcome back to campus.");
    if (this.nightMode) {
      this.updateNightMarker();
    } else if (this.mission.done) {
      this.world.showMarker(null, true);
    }
    return true;
  }

  pause(): void {
    const state = this.store.getState();
    if (state.screen !== "playing" || state.profileOpen) return;
    this.store.setScreen("paused");
    this.store.setPrompt(null);
    this.input.setEnabled(false);
    this.saveGame(false);
    this.releasePointerLock();
  }

  resume(): void {
    if (this.store.getState().screen !== "paused") return;
    this.store.patch({ screen: "playing", settingsOpen: false, profileOpen: false });
    this.input.reset();
    this.input.setEnabled(true);
    this.requestPointerLock();
    this.audio.uiClick();
  }

  openProfile(): void {
    const state = this.store.getState();
    if (!state.profile) return;
    if (state.screen !== "playing" && state.screen !== "paused" && state.screen !== "menu") return;
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
      crouching: false,
      playtime: Math.round(this.playtime),
    });
    this.npc.end();
    this.setCrouching(false);
    if (this.nightMode) {
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
    this.profile = null;
    this.nightMode = false;
    this.nightCaughtHandled = false;
    this.suspicion = 0;
    this.playtime = 0;
    this.setCrouching(false);
    this.world.setNight(false);
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
      dialogue: null,
      notice: null,
      ending: null,
      prompt: null,
      playtime: 0,
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

  setCharacter(raw: CharacterSettings): void {
    const character = sanitizeCharacter(raw);
    this.store.setCharacter(character);
    const house = this.profile ? getHouse(this.profile.houseId) : undefined;
    this.player.setCharacter(character, house?.color ?? UNIFORM_COLORS[character.uniform]);
    this.audio.uiClick();
  }

  startNight(): boolean {
    const state = this.store.getState();
    if (!this.profile) return false;
    if (!this.mission.done) {
      this.showToast("Finish your first day before lights-out.");
      return false;
    }
    if (this.night.active) return false;
    const house = getHouse(this.profile.houseId);
    const hostel = this.world.houseHostels[this.profile.houseId];
    if (!house || !hostel) return false;
    void this.audio.unlock();
    this.night.startNew(this.night.toSave());
    this.nightMode = true;
    this.nightCaughtHandled = false;
    this.suspicion = 0;
    this.setCrouching(false);
    for (const door of this.world.doors) door.setOpenInstant(false);
    this.world.setNight(true);
    this.world.setGardenInteractablesActive(true);
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
      crouching: false,
    });
    this.store.setPrompt(null);
    this.input.reset();
    this.input.setEnabled(true);
    this.updateNightMarker();
    this.requestPointerLock();
    this.saveGame(false);
    this.showToast("Lights out. Your roommate is waiting inside the hostel.");
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

  interact(): void {
    const state = this.store.getState();
    if (state.screen !== "playing" || state.settingsOpen) return;
    const target = this.interaction.target;
    if (!target) return;
    if (target.kind === "npc") {
      this.openDialogue();
      return;
    }
    if (target.kind === "roommate") {
      if (this.nightMode && this.night.active && this.night.currentStepId === "meet-roommate") {
        this.openNightChallenge(target.position);
      } else if (this.nightMode && this.night.active) {
        this.showToast("Your roommate is pretending to be asleep. The garden is waiting.");
      } else {
        this.showToast("The roommate is asleep. Lights-out is over.");
      }
      return;
    }
    if (target.kind === "garden" && target.itemId) {
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
        this.showToast("Four vegetables. Now get back to the hostel before the next sweep.");
        this.updateNightMarker();
      } else {
        this.showToast(`${gardenItem(target.itemId).name} in the bag. Keep low.`);
      }
      return;
    }
    if (target.kind === "notice") {
      this.openNotice();
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
    window.removeEventListener("keydown", this.handleGlobalKeyDown);
    window.removeEventListener("pagehide", this.handlePageHide);
    document.removeEventListener("visibilitychange", this.handleVisibility);
    this.input.detach();
    this.audio.dispose();
    this.player.dispose();
    this.world.dispose();
    this.removeDebugApi();
    this.scene.clear();
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
      prompt: null,
      ending: null,
    });
    this.store.setMission(this.mission.view());
    this.input.reset();
    this.input.setEnabled(true);
    if (snapCamera) this.cameraController.resetToPlayer(this.player.position, this.player.rotationY);
    if (this.nightMode && this.night.active) this.updateNightMarker();
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
      this.showToast("The kitchen garden. Four plots, one of each. Watch the torchlight.");
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
    this.showToast("South lawn, kitchen garden. Four vegetables, then back. Crouch near the hedge.");
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
      title: outcome === "success" ? "Clean escape" : "Caught in the garden",
      message:
        outcome === "success"
          ? `You made it back to ${house?.hostelName ?? "the hostel"} with four vegetables and no torchlight on your heels. Your roommate is already pretending to be asleep.`
          : "Mr. Barua confiscated the vegetables and delivered a short, devastating lecture about permanent marker. The mess will get its tomatoes back. Your roommate claims to have been asleep.",
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

  private openNotice(): void {
    this.input.setEnabled(false);
    this.releasePointerLock();
    this.store.setNotice(NOTICE_CONTENT);
    this.store.setScreen("notice");
    this.store.setPrompt(null);
    this.completeStep("notice-board");
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
      this.showToast("Welcome home. Night Life is now available in the pause menu.");
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
    this.scene.fog = new THREE.FogExp2(
      night ? 0x08101d : 0xccb591,
      SKY_FOG[this.quality] * (night ? 1.55 : 1),
    );
  }

  private applySettings(settings: GameSettings, options: { announce: boolean }): void {
    this.store.setSettings(settings);
    this.audio.setSettings(settings);
    if (settings.quality !== this.quality) {
      this.quality = settings.quality;
      if (this.renderer) {
        this.renderer.shadowMap.enabled = settings.quality !== "low";
        this.scene.traverse((object) => {
          if (object instanceof THREE.Mesh) {
            const materials = Array.isArray(object.material) ? object.material : [object.material];
            for (const material of materials) material.needsUpdate = true;
          }
        });
      }
      this.world.setQuality(settings.quality);
      this.applyAtmosphere(this.nightMode);
      this.applySize();
      this.store.patch({ quality: settings.quality });
    }
    if (options.announce) this.store.toast(`Graphics set to ${settings.quality}.`);
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
    const state = this.store.getState();
    if (event.code === "Escape") {
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
    const simulating = state.screen === "playing" && !state.settingsOpen && !state.profileOpen;

    this.audio.update(dt);

    if (simulating) {
      this.playtime += dt;
      if (this.input.consumeInteract()) this.interact();
      this.player.update(dt, this.input, this.cameraController.yaw, this.world.colliders, this.world.bounds);
      this.cameraController.updateFollow(
        dt,
        this.player.position,
        this.input,
        this.world.occluders,
        state.settings.sensitivity,
        state.settings.invertY,
      );

      const target = this.interaction.update(this.player.position);
      this.store.setPrompt(target ? this.interaction.promptFor(target) : null);

      if (this.mission.currentStepId === "classroom" && insideZone(this.world.zones.classroom, this.player.position)) {
        this.completeStep("classroom");
      } else if (
        this.mission.currentStepId === "hostel" &&
        this.profile &&
        this.world.isInsideHouseHostel(this.profile.houseId, this.player.position)
      ) {
        this.completeStep("hostel");
      }

      const seconds = Math.floor(this.playtime);
      if (seconds !== state.playtime) this.store.patch({ playtime: seconds });
    } else if (state.screen === "dialogue") {
      this.cameraController.updateDialogue(dt, this.player.position, this.dialogueAnchor);
      this.store.setPrompt(null);
    } else if (state.screen === "menu" || state.screen === "creation") {
      this.cameraController.updateCinematic(this.elapsed);
      this.store.setPrompt(null);
    } else {
      this.store.setPrompt(null);
    }

    const visibleScreens = ["playing", "paused", "dialogue", "notice", "ending", "night-result"];
    this.player.rig.group.visible = visibleScreens.includes(state.screen);
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
    this.measurePerformance(dt, simulating);

    if (!this.renderer) return;
    this.renderer.render(this.scene, this.cameraController.camera);
  };

  private measurePerformance(dt: number, simulating: boolean): void {
    this.fpsTime += dt;
    this.fpsFrames += 1;
    if (this.fpsTime < 0.5) return;
    const fps = this.fpsFrames / this.fpsTime;
    this.fpsTime = 0;
    this.fpsFrames = 0;
    this.store.patch({ fps: Math.round(fps) });

    if (!simulating || this.autoAdjusted) return;
    if (fps < 42) {
      this.lowFpsSeconds += 0.5;
      if (this.lowFpsSeconds >= 5 && this.quality !== "low") {
        const next: Quality = this.quality === "high" ? "medium" : "low";
        this.autoAdjusted = true;
        this.lowFpsSeconds = 0;
        const settings = { ...this.store.getState().settings, quality: next };
        this.applySettings(settings, { announce: false });
        this.store.patch({ autoAdjusted: true });
        this.showToast(`Low frame rate detected — graphics set to ${next}. Change it any time in Settings.`);
      }
    } else {
      this.lowFpsSeconds = Math.max(0, this.lowFpsSeconds - 0.5);
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
