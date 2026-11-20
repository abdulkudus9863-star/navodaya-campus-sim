import * as THREE from "three";
import type { CharacterSettings } from "../core/types";
import { SKIN_TONES } from "../core/types";
import { characterOptions, createCharacter, type CharacterRig } from "../world/CharacterFactory";
import { createTeacherRig, type TeacherRig } from "../teachers/TeacherFactory";
import { damp } from "../world/geometry";
import { MessRunAudio } from "./MessRunAudio";
import {
  MessRunSimulation,
  type MessRunSnapshot,
  type ObstacleKind,
  type PickupKind,
  type SimEvent,
} from "./MessRunSimulation";
import type { MessRunModeId, MessRunResult, MessRunTeacherId } from "./messRunData";

export interface MessRunEngineOptions {
  character: CharacterSettings;
  houseColor: string;
  teacherId: MessRunTeacherId;
  mode: MessRunModeId;
  playerName: string;
  sfxEnabled: boolean;
  musicEnabled: boolean;
  onHud: (snapshot: MessRunSnapshot) => void;
  onResult: (result: MessRunResult) => void;
  onEvent?: (event: SimEvent) => void;
  onPauseRequest?: (paused: boolean) => void;
}

interface Particle {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  spin: THREE.Vector3;
  life: number;
  maxLife: number;
}

interface TrayRig {
  group: THREE.Group;
  foods: THREE.Object3D[];
  liquid: THREE.Mesh | null;
}

interface PickupRing {
  mesh: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
  life: number;
  maxLife: number;
  scale: number;
}

const LANE_X = [-2.05, 0, 2.05] as const;
const CHUNK_COUNT = 7;
const CHUNK_LENGTH = 40;
const PLAYER_ARM_REST = -1.15;

function material(
  color: string | number,
  roughness = 0.75,
  metalness = 0,
  extra: Partial<THREE.MeshStandardMaterialParameters> = {},
): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness, ...extra });
}

function box(
  parent: THREE.Object3D,
  geometry: THREE.BoxGeometry,
  mat: THREE.Material,
  x: number,
  y: number,
  z: number,
  sx: number,
  sy: number,
  sz: number,
  rotation?: { x?: number; y?: number; z?: number },
): THREE.Mesh {
  const mesh = new THREE.Mesh(geometry, mat);
  mesh.position.set(x, y, z);
  mesh.scale.set(sx, sy, sz);
  if (rotation) mesh.rotation.set(rotation.x ?? 0, rotation.y ?? 0, rotation.z ?? 0);
  parent.add(mesh);
  return mesh;
}

function cylinder(
  parent: THREE.Object3D,
  geometry: THREE.CylinderGeometry,
  mat: THREE.Material,
  x: number,
  y: number,
  z: number,
  radius: number,
  height: number,
  rotation?: { x?: number; y?: number; z?: number },
): THREE.Mesh {
  const mesh = new THREE.Mesh(geometry, mat);
  mesh.position.set(x, y, z);
  mesh.scale.set(radius, height, radius);
  if (rotation) mesh.rotation.set(rotation.x ?? 0, rotation.y ?? 0, rotation.z ?? 0);
  parent.add(mesh);
  return mesh;
}

function registerFood(piece: THREE.Object3D, foods: THREE.Object3D[]): void {
  piece.userData.baseScale = piece.scale.clone();
  foods.push(piece);
}

/**
 * Standalone Three.js renderer for MESS RUN. It shares the project's character
 * factory and teacher rigs, but none of the campus world or player controller.
 */
export class MessRunEngine {
  readonly simulation: MessRunSimulation;

  private readonly options: MessRunEngineOptions;
  private readonly container: HTMLElement;
  private readonly scene = new THREE.Scene();
  private readonly camera: THREE.PerspectiveCamera;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly audio: MessRunAudio;
  private readonly clock = new THREE.Clock();
  private readonly resizeObserver: ResizeObserver;
  private readonly playerRig: CharacterRig;
  private readonly teacherRig: TeacherRig;
  private readonly teacherGroup = new THREE.Group();
  private readonly worldGroup = new THREE.Group();
  private readonly obstacleGroup = new THREE.Group();
  private readonly pickupGroup = new THREE.Group();
  private readonly particleGroup = new THREE.Group();
  private readonly chunks: THREE.Group[] = [];
  private readonly obstacleVisuals = new Map<number, { group: THREE.Group; kind: ObstacleKind }>();
  private readonly pickupVisuals = new Map<number, { group: THREE.Group; kind: PickupKind }>();
  private readonly obstaclePools: Record<ObstacleKind, THREE.Group[]> = {
    low: [],
    high: [],
    full: [],
  };
  private readonly pickupPools: Record<PickupKind, THREE.Group[]> = {
    chicken: [],
    fries: [],
    samosa: [],
    burger: [],
    coldDrink: [],
    token: [],
  };
  private readonly particles: Particle[] = [];
  private readonly pickupRings: PickupRing[] = [];
  private readonly tray: { left: TrayRig; right: TrayRig };
  private readonly unitBox = new THREE.BoxGeometry(1, 1, 1);
  private readonly unitCylinder = new THREE.CylinderGeometry(0.5, 0.5, 1, 12);
  private readonly unitSphere = new THREE.SphereGeometry(0.5, 12, 9);
  private readonly unitCone = new THREE.ConeGeometry(0.5, 1, 8);
  private readonly unitTorus = new THREE.TorusGeometry(0.5, 0.12, 5, 14);
  private readonly trayGeo = new THREE.BoxGeometry(1, 1, 1);
  private readonly openCylinder = new THREE.CylinderGeometry(0.5, 0.46, 1, 14, 1, true);
  private readonly materials: Record<string, THREE.MeshStandardMaterial>;
  private readonly pickupGlows: Record<"gold" | "warm" | "mint", THREE.MeshBasicMaterial>;
  private readonly particleMaterials: THREE.MeshStandardMaterial[];

  private animationFrame = 0;
  private hudTimer = 0;
  private elapsed = 0;
  private teacherX = 0;
  private teacherPhase = 0;
  private playerPhase = 0;
  private stepTimer = 0;
  private dustTimer = 0;
  private shake = 0;
  private paused = false;
  private disposed = false;
  private resultDelay = -1;
  private resultNotified = false;
  private pointerStart: { id: number; x: number; y: number; time: number } | null = null;

  constructor(container: HTMLElement, options: MessRunEngineOptions) {
    this.container = container;
    this.options = options;
    this.simulation = new MessRunSimulation({
      teacherId: options.teacherId,
      mode: options.mode,
    });
    this.audio = new MessRunAudio(options.sfxEnabled, options.musicEnabled);

    this.materials = {
      path: material("#6f5238", 0.96),
      pathDark: material("#543b29", 0.97),
      pathLight: material("#8b6a45", 0.93),
      grass: material("#263d28", 0.98),
      grassLight: material("#385236", 0.98),
      curb: material("#b8a27a", 0.85),
      building: material("#1b2a22", 0.92),
      buildingLight: material("#324135", 0.92),
      window: material("#d7b96d", 0.34, 0.08, {
        emissive: new THREE.Color("#84652d"),
        emissiveIntensity: 0.34,
      }),
      wood: material("#614528", 0.9),
      foliage: material("#31563a", 0.98),
      foliageLight: material("#466f49", 0.98),
      metal: material("#65726b", 0.38, 0.6),
      darkMetal: material("#252b27", 0.4, 0.65),
      bag: material("#283b4a", 0.82),
      bagAlt: material("#4b5a39", 0.84),
      fabric: material("#8e3d34", 0.96),
      gold: material("#d7b46a", 0.28, 0.55),
      cream: material("#eadfc4", 0.62),
      blackTray: material("#12100d", 0.2, 0.4),
      trayLip: material("#26211a", 0.28, 0.3),
      cake: material("#c8945f", 0.82),
      icing: material("#f0dfbf", 0.72),
      dal: material("#c98e3a", 0.8),
      rice: material("#e7dfc8", 0.9),
      curry: material("#9a4a25", 0.72),
      vegetable: material("#59753d", 0.9),
      glass: material("#d8eef1", 0.14, 0.15, {
        transparent: true,
        opacity: 0.34,
        depthWrite: false,
      }),
      drink: material("#c96e37", 0.28, 0.02, { transparent: true, opacity: 0.86 }),
      bun: material("#c58e4e", 0.85),
      patty: material("#6e3f24", 0.92),
      cheese: material("#e4b74e", 0.58),
      lettuce: material("#6f9b49", 0.92),
      chicken: material("#b66f31", 0.72),
      chickenCrisp: material("#d99545", 0.6),
      fries: material("#e8b94f", 0.62),
      carton: material("#a84130", 0.78),
      samosa: material("#d6a04b", 0.66),
      samosaDark: material("#99602c", 0.82),
      dust: material("#9e8055", 0.98, 0, { transparent: true, opacity: 0.5 }),
    };

    this.pickupGlows = {
      gold: this.createGlow("#e7c47d"),
      warm: this.createGlow("#d98b49"),
      mint: this.createGlow("#9fd3bd"),
    };

    const particlePalette = ["#d7b46a", "#eadfc4", "#c98e3a", "#59753d", "#c8945f"];
    this.particleMaterials = Array.from({ length: 46 }, (_, index) =>
      material(particlePalette[index % particlePalette.length], 0.8, 0, { transparent: true }),
    );

    this.scene.background = new THREE.Color("#0e1a13");
    this.scene.fog = new THREE.Fog("#0e1a13", 28, 108);
    this.camera = new THREE.PerspectiveCamera(58, 1, 0.1, 180);
    // Sit behind the chasing teacher, not between the teacher and the runner.
    // At the normal 5.4 m gap this keeps the teacher's head around 70% of
    // screen height and the player's trays near the centre of the frame.
    this.camera.position.set(2.15, 4.6, 11.4);
    this.camera.lookAt(0, 1.2, -7.5);

    this.renderer = new THREE.WebGLRenderer({
      antialias: !window.matchMedia("(pointer: coarse)").matches,
      powerPreference: "high-performance",
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.04;
    this.renderer.setPixelRatio(
      Math.min(window.devicePixelRatio || 1, window.matchMedia("(pointer: coarse)").matches ? 1.5 : 2),
    );
    this.renderer.domElement.setAttribute("data-testid", "mess-run-canvas");
    this.renderer.domElement.style.display = "block";
    this.renderer.domElement.style.width = "100%";
    this.renderer.domElement.style.height = "100%";
    this.renderer.domElement.style.touchAction = "none";
    container.appendChild(this.renderer.domElement);

    this.addLights();
    this.buildWorld();
    this.playerRig = createCharacter(
      characterOptions(options.character, options.houseColor, SKIN_TONES[options.character.skin], "high"),
    );
    this.playerRig.group.name = "mess-run-player";
    this.tray = this.attachTrays(this.playerRig);
    this.scene.add(this.playerRig.group);

    this.teacherRig = createTeacherRig(this.simulation.teacher.chaserConfig, { x: 0, z: 7 });
    this.teacherRig.tag.visible = false;
    this.teacherRig.indicator.visible = false;
    this.teacherGroup.add(this.teacherRig.group);
    this.teacherGroup.rotation.y = Math.PI;
    this.teacherGroup.position.set(0, 0, this.simulation.teacherGap);
    this.scene.add(this.teacherGroup);

    this.buildParticles();
    this.buildPickupRings();
    this.scene.add(this.worldGroup, this.obstacleGroup, this.pickupGroup, this.particleGroup);

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.resize();

    window.addEventListener("keydown", this.handleKeyDown);
    document.addEventListener("visibilitychange", this.handleVisibility);
    this.renderer.domElement.addEventListener("pointerdown", this.handlePointerDown);
    this.renderer.domElement.addEventListener("pointerup", this.handlePointerUp);
    this.renderer.domElement.addEventListener("pointercancel", this.handlePointerCancel);

    this.audio.resume().catch(() => undefined);
    this.renderer.setAnimationLoop(this.loop);
  }

  start(): void {
    this.clock.start();
    this.emitHud();
  }

  setPaused(paused: boolean): void {
    if (this.simulation.result) return;
    this.paused = paused;
    this.simulation.paused = paused;
    this.clock.getDelta();
    this.emitHud();
    this.options.onPauseRequest?.(paused);
  }

  get isPaused(): boolean {
    return this.paused;
  }

  setAudio(sfx: boolean, music: boolean): void {
    this.audio.setSfx(sfx);
    this.audio.setMusic(music);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.renderer.setAnimationLoop(null);
    cancelAnimationFrame(this.animationFrame);
    this.resizeObserver.disconnect();
    window.removeEventListener("keydown", this.handleKeyDown);
    document.removeEventListener("visibilitychange", this.handleVisibility);
    this.renderer.domElement.removeEventListener("pointerdown", this.handlePointerDown);
    this.renderer.domElement.removeEventListener("pointerup", this.handlePointerUp);
    this.renderer.domElement.removeEventListener("pointercancel", this.handlePointerCancel);
    this.audio.dispose();
    this.scene.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      object.geometry.dispose();
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      materials.forEach((entry) => entry.dispose());
    });
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }

  private loop = (): void => {
    if (this.disposed) return;
    const dt = Math.min(0.05, this.clock.getDelta());
    const sim = this.simulation;

    if (!this.paused && !sim.result) {
      this.elapsed += dt;
      const events = sim.update(dt);
      for (const event of events) this.handleEvent(event);
      this.syncWorld(dt);
      this.animate(dt);
      this.updateHud(dt);
    } else {
      this.animate(Math.min(dt, 0.025));
      if (sim.result && !this.resultNotified) {
        if (this.resultDelay < 0) {
          this.resultDelay = sim.result.outcome === "caught" ? 0.95 : 0.55;
          if (sim.result.outcome === "caught") this.audio.catch();
          else if (sim.result.outcome === "delivered") this.audio.success();
          else this.audio.catch();
        }
        this.resultDelay -= dt;
        if (this.resultDelay <= 0) {
          this.resultNotified = true;
          this.paused = true;
          this.options.onResult(sim.result);
          this.emitHud();
        }
      }
    }

    this.renderer.render(this.scene, this.camera);
  };

  private handleEvent(event: SimEvent): void {
    switch (event.type) {
      case "jump":
        this.audio.jump();
        break;
      case "slide":
        this.audio.slide();
        break;
      case "collect":
        if (event.kind === "token") this.audio.coin();
        else this.audio.food(event.kind);
        this.spawnPickupBurst(event.kind);
        break;
      case "feast":
        this.audio.feast();
        this.shake = Math.min(1, this.shake + 0.35);
        this.spawnFeastBurst();
        break;
      case "near-miss":
        this.audio.nearMiss();
        break;
      case "hit":
        this.audio.hit();
        this.shake = Math.min(1, this.shake + 0.85);
        this.spawnFoodBurst(event.tray);
        break;
      case "land":
        if (event.impact > 0.35) this.audio.footstep(true);
        break;
      default:
        break;
    }
    this.options.onEvent?.(event);
  }

  private updateHud(dt: number): void {
    this.hudTimer += dt;
    if (this.hudTimer < 0.085) return;
    this.hudTimer = 0;
    this.emitHud();
  }

  private emitHud(): void {
    this.options.onHud(this.simulation.snapshot(this.paused));
  }

  private resize(): void {
    const width = Math.max(1, this.container.clientWidth);
    const height = Math.max(1, this.container.clientHeight);
    this.camera.aspect = width / height;
    this.camera.fov = width < 700 ? 64 : 58;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
  }

  private createGlow(color: string): THREE.MeshBasicMaterial {
    return new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.2,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
  }

  private addLights(): void {
    const hemi = new THREE.HemisphereLight("#ffe4b2", "#132017", 2.35);
    this.scene.add(hemi);
    const sun = new THREE.DirectionalLight("#ffd79d", 2.4);
    sun.position.set(-12, 18, 9);
    this.scene.add(sun);
    const fill = new THREE.DirectionalLight("#8db5a4", 0.62);
    fill.position.set(8, 7, -16);
    this.scene.add(fill);
  }

  private buildWorld(): void {
    for (let index = 0; index < CHUNK_COUNT; index += 1) {
      const chunk = this.buildChunk(index);
      chunk.position.z = 8 - index * CHUNK_LENGTH;
      this.chunks.push(chunk);
      this.worldGroup.add(chunk);
    }
  }

  private buildChunk(index: number): THREE.Group {
    const chunk = new THREE.Group();
    const variant = index % 4;
    const path = this.materials.path;
    const grass = this.materials.grass;

    box(chunk, this.unitBox, grass, 0, -0.06, 0, 30, 0.12, CHUNK_LENGTH);
    box(chunk, this.unitBox, path, 0, 0.015, 0, 7.8, 0.06, CHUNK_LENGTH);
    box(chunk, this.unitBox, this.materials.pathLight, -3.95, 0.04, 0, 0.18, 0.08, CHUNK_LENGTH);
    box(chunk, this.unitBox, this.materials.pathLight, 3.95, 0.04, 0, 0.18, 0.08, CHUNK_LENGTH);
    box(chunk, this.unitBox, this.materials.curb, -4.2, 0.05, 0, 0.38, 0.16, CHUNK_LENGTH);
    box(chunk, this.unitBox, this.materials.curb, 4.2, 0.05, 0, 0.38, 0.16, CHUNK_LENGTH);

    for (const x of [-1.025, 1.025]) {
      for (let z = -17; z <= 17; z += 5) {
        box(chunk, this.unitBox, this.materials.cream, x, 0.06, z, 0.08, 0.025, 2.35);
      }
    }

    const buildingSide = variant % 2 === 0 ? -1 : 1;
    const building = new THREE.Group();
    building.position.set(buildingSide * 10.4, 0, variant === 1 ? -8 : 7);
    box(building, this.unitBox, this.materials.building, 0, 2.8, 0, 8.8, 5.6, 17);
    box(building, this.unitBox, this.materials.buildingLight, 0, 5.55, 0, 9.3, 0.28, 17.6);
    box(building, this.unitBox, this.materials.window, -0.1, 3.25, 6.1, 0.08, 1.0, 1.65);
    box(building, this.unitBox, this.materials.window, -0.1, 1.6, 2.5, 0.08, 0.85, 1.4);
    box(building, this.unitBox, this.materials.window, -0.1, 3.2, -2.4, 0.08, 0.9, 1.6);
    box(building, this.unitBox, this.materials.gold, -0.12, 4.75, 6.1, 0.06, 0.06, 2.0);
    chunk.add(building);

    if (variant === 2) {
      const canopy = new THREE.Group();
      canopy.position.set(buildingSide * -8.6, 0, -9);
      for (const z of [-5.2, 5.2]) {
        box(canopy, this.unitBox, this.materials.wood, 0, 1.65, z, 0.25, 3.3, 0.25);
      }
      box(canopy, this.unitBox, this.materials.fabric, 0, 3.28, 0, 4.4, 0.18, 11.5);
      box(canopy, this.unitBox, this.materials.cream, 0, 2.95, 0, 3.15, 0.06, 10.2);
      chunk.add(canopy);
    }

    for (const side of [-1, 1]) {
      for (let item = 0; item < 2; item += 1) {
        const tree = new THREE.Group();
        tree.position.set(side * (7.8 + item * 1.2), 0, -13 + item * 13 + (side > 0 ? 4 : -2));
        cylinder(tree, this.unitCylinder, this.materials.wood, 0, 0.9, 0, 0.24, 1.8);
        const cone = new THREE.Mesh(this.unitCone, item % 2 ? this.materials.foliage : this.materials.foliageLight);
        cone.position.y = 2.35;
        cone.scale.set(2.4, 3.1, 2.4);
        tree.add(cone);
        const upper = new THREE.Mesh(this.unitCone, this.materials.foliage);
        upper.position.y = 3.55;
        upper.scale.set(1.7, 2.2, 1.7);
        tree.add(upper);
        chunk.add(tree);
      }
      const lamp = new THREE.Group();
      lamp.position.set(side * 4.9, 0, side * 8 + 2);
      cylinder(lamp, this.unitCylinder, this.materials.darkMetal, 0, 1.45, 0, 0.07, 2.9);
      const glow = new THREE.Mesh(this.unitSphere, this.materials.window);
      glow.position.y = 3;
      glow.scale.setScalar(0.22);
      lamp.add(glow);
      chunk.add(lamp);
    }

    if (variant % 2 === 0) {
      const banner = new THREE.Group();
      banner.position.z = index === 0 ? 4 : 0;
      for (const x of [-4.55, 4.55]) {
        box(banner, this.unitBox, this.materials.darkMetal, x, 2.15, 0, 0.2, 4.3, 0.2);
      }
      const cloth = box(banner, this.unitBox, this.materials.fabric, 0, 4.05, 0, 9.5, 0.9, 0.08);
      cloth.rotation.z = -0.02;
      box(banner, this.unitBox, this.materials.gold, 0, 4.05, 0.055, 9.7, 0.06, 0.025);
      chunk.add(banner);
    }

    return chunk;
  }

  private attachTrays(rig: CharacterRig): { left: TrayRig; right: TrayRig } {
    const left = this.createTray("left");
    const right = this.createTray("right");
    left.group.position.set(0, -0.51, 0.02);
    right.group.position.set(0, -0.51, 0.02);
    left.group.rotation.x = 1.15;
    right.group.rotation.x = 1.15;
    rig.leftArm.add(left.group);
    rig.rightArm.add(right.group);
    return { left, right };
  }

  private createTray(side: "left" | "right"): TrayRig {
    const group = new THREE.Group();
    const foods: THREE.Object3D[] = [];
    box(group, this.trayGeo, this.materials.blackTray, 0, 0, 0, 0.37, 0.032, 0.27);
    box(group, this.trayGeo, this.materials.trayLip, 0, 0.034, 0.132, 0.38, 0.06, 0.022);
    box(group, this.trayGeo, this.materials.trayLip, 0, 0.034, -0.132, 0.38, 0.06, 0.022);
    box(group, this.trayGeo, this.materials.trayLip, 0.182, 0.034, 0, 0.022, 0.06, 0.27);
    box(group, this.trayGeo, this.materials.trayLip, -0.182, 0.034, 0, 0.022, 0.06, 0.27);
    box(group, this.trayGeo, this.materials.gold, 0, 0.049, 0.112, 0.11, 0.008, 0.012);

    let liquid: THREE.Mesh | null = null;
    if (side === "left") {
      const cup = new THREE.Group();
      cup.position.set(-0.105, 0.082, -0.01);
      cylinder(cup, this.unitCylinder, this.materials.cream, 0, 0, 0, 0.075, 0.105);
      const handle = new THREE.Mesh(this.unitTorus, this.materials.cream);
      handle.position.set(0.078, 0, 0);
      handle.rotation.y = Math.PI / 2;
      handle.scale.setScalar(0.12);
      cup.add(handle);
      cylinder(cup, this.unitCylinder, this.materials.dal, 0, 0.045, 0, 0.063, 0.014);
      group.add(cup);
      registerFood(cup, foods);

      const cake = new THREE.Group();
      cake.position.set(0.075, 0.085, -0.02);
      cylinder(cake, this.unitCylinder, this.materials.cake, 0, 0, 0, 0.095, 0.075);
      cylinder(cake, this.unitCylinder, this.materials.icing, 0, 0.041, 0, 0.088, 0.018);
      cylinder(cake, this.unitCylinder, this.materials.vegetable, 0, 0.057, 0, 0.018, 0.015);
      group.add(cake);
      registerFood(cake, foods);

      const sideDish = new THREE.Group();
      sideDish.position.set(0.09, 0.065, 0.075);
      cylinder(sideDish, this.unitCylinder, this.materials.cream, 0, 0, 0, 0.07, 0.035);
      cylinder(sideDish, this.unitCylinder, this.materials.curry, 0, 0.022, 0, 0.058, 0.012);
      group.add(sideDish);
      registerFood(sideDish, foods);
    } else {
      const glass = new THREE.Group();
      glass.position.set(-0.105, 0.105, -0.01);
      const cup = new THREE.Mesh(this.openCylinder, this.materials.glass);
      cup.scale.set(0.09, 0.16, 0.09);
      glass.add(cup);
      liquid = cylinder(glass, this.unitCylinder, this.materials.drink, 0, -0.026, 0, 0.074, 0.085);
      const straw = cylinder(
        glass,
        this.unitCylinder,
        this.materials.gold,
        0.03,
        0.11,
        0.005,
        0.009,
        0.2,
        { z: -0.18 },
      );
      straw.rotation.x = 0.1;
      group.add(glass);
      registerFood(glass, foods);

      const burger = new THREE.Group();
      burger.position.set(0.075, 0.065, 0.005);
      const bottom = new THREE.Mesh(this.unitCylinder, this.materials.bun);
      bottom.scale.set(0.09, 0.032, 0.09);
      burger.add(bottom);
      const patty = new THREE.Mesh(this.unitCylinder, this.materials.patty);
      patty.position.y = 0.032;
      patty.scale.set(0.086, 0.025, 0.086);
      burger.add(patty);
      box(burger, this.unitBox, this.materials.cheese, 0, 0.052, 0, 0.145, 0.009, 0.145, {
        y: 0.36,
      });
      const lettuce = new THREE.Mesh(this.unitTorus, this.materials.lettuce);
      lettuce.rotation.x = Math.PI / 2;
      lettuce.scale.set(0.15, 0.15, 0.15);
      lettuce.position.y = 0.062;
      burger.add(lettuce);
      const top = new THREE.Mesh(this.unitSphere, this.materials.bun);
      top.position.y = 0.084;
      top.scale.set(0.18, 0.085, 0.18);
      burger.add(top);
      group.add(burger);
      registerFood(burger, foods);

      const sideDish = new THREE.Group();
      sideDish.position.set(-0.08, 0.065, 0.09);
      cylinder(sideDish, this.unitCylinder, this.materials.cream, 0, 0, 0, 0.06, 0.032);
      cylinder(sideDish, this.unitCylinder, this.materials.vegetable, 0, 0.02, 0, 0.048, 0.012);
      group.add(sideDish);
      registerFood(sideDish, foods);
    }

    return { group, foods, liquid };
  }

  private buildPickupRings(): void {
    for (let index = 0; index < 8; index += 1) {
      const material = new THREE.MeshBasicMaterial({
        color: "#e7c47d",
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
      });
      const mesh = new THREE.Mesh(this.unitTorus, material);
      mesh.rotation.x = Math.PI / 2;
      mesh.visible = false;
      this.particleGroup.add(mesh);
      this.pickupRings.push({ mesh, life: 0, maxLife: 0.42, scale: 1 });
    }
  }

  private buildParticles(): void {
    for (let index = 0; index < 46; index += 1) {
      const mesh = new THREE.Mesh(this.unitBox, this.materials.gold);
      mesh.visible = false;
      mesh.scale.setScalar(0.025 + Math.random() * 0.03);
      this.particleGroup.add(mesh);
      this.particles.push({
        mesh,
        velocity: new THREE.Vector3(),
        spin: new THREE.Vector3(),
        life: 0,
        maxLife: 1,
      });
    }
  }

  private syncWorld(dt: number): void {
    for (const chunk of this.chunks) {
      chunk.position.z += this.simulation.speed * dt;
      if (chunk.position.z > 30) chunk.position.z -= CHUNK_COUNT * CHUNK_LENGTH;
    }
    this.syncObstacles();
    this.syncPickups();
    this.updateParticles(dt);
    this.updatePickupRings(dt);
  }

  private syncObstacles(): void {
    const active = new Set(this.simulation.obstacles.map((obstacle) => obstacle.id));
    for (const [id, visual] of this.obstacleVisuals) {
      if (active.has(id)) continue;
      visual.group.visible = false;
      this.obstaclePools[visual.kind].push(visual.group);
      this.obstacleVisuals.delete(id);
    }
    for (const obstacle of this.simulation.obstacles) {
      let visual = this.obstacleVisuals.get(obstacle.id);
      if (!visual) {
        const group = this.acquireObstacle(obstacle.kind);
        group.visible = true;
        visual = { group, kind: obstacle.kind };
        this.obstacleVisuals.set(obstacle.id, visual);
      }
      visual.group.position.set(LANE_X[obstacle.lane], 0, obstacle.z);
    }
  }

  private syncPickups(): void {
    const active = new Set(
      this.simulation.pickups
        .filter((pickup) => !pickup.collected)
        .map((pickup) => pickup.id),
    );
    for (const [id, visual] of this.pickupVisuals) {
      if (active.has(id)) continue;
      visual.group.visible = false;
      this.pickupPools[visual.kind].push(visual.group);
      this.pickupVisuals.delete(id);
    }
    for (const pickup of this.simulation.pickups) {
      let visual = this.pickupVisuals.get(pickup.id);
      if (!visual) {
        const group = this.acquirePickup(pickup.kind);
        group.visible = true;
        visual = { group, kind: pickup.kind };
        this.pickupVisuals.set(pickup.id, visual);
      }
      visual.group.position.set(LANE_X[pickup.lane], 0.88, pickup.z);
    }
  }

  private acquireObstacle(kind: ObstacleKind): THREE.Group {
    const pooled = this.obstaclePools[kind].pop();
    if (pooled) {
      this.obstacleGroup.add(pooled);
      return pooled;
    }
    const group = this.createObstacleModel(kind, Math.floor(Math.random() * 3));
    this.obstacleGroup.add(group);
    return group;
  }

  private createObstacleModel(kind: ObstacleKind, variant: number): THREE.Group {
    const group = new THREE.Group();
    if (kind === "low") {
      if (variant === 0) {
        box(group, this.unitBox, this.materials.bag, 0, 0.33, 0, 0.75, 0.55, 0.5);
        box(group, this.unitBox, this.materials.bagAlt, 0, 0.45, 0.03, 0.48, 0.3, 0.54);
        const handle = new THREE.Mesh(this.unitTorus, this.materials.darkMetal);
        handle.position.set(0, 0.66, 0);
        handle.rotation.x = Math.PI / 2;
        handle.scale.set(0.22, 0.22, 0.22);
        group.add(handle);
      } else if (variant === 1) {
        box(group, this.unitBox, this.materials.wood, 0, 0.46, 0, 1.25, 0.12, 0.42);
        for (const x of [-0.48, 0.48]) {
          box(group, this.unitBox, this.materials.darkMetal, x, 0.22, 0, 0.09, 0.45, 0.3);
        }
      } else {
        cylinder(group, this.unitCylinder, this.materials.metal, 0, 0.3, 0, 0.38, 0.58);
        const rim = new THREE.Mesh(this.unitTorus, this.materials.darkMetal);
        rim.rotation.x = Math.PI / 2;
        rim.position.y = 0.6;
        rim.scale.set(0.75, 0.75, 0.75);
        group.add(rim);
      }
    } else if (kind === "high") {
      if (variant === 0) {
        for (const x of [-0.68, 0.68]) {
          box(group, this.unitBox, this.materials.darkMetal, x, 0.86, 0, 0.12, 1.72, 0.12);
        }
        box(group, this.unitBox, this.materials.metal, 0, 1.52, 0, 1.55, 0.18, 0.38);
        box(group, this.unitBox, this.materials.cream, 0, 1.34, 0, 1.32, 0.08, 0.43);
        box(group, this.unitBox, this.materials.wood, 0, 0.74, 0, 0.95, 0.13, 0.45);
      } else if (variant === 1) {
        for (const x of [-0.74, 0.74]) {
          box(group, this.unitBox, this.materials.darkMetal, x, 0.82, 0, 0.1, 1.64, 0.1);
        }
        box(group, this.unitBox, this.materials.fabric, 0, 1.43, 0, 1.65, 0.5, 0.06);
        box(group, this.unitBox, this.materials.gold, 0, 1.66, 0.04, 1.7, 0.04, 0.025);
      } else {
        for (const x of [-0.7, 0.7]) {
          cylinder(group, this.unitCylinder, this.materials.metal, x, 0.83, 0, 0.16, 1.66);
        }
        box(group, this.unitBox, this.materials.wood, 0, 1.56, 0, 1.75, 0.12, 0.55);
      }
    } else {
      if (variant === 0) {
        cylinder(group, this.unitCylinder, this.materials.metal, 0, 0.58, 0, 0.48, 1.16);
        const lid = new THREE.Mesh(this.unitCylinder, this.materials.darkMetal);
        lid.position.y = 1.2;
        lid.scale.set(0.94, 0.12, 0.94);
        group.add(lid);
        box(group, this.unitBox, this.materials.cream, 0, 0.72, 0.4, 0.35, 0.2, 0.02);
      } else if (variant === 1) {
        for (const x of [-0.55, 0.55]) {
          const wheel = new THREE.Mesh(this.unitTorus, this.materials.darkMetal);
          wheel.position.set(x, 0.42, 0);
          wheel.scale.setScalar(0.42);
          group.add(wheel);
        }
        box(group, this.unitBox, this.materials.fabric, 0, 0.62, 0, 1.08, 0.08, 0.08, {
          z: 0.2,
        });
        box(group, this.unitBox, this.materials.metal, 0, 0.85, 0, 0.08, 0.52, 0.08);
        box(group, this.unitBox, this.materials.darkMetal, 0, 0.98, 0, 0.56, 0.06, 0.06);
      } else {
        box(group, this.unitBox, this.materials.wood, 0, 0.92, 0, 1.55, 0.14, 0.82);
        for (const x of [-0.58, 0.58]) {
          box(group, this.unitBox, this.materials.darkMetal, x, 0.45, 0, 0.1, 0.9, 0.1);
        }
        box(group, this.unitBox, this.materials.cream, 0, 1.08, 0, 0.48, 0.18, 0.48);
      }
    }
    return group;
  }

  private acquirePickup(kind: PickupKind): THREE.Group {
    const pooled = this.pickupPools[kind].pop();
    if (pooled) {
      this.pickupGroup.add(pooled);
      return pooled;
    }

    const group = new THREE.Group();
    const glowTone =
      kind === "coldDrink" ? "mint" : kind === "token" ? "gold" : "warm";
    const glow = new THREE.Mesh(this.unitTorus, this.pickupGlows[glowTone]);
    glow.rotation.x = Math.PI / 2;
    glow.position.y = -0.16;
    glow.scale.setScalar(kind === "token" ? 0.78 : 0.68);
    group.add(glow);
    group.userData.glow = glow;

    if (kind === "chicken") {
      const bone = cylinder(
        group,
        this.unitCylinder,
        this.materials.cream,
        -0.15,
        0.01,
        0,
        0.04,
        0.27,
        { z: Math.PI / 2 },
      );
      bone.position.y = 0.01;
      const meat = new THREE.Mesh(this.unitSphere, this.materials.chicken);
      meat.position.set(0.09, 0.02, 0);
      meat.scale.set(0.37, 0.3, 0.32);
      group.add(meat);
      const crust = new THREE.Mesh(this.unitSphere, this.materials.chickenCrisp);
      crust.position.set(0.01, 0.09, 0.06);
      crust.scale.set(0.26, 0.2, 0.23);
      group.add(crust);
      const crisp = new THREE.Mesh(this.unitTorus, this.materials.chickenCrisp);
      crisp.position.set(-0.01, -0.02, 0.02);
      crisp.rotation.x = Math.PI / 2;
      crisp.scale.setScalar(0.28);
      group.add(crisp);
    } else if (kind === "fries") {
      box(group, this.unitBox, this.materials.carton, 0, -0.08, 0, 0.3, 0.3, 0.19);
      box(group, this.unitBox, this.materials.cream, 0, 0.065, 0.098, 0.27, 0.06, 0.012);
      for (let index = 0; index < 5; index += 1) {
        box(
          group,
          this.unitBox,
          this.materials.fries,
          -0.11 + index * 0.055,
          0.17 + (index % 2) * 0.03,
          (index % 2 ? 1 : -1) * 0.035,
          0.045,
          0.27,
          0.045,
          { z: -0.16 + index * 0.08, x: (index % 2 ? 1 : -1) * 0.08 },
        );
      }
    } else if (kind === "samosa") {
      const samosa = new THREE.Mesh(
        new THREE.ConeGeometry(0.34, 0.42, 4, 1),
        this.materials.samosa,
      );
      samosa.rotation.y = Math.PI / 4;
      samosa.scale.z = 0.74;
      samosa.position.y = 0.02;
      group.add(samosa);
      const seam = new THREE.Mesh(this.unitBox, this.materials.samosaDark);
      seam.position.set(0, 0.15, 0.14);
      seam.rotation.z = -0.18;
      seam.scale.set(0.07, 0.2, 0.035);
      group.add(seam);
      const ridge = new THREE.Mesh(this.unitTorus, this.materials.samosaDark);
      ridge.rotation.x = Math.PI / 2;
      ridge.position.y = -0.17;
      ridge.scale.set(0.33, 0.33, 0.2);
      group.add(ridge);
    } else if (kind === "burger") {
      const bottom = new THREE.Mesh(this.unitCylinder, this.materials.bun);
      bottom.position.y = -0.09;
      bottom.scale.set(0.3, 0.055, 0.3);
      group.add(bottom);
      const patty = new THREE.Mesh(this.unitCylinder, this.materials.patty);
      patty.position.y = -0.035;
      patty.scale.set(0.28, 0.045, 0.28);
      group.add(patty);
      box(group, this.unitBox, this.materials.cheese, 0, 0.012, 0, 0.38, 0.012, 0.38, {
        y: 0.32,
      });
      const lettuce = new THREE.Mesh(this.unitTorus, this.materials.lettuce);
      lettuce.rotation.x = Math.PI / 2;
      lettuce.position.y = 0.045;
      lettuce.scale.set(0.34, 0.34, 0.25);
      group.add(lettuce);
      const top = new THREE.Mesh(this.unitSphere, this.materials.bun);
      top.position.y = 0.12;
      top.scale.set(0.33, 0.15, 0.33);
      group.add(top);
    } else if (kind === "coldDrink") {
      const cup = new THREE.Mesh(this.openCylinder, this.materials.glass);
      cup.scale.set(0.2, 0.36, 0.2);
      group.add(cup);
      const liquid = cylinder(
        group,
        this.unitCylinder,
        this.materials.drink,
        0,
        -0.055,
        0,
        0.165,
        0.22,
      );
      liquid.renderOrder = 1;
      const straw = cylinder(
        group,
        this.unitCylinder,
        this.materials.gold,
        0.06,
        0.16,
        0,
        0.012,
        0.4,
        { z: -0.2 },
      );
      straw.position.y = 0.16;
      const lid = new THREE.Mesh(this.unitTorus, this.materials.cream);
      lid.rotation.x = Math.PI / 2;
      lid.position.y = 0.16;
      lid.scale.setScalar(0.2);
      group.add(lid);
    } else {
      const coin = new THREE.Mesh(this.unitTorus, this.materials.gold);
      coin.rotation.y = Math.PI / 2;
      coin.scale.set(0.4, 0.4, 0.4);
      group.add(coin);
      const center = new THREE.Mesh(this.unitCylinder, this.materials.gold);
      center.rotation.z = Math.PI / 2;
      center.scale.set(0.25, 0.06, 0.25);
      group.add(center);
      const spark = new THREE.Mesh(this.unitSphere, this.materials.window);
      spark.scale.setScalar(0.08);
      group.add(spark);
    }

    this.pickupGroup.add(group);
    return group;
  }

  private animate(dt: number): void {
    const sim = this.simulation;
    const player = this.playerRig;
    const sliding = sim.slideTimer > 0 && sim.grounded;
    const running = !sim.result;
    this.playerPhase += dt * (running ? 8.8 + sim.speed * 0.34 : 2.1);
    const swing = Math.sin(this.playerPhase) * (running ? 0.45 : 0.08);

    player.group.position.set(sim.playerX, sim.playerY, 0);
    player.group.rotation.y = Math.PI;
    player.group.rotation.x = damp(player.group.rotation.x, sliding ? -0.28 : 0, 9, dt);
    player.group.scale.y = damp(player.group.scale.y, sliding ? 0.62 : 1, 12, dt);
    player.group.scale.x = damp(player.group.scale.x, sliding ? 1.02 : 1, 10, dt);
    player.group.scale.z = damp(player.group.scale.z, sliding ? 1.02 : 1, 10, dt);

    player.leftLeg.rotation.x = swing;
    player.rightLeg.rotation.x = -swing;
    player.leftArm.rotation.x = damp(player.leftArm.rotation.x, PLAYER_ARM_REST + swing * 0.03, 15, dt);
    player.rightArm.rotation.x = damp(player.rightArm.rotation.x, PLAYER_ARM_REST - swing * 0.03, 15, dt);
    player.leftArm.rotation.z = damp(player.leftArm.rotation.z, -0.13, 12, dt);
    player.rightArm.rotation.z = damp(player.rightArm.rotation.z, 0.13, 12, dt);
    player.torso.rotation.x = damp(player.torso.rotation.x, sliding ? -0.26 : -0.06, 8, dt);
    player.torso.rotation.y = Math.sin(this.playerPhase * 0.5) * 0.025;
    player.torso.position.y = 1.02 + (running ? Math.abs(Math.sin(this.playerPhase)) * 0.018 : 0);
    player.head.position.y = 1.52 + (running ? Math.abs(Math.sin(this.playerPhase)) * 0.012 : 0);
    player.head.rotation.z = Math.sin(this.playerPhase * 0.5) * 0.018;

    if (!sim.grounded) {
      player.leftLeg.rotation.x = 0.42;
      player.rightLeg.rotation.x = 0.25;
      player.leftArm.rotation.z = -0.2;
      player.rightArm.rotation.z = 0.2;
    }

    const laneVelocity = LANE_X[sim.lane] - sim.playerX;
    const trayTilt = damp(this.tray.left.group.rotation.z, laneVelocity * 0.18, 9, dt);
    this.tray.left.group.rotation.z = trayTilt;
    this.tray.right.group.rotation.z = trayTilt;
    const jumpTilt = sim.grounded ? 0 : -sim.velocityY * 0.025;
    this.tray.left.group.rotation.x = 1.15 + jumpTilt;
    this.tray.right.group.rotation.x = 1.15 + jumpTilt;
    if (this.tray.right.liquid) {
      this.tray.right.liquid.position.x = Math.sin(this.playerPhase * 1.8) * 0.008 + laneVelocity * 0.015;
      this.tray.right.liquid.rotation.z = -laneVelocity * 0.08;
    }
    const leftRatio = sim.leftTray / 100;
    const rightRatio = sim.rightTray / 100;
    for (const piece of this.tray.left.foods) {
      const base = piece.userData.baseScale as THREE.Vector3 | undefined;
      if (base) piece.scale.copy(base).multiplyScalar(0.55 + leftRatio * 0.45);
    }
    for (const piece of this.tray.right.foods) {
      const base = piece.userData.baseScale as THREE.Vector3 | undefined;
      if (base) piece.scale.copy(base).multiplyScalar(0.55 + rightRatio * 0.45);
    }

    this.teacherPhase += dt * (running ? 9.5 + sim.speed * 0.3 : 3);
    this.teacherX = damp(this.teacherX, sim.playerX - 0.6, 3.2, dt);
    const teacherSwing = Math.sin(this.teacherPhase) * 0.58;
    this.teacherRig.leftLeg.rotation.x = teacherSwing;
    this.teacherRig.rightLeg.rotation.x = -teacherSwing;
    this.teacherRig.leftArm.rotation.x = -teacherSwing * 0.85;
    this.teacherRig.rightArm.rotation.x = teacherSwing * 0.85;
    const catchPose = sim.result?.outcome === "caught";
    this.teacherGroup.position.x = damp(
      this.teacherGroup.position.x,
      catchPose ? sim.playerX : this.teacherX,
      catchPose ? 10 : 4,
      dt,
    );
    this.teacherGroup.position.z = damp(
      this.teacherGroup.position.z,
      catchPose ? 2.05 : sim.teacherGap,
      catchPose ? 12 : 6,
      dt,
    );
    this.teacherGroup.rotation.y = Math.PI;
    this.teacherGroup.rotation.z = Math.sin(this.teacherPhase * 0.5) * 0.018;
    this.teacherRig.torso.rotation.x = -0.12;
    this.teacherRig.leftArm.rotation.z = -0.1;
    this.teacherRig.rightArm.rotation.z = 0.1;
    if (catchPose) {
      this.teacherRig.leftArm.rotation.x = damp(this.teacherRig.leftArm.rotation.x, -1.7, 10, dt);
      this.teacherRig.rightArm.rotation.x = damp(this.teacherRig.rightArm.rotation.x, -1.7, 10, dt);
    }

    this.stepTimer -= dt;
    if (running && this.stepTimer <= 0) {
      this.stepTimer = 0.26;
      this.audio.footstep(false);
      if (sim.teacherGap < 3.8) this.audio.footstep(true);
    }
    this.dustTimer -= dt;
    if (running && this.dustTimer <= 0) {
      this.dustTimer = 0.22;
      this.spawnDust();
    }

    this.shake = Math.max(0, this.shake - dt * 2.8);
    const shakeX = (Math.random() - 0.5) * this.shake * 0.18;
    const shakeY = (Math.random() - 0.5) * this.shake * 0.1;
    this.camera.position.x = damp(this.camera.position.x, 2.15 + sim.playerX * 0.24, 5, dt) + shakeX;
    this.camera.position.y = damp(this.camera.position.y, 4.6 + sim.playerY * 0.11, 6, dt) + shakeY;
    this.camera.position.z = damp(this.camera.position.z, sim.teacherGap + 6, 4, dt);
    this.camera.lookAt(sim.playerX * 0.3, 1.18 + sim.playerY * 0.2, -7.5);
    this.camera.fov = window.innerWidth < 700 ? 64 : 58;
    this.camera.updateProjectionMatrix();

    for (const visual of this.obstacleVisuals.values()) {
      if (visual.kind === "high") visual.group.rotation.z = Math.sin(this.elapsed * 1.4) * 0.006;
    }
    for (const visual of this.pickupVisuals.values()) {
      visual.group.rotation.y += dt * 2.2;
      visual.group.position.y = 0.88 + Math.sin(this.elapsed * 3 + visual.group.position.z) * 0.07;
      const glow = visual.group.userData.glow as THREE.Mesh | undefined;
      if (glow) {
        const pulse = 1 + Math.sin(this.elapsed * 4.4 + visual.group.position.z * 0.4) * 0.12;
        glow.scale.setScalar((visual.kind === "token" ? 0.78 : 0.68) * pulse);
        glow.rotation.z += dt * 0.7;
      }
    }
  }

  private updateParticles(dt: number): void {
    for (const particle of this.particles) {
      if (particle.life <= 0) continue;
      particle.life -= dt;
      if (particle.life <= 0) {
        particle.mesh.visible = false;
        continue;
      }
      particle.velocity.y -= 8.5 * dt;
      particle.mesh.position.addScaledVector(particle.velocity, dt);
      particle.mesh.rotation.x += particle.spin.x * dt;
      particle.mesh.rotation.y += particle.spin.y * dt;
      particle.mesh.rotation.z += particle.spin.z * dt;
      const alpha = Math.max(0, particle.life / particle.maxLife);
      particle.mesh.scale.setScalar(0.018 + alpha * 0.026);
      const mat = particle.mesh.material as THREE.MeshStandardMaterial;
      if (mat !== this.materials.dust) {
        mat.opacity = alpha;
        mat.transparent = true;
      }
    }
  }

  private spawnFoodBurst(side: "left" | "right"): void {
    const tray = side === "left" ? this.tray.left.group : this.tray.right.group;
    const position = new THREE.Vector3();
    tray.getWorldPosition(position);
    let spawned = 0;
    for (let index = 0; index < this.particles.length; index += 1) {
      const particle = this.particles[index];
      if (particle.life > 0) continue;
      particle.mesh.visible = true;
      particle.mesh.position.copy(position);
      particle.mesh.material = this.particleMaterials[index % this.particleMaterials.length];
      const mat = particle.mesh.material as THREE.MeshStandardMaterial;
      mat.opacity = 1;
      particle.velocity.set((Math.random() - 0.5) * 2.6, 1.4 + Math.random() * 2.5, (Math.random() - 0.5) * 2.4);
      particle.spin.set(Math.random() * 9, Math.random() * 9, Math.random() * 9);
      particle.life = 0.6 + Math.random() * 0.6;
      particle.maxLife = particle.life;
      spawned += 1;
      if (spawned >= 10) break;
    }
  }

  private spawnPickupBurst(kind: PickupKind): void {
    const pickup = this.simulation.pickups.find(
      (entry) => entry.collected && entry.kind === kind,
    );
    const visual = pickup ? this.pickupVisuals.get(pickup.id) : null;
    const position = new THREE.Vector3(
      this.simulation.playerX,
      1.02,
      0.4,
    );
    visual?.group.getWorldPosition(position);
    const palettes: Record<PickupKind, number[]> = {
      chicken: [2, 4, 0],
      fries: [0, 2],
      samosa: [2, 4],
      burger: [3, 4, 0],
      coldDrink: [1, 3],
      token: [0, 1],
    };
    this.spawnBurst(position, palettes[kind], 8, 1.7);
    const ringColors: Record<PickupKind, string> = {
      chicken: "#d99545",
      fries: "#e8b94f",
      samosa: "#d6a04b",
      burger: "#c58e4e",
      coldDrink: "#9fd3bd",
      token: "#e7c47d",
    };
    this.spawnCollectRing(position, ringColors[kind], 1);
  }

  private spawnFeastBurst(): void {
    const position = new THREE.Vector3(this.simulation.playerX, 1.15, 0.1);
    this.spawnBurst(position, [0, 1, 4, 3, 2], 28, 3.1);
    this.spawnCollectRing(position, "#e7c47d", 2.1);
    this.spawnCollectRing(
      new THREE.Vector3(this.simulation.playerX, 0.25, 0.1),
      "#f1e3c8",
      1.4,
    );
  }

  private spawnCollectRing(position: THREE.Vector3, color: string, scale: number): void {
    const ring = this.pickupRings.find((entry) => entry.life <= 0);
    if (!ring) return;
    ring.mesh.visible = true;
    ring.mesh.position.copy(position);
    ring.mesh.position.y = Math.max(0.25, position.y - 0.18);
    ring.mesh.material.color.set(color);
    ring.mesh.material.opacity = 0.8;
    ring.scale = scale;
    ring.mesh.scale.setScalar(0.25 * scale);
    ring.life = ring.maxLife;
  }

  private updatePickupRings(dt: number): void {
    for (const ring of this.pickupRings) {
      if (ring.life <= 0) continue;
      ring.life -= dt;
      if (ring.life <= 0) {
        ring.mesh.visible = false;
        continue;
      }
      const progress = 1 - ring.life / ring.maxLife;
      ring.mesh.scale.setScalar((0.25 + progress * 1.15) * ring.scale);
      ring.mesh.material.opacity = (1 - progress) * 0.8;
      ring.mesh.position.y += dt * 0.45;
    }
  }

  private spawnBurst(
    position: THREE.Vector3,
    palette: number[],
    count: number,
    spread: number,
  ): void {
    let spawned = 0;
    for (let index = 0; index < this.particles.length; index += 1) {
      const particle = this.particles[index];
      if (particle.life > 0) continue;
      particle.mesh.visible = true;
      particle.mesh.position.copy(position);
      particle.mesh.material = this.particleMaterials[
        palette[index % palette.length] % this.particleMaterials.length
      ];
      const mat = particle.mesh.material as THREE.MeshStandardMaterial;
      mat.opacity = 1;
      particle.velocity.set(
        (Math.random() - 0.5) * spread * 2,
        1.2 + Math.random() * spread * 1.35,
        (Math.random() - 0.5) * spread * 1.6,
      );
      particle.spin.set(Math.random() * 9, Math.random() * 9, Math.random() * 9);
      particle.life = 0.55 + Math.random() * 0.75;
      particle.maxLife = particle.life;
      spawned += 1;
      if (spawned >= count) break;
    }
  }

  private spawnDust(): void {
    const particle = this.particles.find((entry) => entry.life <= 0);
    if (!particle) return;
    particle.mesh.visible = true;
    particle.mesh.position.set(
      this.simulation.playerX + (Math.random() - 0.5) * 0.55,
      0.12,
      0.15 + Math.random() * 0.3,
    );
    particle.mesh.material = this.materials.dust;
    this.materials.dust.opacity = 0.5;
    particle.velocity.set((Math.random() - 0.5) * 0.4, 0.4 + Math.random() * 0.3, 0.25);
    particle.spin.set(0, Math.random(), 0);
    particle.life = 0.45;
    particle.maxLife = 0.45;
  }

  private handlePointerDown = (event: PointerEvent): void => {
    if (this.paused) return;
    this.pointerStart = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      time: performance.now(),
    };
    this.renderer.domElement.setPointerCapture?.(event.pointerId);
    void this.audio.resume();
  };

  private handlePointerUp = (event: PointerEvent): void => {
    const start = this.pointerStart;
    this.pointerStart = null;
    if (!start || start.id !== event.pointerId || this.paused) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (Math.hypot(dx, dy) < 24) return;
    if (Math.abs(dx) > Math.abs(dy)) {
      if (dx < 0) this.simulation.moveLeft();
      else this.simulation.moveRight();
    } else if (dy < 0) {
      this.simulation.jump();
    } else {
      this.simulation.slide();
    }
    this.emitHud();
  };

  private handlePointerCancel = (): void => {
    this.pointerStart = null;
  };

  private handleKeyDown = (event: KeyboardEvent): void => {
    if (event.key === "Escape") {
      event.preventDefault();
      this.setPaused(!this.paused);
      return;
    }
    if (this.paused) return;
    const key = event.key.toLowerCase();
    if (key === "arrowleft" || key === "a") {
      event.preventDefault();
      this.simulation.moveLeft();
    } else if (key === "arrowright" || key === "d") {
      event.preventDefault();
      this.simulation.moveRight();
    } else if (key === "arrowup" || key === "w" || key === " ") {
      event.preventDefault();
      this.simulation.jump();
    } else if (key === "arrowdown" || key === "s") {
      event.preventDefault();
      this.simulation.slide();
    } else {
      return;
    }
    void this.audio.resume();
    this.emitHud();
  };

  private handleVisibility = (): void => {
    if (document.visibilityState !== "hidden" || this.simulation.result) return;
    this.paused = true;
    this.simulation.paused = true;
    this.emitHud();
    this.options.onPauseRequest?.(true);
  };
}
