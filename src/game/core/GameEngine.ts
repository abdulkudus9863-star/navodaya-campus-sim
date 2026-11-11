import * as THREE from "three";
import { AudioSystem } from "./AudioSystem";
import { GameStore } from "./GameStore";
import { InputController } from "./InputController";
import { SaveSystem, sanitizeCharacter, sanitizeSettings } from "./SaveSystem";
import {
  MISSION_STEPS,
  type CharacterSettings,
  type GameSettings,
  type NoticeView,
  type Quality,
  type SaveData,
} from "./types";
import { CameraController } from "../systems/CameraController";
import { InteractionSystem } from "../systems/InteractionSystem";
import { MissionSystem } from "../systems/MissionSystem";
import { NPCSystem } from "../systems/NPCSystem";
import { PlayerController, collidesAt } from "../systems/PlayerController";
import { WorldEnvironment, type WorldZone } from "../world/WorldEnvironment";

export const NOTICE_CONTENT: NoticeView = {
  title: "Navodaya Vidyalaya",
  subtitle: "Notice Board · Term II · Ravi House",
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
  private audio = new AudioSystem();

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
        this.store.hydrateSave(saved.data);
        this.store.patch({ playtime: Math.round(saved.data.playtime) });
        this.applySettings(saved.data.settings, { announce: false });
        this.store.setCharacter(saved.data.character);
        this.player.setCharacter(saved.data.character);
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
    const state = this.store.getState();
    this.player.setCharacter(state.character);
    this.player.resetToSpawn(this.world.spawn);
    this.mission.startNew();
    this.store.setMission(this.mission.view());
    this.playtime = 0;
    this.store.patch({ playtime: 0, ending: null });
    for (const door of this.world.doors) door.setOpenInstant(false);
    this.world.showMarker(this.mission.currentStepId, false);
    this.enterPlaying(true);
    this.saveGame(false);
    this.showToast("Welcome to Navodaya. Meera is waiting by the gate.");
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
    this.applySettings(data.settings, { announce: false });
    this.store.setCharacter(data.character);
    this.player.setCharacter(data.character);
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
    this.store.patch({ playtime: Math.round(data.playtime), hasSave: true, ending: null });
    for (const door of this.world.doors) door.setOpenInstant(false);
    if (insideZone(this.world.zones.classroom, restoredPosition)) {
      this.world.doors.find((door) => door.label === "classroom")?.setOpenInstant(true);
    }
    if (insideZone(this.world.zones.hostel, restoredPosition)) {
      this.world.doors.find((door) => door.label === "hostel")?.setOpenInstant(true);
    }
    this.enterPlaying(true);
    this.audio.uiClick();
    this.showToast("Welcome back to campus.");
    if (this.mission.done) {
      this.world.showMarker(null, true);
    }
    return true;
  }

  pause(): void {
    if (this.store.getState().screen !== "playing") return;
    this.store.setScreen("paused");
    this.store.setPrompt(null);
    this.input.setEnabled(false);
    this.saveGame(false);
    this.releasePointerLock();
  }

  resume(): void {
    if (this.store.getState().screen !== "paused") return;
    this.store.patch({ screen: "playing", settingsOpen: false });
    this.input.reset();
    this.input.setEnabled(true);
    this.requestPointerLock();
    this.audio.uiClick();
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
      dialogue: null,
      notice: null,
      ending: null,
      prompt: null,
      playtime: Math.round(this.playtime),
    });
    this.npc.end();
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
    if (!this.mission.started) return false;
    const state = this.store.getState();
    const data: SaveData = {
      version: 1,
      savedAt: Date.now(),
      playtime: Math.round(this.playtime),
      player: {
        position: { x: this.player.position.x, y: this.player.position.y, z: this.player.position.z },
        rotationY: this.player.rotationY,
      },
      settings: state.settings,
      character: state.character,
      mission: this.mission.toSave(),
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
    this.playtime = 0;
    this.store.patch({
      hasSave: false,
      screen: "menu",
      settingsOpen: false,
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
    this.player.setCharacter(character);
    this.audio.uiClick();
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
    this.store.patch({ screen: "playing", settingsOpen: false, prompt: null, ending: null });
    this.store.setMission(this.mission.view());
    this.input.reset();
    this.input.setEnabled(true);
    if (snapCamera) this.cameraController.resetToPlayer(this.player.position, this.player.rotationY);
    this.world.showMarker(this.mission.currentStepId, this.mission.done);
    this.requestPointerLock();
  }

  private openDialogue(): void {
    this.input.setEnabled(false);
    this.store.setPrompt(null);
    this.releasePointerLock();
    this.store.setDialogue(this.npc.start({ step: this.mission.stepIndex, done: this.mission.done }));
    this.store.setScreen("dialogue");
    this.audio.uiClick();
  }

  private finishDialogue(): void {
    this.npc.end();
    this.store.setDialogue(null);
    this.store.patch({ screen: "playing" });
    this.input.reset();
    this.input.setEnabled(true);
    if (this.mission.currentStepId === "meet-meera") {
      this.completeStep("meet-meera");
    }
    this.requestPointerLock();
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
    this.saveGame(false);
    if (result.allDone) {
      this.showToast("Welcome home. You've found your place on campus.");
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
      this.scene.fog = new THREE.FogExp2(0xccb591, SKY_FOG[settings.quality]);
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
      if (state.settingsOpen) {
        this.closeSettings();
        return;
      }
      if (state.screen === "notice") {
        this.closeNotice();
        return;
      }
      if (state.screen === "playing") this.pause();
      else if (state.screen === "paused") this.resume();
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
    const simulating = state.screen === "playing" && !state.settingsOpen;

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
      } else if (this.mission.currentStepId === "hostel" && insideZone(this.world.zones.hostel, this.player.position)) {
        this.completeStep("hostel");
      }

      const seconds = Math.floor(this.playtime);
      if (seconds !== state.playtime) this.store.patch({ playtime: seconds });
    } else if (state.screen === "dialogue") {
      this.cameraController.updateDialogue(dt, this.player.position, this.world.npcPosition);
      this.store.setPrompt(null);
    } else if (state.screen === "menu") {
      this.cameraController.updateCinematic(this.elapsed);
      this.store.setPrompt(null);
    } else {
      this.store.setPrompt(null);
    }

    this.player.rig.group.visible = state.screen !== "menu";
    this.world.update(dt, this.elapsed, this.player.position);
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
