import * as THREE from "three";
import { createCharacter, setRigUniform, type CharacterRig } from "./CharacterFactory";
import { MeshBuilder, shortestAngle, type MaterialLibrary } from "./geometry";
import {
  chalkboardTexture,
  dirtTexture,
  grassTexture,
  houseFlagTexture,
  nameTagTexture,
  noticeTexture,
  plasterTexture,
  seededRandom,
  signTexture,
  stoneTexture,
} from "./textures";
import {
  DEFAULT_HOUSE_ID,
  HOUSES,
  getHouse,
  type HouseId,
} from "../data/houses";
import { getHouseCaptain, getHousePrefect } from "../data/students";
import { GARDEN_ITEMS, type GardenItemId } from "../data/night";
import { INTERIOR_CONTENT } from "../data/interiors";
import type { NoticeView } from "../core/types";

export interface BlockCollider {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  active: boolean;
  label: string;
  /** Vertical limits let an upper storey wall coexist with a ground room. */
  minY?: number;
  maxY?: number;
}

/** A level, walkable surface. Upper storeys are real collision floors. */
export interface FloorZone {
  id: string;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  height: number;
}

/** A straight stair flight, treated as a smooth height ramp for movement. */
export interface FloorRamp {
  id: string;
  x1: number;
  z1: number;
  x2: number;
  z2: number;
  width: number;
  startY: number;
  endY: number;
}

export interface WorldInteractable {
  id: string;
  kind: "npc" | "notice" | "door" | "student" | "teacher" | "roommate" | "garden" | "book";
  label: string;
  position: THREE.Vector3;
  radius: number;
  active?: boolean;
  door?: Door;
  studentId?: string;
  itemId?: GardenItemId;
  verb?: string;
  notice?: NoticeView;
  roomId?: string;
}

export interface WorldZone {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export interface PathSegment {
  x1: number;
  z1: number;
  x2: number;
  z2: number;
  width: number;
}

export interface HouseHostelInfo {
  houseId: HouseId;
  center: THREE.Vector3;
  zone: WorldZone;
  door: Door;
  markerPoint: THREE.Vector3;
  interiorPoint: THREE.Vector3;
  roommatePoint: THREE.Vector3;
  captainPoint: THREE.Vector3;
}

export interface PatrolDetection {
  seen: boolean;
  hidden: boolean;
  distance: number;
}

interface NightPatrol {
  rig: CharacterRig;
  tag: THREE.Sprite;
  cone: THREE.Mesh;
  coneMaterial: THREE.MeshBasicMaterial;
  route: THREE.Vector3[];
  nextIndex: number;
  facing: number;
  speed: number;
}

export class Door {
  group = new THREE.Group();
  amount = 0;
  target = 0;
  readonly openAngle: number;
  readonly baseRotationY: number;
  collider: BlockCollider | null = null;
  readonly label: string;
  private closingPrompt: string;
  private openingPrompt: string;

  constructor(
    openAngle: number,
    label: string,
    openingPrompt: string,
    closingPrompt: string,
    baseRotationY = 0,
  ) {
    this.openAngle = openAngle;
    this.label = label;
    this.openingPrompt = openingPrompt;
    this.closingPrompt = closingPrompt;
    this.baseRotationY = baseRotationY;
  }

  get isOpen(): boolean {
    return this.target > 0.5;
  }

  get prompt(): string {
    return this.isOpen ? this.closingPrompt : this.openingPrompt;
  }

  toggle(): void {
    this.target = this.isOpen ? 0 : 1;
    if (this.collider) this.collider.active = !this.isOpen;
  }

  update(dt: number): void {
    const speed = 2.4;
    this.amount += Math.sign(this.target - this.amount) * Math.min(Math.abs(this.target - this.amount), dt * speed);
    this.group.rotation.y = this.baseRotationY + this.amount * this.openAngle;
  }

  setOpenInstant(open: boolean): void {
    this.target = open ? 1 : 0;
    this.amount = this.target;
    this.group.rotation.y = this.baseRotationY + this.amount * this.openAngle;
    if (this.collider) this.collider.active = !open;
  }
}

export const OBJECTIVE_POINTS: Record<string, THREE.Vector3> = {
  "meet-meera": new THREE.Vector3(4.2, 0, 31),
  "notice-board": new THREE.Vector3(9.9, 0, 20),
  classroom: new THREE.Vector3(-15.1, 0, 0),
  hostel: new THREE.Vector3(15.1, 0, 9.1),
};

const START_MARKER_Y = 0.06;

export class WorldEnvironment {
  readonly group = new THREE.Group();
  readonly colliders: BlockCollider[] = [];
  readonly floors: FloorZone[] = [];
  readonly ramps: FloorRamp[] = [];
  readonly occluders: THREE.Box3[] = [];
  readonly interactables: WorldInteractable[] = [];
  readonly doors: Door[] = [];
  readonly paths: PathSegment[] = [];
  private treeExclusions: WorldZone[] = [];
  readonly zones: Record<"classroom" | "hostel", WorldZone> = {
    classroom: { minX: -35.5, maxX: -16.4, minZ: -12.6, maxZ: 10.6 },
    hostel: { minX: 16, maxX: 30, minZ: 4, maxZ: 14 },
  };
  readonly spawn = new THREE.Vector3(0, 0, 42);
  readonly npcPosition = new THREE.Vector3(4.2, 0, 33.4);
  readonly bounds = 54;
  readonly houseHostels: Record<HouseId, HouseHostelInfo> = {} as Record<HouseId, HouseHostelInfo>;
  readonly gardenCenter = new THREE.Vector3(-38, 0, 26);
  readonly gardenRadius = 7.4;
  readonly hideZones: WorldZone[] = [];
  readonly gardenPlots: WorldInteractable[] = [];
  readonly nightGroup = new THREE.Group();
  activeHouseId: HouseId = DEFAULT_HOUSE_ID;
  night = false;
  patrolDetection: PatrolDetection = { seen: false, hidden: false, distance: Number.POSITIVE_INFINITY };

  npc!: CharacterRig;
  npcNameTag!: THREE.Sprite;
  marker!: THREE.Group;
  sun!: THREE.DirectionalLight;
  skyMaterial: THREE.ShaderMaterial | null = null;
  sunGlow: THREE.Sprite | null = null;
  hemisphere: THREE.HemisphereLight | null = null;
  ambient: THREE.AmbientLight | null = null;
  fill: THREE.DirectionalLight | null = null;
  roommate: CharacterRig | null = null;
  roommateTag: THREE.Sprite | null = null;

  private builder: MeshBuilder;
  private materials: MaterialLibrary = {};
  private disposables: Array<{ dispose: () => void }> = [];
  private pointLights: THREE.PointLight[] = [];
  private flag: THREE.Mesh | null = null;
  private flagBase: Float32Array | null = null;
  private flagTime = 0;
  private npcBaseY = 0;
  private markerMaterials: THREE.MeshBasicMaterial[] = [];
  private signMeshes: THREE.Mesh[] = [];
  private houseFlagMaterials: Record<HouseId, THREE.MeshStandardMaterial> = {} as Record<HouseId, THREE.MeshStandardMaterial>;
  private houseNpcs: Array<{
    id: string;
    rig: CharacterRig;
    tag: THREE.Sprite;
    baseY: number;
    baseRotation: number;
  }> = [];
  private playerCharacterId: string | null = null;
  private patrols: NightPatrol[] = [];
  private houseLights: THREE.PointLight[] = [];
  private stars: THREE.Points | null = null;
  private moon: THREE.Sprite | null = null;
  private roommateInteractable: WorldInteractable | null = null;

  constructor() {
    this.group.name = "world";
    this.nightGroup.name = "night-life";
    this.nightGroup.visible = false;
    this.group.add(this.nightGroup);
    this.createMaterials();
    this.builder = new MeshBuilder(this.materials);
    this.setupSky();
    this.setupLighting();
    this.createMarker();
  }

  // ---------------------------------------------------------------- materials

  private textured(
    base: THREE.CanvasTexture,
    repeatX: number,
    repeatY: number,
  ): THREE.CanvasTexture {
    const map = base.clone();
    map.wrapS = THREE.RepeatWrapping;
    map.wrapT = THREE.RepeatWrapping;
    map.repeat.set(repeatX, repeatY);
    map.needsUpdate = true;
    this.disposables.push(map);
    return map;
  }

  private standard(
    color: string | number,
    roughness: number,
    metalness = 0,
    extra: Partial<THREE.MeshStandardMaterialParameters> = {},
  ): THREE.MeshStandardMaterial {
    const material = new THREE.MeshStandardMaterial({ color, roughness, metalness, ...extra });
    this.disposables.push(material);
    return material;
  }

  private createMaterials(): void {
    const grass = grassTexture();
    const stone = stoneTexture();
    const dirt = dirtTexture();
    const plaster = plasterTexture();
    this.disposables.push(grass, stone, dirt, plaster);

    const grassMap = this.textured(grass, 48, 48);
    const pathMap = this.textured(stone, 2, 6);
    const plazaMap = this.textured(stone, 8, 7);
    const dirtMap = this.textured(dirt, 5, 4);
    const plasterMap = this.textured(plaster, 3, 2);
    const plasterMap2 = this.textured(plaster, 2, 3);

    const mats: MaterialLibrary = {
      grass: this.standard("#ffffff", 1, 0, { map: grassMap }),
      stonePath: this.standard("#c8c2b4", 0.92, 0, { map: pathMap }),
      stonePlaza: this.standard("#cfc8b8", 0.9, 0, { map: plazaMap }),
      dirt: this.standard("#b7a189", 1, 0, { map: dirtMap }),
      track: this.standard("#9a6248", 0.96),
      plaster: this.standard("#efe6d2", 0.94, 0, { map: plasterMap }),
      plasterWarm: this.standard("#e3cfae", 0.94, 0, { map: plasterMap2 }),
      plasterCool: this.standard("#d7d2c4", 0.94, 0, { map: plasterMap }),
      plinth: this.standard("#7d7464", 0.95),
      roof: this.standard("#8a8071", 0.92),
      roofDark: this.standard("#645d52", 0.9),
      terracotta: this.standard("#8d4f3c", 0.9),
      wood: this.standard("#5f442c", 0.85),
      woodLight: this.standard("#9a7448", 0.86),
      woodDark: this.standard("#3f2d1d", 0.9),
      metal: this.standard("#2b2f2c", 0.5, 0.7),
      brass: this.standard("#b8965a", 0.4, 0.65),
      glass: this.standard("#2a3944", 0.14, 0.42, {
        emissive: new THREE.Color("#1c2d38"),
        emissiveIntensity: 0.5,
      }),
      glassWarm: this.standard("#3a4038", 0.2, 0.3, {
        emissive: new THREE.Color("#d9a761"),
        emissiveIntensity: 0.55,
      }),
      foliageA: this.standard("#3d5a30", 0.96),
      foliageB: this.standard("#4d6a36", 0.96),
      foliageC: this.standard("#60763e", 0.96),
      hedge: this.standard("#40562f", 0.97),
      bark: this.standard("#4b3a2a", 0.95),
      blossomRed: this.standard("#b34a3e", 0.7),
      blossomYellow: this.standard("#cc9a44", 0.7),
      blossomWhite: this.standard("#ddd3bb", 0.75),
      mattress: this.standard("#d8d2c2", 0.92),
      blanket: this.standard("#3b4a63", 0.94),
      paper: this.standard("#eee7d4", 0.9),
      whitePaint: this.standard("#e6e1d4", 0.88),
      blackboard: this.standard("#24382d", 0.9),
      lampGlow: this.standard("#f4dcae", 0.4, 0, {
        emissive: new THREE.Color("#ffd695"),
        emissiveIntensity: 2.2,
      }),
      stageStone: this.standard("#b3a998", 0.92),
      water: this.standard("#42636b", 0.15, 0.3, {
        emissive: new THREE.Color("#1f343b"),
        emissiveIntensity: 0.4,
      }),
      fabricRed: this.standard("#7a3b32", 0.95),
      flagPole: this.standard("#cdc6b6", 0.35, 0.7),
      cement: this.standard("#a49c8c", 0.94),
      darkTrim: this.standard("#3c3a34", 0.8),
      bamboo: this.standard("#607b45", 0.9),
      hill: this.standard("#718066", 0.98),
    };

    const noticeMap = noticeTexture();
    this.disposables.push(noticeMap);
    mats.notice = this.standard("#ffffff", 0.9, 0, { map: noticeMap });

    const chalk = chalkboardTexture();
    this.disposables.push(chalk);
    mats.chalk = this.standard("#ffffff", 0.95, 0, { map: chalk });

    const signs: Array<[string, string, string]> = [
      ["signGate", "NAVODAYA", "VIDYALAYA · RESIDENTIAL CAMPUS"],
      ["signAcademic", "VIDYA BHAVAN", "ACADEMIC BLOCK · ROOMS 1–12"],
      ["signHostel", "NILAYAM", "BOYS & GIRLS HOSTEL"],
      ["signDining", "ANNAPOORNA", "DINING HALL · MESS"],
      ["signLibrary", "GYAN MANDIR", "LIBRARY & READING ROOM"],
      ["signSports", "KHEL MAIDAN", "SPORTS GROUND"],
      ["signGarden", "KITCHEN GARDEN", "STAFF ONLY · PRACTICAL BOTANY"],
      ["signAdmin", "PRASHASAN", "ADMINISTRATION · PRINCIPAL'S OFFICE"],
      ["signLabs", "VIGYAN BHAVAN", "SCIENCE LABORATORIES · PRACTICALS"],
      ["signKitchen", "RASOI", "KITCHEN · DINING STORE"],
      ["signSecurity", "SURAKSHA", "SECURITY · VISITOR ENTRY"],
      ["signPrincipal", "PRINCIPAL", "KARYALAY · PRASHASAN"],
      ["signMess", "ANNAPOORNA", "DINING HALL · SERVING COUNTER"],
      ["signCourts", "KHEL KSHETRA", "BASKETBALL · VOLLEYBALL COURTS"],
      ["signRoom101", "ROOM 101", "CLASS VII A · GROUND FLOOR"],
      ["signRoom102", "ROOM 102", "CLASS VII B · GROUND FLOOR"],
      ["signRoom103", "ROOM 103", "CLASS VI A · GROUND FLOOR"],
      ["signRoom201", "ROOM 201", "CLASS VIII A · FIRST FLOOR"],
      ["signRoom202", "ROOM 202", "CLASS VIII B · FIRST FLOOR"],
      ["signStaff", "STAFF ROOM", "ACADEMIC BLOCK A · FIRST FLOOR"],
      ["signWashroom", "WASHROOM", "ACADEMIC BLOCK A · GROUND FLOOR"],
      ["signActivity", "ACTIVITY ROOM", "ACADEMIC BLOCK A · GROUND FLOOR"],
      ["signBlockB", "ABHYAS BHAVAN", "ACADEMIC BLOCK B · COMPUTER LAB"],
      ["signComputer", "COMPUTER LAB", "ACADEMIC BLOCK B · PRACTICALS"],
      ["signIndoorSports", "INDOOR SPORTS HALL", "BADMINTON · TABLE TENNIS"],
    ];
    for (const [key, main, sub] of signs) {
      const map = signTexture(main, sub);
      this.disposables.push(map);
      mats[key] = this.standard("#ffffff", 0.8, 0, { map });
    }

    for (const house of HOUSES) {
      const flagMap = houseFlagTexture(house.name, house.color, house.motto);
      this.disposables.push(flagMap);
      const flagMaterial = this.standard("#ffffff", 0.9, 0, {
        map: flagMap,
        side: THREE.DoubleSide,
      });
      this.houseFlagMaterials[house.id] = flagMaterial;
      mats[`houseFlag-${house.id}`] = flagMaterial;

      const hostelSign = signTexture(house.hostelName.toUpperCase(), `${house.name.toUpperCase()} · HOUSE HOSTEL`);
      this.disposables.push(hostelSign);
      mats[`signHouse-${house.id}`] = this.standard("#ffffff", 0.8, 0, { map: hostelSign });
    }
    mats.flag = this.houseFlagMaterials[DEFAULT_HOUSE_ID];

    this.materials = mats;
  }

  // -------------------------------------------------------------------- sky

  private setupSky(): void {
    const uniforms = {
      topColor: { value: new THREE.Color("#3f5d80") },
      midColor: { value: new THREE.Color("#a8a184") },
      bottomColor: { value: new THREE.Color("#f0cc9a") },
      sunDirection: { value: new THREE.Vector3(-0.55, 0.32, 0.55).normalize() },
    };
    const skyMaterial = new THREE.ShaderMaterial({
        uniforms,
        vertexShader: `
          varying vec3 vWorldPosition;
          void main() {
            vec4 worldPosition = modelMatrix * vec4(position, 1.0);
            vWorldPosition = worldPosition.xyz;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: `
          uniform vec3 topColor;
          uniform vec3 midColor;
          uniform vec3 bottomColor;
          uniform vec3 sunDirection;
          varying vec3 vWorldPosition;
          void main() {
            vec3 direction = normalize(vWorldPosition);
            float height = clamp(direction.y, -0.1, 1.0);
            vec3 color = mix(bottomColor, midColor, smoothstep(0.0, 0.22, height));
            color = mix(color, topColor, smoothstep(0.18, 0.75, height));
            float sunAmount = max(dot(direction, sunDirection), 0.0);
            color += vec3(1.0, 0.72, 0.42) * pow(sunAmount, 22.0) * 0.85;
            color += vec3(1.0, 0.78, 0.52) * pow(sunAmount, 4.0) * 0.12;
            gl_FragColor = vec4(color, 1.0);
            #include <tonemapping_fragment>
            #include <colorspace_fragment>
          }
        `,
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
      });
    this.skyMaterial = skyMaterial;
    const sky = new THREE.Mesh(new THREE.SphereGeometry(320, 32, 20), skyMaterial);
    sky.name = "sky";
    this.group.add(sky);

    // Soft sun glow sprite, generated procedurally.
    const canvas = document.createElement("canvas");
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
      gradient.addColorStop(0, "rgba(255,238,198,0.95)");
      gradient.addColorStop(0.28, "rgba(255,206,132,0.5)");
      gradient.addColorStop(1, "rgba(255,190,110,0)");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 128, 128);
    }
    const glowTexture = new THREE.CanvasTexture(canvas);
    glowTexture.colorSpace = THREE.SRGBColorSpace;
    this.disposables.push(glowTexture);
    const glowMaterial = new THREE.SpriteMaterial({
      map: glowTexture,
      transparent: true,
      depthWrite: false,
      fog: false,
      opacity: 0.85,
    });
    this.disposables.push(glowMaterial);
    const sunGlow = new THREE.Sprite(glowMaterial);
    sunGlow.position.set(-135, 92, 150);
    sunGlow.scale.set(90, 90, 1);
    this.group.add(sunGlow);
    this.sunGlow = sunGlow;
  }

  private setupLighting(): void {
    const hemisphere = new THREE.HemisphereLight(0xd6dde9, 0x5c5642, 0.75);
    this.group.add(hemisphere);
    this.hemisphere = hemisphere;

    const ambient = new THREE.AmbientLight(0xffe8c8, 0.22);
    this.group.add(ambient);
    this.ambient = ambient;

    const sun = new THREE.DirectionalLight(0xffd9a3, 3.1);
    sun.position.set(-48, 42, 46);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 180;
    sun.shadow.camera.left = -60;
    sun.shadow.camera.right = 60;
    sun.shadow.camera.top = 60;
    sun.shadow.camera.bottom = -60;
    sun.shadow.bias = -0.0006;
    sun.shadow.normalBias = 0.035;
    this.group.add(sun);
    this.group.add(sun.target);
    this.sun = sun;

    const fill = new THREE.DirectionalLight(0xbcd0e8, 0.35);
    fill.position.set(38, 24, -40);
    this.group.add(fill);
    this.fill = fill;
  }

  private addInteriorLight(x: number, z: number, intensity = 7): void {
    this.addInteriorLightAt(x, 2.9, z, intensity);
  }

  private addInteriorLightAt(x: number, y: number, z: number, intensity = 7): void {
    const light = new THREE.PointLight(0xffd8a4, intensity, 13, 2);
    light.position.set(x, y, z);
    this.group.add(light);
    this.pointLights.push(light);
  }

  // ------------------------------------------------------------------- build

  private async stage(progress: number, label: string, onProgress: (p: number, s: string) => void): Promise<void> {
    onProgress(progress, label);
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  }

  async build(onProgress: (progress: number, stage: string) => void): Promise<void> {
    await this.stage(0.08, "Surveying the campus", onProgress);
    this.buildGround();

    await this.stage(0.22, "Raising the main gate", onProgress);
    this.buildGate();

    await this.stage(0.34, "Laying the assembly ground", onProgress);
    this.buildPlaza();

    await this.stage(0.5, "Building the academic block", onProgress);
    this.buildAcademicBlock();

    await this.stage(0.64, "Opening the hostel", onProgress);
    this.buildHostel();

    await this.stage(0.72, "Serving the dining hall", onProgress);
    this.buildDiningHall();
    this.buildKitchen();
    this.buildLibrary();

    await this.stage(0.78, "Adding administration and laboratories", onProgress);
    this.buildAdministration();
    this.buildScienceLabs();
    this.buildAcademicBlockB();
    this.buildIndoorSportsHall();

    await this.stage(0.84, "Marking the sports ground", onProgress);
    this.buildSportsGround();

    await this.stage(0.88, "Raising the house hostels", onProgress);
    this.buildHouseHostels();

    await this.stage(0.91, "Planting the kitchen garden", onProgress);
    this.buildNightLife();

    await this.stage(0.94, "Planting gardens", onProgress);
    this.buildGardensAndTrees();
    this.buildRegionalLandscape();
    this.buildStreetProps();
    this.buildNpc();

    await this.stage(0.98, "Finalising lighting", onProgress);
    this.finalize();

    // Colliders need the final geometry; remove camera occluders that would
    // sit inside walkable rooms by construction (we never added those).
    this.buildInteractables();
    await this.stage(1, "Ready", onProgress);
  }

  private collider(
    minX: number,
    maxX: number,
    minZ: number,
    maxZ: number,
    label: string,
    minY?: number,
    maxY?: number,
  ): BlockCollider {
    const box: BlockCollider = { minX, maxX, minZ, maxZ, active: true, label, minY, maxY };
    this.colliders.push(box);
    return box;
  }

  private floor(id: string, minX: number, maxX: number, minZ: number, maxZ: number, height: number): void {
    this.floors.push({ id, minX, maxX, minZ, maxZ, height });
  }

  private ramp(id: string, x1: number, z1: number, x2: number, z2: number, width: number, startY: number, endY: number): void {
    this.ramps.push({ id, x1, z1, x2, z2, width, startY, endY });
  }

  /**
   * Highest walkable surface the player can reach from their current height.
   * A surface more than 55 cm above the player is overhead, not a step, so the
   * ground floor stays on the ground under a first-floor slab.
   */
  readonly walkHeightAt = (x: number, z: number, currentY: number): number => {
    let best = 0;
    const reach = currentY + 0.55;
    for (const surface of this.floors) {
      if (surface.height > reach || surface.height <= best) continue;
      if (x >= surface.minX && x <= surface.maxX && z >= surface.minZ && z <= surface.maxZ) {
        best = surface.height;
      }
    }
    for (const ramp of this.ramps) {
      const dx = ramp.x2 - ramp.x1;
      const dz = ramp.z2 - ramp.z1;
      const lengthSq = dx * dx + dz * dz;
      if (lengthSq < 0.0001) continue;
      const t = ((x - ramp.x1) * dx + (z - ramp.z1) * dz) / lengthSq;
      if (t < 0 || t > 1) continue;
      const px = ramp.x1 + dx * t;
      const pz = ramp.z1 + dz * t;
      if (Math.hypot(x - px, z - pz) > ramp.width / 2) continue;
      const height = ramp.startY + (ramp.endY - ramp.startY) * t;
      if (height <= reach && height > best) best = height;
    }
    return best;
  };

  private occluder(cx: number, cy: number, cz: number, w: number, h: number, d: number): void {
    this.occluders.push(
      new THREE.Box3(
        new THREE.Vector3(cx - w / 2, cy - h / 2, cz - d / 2),
        new THREE.Vector3(cx + w / 2, cy + h / 2, cz + d / 2),
      ),
    );
  }

  /** Static solid mass: batched mesh + ground collider + camera occluder. */
  private solid(
    key: string,
    w: number,
    h: number,
    d: number,
    x: number,
    z: number,
    label: string,
    options: { collide?: boolean; occlude?: boolean; rotY?: number } = {},
  ): void {
    this.builder.box(key, { w, h, d }, x, h / 2, z, { rotY: options.rotY ?? 0 });
    if (options.collide !== false && !options.rotY) {
      this.collider(x - w / 2, x + w / 2, z - d / 2, z + d / 2, label);
    }
    if (options.occlude !== false) this.occluder(x, h / 2, z, w, h, d);
  }

  /** Interior wall running east-west, with an optional doorway gap. */
  private wallAlongX(
    z: number,
    x1: number,
    x2: number,
    height: number,
    key: string,
    label: string,
    gap?: [number, number],
  ): void {
    const segments: Array<[number, number]> = gap ? [[x1, gap[0]], [gap[1], x2]] : [[x1, x2]];
    for (const [a, b] of segments) {
      if (b - a <= 0.02) continue;
      this.builder.box(key, { w: b - a, h: height, d: 0.36 }, (a + b) / 2, height / 2, z, {});
      this.collider(a, b, z - 0.18, z + 0.18, `${label}-wall`);
      this.occluder((a + b) / 2, height / 2, z, b - a, height, 0.36);
    }
  }

  /** Interior wall running north-south, with an optional doorway gap. */
  private wallAlongZ(
    x: number,
    z1: number,
    z2: number,
    height: number,
    key: string,
    label: string,
    gap?: [number, number],
  ): void {
    const segments: Array<[number, number]> = gap ? [[z1, gap[0]], [gap[1], z2]] : [[z1, z2]];
    for (const [a, b] of segments) {
      if (b - a <= 0.02) continue;
      this.builder.box(key, { w: 0.36, h: height, d: b - a }, x, height / 2, (a + b) / 2, {});
      this.collider(x - 0.18, x + 0.18, a, b, `${label}-wall`);
      this.occluder(x, height / 2, (a + b) / 2, 0.36, height, b - a);
    }
  }

  /** Vertical-scoped wall for a storey with any number of doorway gaps. */
  private wallLevelX(
    z: number,
    x1: number,
    x2: number,
    baseY: number,
    height: number,
    key: string,
    label: string,
    gaps: Array<[number, number]> = [],
  ): void {
    const sorted = [...gaps].sort((a, b) => a[0] - b[0]);
    let cursor = x1;
    for (const [gapStart, gapEnd] of sorted) {
      if (gapStart > cursor) this.wallLevelSegmentX(z, cursor, gapStart, baseY, height, key, label);
      cursor = Math.max(cursor, gapEnd);
    }
    if (cursor < x2) this.wallLevelSegmentX(z, cursor, x2, baseY, height, key, label);
  }

  private wallLevelSegmentX(
    z: number,
    x1: number,
    x2: number,
    baseY: number,
    height: number,
    key: string,
    label: string,
  ): void {
    const w = x2 - x1;
    if (w <= 0.02) return;
    this.builder.box(key, { w, h: height, d: 0.36 }, (x1 + x2) / 2, baseY + height / 2, z, {});
    this.collider(x1, x2, z - 0.18, z + 0.18, `${label}-wall`, baseY, baseY + height);
    this.occluder((x1 + x2) / 2, baseY + height / 2, z, w, height, 0.36);
  }

  private wallLevelZ(
    x: number,
    z1: number,
    z2: number,
    baseY: number,
    height: number,
    key: string,
    label: string,
    gaps: Array<[number, number]> = [],
  ): void {
    const sorted = [...gaps].sort((a, b) => a[0] - b[0]);
    let cursor = z1;
    for (const [gapStart, gapEnd] of sorted) {
      if (gapStart > cursor) this.wallLevelSegmentZ(x, cursor, gapStart, baseY, height, key, label);
      cursor = Math.max(cursor, gapEnd);
    }
    if (cursor < z2) this.wallLevelSegmentZ(x, cursor, z2, baseY, height, key, label);
  }

  private wallLevelSegmentZ(
    x: number,
    z1: number,
    z2: number,
    baseY: number,
    height: number,
    key: string,
    label: string,
  ): void {
    const d = z2 - z1;
    if (d <= 0.02) return;
    this.builder.box(key, { w: 0.36, h: height, d }, x, baseY + height / 2, (z1 + z2) / 2, {});
    this.collider(x - 0.18, x + 0.18, z1, z2, `${label}-wall`, baseY, baseY + height);
    this.occluder(x, baseY + height / 2, (z1 + z2) / 2, 0.36, height, d);
  }

  private interiorTable(x: number, z: number, w: number, d: number, collide = true): void {
    this.builder.box("woodLight", { w, h: 0.08, d }, x, 0.76, z, {});
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        this.builder.box(
          "woodDark",
          { w: 0.08, h: 0.72, d: 0.08 },
          x + sx * (w / 2 - 0.12),
          0.38,
          z + sz * (d / 2 - 0.12),
          {},
        );
      }
    }
    if (collide) this.collider(x - w / 2, x + w / 2, z - d / 2, z + d / 2, "furniture-table");
  }

  private interiorChair(x: number, z: number, facing: 1 | -1 = 1): void {
    this.builder.box("woodDark", { w: 0.44, h: 0.06, d: 0.44 }, x, 0.44, z, {});
    this.builder.box("woodDark", { w: 0.44, h: 0.5, d: 0.06 }, x, 0.72, z + facing * 0.19, {});
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        this.builder.box("metal", { w: 0.045, h: 0.42, d: 0.045 }, x + sx * 0.17, 0.21, z + sz * 0.17, {});
      }
    }
  }

  /** Bookshelf; axis is the direction the shelf runs along. */
  private bookshelf(cx: number, cz: number, length: number, axis: "x" | "z"): void {
    const depth = 0.55;
    const height = 2.12;
    const w = axis === "x" ? length : depth;
    const d = axis === "x" ? depth : length;
    this.builder.box("woodDark", { w, h: 0.1, d }, cx, height, cz, {});
    this.builder.box("woodDark", { w, h: 0.1, d: 0.06 }, cx, 0.03, cz, {});
    const shelves = [0.44, 0.9, 1.36, 1.8];
    for (const y of shelves) {
      this.builder.box("woodDark", { w: w - 0.06, h: 0.06, d: d - 0.04 }, cx, y, cz, {});
      const count = Math.max(5, Math.round(length * 3.2));
      for (let i = 0; i < count; i += 1) {
        const offset = -length / 2 + 0.24 + (i / Math.max(1, count - 1)) * (length - 0.48);
        const bx = axis === "x" ? cx + offset : cx;
        const bz = axis === "x" ? cz : cz + offset;
        const bookHeight = 0.24 + ((i * 7) % 5) * 0.022;
        const bookWidth = 0.1 + ((i * 3) % 4) * 0.018;
        const key = i % 3 === 0 ? "fabricRed" : i % 3 === 1 ? "hedge" : "paper";
        this.builder.box(
          key,
          axis === "x"
            ? { w: bookWidth, h: bookHeight, d: 0.2 }
            : { w: 0.2, h: bookHeight, d: bookWidth },
          bx,
          y + 0.03 + bookHeight / 2,
          bz,
          {},
        );
      }
    }
    this.collider(cx - w / 2, cx + w / 2, cz - d / 2, cz + d / 2, "furniture-shelf");
  }

  /** 2D segment/AABB test used for interaction line-of-sight. */
  private segmentHitsBox(
    x1: number,
    z1: number,
    x2: number,
    z2: number,
    minX: number,
    maxX: number,
    minZ: number,
    maxZ: number,
  ): boolean {
    let tMin = 0;
    let tMax = 1;
    const dx = x2 - x1;
    const dz = z2 - z1;
    for (const [p, delta, min, max] of [
      [x1, dx, minX, maxX],
      [z1, dz, minZ, maxZ],
    ] as const) {
      if (Math.abs(delta) < 0.0001) {
        if (p < min || p > max) return false;
        continue;
      }
      let near = (min - p) / delta;
      let far = (max - p) / delta;
      if (near > far) [near, far] = [far, near];
      tMin = Math.max(tMin, near);
      tMax = Math.min(tMax, far);
      if (tMin > tMax) return false;
    }
    return tMax > 0.02 && tMin < 0.98;
  }

  /**
   * Interaction must not pass through a building wall or a closed door. The
   * check uses camera occluders (tall walls) and wall/door colliders only, so
   * low furniture does not suppress prompts.
   */
  hasLineOfSight(fromX: number, fromZ: number, toX: number, toZ: number): boolean {
    if (this.segmentHitsBoxAnyOccluder(fromX, fromZ, toX, toZ)) return false;
    for (const collider of this.colliders) {
      if (!collider.active) continue;
      if (!collider.label.includes("wall") && !collider.label.includes("door")) continue;
      if (this.segmentHitsBox(fromX, fromZ, toX, toZ, collider.minX, collider.maxX, collider.minZ, collider.maxZ)) {
        return false;
      }
    }
    return true;
  }

  private segmentHitsBoxAnyOccluder(fromX: number, fromZ: number, toX: number, toZ: number): boolean {
    const eye = 1.35;
    for (const box of this.occluders) {
      if (box.min.y > eye || box.max.y < eye) continue;
      if (this.segmentHitsBox(fromX, fromZ, toX, toZ, box.min.x, box.max.x, box.min.z, box.max.z)) {
        return true;
      }
    }
    return false;
  }

  private addPath(x1: number, z1: number, x2: number, z2: number, width: number): void {
    const dx = x2 - x1;
    const dz = z2 - z1;
    const length = Math.hypot(dx, dz);
    const angle = Math.atan2(dx, dz);
    const cx = (x1 + x2) / 2;
    const cz = (z1 + z2) / 2;
    this.builder.box("stonePath", { w: width, h: 0.05, d: length }, cx, 0.025, cz, { rotY: angle });
    this.paths.push({ x1, z1, x2, z2, width });
  }

  private sign(key: string, width: number, height: number, x: number, y: number, z: number, rotY: number): void {
    const material = this.materials[key];
    if (!material) return;
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), material);
    mesh.position.set(x, y, z);
    mesh.rotation.y = rotY;
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    this.group.add(mesh);
    this.signMeshes.push(mesh);
  }

  private buildGround(): void {
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(240, 240, 1, 1), this.materials.grass);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = 0;
    ground.receiveShadow = true;
    ground.name = "ground";
    this.group.add(ground);

    // Perimeter wall + hedge, keeps the world readable and bounded.
    const wallY = 1.15;
    this.builder.box("stonePath", { w: 108, h: wallY, d: 0.7 }, 0, wallY / 2, -55, {});
    this.builder.box("stonePath", { w: 108, h: wallY, d: 0.7 }, 0, wallY / 2, 55, {});
    this.builder.box("stonePath", { w: 0.7, h: wallY, d: 110 }, -55, wallY / 2, 0, {});
    this.builder.box("stonePath", { w: 0.7, h: wallY, d: 110 }, 55, wallY / 2, 0, {});
    this.builder.box("hedge", { w: 108, h: 0.5, d: 1 }, 0, 1.45, -55.4, {});
    this.builder.box("hedge", { w: 108, h: 0.5, d: 1 }, 0, 1.45, 55.4, {});
    this.builder.box("hedge", { w: 1, h: 0.5, d: 110 }, -55.4, 1.45, 0, {});
    this.builder.box("hedge", { w: 1, h: 0.5, d: 110 }, 55.4, 1.45, 0, {});

    // Main drive from the gate into campus.
    this.addPath(0, 54, 0, 16, 7);
    this.addPath(-15, 3.5, -16, 3.5, 4.5);
    this.addPath(15, 9.2, 16, 9.2, 4.5);
    this.addPath(8, -8, 8, -26, 5.5);
    this.addPath(8, -26, 2, -30.5, 5.5);
    this.addPath(-10, -5, -26, -21, 4.5);
    this.addPath(15, 12, 26, 26, 4.5);
    this.addPath(26, 26, 32, 28, 4.5);
  }

  private buildGate(): void {
    // Boundary wall with a central gate opening.
    this.builder.box("stonePath", { w: 49, h: 2.3, d: 0.8 }, -30.5, 1.15, 50, {});
    this.builder.box("stonePath", { w: 49, h: 2.3, d: 0.8 }, 30.5, 1.15, 50, {});
    this.builder.box("hedge", { w: 49, h: 0.6, d: 1.3 }, -30.5, 2.6, 50, {});
    this.builder.box("hedge", { w: 49, h: 0.6, d: 1.3 }, 30.5, 2.6, 50, {});
    this.collider(-55, -6, 49.4, 50.6, "south-wall-west");
    this.collider(6, 55, 49.4, 50.6, "south-wall-east");
    this.occluder(-30.5, 1.6, 50, 49, 3.2, 1);

    // Pillars and arch.
    [ -6.9, 6.9 ].forEach((x) => {
      this.builder.box("plaster", { w: 1.5, h: 6.4, d: 1.5 }, x, 3.2, 50, {});
      this.builder.box("stonePath", { w: 1.9, h: 0.45, d: 1.9 }, x, 0.22, 50, {});
      this.builder.box("brass", { w: 1.1, h: 0.24, d: 1.1 }, x, 6.5, 50, {});
      this.collider(x - 0.85, x + 0.85, 49.15, 50.85, "gate-pillar");
      this.occluder(x, 3.2, 50, 1.5, 6.4, 1.5);
    });
    this.builder.box("plaster", { w: 16, h: 1.35, d: 1.2 }, 0, 6.5, 50, {});
    this.builder.box("stonePath", { w: 16.6, h: 0.28, d: 1.5 }, 0, 7.28, 50, {});
    this.sign("signGate", 11.5, 1.55, 0, 6.5, 50.66, 0);
    this.sign("signGate", 11.5, 1.55, 0, 6.5, 49.32, Math.PI);
    this.builder.box("brass", { w: 0.35, h: 0.35, d: 0.35 }, 0, 7.4, 50, {});
    this.builder.cylinder("brass", 0.06, 0.06, 1.1, 8, 0, 8.0, 50);

    // Iron gate leaves, held open inward so the player can walk through.
    const gateMetal = this.materials.metal as THREE.MeshStandardMaterial;
    [-1, 1].forEach((side) => {
      const leaf = new THREE.Group();
      leaf.position.set(side * 5.9, 0, 49.2);
      leaf.rotation.y = side * 1.95;
      for (let i = 0; i <= 6; i += 1) {
        const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 3.5, 6), gateMetal);
        bar.position.set(0, 1.85, (i / 6) * 5.4);
        bar.castShadow = true;
        leaf.add(bar);
      }
      [0.55, 1.9, 3.3].forEach((y) => {
        const rail = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.1, 5.4), gateMetal);
        rail.position.set(0, y, 2.7);
        rail.castShadow = true;
        leaf.add(rail);
      });
      for (let i = 1; i < 6; i += 1) {
        const finial = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.28, 6), gateMetal);
        finial.position.set(0, 3.72, (i / 6) * 5.4);
        leaf.add(finial);
      }
      this.group.add(leaf);
    });

    // Walk-in security cabin just inside the gate.
    this.builder.box("stonePlaza", { w: 4.2, h: 0.06, d: 3.4 }, -10.5, 0.03, 44.5, {});
    this.wallAlongX(46.2, -12.6, -8.4, 3.0, "plasterWarm", "guard-cabin", [-10.0, -8.9]);
    this.wallAlongX(42.8, -12.6, -8.4, 3.0, "plasterWarm", "guard-cabin");
    this.wallAlongZ(-12.6, 42.8, 46.2, 3.0, "plasterWarm", "guard-cabin");
    this.wallAlongZ(-8.4, 42.8, 46.2, 3.0, "plasterWarm", "guard-cabin");
    this.builder.box("plasterWarm", { w: 1.1, h: 0.9, d: 0.36 }, -9.45, 2.55, 46.2, {});
    this.builder.box("plasterWarm", { w: 4.2, h: 0.18, d: 3.4 }, -10.5, 3.0, 44.5, {});
    this.builder.box("roof", { w: 5.0, h: 0.25, d: 4.2 }, -10.5, 3.15, 44.5, {});
    this.builder.box("glass", { w: 0.06, h: 1.1, d: 2.2 }, -8.2, 1.75, 44.5, {});
    this.sign("signSecurity", 2.8, 0.62, -10.5, 2.78, 46.4, 0);
    this.addPath(0, 47.6, -9.4, 47.6, 1.6);
    this.addPath(-9.4, 47.6, -9.4, 46.7, 1.6);

    this.interiorTable(-11.15, 44.85, 1.8, 0.75);
    this.interiorChair(-10.4, 44.85, -1);
    this.builder.box("paper", { w: 0.5, h: 0.04, d: 0.34 }, -11.2, 0.81, 44.8, {});
    this.builder.box("notice", { w: 1.2, h: 0.8, d: 0.05 }, -12.4, 1.9, 44.5, { rotY: Math.PI / 2 });
    this.addInteriorLight(-10.5, 44.5, 5);

    const guardDoor = this.createDoor({
      hinge: new THREE.Vector3(-10.0, 0, 46.2),
      width: 1.1,
      height: 2.2,
      openAngle: 1.35,
      baseRotationY: Math.PI / 2,
      label: "security-cabin",
      opening: "Enter the security cabin",
      closing: "Close the security cabin door",
    });
    guardDoor.collider = this.collider(-10.05, -8.85, 46.05, 46.35, "security-cabin-door");
    this.interactables.push({
      id: "security-cabin-door",
      kind: "door",
      label: "Security cabin",
      position: new THREE.Vector3(-9.45, 0, 47.15),
      radius: 2.3,
      door: guardDoor,
      roomId: "gate-cabin",
    });
    this.interactables.push({
      id: "security-log",
      kind: "notice",
      label: "Visitor register",
      position: new THREE.Vector3(-10.6, 0, 45.2),
      radius: 1.9,
      notice: INTERIOR_CONTENT.securityLog,
      roomId: "gate-cabin",
    });
  }

  private buildPlaza(): void {
    // Assembly ground.
    this.builder.box("stonePlaza", { w: 30, h: 0.06, d: 24 }, 0, 0.03, 4, {});
    this.builder.box("plinth", { w: 31, h: 0.04, d: 25 }, 0, 0.02, 4, {});

    // Stage.
    this.builder.box("stageStone", { w: 11, h: 0.5, d: 3.6 }, 0, 0.25, -6.4, {});
    this.builder.box("stageStone", { w: 4, h: 0.22, d: 2.6 }, 0, 0.11, -4.2, {});
    this.collider(-5.5, 5.5, -8.2, -4.6, "assembly-stage");
    this.builder.box("darkTrim", { w: 10.2, h: 0.06, d: 3 }, 0, 0.52, -6.4, {});

    // Flag.
    this.builder.cylinder("plinth", 1.7, 1.9, 0.35, 20, 0, 0.17, 7, {});
    this.builder.cylinder("flagPole", 0.09, 0.12, 12, 12, 0, 6.2, 7, {});
    this.builder.cylinder("brass", 0.16, 0.16, 0.3, 12, 0, 12.2, 7, {});
    this.collider(-1.3, 1.3, 5.7, 8.3, "flag-pole");

    const flagGeometry = new THREE.PlaneGeometry(3.3, 2.1, 16, 8);
    const flag = new THREE.Mesh(flagGeometry, this.materials.flag);
    flag.position.set(1.75, 11, 7);
    flag.castShadow = true;
    flag.name = "flag";
    this.group.add(flag);
    this.flag = flag;
    this.flagBase = new Float32Array(flagGeometry.attributes.position.array);

    // Notice board marker area, east of the plaza.
    const board = new THREE.Group();
    board.position.set(11, 0, 18);
    board.rotation.y = -0.5;
    this.group.add(board);

    const postGeometry = new THREE.BoxGeometry(0.18, 2.9, 0.18);
    const postMaterial = this.materials.woodDark as THREE.MeshStandardMaterial;
    [-1.85, 1.85].forEach((x) => {
      const post = new THREE.Mesh(postGeometry, postMaterial);
      post.position.set(x, 1.45, 0);
      post.castShadow = true;
      board.add(post);
    });
    const frame = new THREE.Mesh(new THREE.BoxGeometry(4.1, 2.5, 0.16), this.materials.wood);
    frame.position.set(0, 2.05, 0);
    frame.castShadow = true;
    frame.receiveShadow = true;
    board.add(frame);
    const notices = new THREE.Mesh(new THREE.PlaneGeometry(3.86, 2.28), this.materials.notice);
    notices.position.set(0, 2.05, 0.085);
    board.add(notices);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.12, 0.9), this.materials.terracotta);
    roof.position.set(0, 3.34, 0.1);
    roof.rotation.x = 0.12;
    roof.castShadow = true;
    board.add(roof);
    const ridge = new THREE.Mesh(new THREE.BoxGeometry(4.7, 0.08, 0.12), this.materials.brass);
    ridge.position.set(0, 3.44, 0.48);
    board.add(ridge);

    // Assembly benches: long low stone ledges at the plaza edges.
    [-12.6, 12.6].forEach((x) => {
      this.builder.box("stageStone", { w: 1.1, h: 0.42, d: 7 }, x, 0.25, 2, {});
    });
    this.builder.box("hedge", { w: 7, h: 0.8, d: 1.4 }, -12.6, 0.55, -4.4, {});
    this.builder.box("hedge", { w: 7, h: 0.8, d: 1.4 }, 12.6, 0.55, -4.4, {});
  }

  /** Prior single-room academic block, retained only as a build reference. */
  private buildLegacyAcademicBlock(): void {
    const wallH = 3.5;
    // Ground-floor wings (solid) leave a room carved out in the middle.
    this.solid("plaster", 28, 3.8, 12, -30, -12, "academic-wing-north");
    this.solid("plaster", 28, 3.8, 10, -30, 11, "academic-wing-south");
    this.solid("plaster", 14, 3.8, 12, -37, 0, "academic-wing-west");

    // Room shell (classroom).
    this.builder.box("stonePlaza", { w: 14, h: 0.05, d: 12 }, -23, 0.025, 0, {});
    this.builder.box("plaster", { w: 14, h: 0.2, d: 12 }, -23, wallH - 0.1, 0, {});
    this.builder.box("plaster", { w: 0.4, h: wallH, d: 12 }, -30, wallH / 2, 0, {});
    this.builder.box("plaster", { w: 0.35, h: wallH, d: 4.9 }, -16, wallH / 2, -3.65, {});
    this.builder.box("plaster", { w: 0.35, h: wallH, d: 4.9 }, -16, wallH / 2, 3.65, {});
    this.builder.box("plaster", { w: 0.35, h: 0.85, d: 2.3 }, -16, 3.075, 0, {});
    this.builder.box("plaster", { w: 14, h: wallH, d: 0.4 }, -23, wallH / 2, -6, {});
    this.builder.box("plaster", { w: 14, h: wallH, d: 0.4 }, -23, wallH / 2, 6, {});
    this.collider(-30.3, -29.7, -6, 6, "classroom-back-wall");
    this.collider(-16.3, -15.8, -6, -1.15, "classroom-front-wall-n");
    this.collider(-16.3, -15.8, 1.15, 6, "classroom-front-wall-s");
    this.collider(-30, -16, -6.2, -5.8, "classroom-side-wall-w");
    this.collider(-30, -16, 5.8, 6.2, "classroom-side-wall-e");

    // Upper floors + roof.
    this.builder.box("plasterWarm", { w: 28, h: 4.6, d: 34 }, -30, 6.1, -1, {});
    this.occluder(-30, 6.1, -1, 28, 4.6, 34);
    this.builder.box("roof", { w: 29, h: 0.3, d: 35 }, -30, 8.55, -1, {});
    this.builder.box("plinth", { w: 29.2, h: 0.7, d: 35.2 }, -30, 9.05, -1, {});
    this.builder.box("plinth", { w: 29.6, h: 0.18, d: 35.6 }, -30, 9.45, -1, {});

    // Upper storey windows on the east facade.
    for (let row = 0; row < 2; row += 1) {
      for (let col = 0; col < 7; col += 1) {
        const z = -15 + col * 4.7;
        const y = 4.9 + row * 2.1;
        this.builder.box("whitePaint", { w: 0.16, h: 1.7, d: 1.9 }, -15.9, y, z, {});
        this.builder.box("glass", { w: 0.1, h: 1.45, d: 1.6 }, -15.78, y, z, {});
        this.builder.box("whitePaint", { w: 0.2, h: 0.08, d: 1.7 }, -15.7, y - 0.85, z, {});
      }
    }

    // Veranda roof, columns.
    this.builder.box("roof", { w: 3.8, h: 0.22, d: 15 }, -14.2, 3.34, 0, {});
    this.builder.box("plinth", { w: 3.9, h: 0.12, d: 15.1 }, -14.2, 3.5, 0, {});
    [-5.4, -2.8, 2.8, 5.4].forEach((z) => {
      this.builder.cylinder("plasterCool", 0.2, 0.24, 3.3, 8, -13, 1.65, z, {});
      this.collider(-13.3, -12.7, z - 0.3, z + 0.3, "veranda-column");
    });
    this.builder.box("stageStone", { w: 1.3, h: 0.05, d: 2.6 }, -15.3, 0.025, 0, {});
    this.builder.box("stageStone", { w: 1.3, h: 0.04, d: 3.2 }, -14.4, 0.02, 0, {});

    this.sign("signAcademic", 5.4, 1.35, -15.62, 4.05, 0, Math.PI / 2);

    // Classroom interior.
    this.builder.plane("chalk", 5.4, 2.2, -29.78, 2.05, 0, { rotY: Math.PI / 2 });
    this.builder.box("woodDark", { w: 0.08, h: 2.3, d: 0.12 }, -29.72, 2.05, -2.75, {});
    this.builder.box("woodDark", { w: 0.08, h: 2.3, d: 0.12 }, -29.72, 2.05, 2.75, {});
    this.builder.box("woodDark", { w: 0.6, h: 0.62, d: 5.4 }, -29.68, 0.35, 0, {});

    for (let col = 0; col < 2; col += 1) {
      for (let row = 0; row < 3; row += 1) {
        const x = -22 - col * 3.6;
        const z = -3.4 + row * 3.1;
        this.builder.box("woodLight", { w: 1.5, h: 0.07, d: 0.72 }, x, 0.76, z, {});
        this.builder.box("woodDark", { w: 0.1, h: 0.72, d: 0.1 }, x - 0.65, 0.4, z - 0.28, {});
        this.builder.box("woodDark", { w: 0.1, h: 0.72, d: 0.1 }, x + 0.65, 0.4, z - 0.28, {});
        this.builder.box("woodDark", { w: 0.1, h: 0.72, d: 0.1 }, x - 0.65, 0.4, z + 0.28, {});
        this.builder.box("woodDark", { w: 0.1, h: 0.72, d: 0.1 }, x + 0.65, 0.4, z + 0.28, {});
        this.builder.box("woodDark", { w: 0.5, h: 0.42, d: 1.3 }, x + 1.35, 0.24, z, {});
        this.builder.box("woodLight", { w: 0.5, h: 0.07, d: 1.3 }, x + 1.35, 0.46, z, {});
      }
    }
    this.builder.box("woodLight", { w: 1.9, h: 0.08, d: 1.1 }, -28.2, 0.8, 4.6, {});
    this.builder.box("woodDark", { w: 0.12, h: 0.78, d: 0.12 }, -29, 0.4, 4.2, {});
    this.builder.box("woodDark", { w: 0.12, h: 0.78, d: 0.12 }, -27.4, 0.4, 5, {});
    // Interior notice + clock, wall maps.
    this.builder.plane("notice", 1.9, 1.2, -29.75, 1.75, 4.2, { rotY: Math.PI / 2 });
    this.builder.cylinder("whitePaint", 0.32, 0.32, 0.06, 20, -27, 3.05, 5.78, { rotX: Math.PI / 2 });
    this.builder.box("glassWarm", { w: 2.4, h: 1.5, d: 0.08 }, -18.5, 2.1, 5.78, {});
    this.builder.box("whitePaint", { w: 2.6, h: 1.7, d: 0.12 }, -18.5, 2.1, 5.82, {});

    this.addInteriorLight(-23, 0, 9);

    // Door.
    const door = this.createDoor({
      hinge: new THREE.Vector3(-16, 0, -1.15),
      width: 2.3,
      height: 2.65,
      openAngle: -1.5,
      label: "classroom",
      opening: "Enter the classroom",
      closing: "Close the classroom door",
    });
    door.collider = this.collider(-16.3, -15.7, -1.15, 1.15, "classroom-door");
  }

  /**
   * Two-storey Academic Block A. The ground and first floors share one
   * footprint but use height-scoped walls, real stair ramps and separate
   * collision floors so the upper corridor is genuinely walkable.
   */
  private buildAcademicBlock(): void {
    const x1 = -44;
    const x2 = -16;
    const z1 = -13;
    const z2 = 11;
    const innerX1 = x1 + 0.4;
    const innerX2 = x2 - 0.4;
    const innerZ1 = z1 + 0.4;
    const innerZ2 = z2 - 0.4;
    const floorY = 3.6;
    const groundH = 3.5;
    const upperH = 3.6;
    const roofY = 7.35;
    const corridorNorth = -1.6;
    const corridorSouth = 1.6;
    const stairX = -35.5;

    this.builder.box("stonePlaza", { w: 28.6, h: 0.06, d: 24.6 }, -30, 0.03, -1, {});

    // Shell. East facade is built in two bands because the entrance opens onto
    // the portico below while a balcony door opens over it on the first floor.
    this.wallLevelX(z1, x1, x2, 0, 7.2, "plaster", "academic-shell-north");
    this.wallLevelX(z2, x1, x2, 0, 7.2, "plaster", "academic-shell-south");
    this.wallLevelZ(x1, z1, z2, 0, 7.2, "plaster", "academic-shell-west");
    this.wallLevelZ(x2, z1, z2, 0, groundH + 0.1, "plaster", "academic-shell-east", [[-1.2, 1.2]]);
    this.wallLevelZ(x2, z1, z2, floorY, upperH, "plaster", "academic-shell-east-upper", [[-1.1, 1.1]]);
    this.builder.box("plaster", { w: 0.4, h: 1.1, d: 2.2 }, x2, 6.65, 0, {});
    this.builder.box("plaster", { w: 0.4, h: 0.8, d: 2.4 }, x2, 3.2, 0, {});

    // First-floor slab, with a real stairwell opening at the west end.
    this.builder.box("cement", { w: 19.1, h: 0.26, d: 23.2 }, -25.95, floorY - 0.14, -1, {});
    this.builder.box("cement", { w: 8.1, h: 0.26, d: 7.6 }, -39.55, floorY - 0.14, -8.8, {});
    this.builder.box("cement", { w: 8.1, h: 0.26, d: 5.6 }, -39.55, floorY - 0.14, 7.8, {});
    this.builder.box("cement", { w: 1.4, h: 0.26, d: 3.1 }, -35.75, floorY - 0.14, -2.95, {});
    this.floor("academic-upper", -35.5, innerX2, -12.6, 10.6, floorY);
    this.floor("academic-upper-landing", -36.4, -35.1, -4.4, 1.6, floorY);

    // Ground-level corridor and room partitions.
    const northDoors: Array<[number, number]> = [[-32.2, -30.4], [-22.2, -20.4]];
    const southDoors: Array<[number, number]> = [[-32.2, -30.4], [-22.2, -20.4]];
    this.wallLevelX(corridorNorth, stairX, innerX2, 0, groundH, "plasterWarm", "academic-gf", northDoors);
    this.wallLevelX(corridorSouth, stairX, innerX2, 0, groundH, "plasterWarm", "academic-gf", southDoors);
    this.wallLevelZ(-26, innerZ1, corridorNorth, 0, 7.2, "plasterWarm", "academic-gf-partition");
    this.wallLevelZ(-26, corridorSouth, innerZ2, 0, 7.2, "plasterWarm", "academic-gf-partition");
    this.wallLevelX(-5, x1, stairX, 0, groundH, "plasterWarm", "academic-washroom", [[-41, -39.4]]);
    this.wallLevelX(5, x1, stairX, 0, groundH, "plasterWarm", "academic-store");
    this.wallLevelZ(stairX, -12.6, -5, 0, 7.2, "plasterWarm", "academic-washroom-east");
    this.wallLevelZ(stairX, -5, corridorNorth, 0, groundH, "plasterWarm", "academic-stair-north");
    this.wallLevelZ(stairX, -5, -4.4, floorY, upperH, "plasterWarm", "academic-ff-west");
    this.wallLevelZ(stairX, corridorSouth, 5, 0, 7.2, "plasterWarm", "academic-stair-south");
    this.wallLevelZ(stairX, 5, 10.6, 0, groundH, "plasterWarm", "academic-store-wall", [[7, 8.5]]);
    this.wallLevelZ(stairX, 5, 10.6, floorY, upperH, "plasterWarm", "academic-upper-west");

    // First-floor corridor and classrooms. The gap at the west end is the
    // stair arrival, not a missing wall.
    this.wallLevelX(corridorNorth, stairX, innerX2, floorY, upperH - 0.1, "plasterWarm", "academic-ff", [
      [-36.2, -33.6],
      ...northDoors,
    ]);
    this.wallLevelX(corridorSouth, stairX, innerX2, floorY, upperH - 0.1, "plasterWarm", "academic-ff", southDoors);
    this.wallLevelZ(-26, innerZ1, corridorNorth, floorY, upperH - 0.1, "plasterWarm", "academic-ff-partition");
    this.wallLevelZ(-26, corridorSouth, innerZ2, floorY, upperH - 0.1, "plasterWarm", "academic-ff-partition");
    this.wallLevelZ(stairX, -12.6, -4.4, floorY, upperH - 0.1, "plasterWarm", "academic-ff-west");
    this.wallLevelZ(stairX, 1.6, 10.6, floorY, upperH - 0.1, "plasterWarm", "academic-ff-west");

    // Ceiling, roof, parapet and rooftop tank.
    this.builder.box("plaster", { w: 27.2, h: 0.18, d: 23.2 }, -30, 7.02, -1, {});
    this.builder.box("roof", { w: 29.2, h: 0.32, d: 25.2 }, -30, roofY, -1, {});
    this.builder.box("plinth", { w: 29.4, h: 0.55, d: 25.4 }, -30, roofY + 0.42, -1, {});
    for (const [wx, wz, ww, wd] of [
      [-30, z1 + 0.2, 29.4, 0.45],
      [-30, z2 - 0.2, 29.4, 0.45],
      [x1 + 0.2, -1, 0.45, 25.4],
      [x2 - 0.2, -1, 0.45, 25.4],
    ] as const) {
      this.builder.box("plaster", { w: ww, h: 0.75, d: wd }, wx, roofY + 0.75, wz, {});
    }
    this.builder.cylinder("darkTrim", 1.25, 1.25, 1.55, 14, -40, 8.35, -8, {});
    this.builder.cylinder("metal", 0.1, 0.1, 0.8, 6, -41, 7.75, -8.8, {});
    this.builder.cylinder("metal", 0.1, 0.1, 0.8, 6, -39, 7.75, -8.8, {});

    // Stair hall. Two straight flights with a half-landing, each with a
    // matching walk-height ramp and step geometry.
    const run = 6 / 12;
    for (let index = 0; index < 12; index += 1) {
      const height = (1.8 / 12) * (index + 1);
      this.builder.box("stonePlaza", { w: run + 0.02, h: height, d: 2.2 }, -36 - run * (index + 0.5), height / 2, 3.2, {});
      const upperHeight = 1.8 + (1.8 / 12) * (index + 1);
      this.builder.box("stonePlaza", { w: run + 0.02, h: upperHeight - 1.8, d: 2.2 }, -42 + run * (index + 0.5), (upperHeight + 1.8) / 2, -3.2, {});
    }
    this.builder.box("stonePlaza", { w: 1.6, h: 0.22, d: 6.4 }, -42.7, 1.79, 0, {});
    this.builder.box("stonePlaza", { w: 1.4, h: 0.22, d: 3.1 }, -35.75, 3.5, -2.95, {});
    this.ramp("academic-stair-up", -36, 3.2, -42, 3.2, 2.2, 0, 1.8);
    this.floor("academic-stair-landing", -43.4, -41.9, -3.2, 3.2, 1.8);
    this.ramp("academic-stair-top", -42, -3.2, -36, -3.2, 2.2, 1.8, 3.6);
    this.collider(-42.0, -37.0, 2.02, 2.18, "academic-stair-rail", 0, 3.8);
    this.collider(-42.0, -37.0, 4.22, 4.38, "academic-stair-rail", 0, 3.8);
    this.collider(-42.0, -37.0, -4.38, -4.22, "academic-stair-rail", 1.7, 5.4);
    this.collider(-42.0, -37.0, -2.18, -2.02, "academic-stair-rail", 1.7, 5.4);
    for (const z of [2.1, 4.3, -4.3, -2.1]) {
      for (let index = 0; index <= 4; index += 1) {
        const x = -37.3 - index * 1.5;
        const y = z > 0 ? index * 0.3 : 1.8 + index * 0.3;
        this.builder.cylinder("woodDark", 0.04, 0.045, 0.95, 6, x, y + 0.48, z, {});
      }
    }

    // East balcony over the portico, with real railings and a floor zone.
    this.builder.box("stonePlaza", { w: 2.9, h: 0.24, d: 6.4 }, -14.55, floorY - 0.12, 0, {});
    this.floor("academic-balcony", -16.6, -13.1, -3.2, 3.2, floorY);
    this.builder.box("stonePlaza", { w: 0.7, h: 0.22, d: 2.2 }, -16.2, floorY - 0.11, 0, {});
    this.builder.box("metal", { w: 0.08, h: 0.98, d: 6.4 }, -13.2, floorY + 0.5, 0, {});
    this.builder.box("metal", { w: 2.8, h: 0.98, d: 0.08 }, -14.55, floorY + 0.5, -3.2, {});
    this.builder.box("metal", { w: 2.8, h: 0.98, d: 0.08 }, -14.55, floorY + 0.5, 3.2, {});
    this.collider(-13.3, -13.1, -3.2, 3.2, "academic-balcony-rail", floorY, floorY + 1.1);

    this.collider(-16, -13.1, -3.3, -3.1, "academic-balcony-rail", floorY, floorY + 1.1);
    this.collider(-16, -13.1, 3.1, 3.3, "academic-balcony-rail", floorY, floorY + 1.1);

    // Portico, steps and veranda columns.
    this.builder.box("roof", { w: 3.8, h: 0.24, d: 7.2 }, -14.3, 3.35, 0, {});
    this.builder.box("stageStone", { w: 2.4, h: 0.05, d: 4.6 }, -14.8, 0.03, 0, {});
    for (const z of [-3.3, 3.3]) {
      this.builder.cylinder("plasterCool", 0.2, 0.24, 3.3, 8, -12.9, 1.65, z, {});
      this.collider(-13.2, -12.6, z - 0.3, z + 0.3, "academic-portico-column");
    }
    for (let step = 0; step < 3; step += 1) {
      this.builder.box("stageStone", { w: 0.55, h: 0.16, d: 3.6 }, -12.5 - step * 0.5, 0.08 + step * 0.16, 0, {});
    }

    // Facade windows: real inset frames rather than a flat texture.
    for (const baseY of [1.8, 5.35]) {
      for (const z of [-9.4, -6.1, 6.1, 9.4]) {
        if (baseY > 4 && Math.abs(z) < 4.5) continue;
        this.builder.box("whitePaint", { w: 0.16, h: 1.7, d: 1.9 }, -15.86, baseY, z, {});
        this.builder.box("glass", { w: 0.1, h: 1.45, d: 1.6 }, -15.74, baseY, z, {});
        this.builder.box("whitePaint", { w: 0.22, h: 0.08, d: 1.7 }, -15.66, baseY - 0.85, z, {});
      }
      for (let index = 0; index < 5; index += 1) {
        const x = -40.5 + index * 5.4;
        for (const zSide of [z1, z2]) {
          this.builder.box("whitePaint", { w: 1.9, h: 1.7, d: 0.16 }, x, baseY, zSide + (zSide < 0 ? 0.14 : -0.14), {});
          this.builder.box("glass", { w: 1.6, h: 1.45, d: 0.1 }, x, baseY, zSide + (zSide < 0 ? 0.26 : -0.26), {});
        }
      }
    }
    this.sign("signAcademic", 5.4, 1.35, -15.62, 4.35, 0, Math.PI / 2);

    // Room furniture. The helper keeps the same classroom language on both
    // floors and leaves the corridor and door approaches clear.
    const classroom = (left: number, right: number, back: number, front: number, baseY: number, boardFacing: 1 | -1) => {
      const boardZ = boardFacing > 0 ? back + 0.22 : front - 0.22;
      this.builder.plane("chalk", 4.2, 1.9, (left + right) / 2, baseY + 1.95, boardZ, { rotY: boardFacing > 0 ? 0 : Math.PI });
      this.builder.box("woodDark", { w: 4.4, h: 2.1, d: 0.08 }, (left + right) / 2, baseY + 1.95, boardZ + (boardFacing > 0 ? -0.04 : 0.04), {});
      this.builder.box("woodLight", { w: 1.8, h: 0.08, d: 0.8 }, (left + right) / 2, baseY + 0.8, boardZ + boardFacing * 0.8, {});
      const rows = Math.max(1, Math.min(3, Math.floor((front - back - 4.4) / 2.5) + 1));
      for (let row = 0; row < rows; row += 1) {
        for (let col = 0; col < 2; col += 1) {
          const x = left + 2.5 + col * 4.0;
          const z = back + 4.4 + row * 2.5;
          this.builder.box("woodLight", { w: 1.45, h: 0.07, d: 0.7 }, x, baseY + 0.76, z, {});
          this.builder.box("woodDark", { w: 0.09, h: 0.72, d: 0.09 }, x - 0.62, baseY + 0.38, z - 0.25, {});
          this.builder.box("woodDark", { w: 0.09, h: 0.72, d: 0.09 }, x + 0.62, baseY + 0.38, z - 0.25, {});
          this.builder.box("woodDark", { w: 0.45, h: 0.42, d: 1.25 }, x + 1.25, baseY + 0.24, z, {});
          this.builder.box("woodLight", { w: 0.45, h: 0.06, d: 1.25 }, x + 1.25, baseY + 0.46, z, {});
        }
      }
      this.builder.plane("notice", 1.7, 1.1, right - 0.5, baseY + 1.8, back + (boardFacing > 0 ? 0.24 : 0), { rotY: boardFacing > 0 ? 0 : Math.PI });
    };

    classroom(-35.5, -26, innerZ1, corridorNorth, 0, 1);
    classroom(-26, innerX2, innerZ1, corridorNorth, 0, 1);
    classroom(-35.5, -26, corridorSouth, innerZ2, 0, -1);
    classroom(-35.5, -26, innerZ1, corridorNorth, floorY, 1);
    classroom(-26, innerX2, innerZ1, corridorNorth, floorY, 1);
    classroom(-35.5, -26, corridorSouth, innerZ2, floorY, -1);

    // Activity room, south-east of the ground corridor.
    for (const [x, z] of [[-22.5, 4.3], [-19.5, 4.3], [-22.5, 7.4], [-19.5, 7.4]] as const) {
      this.builder.box("woodLight", { w: 2.0, h: 0.08, d: 0.9 }, x, 0.78, z, {});
      this.builder.box("woodDark", { w: 0.1, h: 0.74, d: 0.1 }, x - 0.7, 0.37, z - 0.3, {});
      this.builder.box("woodDark", { w: 0.1, h: 0.74, d: 0.1 }, x + 0.7, 0.37, z - 0.3, {});
      this.builder.box("woodDark", { w: 0.1, h: 0.74, d: 0.1 }, x - 0.7, 0.37, z + 0.3, {});
      this.builder.box("woodDark", { w: 0.1, h: 0.74, d: 0.1 }, x + 0.7, 0.37, z + 0.3, {});
      this.builder.box("woodDark", { w: 0.44, h: 0.42, d: 0.44 }, x - 0.65, 0.22, z + 0.8, {});
      this.builder.box("woodDark", { w: 0.44, h: 0.42, d: 0.44 }, x + 0.65, 0.22, z + 0.8, {});
    }
    this.builder.plane("chalk", 3.4, 1.6, -21.2, 2.0, 10.3, { rotY: Math.PI });
    this.builder.box("woodDark", { w: 3.6, h: 0.76, d: 0.55 }, -21.2, 0.38, 9.8, {});
    for (let index = 0; index < 5; index += 1) {
      this.builder.box("paper", { w: 0.5, h: 0.04, d: 0.36 }, -22.6 + index * 0.7, 0.8, 9.8, {});
    }

    // Ground-west washroom and the activity store behind the south classroom.
    for (let index = 0; index < 3; index += 1) {
      const z = -11.6 + index * 1.35;
      this.builder.box("whitePaint", { w: 1.0, h: 0.42, d: 1.15 }, -42.7, 0.21, z, {});
      this.builder.box("whitePaint", { w: 0.9, h: 1.9, d: 0.08 }, -42.7, 1.4, z, {});
    }
    this.builder.box("cement", { w: 2.8, h: 0.82, d: 0.55 }, -38.3, 0.41, -12.2, {});
    for (const x of [-39.4, -38.3, -37.2]) {
      this.builder.cylinder("brass", 0.03, 0.03, 0.28, 6, x, 1.0, -12.0, {});
      this.builder.box("glass", { w: 0.55, h: 0.7, d: 0.05 }, x, 1.45, -12.45, {});
    }
    this.builder.plane("notice", 1.4, 0.9, -43.4, 1.6, -8.5, { rotY: Math.PI / 2 });
    for (const x of [-42.8, -37.6]) {
      this.builder.box("woodDark", { w: 1.0, h: 0.95, d: 3.4 }, x, 0.48, 7.8, {});
      this.builder.box("woodLight", { w: 0.92, h: 0.06, d: 3.25 }, x, 0.98, 7.8, {});
    }
    this.builder.box("paper", { w: 2.4, h: 0.04, d: 1.2 }, -40.2, 1.0, 7.8, {});
    this.builder.plane("chalk", 2.6, 1.3, -40.2, 2.0, 10.3, { rotY: Math.PI });

    // Staff room, first floor south-east.
    this.builder.box("woodLight", { w: 3.6, h: 0.08, d: 1.2 }, -21.5, floorY + 0.78, 6.0, {});
    for (const x of [-23.0, -21.5, -20.0]) {
      this.builder.box("woodDark", { w: 0.42, h: 0.42, d: 0.42 }, x, floorY + 0.22, 5.0, {});
      this.builder.box("woodDark", { w: 0.42, h: 0.42, d: 0.42 }, x, floorY + 0.22, 7.0, {});
    }
    this.builder.box("metal", { w: 1.9, h: 2.15, d: 0.55 }, -17.1, floorY + 1.08, 7.5, {});
    this.builder.plane("notice", 1.8, 1.1, -17.0, floorY + 1.7, 4.2, { rotY: -Math.PI / 2 });
    this.builder.plane("chalk", 3.2, 1.4, -21.5, floorY + 2.0, 10.34, { rotY: Math.PI });

    this.addInteriorLightAt(-31, 2.9, 0, 7);
    this.addInteriorLightAt(-21, 2.9, 0, 7);
    this.addInteriorLightAt(-31, 6.35, 0, 6);
    this.addInteriorLightAt(-21, 6.35, 0, 6);

    // Door leaves and their interaction points.
    const mainDoor = this.createDoor({
      hinge: new THREE.Vector3(x2, 0, -1.2),
      width: 2.4,
      height: 2.8,
      openAngle: -1.5,
      label: "classroom",
      opening: "Enter Academic Block A",
      closing: "Close the academic block door",
    });
    mainDoor.collider = this.collider(-16.3, -15.7, -1.2, 1.2, "classroom-door");
    this.interactables.push({
      id: "classroom-door",
      kind: "door",
      label: "Academic Block A",
      position: new THREE.Vector3(-14.7, 0, 0),
      radius: 2.5,
      door: mainDoor,
      roomId: "academic-corridor-gf",
    });

    const balconyDoor = this.createDoor({
      hinge: new THREE.Vector3(x2, floorY, -1.1),
      width: 2.2,
      height: 2.45,
      openAngle: 1.4,
      label: "academic-balcony",
      opening: "Step onto the first-floor balcony",
      closing: "Close the balcony door",
    });
    balconyDoor.collider = this.collider(-16.3, -15.7, -1.1, 1.1, "academic-balcony-door", floorY, floorY + 2.5);
    this.interactables.push({
      id: "academic-balcony-door",
      kind: "door",
      label: "First-floor balcony",
      position: new THREE.Vector3(-17.1, floorY, 0),
      radius: 2.3,
      door: balconyDoor,
      roomId: "academic-corridor-ff",
    });

    const washDoor = this.createDoor({
      hinge: new THREE.Vector3(-41, 0, -5),
      width: 1.6,
      height: 2.2,
      openAngle: 1.35,
      baseRotationY: Math.PI / 2,
      label: "academic-washroom",
      opening: "Open the washroom",
      closing: "Close the washroom door",
    });
    washDoor.collider = this.collider(-41, -39.4, -5.2, -4.8, "academic-washroom-door");
    this.interactables.push({
      id: "academic-washroom-door",
      kind: "door",
      label: "Washroom",
      position: new THREE.Vector3(-40.2, 0, -4.2),
      radius: 2.2,
      door: washDoor,
      roomId: "academic-washroom",
    });

    const storeDoor = this.createDoor({
      hinge: new THREE.Vector3(stairX, 0, 7),
      width: 1.5,
      height: 2.2,
      openAngle: 1.35,
      label: "academic-activity-store",
      opening: "Open the activity store",
      closing: "Close the activity store door",
    });
    storeDoor.collider = this.collider(-35.7, -35.3, 7, 8.5, "academic-store-door");
    this.interactables.push({
      id: "academic-store-door",
      kind: "door",
      label: "Activity store",
      position: new THREE.Vector3(-34.6, 0, 7.75),
      radius: 2.1,
      door: storeDoor,
      roomId: "academic-activity-store",
    });

    this.interactables.push({
      id: "academic-notice",
      kind: "notice",
      label: "the classroom notice board",
      position: new THREE.Vector3(-29.0, 0, -3.0),
      radius: 2.4,
      notice: INTERIOR_CONTENT.classroomNotice,
      roomId: "academic-classroom-101",
    });

    // Room number signs sit beside the corridor doors.
    this.sign("signRoom101", 2.2, 0.5, -31.3, 2.55, corridorNorth + 0.02, 0);
    this.sign("signRoom102", 2.2, 0.5, -21.3, 2.55, corridorNorth + 0.02, 0);
    this.sign("signRoom103", 2.2, 0.5, -31.3, 2.55, corridorSouth - 0.02, Math.PI);
    this.sign("signWashroom", 2.2, 0.5, -40.2, 2.4, -4.82, 0);
    this.sign("signRoom201", 2.2, 0.5, -31.3, floorY + 2.55, corridorNorth + 0.02, 0);
    this.sign("signRoom202", 2.2, 0.5, -21.3, floorY + 2.55, corridorNorth + 0.02, 0);
    this.sign("signStaff", 2.4, 0.5, -21.3, floorY + 2.55, corridorSouth - 0.02, Math.PI);
  }

  private buildHostel(): void {
    const wallH = 3.5;
    this.solid("plasterWarm", 28, 3.8, 10, 30, -1, "hostel-wing-north");
    this.solid("plasterWarm", 28, 3.8, 8, 30, 18, "hostel-wing-south");
    this.solid("plasterWarm", 14, 3.8, 10, 37, 9, "hostel-wing-east");

    this.builder.box("stonePlaza", { w: 14, h: 0.05, d: 10 }, 23, 0.025, 9, {});
    this.builder.box("plasterWarm", { w: 14, h: 0.2, d: 10 }, 23, wallH - 0.1, 9, {});
    this.builder.box("plasterWarm", { w: 0.4, h: wallH, d: 10 }, 30, wallH / 2, 9, {});
    this.builder.box("plasterWarm", { w: 0.35, h: wallH, d: 4.1 }, 16, wallH / 2, 6.05, {});
    this.builder.box("plasterWarm", { w: 0.35, h: wallH, d: 3.9 }, 16, wallH / 2, 12.05, {});
    this.builder.box("plasterWarm", { w: 0.35, h: 0.85, d: 2.2 }, 16, 3.075, 9.05, {});
    this.builder.box("plasterWarm", { w: 14, h: wallH, d: 0.4 }, 23, wallH / 2, 4, {});
    this.builder.box("plasterWarm", { w: 14, h: wallH, d: 0.4 }, 23, wallH / 2, 14, {});
    this.collider(29.7, 30.3, 4, 14, "hostel-back-wall");
    this.collider(15.8, 16.3, 4, 8, "hostel-front-wall-n");
    this.collider(15.8, 16.3, 10, 14, "hostel-front-wall-s");
    this.collider(16, 30, 3.8, 4.2, "hostel-side-wall-n");
    this.collider(16, 30, 13.8, 14.2, "hostel-side-wall-s");

    // Three upper storeys, balconies facing the plaza.
    this.builder.box("plaster", { w: 30, h: 9.6, d: 28 }, 29, 8.3, 8, {});
    this.occluder(29, 8.3, 8, 30, 9.6, 28);
    this.builder.box("roof", { w: 31, h: 0.3, d: 29 }, 29, 13.2, 8, {});
    this.builder.box("plinth", { w: 31.2, h: 0.7, d: 29.2 }, 29, 13.7, 8, {});
    for (let floor = 0; floor < 3; floor += 1) {
      const y = 5.5 + floor * 3.0;
      this.builder.box("plinth", { w: 2.2, h: 0.16, d: 26 }, 14.6, y, 8, {});
      this.builder.box("metal", { w: 0.08, h: 0.9, d: 26 }, 13.55, y + 0.5, 8, {});
      for (let col = 0; col < 9; col += 1) {
        const z = -4 + col * 3.1;
        this.builder.box("whitePaint", { w: 0.16, h: 1.6, d: 1.7 }, 14.1, y + 0.9, z, {});
        this.builder.box("glass", { w: 0.1, h: 1.4, d: 1.45 }, 14.0, y + 0.9, z, {});
      }
      for (let col = 0; col < 9; col += 1) {
        this.builder.cylinder("plaster", 0.09, 0.09, 0.9, 6, 13.55, y + 0.45, -4 + col * 3.1, {});
      }
    }

    // Entrance portico.
    this.builder.box("roof", { w: 4.2, h: 0.24, d: 5.2 }, 14, 3.4, 9, {});
    this.builder.cylinder("plaster", 0.22, 0.26, 3.3, 8, 12.2, 1.65, 6.9, {});
    this.builder.cylinder("plaster", 0.22, 0.26, 3.3, 8, 12.2, 1.65, 11.1, {});
    this.collider(11.9, 12.5, 6.6, 7.2, "hostel-portico");
    this.collider(11.9, 12.5, 10.8, 11.4, "hostel-portico");
    this.builder.box("stageStone", { w: 1.2, h: 0.05, d: 3 }, 15.4, 0.025, 9, {});
    this.sign("signHostel", 4.6, 1.15, 13.96, 4.05, 9.05, -Math.PI / 2);

    // Room interior.
    this.builder.box("woodDark", { w: 4.2, h: 0.28, d: 1.85 }, 27.5, 0.42, 6.4, {});
    this.builder.box("mattress", { w: 4.0, h: 0.32, d: 1.7 }, 27.5, 0.72, 6.4, {});
    this.builder.box("blanket", { w: 2.9, h: 0.1, d: 1.74 }, 26.4, 0.9, 6.4, {});
    this.builder.box("whitePaint", { w: 0.7, h: 0.16, d: 1.1 }, 28.6, 0.94, 6.4, {});
    this.builder.box("woodDark", { w: 0.12, h: 0.5, d: 0.12 }, 25.5, 0.2, 5.5, {});
    this.builder.box("woodDark", { w: 0.12, h: 0.5, d: 0.12 }, 29.5, 0.2, 5.5, {});
    this.builder.box("woodDark", { w: 0.12, h: 0.5, d: 0.12 }, 25.5, 0.2, 7.3, {});
    this.builder.box("woodDark", { w: 0.12, h: 0.5, d: 0.12 }, 29.5, 0.2, 7.3, {});
    this.builder.box("whitePaint", { w: 2, h: 0.45, d: 1.4 }, 19, 0.22, 6.2, {});
    this.builder.box("whitePaint", { w: 1.1, h: 0.08, d: 0.6 }, 19, 0.9, 6.2, {});
    this.builder.box("woodLight", { w: 2.8, h: 0.08, d: 1.2 }, 27.4, 0.84, 12.2, {});
    this.builder.box("woodDark", { w: 0.1, h: 0.8, d: 1.1 }, 26.2, 0.4, 12.2, {});
    this.builder.box("woodDark", { w: 0.1, h: 0.8, d: 1.1 }, 28.6, 0.4, 12.2, {});
    this.builder.box("woodLight", { w: 0.6, h: 0.08, d: 0.6 }, 28.4, 0.55, 11.2, {});
    this.builder.box("woodDark", { w: 0.5, h: 0.5, d: 0.5 }, 28.4, 0.27, 11.2, {});
    this.builder.box("wood", { w: 0.9, h: 2.1, d: 2.3 }, 29.4, 1.05, 12.6, {});
    this.builder.box("glassWarm", { w: 2.8, h: 1.5, d: 0.08 }, 23, 2.0, 4.22, {});
    this.builder.plane("notice", 0.9, 0.6, 28.2, 2.1, 4.23, { rotY: Math.PI });
    this.builder.box("blanket", { w: 0.6, h: 0.9, d: 0.1 }, 21.5, 1.5, 4.24, {});
    this.addInteriorLight(23, 9, 8);

    const door = this.createDoor({
      hinge: new THREE.Vector3(16, 0, 8),
      width: 2.2,
      height: 2.65,
      openAngle: 1.5,
      label: "hostel",
      opening: "Enter the hostel room",
      closing: "Close the hostel room door",
    });
    door.collider = this.collider(15.8, 16.35, 8, 10.2, "hostel-door");
  }

  private buildHouseHostels(): void {
    const row: Array<[HouseId, number]> = [
      ["aravali", -45],
      ["nilgiri", -36.5],
      ["shivalik", -28],
      ["udaygiri", -19.5],
    ];
    const z = 38;
    const front = 35;
    const back = 41;
    const width = 6.4;
    const depth = 6;
    const wallH = 3.2;
    this.addPath(-14, 31.4, -46, 31.4, 3.8);

    for (const [houseId, cx] of row) {
      const house = getHouse(houseId);
      if (!house) continue;
      this.addPath(cx, 31.4, cx, 34.85, 2.5);

      this.builder.box("stonePlaza", { w: width, h: 0.06, d: depth }, cx, 0.03, z, {});
      this.builder.box("plasterWarm", { w: width, h: wallH, d: 0.32 }, cx, wallH / 2, back - 0.15, {});
      this.builder.box("plasterWarm", { w: 0.32, h: wallH, d: depth }, cx - width / 2, wallH / 2, z, {});
      this.builder.box("plasterWarm", { w: 0.32, h: wallH, d: depth }, cx + width / 2, wallH / 2, z, {});
      const sideWidth = (width - 2.2) / 2;
      [-1, 1].forEach((side) => {
        const wx = cx + side * (1.1 + sideWidth / 2);
        this.builder.box("plasterWarm", { w: sideWidth, h: wallH, d: 0.32 }, wx, wallH / 2, front + 0.15, {});
        this.collider(wx - sideWidth / 2, wx + sideWidth / 2, front, front + 0.32, `house-front-${houseId}`);
        this.builder.box("whitePaint", { w: 1.0, h: 0.86, d: 0.08 }, wx, 1.72, front + 0.005, {});
        this.builder.box("glassWarm", { w: 0.82, h: 0.68, d: 0.06 }, wx, 1.72, front - 0.02, {});
      });
      this.builder.box("plasterWarm", { w: width, h: 0.72, d: 0.32 }, cx, 2.94, front + 0.15, {});
      this.builder.box("roof", { w: width + 0.8, h: 0.24, d: depth + 0.8 }, cx, wallH + 0.16, z, {});
      this.builder.box("plinth", { w: width + 0.9, h: 0.12, d: depth + 0.9 }, cx, wallH + 0.32, z, {});
      this.collider(cx - width / 2, cx + width / 2, back - 0.3, back, `house-back-${houseId}`);
      this.collider(cx - width / 2 - 0.16, cx - width / 2 + 0.16, front, back, `house-side-w-${houseId}`);
      this.collider(cx + width / 2 - 0.16, cx + width / 2 + 0.16, front, back, `house-side-e-${houseId}`);
      this.occluder(cx, 1.6, back - 0.15, width, wallH, 0.32);
      this.occluder(cx - width / 2, 1.6, z, 0.32, wallH, depth);
      this.occluder(cx + width / 2, 1.6, z, 0.32, wallH, depth);

      this.sign(`signHouse-${houseId}`, 4.3, 0.74, cx, 2.94, front - 0.02, Math.PI);

      const door = this.createDoor({
        hinge: new THREE.Vector3(cx - 1.1, 0, front + 0.16),
        width: 2.2,
        height: 2.55,
        openAngle: -1.45,
        baseRotationY: Math.PI / 2,
        label: `house-${houseId}`,
        opening: `Enter ${house.hostelName}`,
        closing: `Close ${house.hostelName} door`,
      });
      door.collider = this.collider(cx - 1.1, cx + 1.1, front + 0.02, front + 0.34, `house-door-${houseId}`);

      // A small flag on a pole beside every front door.
      const poleX = cx + 3.85;
      this.builder.cylinder("flagPole", 0.055, 0.075, 4.9, 8, poleX, 2.45, 34.1, {});
      this.builder.add("brass", new THREE.SphereGeometry(0.11, 10, 8), poleX, 4.95, 34.1);
      const flag = new THREE.Mesh(
        new THREE.PlaneGeometry(1.5, 0.95, 6, 3),
        this.houseFlagMaterials[houseId],
      );
      flag.position.set(poleX + 0.78, 4.3, 34.1);
      flag.rotation.y = Math.PI;
      flag.castShadow = true;
      this.group.add(flag);

      // Interior: bed, study desk, house banner and a warm night lamp.
      this.builder.box("woodDark", { w: 3.3, h: 0.3, d: 1.45 }, cx - 1.2, 0.35, 40.1, {});
      this.builder.box("mattress", { w: 3.15, h: 0.28, d: 1.35 }, cx - 1.2, 0.62, 40.1, {});
      this.builder.box("blanket", { w: 2.2, h: 0.08, d: 1.37 }, cx - 1.55, 0.78, 40.1, {});
      this.builder.box("woodLight", { w: 2.1, h: 0.08, d: 0.9 }, cx + 2.15, 0.8, 39.5, {});
      this.builder.box("woodDark", { w: 0.1, h: 0.78, d: 0.1 }, cx + 1.3, 0.4, 39.15, {});
      this.builder.box("woodDark", { w: 0.1, h: 0.78, d: 0.1 }, cx + 3.0, 0.4, 39.85, {});
      this.builder.box("woodLight", { w: 0.6, h: 0.07, d: 0.6 }, cx + 2.7, 1.1, 39.5, {});
      this.builder.add("lampGlow", new THREE.SphereGeometry(0.16, 10, 8), cx, 2.55, 38, {});
      this.builder.plane(`houseFlag-${houseId}`, 2.6, 1.0, cx, 2.3, back - 0.35, { rotY: Math.PI });

      const light = new THREE.PointLight(0xffd3a0, 5.5, 9, 2);
      light.position.set(cx, 2.6, 38);
      light.visible = false;
      this.group.add(light);
      this.houseLights.push(light);

      const zone: WorldZone = { minX: cx - 2.9, maxX: cx + 2.9, minZ: front + 0.5, maxZ: back - 0.4 };
      this.interactables.push({
        id: `house-door-${houseId}`,
        kind: "door",
        label: house.hostelName,
        position: new THREE.Vector3(cx, 0, 34.35),
        radius: 2.8,
        door,
      });

      const captain = getHouseCaptain(houseId);
      const prefect = getHousePrefect(houseId);
      if (captain) {
        this.addHouseNpc(captain.id, captain.displayName, `${house.shortName} · House captain`, cx + 1.85, 38.2, Math.PI, house.color, true);
      }
      if (prefect) {
        this.addHouseNpc(prefect.id, prefect.displayName, `${house.shortName} · House prefect`, cx + 2.55, 33.15, Math.PI, house.color, false);
      }

      this.houseHostels[houseId] = {
        houseId,
        center: new THREE.Vector3(cx, 0, z),
        zone,
        door,
        markerPoint: new THREE.Vector3(cx, 0, 33.7),
        interiorPoint: new THREE.Vector3(cx + 0.35, 0, 36.8),
        roommatePoint: new THREE.Vector3(cx - 1.55, 0, 38.2),
        captainPoint: new THREE.Vector3(cx + 1.85, 0, 38.2),
      };
    }

    const roommate = createCharacter({ uniform: "#6d6f76", skin: "#a8734c" });
    roommate.group.name = "roommate";
    roommate.group.visible = false;
    this.group.add(roommate.group);
    this.roommate = roommate;
    const tagTexture = nameTagTexture("Roommate", "Class VII · House hostel");
    this.disposables.push(tagTexture);
    const tagMaterial = new THREE.SpriteMaterial({ map: tagTexture, transparent: true, depthTest: false, depthWrite: false });
    this.disposables.push(tagMaterial);
    const tag = new THREE.Sprite(tagMaterial);
    tag.scale.set(1.65, 0.5, 1);
    tag.renderOrder = 10;
    tag.visible = false;
    this.group.add(tag);
    this.roommateTag = tag;

    this.roommateInteractable = {
      id: "roommate",
      kind: "roommate",
      label: "Roommate",
      position: this.houseHostels[DEFAULT_HOUSE_ID].roommatePoint.clone(),
      radius: 2.6,
      active: false,
    };
    this.interactables.push(this.roommateInteractable);
  }

  private addHouseNpc(
    id: string,
    name: string,
    role: string,
    x: number,
    z: number,
    rotationY: number,
    color: string,
    senior: boolean,
  ): void {
    const rig = createCharacter({ uniform: color, skin: "#a8734c", senior });
    rig.group.position.set(x, 0, z);
    rig.group.rotation.y = rotationY;
    this.group.add(rig.group);

    const tagTexture = nameTagTexture(name, role);
    this.disposables.push(tagTexture);
    const tagMaterial = new THREE.SpriteMaterial({ map: tagTexture, transparent: true, depthTest: false, depthWrite: false });
    this.disposables.push(tagMaterial);
    const tag = new THREE.Sprite(tagMaterial);
    tag.position.set(x, 2.22, z);
    tag.scale.set(1.7, 0.53, 1);
    tag.renderOrder = 10;
    this.group.add(tag);
    this.houseNpcs.push({ id, rig, tag, baseY: 0, baseRotation: rotationY });
    tag.visible = id !== this.playerCharacterId;
    rig.group.visible = id !== this.playerCharacterId;
  }

  /** Hide a leadership NPC when that same student is the player character. */
  setPlayerCharacterId(id: string | null): void {
    this.playerCharacterId = id;
    for (const npc of this.houseNpcs) {
      const visible = !id || npc.id !== id;
      npc.rig.group.visible = visible;
      npc.tag.visible = visible;
    }
  }

  private buildNightLife(): void {
    this.addPath(-38, 31.3, -38, 29.6, 2.6);
    this.builder.box("dirt", { w: 13, h: 0.035, d: 8 }, -38, 0.02, 25.5, {});
    this.sign("signGarden", 4.6, 1.2, -38, 2.05, 30.05, 0);

    // Low fence with an opening on the south side. The player enters through
    // the gate; the patrols stay on their inside loop.
    const post = (x: number, z: number) => {
      this.builder.box("woodLight", { w: 0.14, h: 0.95, d: 0.14 }, x, 0.48, z, {});
      this.builder.box("woodDark", { w: 0.18, h: 0.08, d: 0.18 }, x, 0.98, z, {});
    };
    const rail = (x1: number, z1: number, x2: number, z2: number) => {
      const length = Math.hypot(x2 - x1, z2 - z1);
      this.builder.box("woodLight", { w: 0.08, h: 0.08, d: length }, (x1 + x2) / 2, 0.72, (z1 + z2) / 2, {
        rotY: Math.atan2(x2 - x1, z2 - z1),
      });
    };
    for (let x = -44.5; x <= -31.5; x += 2.6) {
      if (x < -40 || x > -36) {
        post(x, 29.5);
        rail(x, 29.5, Math.min(x + 2.6, -40), 29.5);
      }
      post(x, 21.5);
    }
    for (let z = 21.5; z <= 29.5; z += 2) {
      post(-44.5, z);
      post(-31.5, z);
    }
    rail(-44.5, 21.5, -31.5, 21.5);
    this.collider(-44.7, -40, 29.35, 29.65, "garden-fence-s-west");
    this.collider(-36, -31.3, 29.35, 29.65, "garden-fence-s-east");
    this.collider(-44.7, -31.3, 21.35, 21.65, "garden-fence-north");
    this.collider(-44.7, -44.3, 21.5, 29.5, "garden-fence-west");
    this.collider(-31.7, -31.3, 21.5, 29.5, "garden-fence-east");

    this.addGardenBed(-41.2, 24.1, "tomato");
    this.addGardenBed(-38, 24.1, "potato");
    this.addGardenBed(-34.8, 24.1, "carrot");
    this.addGardenBed(-38, 27.2, "cabbage");

    // Hiding spots around the garden and the tool shed.
    this.addHideBush(-43.6, 31.1, 2.5, 1.6);
    this.addHideBush(-32.4, 31.1, 2.5, 1.6);
    this.addHideBush(-42.9, 27.6, 1.7, 1.7);

    const shedX = -29.3;
    const shedZ = 23.2;
    this.builder.box("woodDark", { w: 2.8, h: 0.12, d: 2.4 }, shedX, 0.06, shedZ, {});
    this.builder.box("woodDark", { w: 2.8, h: 2.1, d: 0.16 }, shedX, 1.05, shedZ - 1.2, {});
    this.builder.box("woodDark", { w: 0.16, h: 2.1, d: 2.4 }, shedX - 1.4, 1.05, shedZ, {});
    this.builder.box("woodDark", { w: 0.16, h: 2.1, d: 2.4 }, shedX + 1.4, 1.05, shedZ, {});
    this.builder.box("roof", { w: 3.2, h: 0.18, d: 2.8 }, shedX, 2.2, shedZ, {});
    this.collider(shedX - 1.5, shedX + 1.5, shedZ - 1.35, shedZ - 1.05, "garden-shed-back");
    this.collider(shedX - 1.5, shedX - 1.2, shedZ - 1.2, shedZ + 1.2, "garden-shed-west");
    this.collider(shedX + 1.2, shedX + 1.5, shedZ - 1.2, shedZ + 1.2, "garden-shed-east");
    this.hideZones.push({ minX: shedX - 1.25, maxX: shedX + 1.25, minZ: shedZ - 1.0, maxZ: shedZ + 1.15 });

    const gardenPlots: Array<[GardenItemId, number, number, string]> = [
      ["tomato", -41.2, 24.1, "Tomato bed"],
      ["potato", -38, 24.1, "Potato bed"],
      ["carrot", -34.8, 24.1, "Carrot bed"],
      ["cabbage", -38, 27.2, "Cabbage bed"],
    ];
    for (const [itemId, x, z, label] of gardenPlots) {
      const plot: WorldInteractable = {
        id: `garden-${itemId}`,
        kind: "garden",
        label,
        position: new THREE.Vector3(x, 0, z),
        radius: 2.2,
        itemId,
        active: false,
      };
      this.gardenPlots.push(plot);
      this.interactables.push(plot);
    }

    this.addPatrol(
      [
        new THREE.Vector3(-43.8, 0, 22.4),
        new THREE.Vector3(-32.2, 0, 22.4),
        new THREE.Vector3(-32.2, 0, 28.6),
        new THREE.Vector3(-43.8, 0, 28.6),
      ],
      0.55,
    );
    this.addPatrol(
      [
        new THREE.Vector3(-41.8, 0, 25.7),
        new THREE.Vector3(-34.2, 0, 25.7),
      ],
      0.45,
    );

    // Moon and stars, hidden until lights-out.
    const starCount = 560;
    const starPositions = new Float32Array(starCount * 3);
    const rand = seededRandom(7007);
    for (let i = 0; i < starCount; i += 1) {
      const theta = rand() * Math.PI * 2;
      const phi = Math.acos(0.08 + rand() * 0.9);
      const radius = 245;
      starPositions[i * 3] = Math.sin(phi) * Math.cos(theta) * radius;
      starPositions[i * 3 + 1] = Math.cos(phi) * radius;
      starPositions[i * 3 + 2] = Math.sin(phi) * Math.sin(theta) * radius;
    }
    const starGeometry = new THREE.BufferGeometry();
    starGeometry.setAttribute("position", new THREE.BufferAttribute(starPositions, 3));
    const starMaterial = new THREE.PointsMaterial({
      color: 0xdfe8ff,
      size: 1.15,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.82,
      depthWrite: false,
      fog: false,
    });
    this.disposables.push(starMaterial);
    const stars = new THREE.Points(starGeometry, starMaterial);
    stars.name = "night-stars";
    this.nightGroup.add(stars);
    this.stars = stars;

    const canvas = document.createElement("canvas");
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      const glow = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
      glow.addColorStop(0, "rgba(240,246,255,0.98)");
      glow.addColorStop(0.28, "rgba(208,225,255,0.55)");
      glow.addColorStop(1, "rgba(160,190,255,0)");
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, 128, 128);
    }
    const moonTexture = new THREE.CanvasTexture(canvas);
    moonTexture.colorSpace = THREE.SRGBColorSpace;
    this.disposables.push(moonTexture);
    const moonMaterial = new THREE.SpriteMaterial({ map: moonTexture, transparent: true, depthWrite: false, fog: false });
    this.disposables.push(moonMaterial);
    const moon = new THREE.Sprite(moonMaterial);
    moon.position.set(105, 118, -150);
    moon.scale.set(42, 42, 1);
    this.nightGroup.add(moon);
    this.moon = moon;
  }

  private addGardenBed(cx: number, cz: number, itemId: GardenItemId): void {
    this.builder.box("woodDark", { w: 2.5, h: 0.32, d: 1.5 }, cx, 0.16, cz, {});
    this.builder.box("dirt", { w: 2.25, h: 0.08, d: 1.25 }, cx, 0.34, cz, {});
    const rand = seededRandom(itemId.length * 991 + cx * 13 + cz * 7);
    for (let i = 0; i < 7; i += 1) {
      const x = cx - 0.9 + (i / 6) * 1.8;
      const z = cz - 0.35 + rand() * 0.7;
      if (itemId === "tomato") {
        this.builder.cylinder("hedge", 0.025, 0.035, 0.55, 5, x, 0.64, z, {});
        this.builder.add("blossomRed", new THREE.SphereGeometry(0.12, 8, 6), x - 0.08, 0.76, z + 0.03);
        this.builder.add("blossomRed", new THREE.SphereGeometry(0.09, 8, 6), x + 0.09, 0.63, z - 0.05);
        this.builder.add("foliageB", new THREE.IcosahedronGeometry(0.2, 0), x, 0.52, z, { scale: { x: 1.2, y: 0.55, z: 1.2 } });
      } else if (itemId === "potato") {
        this.builder.add("foliageA", new THREE.IcosahedronGeometry(0.24, 0), x, 0.47, z, { scale: { x: 1.2, y: 0.7, z: 1.1 } });
        this.builder.add("foliageC", new THREE.IcosahedronGeometry(0.16, 0), x + 0.14, 0.42, z + 0.12);
      } else if (itemId === "carrot") {
        this.builder.add("terracotta", new THREE.ConeGeometry(0.1, 0.4, 7), x, 0.42, z, { rotX: Math.PI });
        this.builder.add("foliageC", new THREE.ConeGeometry(0.12, 0.3, 5), x, 0.68, z);
      } else {
        this.builder.add("foliageB", new THREE.SphereGeometry(0.25, 8, 6), x, 0.52, z, { scale: { x: 1.1, y: 0.8, z: 1.1 } });
        this.builder.add("foliageA", new THREE.SphereGeometry(0.16, 8, 6), x + 0.12, 0.48, z + 0.1);
      }
    }
    this.builder.box("brass", { w: 0.5, h: 0.18, d: 0.03 }, cx, 0.55, cz - 0.78, {});
  }

  private addHideBush(cx: number, cz: number, width: number, depth: number): void {
    const rand = seededRandom(Math.round(cx * 31 + cz * 17));
    for (let i = 0; i < 8; i += 1) {
      this.builder.add(
        i % 2 === 0 ? "hedge" : "foliageA",
        new THREE.IcosahedronGeometry(0.55 + rand() * 0.35, 1),
        cx + (rand() - 0.5) * width,
        0.45 + rand() * 0.4,
        cz + (rand() - 0.5) * depth,
        { scale: { x: 1.25, y: 0.85, z: 1.15 } },
      );
    }
    this.hideZones.push({
      minX: cx - width / 2,
      maxX: cx + width / 2,
      minZ: cz - depth / 2,
      maxZ: cz + depth / 2,
    });
  }

  private addPatrol(route: THREE.Vector3[], speed: number): void {
    const rig = createCharacter({ uniform: "#2b3038", skin: "#9c6b4a" });
    rig.group.position.copy(route[0]);
    rig.group.name = "night-patrol";
    this.nightGroup.add(rig.group);

    const tagTexture = nameTagTexture("Night duty", "Teacher · Garden patrol");
    this.disposables.push(tagTexture);
    const tagMaterial = new THREE.SpriteMaterial({ map: tagTexture, transparent: true, depthTest: false, depthWrite: false });
    this.disposables.push(tagMaterial);
    const tag = new THREE.Sprite(tagMaterial);
    tag.position.set(route[0].x, 2.22, route[0].z);
    tag.scale.set(1.8, 0.55, 1);
    tag.renderOrder = 10;
    this.nightGroup.add(tag);

    const coneMaterial = new THREE.MeshBasicMaterial({
      color: "#e5c27e",
      transparent: true,
      opacity: 0.13,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.disposables.push(coneMaterial);
    const cone = new THREE.Mesh(new THREE.CircleGeometry(5.8, 28, -0.58, 1.16), coneMaterial);
    cone.rotation.x = -Math.PI / 2;
    cone.position.set(route[0].x, 0.07, route[0].z);
    cone.renderOrder = 2;
    this.nightGroup.add(cone);

    const loop = [...route, route[0]];
    const lineGeometry = new THREE.BufferGeometry().setFromPoints(loop.map((point) => new THREE.Vector3(point.x, 0.09, point.z)));
    const lineMaterial = new THREE.LineDashedMaterial({
      color: 0xd8b97a,
      transparent: true,
      opacity: 0.32,
      dashSize: 0.45,
      gapSize: 0.35,
    });
    this.disposables.push(lineMaterial);
    const line = new THREE.Line(lineGeometry, lineMaterial);
    line.computeLineDistances();
    this.nightGroup.add(line);

    this.patrols.push({
      rig,
      tag,
      cone,
      coneMaterial,
      route,
      nextIndex: 1,
      facing: 0,
      speed,
    });
  }

  private buildDiningHall(): void {
    this.builder.box("stonePlaza", { w: 32, h: 0.06, d: 14 }, 2, 0.03, -38, {});
    this.wallAlongX(-31.3, -14, 18, 6.2, "plasterCool", "dining", [-0.2, 4.2]);
    this.wallAlongX(-44.7, -14, 18, 6.2, "plasterCool", "dining");
    this.wallAlongZ(-13.7, -44.7, -31.3, 6.2, "plasterCool", "dining");
    this.wallAlongZ(17.7, -44.7, -31.3, 6.2, "plasterCool", "dining");
    this.builder.box("plasterCool", { w: 4.4, h: 3.2, d: 0.36 }, 2, 4.6, -31.3, {});
    this.builder.box("plasterCool", { w: 32, h: 0.18, d: 14 }, 2, 4.3, -38, {});

    this.builder.box("roof", { w: 33.5, h: 0.35, d: 15.5 }, 2, 6.4, -38, {});
    this.builder.box("plinth", { w: 34, h: 0.5, d: 16 }, 2, 6.85, -38, {});
    // Southern veranda.
    this.builder.box("roof", { w: 33, h: 0.24, d: 3.4 }, 2, 3.5, -28.9, {});
    for (let col = 0; col < 7; col += 1) {
      const x = -12.5 + col * 4.8;
      this.builder.cylinder("plasterCool", 0.2, 0.24, 3.4, 8, x, 1.7, -27.8, {});
      this.collider(x - 0.3, x + 0.3, -28.1, -27.5, "dining-column");
    }
    // Upper windows and the walk-in double-door entrance.
    for (let i = 0; i < 5; i += 1) {
      const x = -12.6 + i * 3.6;
      if (Math.abs(x - 2) < 2.6) continue;
      this.builder.box("whitePaint", { w: 2.2, h: 1.9, d: 0.14 }, x, 4.4, -30.9, {});
      this.builder.box("glassWarm", { w: 1.9, h: 1.6, d: 0.1 }, x, 4.4, -30.78, {});
    }
    this.builder.box("stageStone", { w: 6, h: 0.05, d: 2.4 }, 2, 0.025, -29.6, {});
    this.sign("signDining", 5.4, 1.35, 2, 3.7, -30.82, 0);
    this.builder.box("metal", { w: 0.5, h: 0.5, d: 0.5 }, -11, 6.9, -36, {});

    // Dining rows: nine tables, benches on both sides, clear centre aisles.
    for (const x of [-8, 2, 12]) {
      for (const z of [-40, -36.5, -33]) {
        // Leave the centre approach from the double doors clear.
        if (x === 2 && z === -33) continue;
        this.interiorTable(x, z, 2.2, 0.95);
        for (const side of [-1, 1]) {
          this.builder.box("woodLight", { w: 2.4, h: 0.08, d: 0.32 }, x, 0.42, z + side * 0.78, {});
          this.builder.box("woodDark", { w: 0.1, h: 0.4, d: 0.28 }, x - 0.9, 0.21, z + side * 0.78, {});
          this.builder.box("woodDark", { w: 0.1, h: 0.4, d: 0.28 }, x + 0.9, 0.21, z + side * 0.78, {});
        }
      }
    }

    // Serving counter along the north wall.
    this.builder.box("cement", { w: 20, h: 1.05, d: 1.0 }, 2, 0.52, -43.7, {});
    this.builder.box("whitePaint", { w: 20.2, h: 0.08, d: 1.1 }, 2, 1.09, -43.7, {});
    this.collider(-8, 12, -44.25, -43.15, "dining-counter");
    for (let i = 0; i < 4; i += 1) {
      this.builder.box("metal", { w: 2.0, h: 0.14, d: 0.6 }, -5 + i * 4.6, 1.15, -43.7, {});
      this.builder.box("brass", { w: 0.16, h: 0.5, d: 0.16 }, -5 + i * 4.6, 1.35, -43.4, {});
    }
    this.builder.plane("notice", 4.6, 1.5, 2, 2.55, -44.5, {});
    this.sign("signMess", 3.4, 0.7, 2, 3.45, -44.5, 0);

    // Wash area and drinking water along the west wall.
    this.builder.box("cement", { w: 0.7, h: 0.9, d: 5.0 }, -13.0, 0.45, -37.5, {});
    this.builder.box("metal", { w: 0.5, h: 0.08, d: 4.6 }, -12.8, 0.92, -37.5, {});
    for (let i = 0; i < 4; i += 1) {
      const z = -39.4 + i * 1.3;
      this.builder.box("metal", { w: 0.36, h: 0.1, d: 0.44 }, -12.75, 0.88, z, {});
      this.builder.cylinder("brass", 0.025, 0.025, 0.26, 6, -12.9, 1.05, z, {});
      this.builder.box("glass", { w: 0.05, h: 0.6, d: 0.5 }, -13.4, 1.7, z, {});
    }
    this.collider(-13.4, -12.6, -40.0, -35.0, "dining-wash");

    // Structural columns and ceiling fans.
    for (const x of [-4, 8]) {
      for (const z of [-35.5, -40.5]) {
        this.builder.cylinder("plasterCool", 0.22, 0.26, 4.3, 8, x, 2.15, z, {});
        this.collider(x - 0.3, x + 0.3, z - 0.3, z + 0.3, "dining-column");
      }
    }
    for (const [x, z] of [[-8, -38], [2, -38], [12, -38]]) {
      this.builder.cylinder("metal", 0.05, 0.05, 0.5, 6, x, 4.05, z, {});
      this.builder.box("darkTrim", { w: 1.3, h: 0.04, d: 0.18 }, x, 3.78, z, {});
      this.builder.box("darkTrim", { w: 0.18, h: 0.04, d: 1.3 }, x, 3.78, z, {});
    }

    this.addInteriorLight(-8, -38, 7);
    this.addInteriorLight(2, -38, 7);
    this.addInteriorLight(12, -38, 7);

    const left = this.createDoor({
      hinge: new THREE.Vector3(-0.2, 0, -31.3),
      width: 2.2,
      height: 3.0,
      openAngle: 1.35,
      baseRotationY: Math.PI / 2,
      label: "dining-left",
      opening: "Enter the dining hall",
      closing: "Close the dining hall door",
    });
    left.collider = this.collider(-0.2, 2.0, -31.45, -31.15, "dining-door");
    const right = this.createDoor({
      hinge: new THREE.Vector3(4.2, 0, -31.3),
      width: 2.2,
      height: 3.0,
      openAngle: -1.35,
      baseRotationY: -Math.PI / 2,
      label: "dining-right",
      opening: "Enter the dining hall",
      closing: "Close the dining hall door",
    });
    right.collider = this.collider(2.0, 4.2, -31.45, -31.15, "dining-door");
    this.interactables.push(
      {
        id: "dining-door-left",
        kind: "door",
        label: "Dining hall",
        position: new THREE.Vector3(0.9, 0, -30.1),
        radius: 2.4,
        door: left,
        roomId: "dining-hall",
      },
      {
        id: "dining-door-right",
        kind: "door",
        label: "Dining hall",
        position: new THREE.Vector3(3.1, 0, -30.1),
        radius: 2.4,
        door: right,
        roomId: "dining-hall",
      },
    );
    this.interactables.push({
      id: "mess-menu",
      kind: "notice",
      label: "the mess menu",
      position: new THREE.Vector3(2, 0, -42.9),
      radius: 2.6,
      notice: INTERIOR_CONTENT.messMenu,
      roomId: "dining-service",
    });
    this.interactables.push({
      id: "dining-wash-area",
      kind: "notice",
      label: "the wash area",
      position: new THREE.Vector3(-12.2, 0, -37.5),
      radius: 2.2,
      notice: INTERIOR_CONTENT.washArea,
      roomId: "dining-hall",
    });
  }

  /** Low, pitched-roof administrative block beside the main entrance. */
  private buildAdministration(): void {
    this.builder.box("stonePlaza", { w: 11, h: 0.06, d: 8 }, 13, 0.03, 43.5, {});
    this.wallAlongX(39.7, 7.5, 18.5, 4.4, "plasterWarm", "admin", [12.0, 14.0]);
    this.wallAlongX(47.3, 7.5, 18.5, 4.4, "plasterWarm", "admin");
    this.wallAlongZ(7.7, 39.7, 47.3, 4.4, "plasterWarm", "admin");
    this.wallAlongZ(18.3, 39.7, 47.3, 4.4, "plasterWarm", "admin");
    this.builder.box("plasterWarm", { w: 2.0, h: 1.8, d: 0.36 }, 13, 3.5, 39.7, {});
    this.builder.box("plasterWarm", { w: 11, h: 0.18, d: 8 }, 13, 3.5, 43.5, {});

    // Interior partitions: principal's office and staff room.
    this.wallAlongX(43.9, 14.6, 18.3, 3.2, "plasterWarm", "admin-office");
    this.wallAlongZ(13.2, 43.9, 47.3, 3.2, "plasterWarm", "admin-office");
    this.builder.box("woodDark", { w: 1.5, h: 2.1, d: 0.06 }, 15.35, 1.05, 43.69, {});
    this.builder.box("glass", { w: 1.2, h: 1.15, d: 0.04 }, 15.35, 1.55, 43.64, {});
    this.sign("signPrincipal", 2.5, 0.52, 16.45, 2.65, 43.59, 0);

    this.builder.box("roof", { w: 11.8, h: 0.22, d: 8.8 }, 13, 4.55, 43.5, {});
    this.builder.add(
      "roof",
      new THREE.ConeGeometry(8.2, 2.6, 4),
      13,
      5.75,
      43.5,
      { rotY: Math.PI / 4, scale: { x: 1.0, y: 1, z: 0.86 } },
    );
    this.builder.box("stonePlaza", { w: 5, h: 0.08, d: 2.4 }, 13, 0.04, 39.1, {});
    this.builder.box("plinth", { w: 5.2, h: 0.16, d: 2.5 }, 13, 0.08, 39.1, {});
    [-3.4, 3.4].forEach((offset) => {
      this.builder.box("whitePaint", { w: 1.8, h: 1.4, d: 0.12 }, 13 + offset, 2.2, 39.44, {});
      this.builder.box("glass", { w: 1.5, h: 1.15, d: 0.08 }, 13 + offset, 2.2, 39.36, {});
    });
    this.sign("signAdmin", 4.6, 1.0, 13, 3.55, 39.38, 0);
    this.addPath(0.8, 41.8, 10.7, 39.8, 2.3);
    this.addPath(10.7, 39.8, 12.6, 39.0, 2.6);

    // Reception counter and waiting bench, set west of the entrance lane.
    this.builder.box("woodDark", { w: 3.4, h: 1.0, d: 0.85 }, 10.1, 0.5, 41.5, {});
    this.builder.box("woodLight", { w: 3.6, h: 0.08, d: 0.98 }, 10.1, 1.04, 41.5, {});
    this.collider(8.4, 11.8, 41.05, 41.95, "admin-reception");
    this.interiorChair(10.1, 42.35, 1);
    this.builder.box("paper", { w: 0.6, h: 0.04, d: 0.4 }, 9.2, 1.09, 41.4, {});
    this.builder.box("brass", { w: 0.14, h: 0.2, d: 0.14 }, 11.0, 1.16, 41.4, {});
    this.interiorTable(8.9, 44.0, 1.4, 0.9);
    this.interiorChair(8.9, 43.2, 1);
    this.builder.plane("notice", 2.6, 1.6, 12.4, 1.9, 47.12, { rotY: Math.PI });

    // Staff room: long table, chairs and lockers.
    this.interiorTable(10.3, 45.6, 3.0, 1.2);
    for (const x of [9.2, 10.6, 11.7]) {
      this.interiorChair(x, 44.8, 1);
      this.interiorChair(x, 46.4, -1);
    }
    this.builder.box("metal", { w: 0.8, h: 2.25, d: 0.55 }, 8.2, 1.12, 44.8, {});
    this.builder.box("metal", { w: 0.8, h: 2.25, d: 0.55 }, 8.2, 1.12, 45.6, {});
    this.builder.box("metal", { w: 0.8, h: 2.25, d: 0.55 }, 8.2, 1.12, 46.4, {});
    this.collider(7.8, 8.6, 44.5, 46.7, "admin-lockers");
    this.builder.plane("notice", 1.8, 1.2, 12.98, 1.9, 45.6, { rotY: -Math.PI / 2 });
    this.builder.plane("chalk", 3.0, 1.4, 10.2, 2.2, 47.12, { rotY: Math.PI });

    // Principal's office.
    this.builder.box("woodDark", { w: 2.5, h: 0.78, d: 1.0 }, 16.3, 0.39, 45.9, {});
    this.builder.box("woodLight", { w: 2.6, h: 0.07, d: 1.1 }, 16.3, 0.81, 45.9, {});
    this.collider(15.0, 17.6, 45.4, 46.4, "principal-desk");
    this.interiorChair(16.3, 46.8, -1);
    this.builder.box("paper", { w: 0.7, h: 0.04, d: 0.45 }, 16.4, 0.86, 45.8, {});
    this.builder.box("brass", { w: 0.13, h: 0.26, d: 0.13 }, 17.1, 0.97, 45.65, {});
    this.bookshelf(17.75, 45.2, 2.2, "z");
    this.builder.plane("glassWarm", 2.0, 1.2, 15.0, 2.2, 47.12, { rotY: Math.PI });

    this.addInteriorLight(11, 42.2, 7);
    this.addInteriorLight(16.2, 45.4, 6);

    const door = this.createDoor({
      hinge: new THREE.Vector3(12.0, 0, 39.7),
      width: 2.0,
      height: 2.6,
      openAngle: -1.4,
      baseRotationY: Math.PI / 2,
      label: "administration",
      opening: "Enter the administration office",
      closing: "Close the administration door",
    });
    door.collider = this.collider(12.0, 14.0, 39.55, 39.85, "admin-door");
    this.interactables.push({
      id: "admin-door",
      kind: "door",
      label: "Administration",
      position: new THREE.Vector3(13.0, 0, 38.65),
      radius: 2.3,
      door,
      roomId: "admin-reception",
    });
    this.interactables.push({
      id: "admin-notice",
      kind: "notice",
      label: "the staff-room notices",
      position: new THREE.Vector3(12.4, 0, 46.4),
      radius: 2.2,
      notice: INTERIOR_CONTENT.adminNotice,
      roomId: "admin-staff-room",
    });
    this.interactables.push({
      id: "principal-desk",
      kind: "book",
      label: "the principal's desk",
      position: new THREE.Vector3(16.3, 0, 45.2),
      radius: 2.0,
      notice: INTERIOR_CONTENT.principalDesk,
      roomId: "admin-principal-office",
    });
  }

  /** Walk-in practical science wing with two entrance leaves. */
  private buildScienceLabs(): void {
    this.builder.box("stonePlaza", { w: 15, h: 0.06, d: 11 }, 36, 0.03, -38, {});
    this.wallAlongX(-43.3, 28.5, 43.5, 5.2, "plasterCool", "science-lab");
    this.wallAlongX(-32.7, 28.5, 43.5, 5.2, "plasterCool", "science-lab", [34.0, 38.0]);
    this.wallAlongZ(28.7, -43.3, -32.7, 5.2, "plasterCool", "science-lab");
    this.wallAlongZ(43.3, -43.3, -32.7, 5.2, "plasterCool", "science-lab");
    this.builder.box("plasterCool", { w: 4.0, h: 2.3, d: 0.36 }, 36, 4.05, -32.7, {});
    this.builder.box("plasterCool", { w: 15, h: 0.18, d: 11 }, 36, 3.75, -38, {});

    this.builder.box("plinth", { w: 15.6, h: 0.4, d: 11.5 }, 36, 5.4, -38, {});
    this.builder.add(
      "roof",
      new THREE.ConeGeometry(10.4, 2.4, 4),
      36,
      6.8,
      -38,
      { rotY: Math.PI / 4, scale: { x: 1.02, y: 1, z: 0.8 } },
    );
    this.builder.box("roof", { w: 16.2, h: 0.22, d: 12.2 }, 36, 5.3, -38, {});
    this.builder.box("stonePlaza", { w: 11, h: 0.07, d: 2.8 }, 36, 0.035, -31.5, {});

    // Outer windows and a central double-door entrance.
    [-4.7, 4.7].forEach((offset) => {
      this.builder.box("whitePaint", { w: 2.5, h: 1.9, d: 0.13 }, 36 + offset, 2.15, -32.44, {});
      this.builder.box("glass", { w: 2.15, h: 1.55, d: 0.08 }, 36 + offset, 2.15, -32.36, {});
    });
    this.sign("signLabs", 5.2, 1.08, 36, 3.85, -32.34, 0);
    this.builder.box("metal", { w: 0.42, h: 1.2, d: 0.42 }, 41.5, 6.0, -41.5, {});
    this.addPath(18.2, -31.4, 28.7, -33.2, 2.2);
    this.addPath(28.7, -33.2, 35.0, -31.4, 2.4);

    // Lab benches with sinks, taps and stools. Two benches per row leave a
    // wide central aisle from the double doors to the demonstration bench.
    for (const z of [-35.7, -40.3]) {
      for (const x of [31.0, 40.2]) {
        this.builder.box("cement", { w: 3.2, h: 0.82, d: 1.0 }, x, 0.41, z, {});
        this.builder.box("darkTrim", { w: 3.3, h: 0.06, d: 1.08 }, x, 0.85, z, {});
        this.builder.box("metal", { w: 0.52, h: 0.08, d: 0.4 }, x - 0.9, 0.9, z, {});
        this.builder.cylinder("brass", 0.03, 0.03, 0.28, 6, x - 0.9, 1.04, z - 0.18, {});
        this.builder.cylinder("brass", 0.03, 0.03, 0.28, 6, x + 0.9, 1.04, z + 0.18, {});
        this.collider(x - 1.6, x + 1.6, z - 0.5, z + 0.5, "lab-bench");
        for (const sx of [-0.9, 0, 0.9]) {
          this.builder.cylinder("woodLight", 0.17, 0.17, 0.08, 10, x + sx, 0.55, z + 0.95, {});
          this.builder.cylinder("metal", 0.04, 0.04, 0.55, 6, x + sx, 0.28, z + 0.95, {});
        }
      }
    }

    // Demonstration bench, chalkboard and apparatus cupboard.
    this.builder.box("woodDark", { w: 4.2, h: 0.86, d: 1.2 }, 36, 0.43, -41.8, {});
    this.builder.box("darkTrim", { w: 4.35, h: 0.07, d: 1.3 }, 36, 0.9, -41.8, {});
    this.collider(33.9, 38.1, -42.4, -41.2, "lab-demo-bench");
    this.builder.plane("chalk", 6.2, 2.1, 36, 2.1, -43.07, {});
    this.builder.box("woodDark", { w: 6.4, h: 2.25, d: 0.05 }, 36, 2.1, -43.11, {});
    this.builder.box("woodDark", { w: 1.5, h: 0.76, d: 0.7 }, 42.3, 1.62, -36.2, {});
    this.builder.box("glass", { w: 1.42, h: 0.62, d: 0.06 }, 42.3, 1.66, -36.54, {});
    this.builder.box("woodDark", { w: 1.5, h: 0.76, d: 0.7 }, 42.3, 0.82, -36.2, {});
    this.builder.box("glass", { w: 1.42, h: 0.62, d: 0.06 }, 42.3, 0.86, -36.54, {});
    for (let i = 0; i < 5; i += 1) {
      this.builder.cylinder("glass", 0.08, 0.1, 0.24, 8, 41.9 + i * 0.22, 1.5, -36.05, {});
      this.builder.cylinder("water", 0.06, 0.08, 0.1, 8, 41.9 + i * 0.22, 1.38, -36.05, {});
    }
    this.collider(41.6, 43.2, -36.6, -35.8, "lab-cupboard");
    this.builder.plane("notice", 2.4, 1.5, 28.93, 1.9, -37.0, { rotY: Math.PI / 2 });

    this.addInteriorLight(33, -37, 8);
    this.addInteriorLight(39, -39.5, 8);

    const left = this.createDoor({
      hinge: new THREE.Vector3(34.0, 0, -32.7),
      width: 2.0,
      height: 2.9,
      openAngle: 1.35,
      baseRotationY: Math.PI / 2,
      label: "science-lab-left",
      opening: "Enter the laboratory",
      closing: "Close the laboratory door",
    });
    left.collider = this.collider(34.0, 36.0, -32.85, -32.55, "science-lab-door");
    const right = this.createDoor({
      hinge: new THREE.Vector3(38.0, 0, -32.7),
      width: 2.0,
      height: 2.9,
      openAngle: -1.35,
      baseRotationY: -Math.PI / 2,
      label: "science-lab-right",
      opening: "Enter the laboratory",
      closing: "Close the laboratory door",
    });
    right.collider = this.collider(36.0, 38.0, -32.85, -32.55, "science-lab-door");
    this.interactables.push(
      {
        id: "science-lab-door-left",
        kind: "door",
        label: "Laboratory",
        position: new THREE.Vector3(35.0, 0, -31.4),
        radius: 2.2,
        door: left,
        roomId: "science-lab-main",
      },
      {
        id: "science-lab-door-right",
        kind: "door",
        label: "Laboratory",
        position: new THREE.Vector3(37.0, 0, -31.4),
        radius: 2.2,
        door: right,
        roomId: "science-lab-main",
      },
    );
    this.interactables.push({
      id: "lab-notice",
      kind: "notice",
      label: "the laboratory notice",
      position: new THREE.Vector3(30.6, 0, -37.0),
      radius: 2.2,
      notice: INTERIOR_CONTENT.labSafety,
      roomId: "science-lab-main",
    });
  }

  /** Kitchen and store wing beside the dining hall. */
  private buildKitchen(): void {
    this.solid("plasterWarm", 7, 4.0, 7, 22, -40, "kitchen");
    this.builder.box("roof", { w: 7.7, h: 0.22, d: 7.7 }, 22, 4.12, -40, {});
    this.builder.add(
      "roof",
      new THREE.ConeGeometry(5.4, 1.8, 4),
      22,
      5.05,
      -40,
      { rotY: Math.PI / 4, scale: { x: 1.0, y: 1, z: 0.9 } },
    );
    this.builder.box("metal", { w: 0.65, h: 2.6, d: 0.65 }, 24.4, 5.4, -41.6, {});
    this.builder.box("wood", { w: 1.8, h: 2.3, d: 0.14 }, 22, 1.15, -36.44, {});
    this.builder.box("glassWarm", { w: 1.3, h: 1.5, d: 0.1 }, 22, 2.6, -36.4, {});
    this.sign("signKitchen", 3.2, 0.72, 22, 3.35, -36.36, 0);
  }

  private buildLibrary(): void {
    // Walk-in reading room. The upper band stays solid above the interior
    // ceiling so the tall exterior volume, windows and roof remain intact.
    this.builder.box("stonePlaza", { w: 18, h: 0.06, d: 15 }, -36, 0.03, -30, {});
    this.wallAlongX(-37.3, -45, -27, 7.4, "plaster", "library");
    this.wallAlongX(-22.7, -45, -27, 7.4, "plaster", "library");
    this.wallAlongZ(-44.8, -37.3, -22.7, 7.4, "plaster", "library");
    this.wallAlongZ(-27.2, -37.3, -22.7, 7.4, "plaster", "library", [-31.2, -28.8]);
    this.builder.box("plaster", { w: 0.36, h: 4.6, d: 2.4 }, -27.2, 5.1, -30, {});
    this.builder.box("plaster", { w: 18, h: 0.18, d: 15 }, -36, 4.2, -30, {});

    this.builder.box("roof", { w: 19.4, h: 0.4, d: 16.4 }, -36, 7.6, -30, {});
    this.builder.box("plinth", { w: 20, h: 0.6, d: 17 }, -36, 8.1, -30, {});
    this.builder.box("plinth", { w: 14, h: 0.28, d: 12 }, -36, 8.5, -30, {});

    // Portico facing east toward the campus.
    this.builder.box("roof", { w: 3.2, h: 0.26, d: 8 }, -26, 3.9, -30, {});
    [-33.4, -26.6].forEach((z) => {
      this.builder.cylinder("plasterCool", 0.24, 0.28, 3.7, 10, -25, 1.85, z, {});
      this.collider(-25.3, -24.7, z - 0.35, z + 0.35, "library-column");
    });
    this.builder.box("stageStone", { w: 1.6, h: 0.04, d: 3.2 }, -25.8, 0.02, -30, {});
    for (let col = 0; col < 4; col += 1) {
      this.builder.box("whitePaint", { w: 0.14, h: 1.7, d: 1.9 }, -26.85, 5.0, -34.6 + col * 2.8, {});
      this.builder.box("glassWarm", { w: 0.1, h: 1.5, d: 1.65 }, -26.76, 5.0, -34.6 + col * 2.8, {});
    }
    this.sign("signLibrary", 4.8, 1.1, -26.94, 6.3, -30, Math.PI / 2);
    this.addPath(-25.8, -20.8, -25.8, -29.3, 2.4);

    // Shelving around the reading room.
    this.bookshelf(-43.7, -34.6, 2.6, "z");
    this.bookshelf(-43.7, -31.6, 2.6, "z");
    this.bookshelf(-43.7, -28.3, 2.6, "z");
    this.bookshelf(-41.4, -36.35, 2.8, "x");
    this.bookshelf(-38.2, -36.35, 2.8, "x");
    this.bookshelf(-35.0, -36.35, 2.8, "x");
    this.bookshelf(-43.2, -23.65, 2.6, "x");
    this.bookshelf(-34.6, -23.65, 2.6, "x");

    // Reading tables with chairs on both sides.
    for (const x of [-38.4, -34.6, -30.9]) {
      this.interiorTable(x, -30, 2.2, 1.25);
      for (const offset of [-1, 1]) {
        this.interiorChair(x - 0.62, -30 + offset * 1.05, offset < 0 ? 1 : -1);
        this.interiorChair(x + 0.62, -30 + offset * 1.05, offset < 0 ? 1 : -1);
        this.builder.box("paper", { w: 0.5, h: 0.03, d: 0.34 }, x - 0.62, 0.82, -30 + offset * 0.35, {});
      }
    }

    // Librarian counter, shelf trolley and catalogue.
    this.builder.box("woodLight", { w: 3.6, h: 0.95, d: 0.8 }, -31.8, 0.48, -34.6, {});
    this.builder.box("woodDark", { w: 3.8, h: 0.08, d: 0.92 }, -31.8, 1.0, -34.6, {});
    this.collider(-33.6, -30, -35.0, -34.2, "library-counter");
    this.interiorChair(-31.8, -35.5, 1);
    this.builder.box("paper", { w: 0.5, h: 0.04, d: 0.35 }, -32.6, 1.06, -34.5, {});
    this.builder.box("brass", { w: 0.16, h: 0.22, d: 0.16 }, -30.5, 1.13, -34.5, {});
    this.builder.box("woodDark", { w: 2.2, h: 0.55, d: 0.7 }, -36.2, 0.3, -35.8, {});
    this.builder.box("woodDark", { w: 2.2, h: 0.55, d: 0.7 }, -36.2, 0.9, -35.8, {});

    // Quiet reading corner: rug, two low chairs and a lamp.
    this.builder.box("fabricRed", { w: 4.4, h: 0.03, d: 3.2 }, -40.4, 0.08, -24.9, {});
    for (const x of [-41.5, -39.3]) {
      this.builder.box("woodDark", { w: 1.05, h: 0.12, d: 0.9 }, x, 0.44, -24.5, {});
      this.builder.box("woodDark", { w: 1.05, h: 0.75, d: 0.12 }, x, 0.82, -24.05, { rotX: -0.12 });
      this.builder.box("metal", { w: 0.08, h: 0.4, d: 0.08 }, x - 0.4, 0.22, -24.5, {});
      this.builder.box("metal", { w: 0.08, h: 0.4, d: 0.08 }, x + 0.4, 0.22, -24.5, {});
    }
    this.builder.box("woodLight", { w: 1.1, h: 0.06, d: 0.7 }, -40.4, 0.46, -25.9, {});
    this.builder.box("woodDark", { w: 0.08, h: 0.44, d: 0.08 }, -40.9, 0.22, -25.9, {});
    this.builder.box("woodDark", { w: 0.08, h: 0.44, d: 0.08 }, -39.9, 0.22, -25.9, {});
    this.builder.cylinder("metal", 0.04, 0.05, 2.1, 8, -43.1, 1.05, -24.0, {});
    this.builder.add("lampGlow", new THREE.SphereGeometry(0.2, 10, 8), -43.1, 2.12, -24.0, {});

    // Interior notice and wall map.
    this.builder.plane("notice", 2.2, 1.35, -30.4, 1.85, -22.86, { rotY: Math.PI });
    this.builder.box("whitePaint", { w: 2.8, h: 1.8, d: 0.1 }, -39.0, 1.85, -22.85, { rotY: Math.PI });
    this.builder.box("glassWarm", { w: 2.6, h: 1.6, d: 0.08 }, -39.0, 1.85, -22.79, { rotY: Math.PI });

    this.addInteriorLight(-40, -32.8, 10);
    this.addInteriorLight(-32, -26.5, 9);

    const door = this.createDoor({
      hinge: new THREE.Vector3(-27.15, 0, -31.2),
      width: 2.4,
      height: 2.8,
      openAngle: -1.5,
      label: "library",
      opening: "Enter the library",
      closing: "Close the library door",
    });
    door.collider = this.collider(-27.35, -26.95, -31.2, -28.8, "library-door");
    this.interactables.push({
      id: "library-door",
      kind: "door",
      label: "Library",
      position: new THREE.Vector3(-25.9, 0, -30),
      radius: 2.5,
      door,
      roomId: "library-reading-room",
    });
    this.interactables.push({
      id: "library-shelves",
      kind: "book",
      label: "the shelves",
      position: new THREE.Vector3(-42.6, 0, -31.6),
      radius: 2.4,
      notice: INTERIOR_CONTENT.libraryShelf,
      roomId: "library-reading-room",
    });
    this.interactables.push({
      id: "library-catalogue",
      kind: "notice",
      label: "the card catalogue",
      position: new THREE.Vector3(-31.8, 0, -33.5),
      radius: 2.2,
      notice: INTERIOR_CONTENT.libraryCatalogue,
      roomId: "library-reading-room",
    });
  }

  /**
   * Academic Block B: a single-storey practical wing with a walk-in computer
   * laboratory, classroom, activity room and staff room around a central
   * corridor. It occupies the empty service strip east of the assembly ground.
   */
  private buildAcademicBlockB(): void {
    const x1 = 24;
    const x2 = 44;
    const z1 = -29;
    const z2 = -14;
    const innerX1 = x1 + 0.4;
    const innerX2 = x2 - 0.4;
    const innerZ1 = z1 + 0.4;
    const innerZ2 = z2 - 0.4;
    const wallH = 3.6;

    this.builder.box("stonePlaza", { w: 20.8, h: 0.06, d: 15.8 }, 34, 0.03, -21.5, {});
    this.addPath(18.5, -16.5, 24.5, -20.6, 2.4);
    this.addPath(8, -26, 18.5, -16.5, 2.2);

    this.wallLevelX(z1, x1, x2, 0, 5.6, "plasterCool", "block-b");
    this.wallLevelX(z2, x1, x2, 0, 5.6, "plasterCool", "block-b");
    this.wallLevelZ(x2, z1, z2, 0, 5.6, "plasterCool", "block-b");
    this.wallLevelZ(x1, z1, z2, 0, 5.6, "plasterCool", "block-b", [[-21.2, -19.2]]);
    this.builder.box("plasterCool", { w: 0.4, h: 0.9, d: 2.0 }, x1, 3.15, -20.2, {});
    this.builder.box("roof", { w: 21.2, h: 0.3, d: 16.2 }, 34, 5.75, -21.5, {});
    this.builder.box("plinth", { w: 21.5, h: 0.55, d: 16.5 }, 34, 6.18, -21.5, {});
    this.builder.box("stonePlaza", { w: 4.4, h: 0.05, d: 3.4 }, 21.8, 0.03, -20.2, {});

    // Corridor with room partitions and clear door gaps.
    this.wallLevelX(-22, x1, x2, 0, wallH, "plasterWarm", "block-b-corridor", [[29, 31], [38, 40]]);
    this.wallLevelX(-19, x1, x2, 0, wallH, "plasterWarm", "block-b-corridor", [[29, 31], [38, 40]]);
    this.wallLevelZ(34.5, z1, -22, 0, wallH, "plasterWarm", "block-b-partition");
    this.wallLevelZ(34.5, -19, z2, 0, wallH, "plasterWarm", "block-b-partition");
    this.builder.box("plasterCool", { w: 19.2, h: 0.18, d: 14.2 }, 34, 3.55, -21.5, {});

    // Windows on all four facades.
    for (const zSide of [z1, z2]) {
      for (let index = 0; index < 4; index += 1) {
        const x = 27 + index * 4.4;
        this.builder.box("whitePaint", { w: 2.1, h: 1.8, d: 0.16 }, x, 2.0, zSide + (zSide < 0 ? 0.14 : -0.14), {});
        this.builder.box("glass", { w: 1.8, h: 1.55, d: 0.1 }, x, 2.0, zSide + (zSide < 0 ? 0.26 : -0.26), {});
      }
    }
    for (let index = 0; index < 3; index += 1) {
      const z = -27 + index * 5.0;
      this.builder.box("whitePaint", { w: 0.16, h: 1.8, d: 2.0 }, x2 - 0.14, 2.0, z, {});
      this.builder.box("glass", { w: 0.1, h: 1.55, d: 1.7 }, x2 - 0.26, 2.0, z, {});
    }
    this.sign("signBlockB", 5.4, 1.15, x1 - 0.03, 4.35, -20.2, -Math.PI / 2);

    // Computer laboratory: desks, monitors, keyboards and a wall board.
    this.builder.plane("chalk", 5.0, 1.9, 29.5, 2.0, -28.25, { rotY: 0 });
    this.builder.box("woodDark", { w: 5.2, h: 2.1, d: 0.08 }, 29.5, 2.0, -28.3, {});
    for (let row = 0; row < 3; row += 1) {
      for (let col = 0; col < 3; col += 1) {
        const x = 26.6 + col * 2.55;
        const z = -26.9 + row * 1.45;
        this.builder.box("woodLight", { w: 2.0, h: 0.07, d: 1.05 }, x, 0.76, z, {});
        this.builder.box("metal", { w: 0.12, h: 0.72, d: 0.12 }, x - 0.85, 0.38, z - 0.4, {});
        this.builder.box("metal", { w: 0.12, h: 0.72, d: 0.12 }, x + 0.85, 0.38, z - 0.4, {});
        this.builder.box("darkTrim", { w: 0.62, h: 0.42, d: 0.08 }, x, 1.12, z + 0.08, {});
        this.builder.box("glass", { w: 0.56, h: 0.34, d: 0.03 }, x, 1.13, z + 0.025, {});
        this.builder.box("metal", { w: 0.62, h: 0.05, d: 0.24 }, x, 0.79, z + 0.35, {});
        this.builder.box("woodDark", { w: 0.42, h: 0.42, d: 0.42 }, x, 0.22, z - 0.85, {});
        this.collider(x - 1.0, x + 1.0, z - 0.55, z + 0.55, "block-b-computer-desk");
      }
    }
    this.builder.box("metal", { w: 1.3, h: 1.9, d: 0.7 }, 42.1, 0.95, -26.9, {});
    this.builder.plane("notice", 2.2, 1.4, 33.0, 1.8, -21.78, { rotY: 0 });

    // Classroom across the north corridor.
    this.builder.plane("chalk", 3.9, 1.8, 39.2, 2.0, -28.25, { rotY: 0 });
    this.builder.box("woodDark", { w: 4.1, h: 2.0, d: 0.08 }, 39.2, 2.0, -28.3, {});
    for (let row = 0; row < 2; row += 1) {
      for (let col = 0; col < 2; col += 1) {
        const x = 37.2 + col * 3.4;
        const z = -26.6 + row * 2.5;
        this.builder.box("woodLight", { w: 1.5, h: 0.07, d: 0.7 }, x, 0.76, z, {});
        this.builder.box("woodDark", { w: 0.45, h: 0.42, d: 1.2 }, x + 1.25, 0.24, z, {});
      }
    }

    // Practical activity room and staff room on the south side.
    this.builder.box("cement", { w: 6.6, h: 0.84, d: 2.2 }, 29.5, 0.42, -16.1, {});
    this.builder.box("darkTrim", { w: 6.8, h: 0.06, d: 2.3 }, 29.5, 0.87, -16.1, {});
    for (let index = 0; index < 4; index += 1) {
      this.builder.cylinder("woodLight", 0.17, 0.17, 0.06, 10, 27.2 + index * 1.6, 0.55, -17.7, {});
      this.builder.cylinder("metal", 0.04, 0.04, 0.52, 6, 27.2 + index * 1.6, 0.26, -17.7, {});
    }
    this.builder.box("woodDark", { w: 4.2, h: 0.8, d: 0.7 }, 29.5, 1.55, -28.1, {});
    this.builder.plane("notice", 2.3, 1.5, 34.1, 1.8, -14.24, { rotY: Math.PI });

    this.builder.box("woodLight", { w: 3.2, h: 0.08, d: 1.1 }, 39.2, 0.78, -16.3, {});
    for (const x of [37.8, 39.2, 40.6]) {
      this.builder.box("woodDark", { w: 0.42, h: 0.42, d: 0.42 }, x, 0.22, -17.2, {});
      this.builder.box("woodDark", { w: 0.42, h: 0.42, d: 0.42 }, x, 0.22, -15.4, {});
    }
    this.builder.box("metal", { w: 2.0, h: 2.15, d: 0.55 }, 42.4, 1.08, -15.6, {});

    this.addInteriorLight(29, -25, 7);
    this.addInteriorLight(39, -25, 7);
    this.addInteriorLight(29, -17, 7);
    this.addInteriorLight(39, -17, 7);

    const door = this.createDoor({
      hinge: new THREE.Vector3(x1, 0, -21.2),
      width: 2.0,
      height: 2.7,
      openAngle: 1.4,
      label: "block-b",
      opening: "Enter Academic Block B",
      closing: "Close the Academic Block B door",
    });
    door.collider = this.collider(x1 - 0.3, x1 + 0.3, -21.2, -19.2, "block-b-door");
    this.interactables.push({
      id: "block-b-door",
      kind: "door",
      label: "Academic Block B",
      position: new THREE.Vector3(22.6, 0, -20.2),
      radius: 2.4,
      door,
      roomId: "block-b-corridor",
    });
    this.interactables.push({
      id: "computer-lab-notice",
      kind: "notice",
      label: "the computer lab rota",
      position: new THREE.Vector3(33.0, 0, -23.2),
      radius: 2.4,
      notice: INTERIOR_CONTENT.computerLab,
      roomId: "computer-lab",
    });
    this.sign("signComputer", 2.8, 0.55, 31.0, 2.5, -21.98, 0);
  }

  /** Indoor badminton/table-tennis hall, with its own equipment store. */
  private buildIndoorSportsHall(): void {
    const x1 = 44.5;
    const x2 = 54;
    const z1 = -28;
    const z2 = -11;
    const wallH = 6.4;
    this.builder.box("stonePlaza", { w: 10.4, h: 0.06, d: 17.8 }, 49.25, 0.03, -19.5, {});
    this.wallLevelX(z1, x1, x2, 0, wallH, "plasterWarm", "indoor-sports");
    this.wallLevelX(z2, x1, x2, 0, wallH, "plasterWarm", "indoor-sports", [[48.3, 50.3]]);
    this.wallLevelZ(x1, z1, z2, 0, wallH, "plasterWarm", "indoor-sports");
    this.wallLevelZ(x2, z1, z2, 0, wallH, "plasterWarm", "indoor-sports");
    this.builder.box("plasterWarm", { w: 2.0, h: 3.7, d: 0.36 }, 49.3, 4.55, z2, {});
    this.builder.box("roof", { w: 10.8, h: 0.3, d: 18.2 }, 49.25, wallH + 0.15, -19.5, {});
    this.builder.box("plinth", { w: 11.1, h: 0.5, d: 18.5 }, 49.25, wallH + 0.55, -19.5, {});
    this.builder.box("stonePlaza", { w: 4.2, h: 0.05, d: 3.0 }, 49.3, 0.03, -9.8, {});
    this.sign("signIndoorSports", 5.6, 1.1, 49.3, 5.6, z2 + 0.19, 0);

    // High windows and roof trusses give the hall a real indoor volume.
    for (let index = 0; index < 5; index += 1) {
      const z = -26 + index * 3.2;
      for (const xSide of [x1, x2]) {
        this.builder.box("glass", { w: 0.1, h: 1.5, d: 2.15 }, xSide + (xSide < 49 ? 0.14 : -0.14), 5.0, z, {});
        this.builder.box("whitePaint", { w: 0.16, h: 1.7, d: 2.35 }, xSide + (xSide < 49 ? 0.08 : -0.08), 5.0, z, {});
      }
    }
    for (let index = 0; index < 6; index += 1) {
      const z = -27 + index * 3.0;
      this.builder.box("metal", { w: 9.4, h: 0.08, d: 0.08 }, 49.25, 6.1, z, {});
      this.builder.box("metal", { w: 0.08, h: 0.5, d: 0.08 }, 45.0, 5.85, z, {});
      this.builder.box("metal", { w: 0.08, h: 0.5, d: 0.08 }, 53.5, 5.85, z, {});
    }

    // Badminton court markings and net posts.
    this.builder.box("woodLight", { w: 7.0, h: 0.04, d: 12.0 }, 49.3, 0.08, -18.6, {});
    for (const x of [46.2, 52.4]) {
      this.builder.box("whitePaint", { w: 0.07, h: 0.02, d: 12.0 }, x, 0.11, -18.6, {});
    }
    for (const z of [-24.6, -18.6, -12.6]) {
      this.builder.box("whitePaint", { w: 6.2, h: 0.02, d: 0.07 }, 49.3, 0.11, z, {});
    }
    for (const x of [46.2, 52.4]) {
      this.builder.cylinder("metal", 0.055, 0.07, 1.7, 8, x, 0.85, -18.6, {});
      this.builder.box("whitePaint", { w: 0.04, h: 0.9, d: 6.2 }, x, 1.35, -18.6, {});
      this.collider(x - 0.1, x + 0.1, -18.7, -18.5, "badminton-post");
    }

    // Equipment room at the north end, with a counter and shelving.
    this.wallLevelX(-24.6, x1, 49.4, 0, 2.8, "woodDark", "indoor-store", [[46.7, 48.5]]);
    this.wallLevelZ(49.4, z1, -24.6, 0, 2.8, "woodDark", "indoor-store");
    this.builder.box("woodDark", { w: 4.5, h: 0.1, d: 2.6 }, 47.0, 2.75, -26.3, {});
    for (let index = 0; index < 5; index += 1) {
      this.builder.box("woodDark", { w: 0.12, h: 1.9, d: 0.55 }, 47.2 + index * 0.5, 0.95, -26.8, {});
    }
    this.builder.box("woodLight", { w: 3.0, h: 0.08, d: 0.8 }, 47.6, 1.0, -25.1, {});
    this.builder.box("paper", { w: 0.7, h: 0.04, d: 0.45 }, 47.2, 1.06, -25.1, {});

    // Table-tennis table along the east wall.
    this.builder.box("darkTrim", { w: 1.5, h: 0.07, d: 2.7 }, 52.5, 0.76, -14.8, {});
    this.builder.box("metal", { w: 0.08, h: 0.74, d: 0.08 }, 51.95, 0.37, -13.8, {});
    this.builder.box("metal", { w: 0.08, h: 0.74, d: 0.08 }, 53.05, 0.37, -13.8, {});
    this.builder.box("metal", { w: 0.08, h: 0.74, d: 0.08 }, 51.95, 0.37, -15.8, {});
    this.builder.box("metal", { w: 0.08, h: 0.74, d: 0.08 }, 53.05, 0.37, -15.8, {});
    this.builder.box("whitePaint", { w: 0.02, h: 0.16, d: 2.8 }, 52.5, 0.87, -14.8, {});

    this.addInteriorLight(49.3, -22, 8);
    this.addInteriorLight(49.3, -15, 8);

    const door = this.createDoor({
      hinge: new THREE.Vector3(48.3, 0, z2),
      width: 2.0,
      height: 2.7,
      openAngle: 1.35,
      baseRotationY: Math.PI,
      label: "indoor-sports",
      opening: "Enter the indoor sports hall",
      closing: "Close the indoor sports hall door",
    });
    door.collider = this.collider(48.3, 50.3, z2 - 0.18, z2 + 0.18, "indoor-sports-door");
    this.interactables.push({
      id: "indoor-sports-door",
      kind: "door",
      label: "Indoor sports hall",
      position: new THREE.Vector3(49.3, 0, -10.5),
      radius: 2.5,
      door,
      roomId: "indoor-sports-hall",
    });
    this.interactables.push({
      id: "indoor-sports-notice",
      kind: "notice",
      label: "the indoor games board",
      position: new THREE.Vector3(48.0, 0, -25.3),
      radius: 2.3,
      notice: INTERIOR_CONTENT.indoorSports,
      roomId: "indoor-sports-hall",
    });
  }

  private buildSportsGround(): void {
    const cx = 37;
    const cz = 36;
    const rx = 15;
    const rz = 11;
    const oval = new THREE.Mesh(new THREE.CircleGeometry(1, 48), this.materials.dirt);
    oval.rotation.x = -Math.PI / 2;
    oval.scale.set(rx, rz, 1);
    oval.position.set(cx, 0.035, cz);
    oval.receiveShadow = true;
    this.group.add(oval);

    const track = new THREE.Mesh(new THREE.RingGeometry(1.0, 1.16, 64), this.materials.track);
    track.rotation.x = -Math.PI / 2;
    track.scale.set(rx + 1.4, rz + 1.4, 1);
    track.position.set(cx, 0.03, cz);
    track.receiveShadow = true;
    this.group.add(track);

    // White boundary line.
    const line = new THREE.Mesh(new THREE.RingGeometry(0.86, 0.875, 64), this.materials.whitePaint);
    line.rotation.x = -Math.PI / 2;
    line.scale.set(rx, rz, 1);
    line.position.set(cx, 0.045, cz);
    this.group.add(line);

    // Goals at each end.
    [cx - rx + 2.4, cx + rx - 2.4].forEach((x) => {
      const dir = x < cx ? 1 : -1;
      [cz - 2.6, cz + 2.6].forEach((z) => {
        this.builder.cylinder("whitePaint", 0.09, 0.09, 2.5, 8, x, 1.25, z, {});
      });
      this.builder.box("whitePaint", { w: 0.1, h: 0.1, d: 5.2 }, x, 2.5, cz, {});
      const netMaterial = new THREE.MeshBasicMaterial({
        color: "#ded8c6",
        wireframe: true,
        transparent: true,
        opacity: 0.32,
      });
      this.disposables.push(netMaterial);
      const net = new THREE.Mesh(new THREE.BoxGeometry(1.8, 2.3, 5), netMaterial);
      net.position.set(x - dir * 0.9, 1.15, cz);
      this.group.add(net);
    });

    // Elliptical fence markers.
    for (let i = 0; i < 22; i += 1) {
      const angle = (i / 22) * Math.PI * 2;
      const x = cx + Math.cos(angle) * (rx + 3);
      const z = cz + Math.sin(angle) * (rz + 3);
      this.builder.cylinder("whitePaint", 0.06, 0.06, 1.1, 5, x, 0.55, z, {});
    }
    // Small pavilion beside the ground.
    this.solid("plasterWarm", 5, 3, 3.4, 48, 16, "sports-pavilion");
    this.builder.box("terracotta", { w: 6, h: 0.3, d: 4.4 }, 48, 3.2, 16, {});
    this.builder.box("wood", { w: 1.2, h: 2.1, d: 0.14 }, 48, 1.05, 14.3, {});
    this.sign("signSports", 3.6, 0.95, 48, 3.65, 14.2, Math.PI);

    // Benches along the west touchline.
    [26, 30, 40, 44].forEach((z, index) => {
      this.builder.box("woodLight", { w: 0.55, h: 0.1, d: 2.2 }, 20.4, 0.5, z, {});
      this.builder.box("metal", { w: 0.5, h: 0.42, d: 0.1 }, 20.4, 0.25, z - 0.8, {});
      this.builder.box("metal", { w: 0.5, h: 0.42, d: 0.1 }, 20.4, 0.25, z + 0.8, {});
      if (index === 0) this.collider(20.1, 20.7, z - 1.1, z + 1.1, "sports-bench");
    });

    // Outdoor games courts behind the laboratory wing. A service lane links
    // them to the academic side without crossing any building.
    this.addPath(-26, -21, -17, -23, 2.8);
    this.addPath(-17, -23, -17, -46.3, 3.0);
    this.addPath(-17, -46.3, 26.5, -46.3, 1.8);
    this.addPath(26.5, -46.3, 26.5, -44.5, 1.8);
    this.addPath(26.5, -44.5, 48, -44.5, 1.8);
    this.treeExclusions.push(
      { minX: 25.5, maxX: 42.5, minZ: -55, maxZ: -44.5 },
      { minX: 41.5, maxX: 54, minZ: -54.5, maxZ: -45.5 },
    );

    // Basketball half-court.
    this.builder.box("cement", { w: 14, h: 0.06, d: 8 }, 34, 0.04, -50, {});
    for (const z of [-54, -46]) {
      this.builder.box("whitePaint", { w: 14, h: 0.02, d: 0.09 }, 34, 0.08, z, {});
    }
    for (const x of [27, 41]) {
      this.builder.box("whitePaint", { w: 0.09, h: 0.02, d: 8 }, x, 0.08, -50, {});
    }
    this.builder.box("whitePaint", { w: 0.09, h: 0.02, d: 8 }, 34, 0.08, -50, {});
    this.builder.add(
      "whitePaint",
      new THREE.RingGeometry(0.55, 0.63, 28),
      34,
      0.082,
      -50,
      { rotX: -Math.PI / 2 },
    );
    for (const side of [-1, 1]) {
      const poleX = 34 + side * 7.55;
      const boardX = 34 + side * 7.15;
      const rimX = 34 + side * 6.78;
      this.builder.cylinder("metal", 0.09, 0.1, 3.5, 8, poleX, 1.75, -50, {});
      this.builder.box("metal", { w: 0.6, h: 0.09, d: 0.09 }, 34 + side * 7.35, 3.35, -50, {});
      this.builder.box("whitePaint", { w: 0.08, h: 1.05, d: 1.8 }, boardX, 3.05, -50, {});
      this.builder.box("metal", { w: 0.06, h: 0.1, d: 0.5 }, rimX, 2.6, -50, {});
      this.builder.add(
        "brass",
        new THREE.TorusGeometry(0.23, 0.028, 6, 14),
        rimX,
        2.6,
        -50,
        { rotX: Math.PI / 2 },
      );
      this.builder.cylinder("metal", 0.012, 0.012, 0.4, 4, rimX, 2.38, -50 + 0.2, {});
      this.builder.cylinder("metal", 0.012, 0.012, 0.4, 4, rimX, 2.38, -50 - 0.2, {});
      this.collider(poleX - 0.12, poleX + 0.12, -50.12, -49.88, "basketball-pole");
    }

    // Volleyball court.
    this.builder.box("dirt", { w: 11, h: 0.06, d: 7 }, 48, 0.04, -50.8, {});
    for (const z of [-54.3, -47.3]) {
      this.builder.box("whitePaint", { w: 11, h: 0.02, d: 0.09 }, 48, 0.08, z, {});
    }
    for (const x of [42.5, 53.5]) {
      this.builder.box("whitePaint", { w: 0.09, h: 0.02, d: 7 }, x, 0.08, -50.8, {});
    }
    for (const z of [-53.9, -47.7]) {
      this.builder.cylinder("metal", 0.06, 0.07, 2.55, 8, 48, 1.27, z, {});
      this.collider(47.9, 48.1, z - 0.1, z + 0.1, "volleyball-post");
    }
    this.builder.box("metal", { w: 0.03, h: 0.03, d: 6.2 }, 48, 2.42, -50.8, {});
    this.builder.box("woodLight", { w: 0.04, h: 0.04, d: 6.2 }, 48, 2.0, -50.8, {});
    for (let i = 0; i < 9; i += 1) {
      this.builder.box("paper", { w: 0.015, h: 0.9, d: 0.02 }, 48, 2.2, -53.9 + i * 0.7, {});
    }
    this.builder.box("paper", { w: 0.015, h: 0.02, d: 6.2 }, 48, 2.2, -50.8, {});

    // Court sign on the rear wall of the laboratory wing.
    this.builder.box("woodDark", { w: 4.2, h: 1.2, d: 0.08 }, 36, 2.3, -43.53, {});
    this.sign("signCourts", 4.0, 1.0, 36, 2.3, -43.58, Math.PI);
  }

  private isClearForTree(x: number, z: number): boolean {
    if (x * x + z * z > 52 * 52) return false;
    for (const zone of this.treeExclusions) {
      if (x > zone.minX - 2 && x < zone.maxX + 2 && z > zone.minZ - 2 && z < zone.maxZ + 2) return false;
    }
    if (Math.abs(x) < 5 && z > 12 && z < 54) return false;
    if (Math.hypot(x - 0, z - 42) < 6) return false;
    if (Math.hypot(x - this.npcPosition.x, z - this.npcPosition.z) < 5) return false;
    if (Math.abs(x) < 17 && z > -10 && z < 18) return false; // plaza
    if (Math.abs(x - 37) / 19 < 1 && Math.abs(z - 36) / 15 < 1) return false;
    if (x > -48 && x < -29 && z > 19 && z < 34) return false; // kitchen garden and house row approach
    for (const collider of this.colliders) {
      if (
        x > collider.minX - 2.4 &&
        x < collider.maxX + 2.4 &&
        z > collider.minZ - 2.4 &&
        z < collider.maxZ + 2.4
      ) {
        return false;
      }
    }
    for (const path of this.paths) {
      if (distanceToSegment(x, z, path.x1, path.z1, path.x2, path.z2) < path.width / 2 + 2) return false;
    }
    return true;
  }

  private addTree(x: number, z: number, scale: number, seed: number): void {
    const rand = seededRandom(seed);
    const height = (4.4 + rand() * 2.4) * scale;
    const trunkHeight = height * 0.58;
    this.builder.cylinder("bark", 0.16 * scale, 0.3 * scale, trunkHeight, 6, x, trunkHeight / 2, z, {});
    const canopyY = trunkHeight + 0.6 * scale;
    const colors = ["foliageA", "foliageB", "foliageC"];
    const clusters = 3 + Math.floor(rand() * 2);
    for (let i = 0; i < clusters; i += 1) {
      const radius = (1.5 + rand() * 0.9) * scale;
      const ox = (rand() - 0.5) * 2.4 * scale;
      const oz = (rand() - 0.5) * 2.4 * scale;
      const oy = rand() * 1.6 * scale;
      this.builder.add(
        colors[i % colors.length],
        new THREE.IcosahedronGeometry(radius, 1),
        x + ox,
        canopyY + oy,
        z + oz,
        { scale: { x: 1, y: 0.82, z: 1 } },
      );
    }
    this.collider(x - 0.35, x + 0.35, z - 0.35, z + 0.35, "tree");
  }

  private addBench(x: number, z: number, rotY: number): void {
    const group = new THREE.Group();
    group.position.set(x, 0, z);
    group.rotation.y = rotY;
    this.group.add(group);
    const wood = this.materials.woodLight as THREE.MeshStandardMaterial;
    const metal = this.materials.metal as THREE.MeshStandardMaterial;
    for (let i = 0; i < 3; i += 1) {
      const slat = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.07, 0.16), wood);
      slat.position.set(0, 0.46, -0.18 + i * 0.18);
      slat.castShadow = true;
      group.add(slat);
    }
    const back = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.4, 0.07), wood);
    back.position.set(0, 0.78, -0.28);
    back.rotation.x = -0.12;
    back.castShadow = true;
    group.add(back);
    [-0.75, 0.75].forEach((legX) => {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.45, 0.5), metal);
      leg.position.set(legX, 0.22, 0);
      leg.castShadow = true;
      group.add(leg);
    });
  }

  private addLamp(x: number, z: number): void {
    this.builder.cylinder("metal", 0.07, 0.11, 3.6, 8, x, 1.8, z, {});
    this.builder.box("metal", { w: 0.5, h: 0.12, d: 0.12 }, x + 0.2, 3.6, z, {});
    this.builder.add("lampGlow", new THREE.SphereGeometry(0.2, 10, 8), x + 0.42, 3.52, z);
    this.builder.box("metal", { w: 0.62, h: 0.1, d: 0.62 }, x + 0.42, 3.72, z, {});
    this.collider(x - 0.2, x + 0.2, z - 0.2, z + 0.2, "lamp");
  }

  /**
   * Deliberately restrained regional dressing: bamboo at the edges and low
   * hills beyond the wall. It suggests the Manipur setting without claiming to
   * reproduce the real school's landscape or exact building positions.
   */
  private buildRegionalLandscape(): void {
    const hills: Array<[number, number, number, number]> = [
      [-78, -92, 1.25, 1.4],
      [18, -110, 1.7, 1.15],
      [108, -82, 1.35, 1.25],
    ];
    for (const [x, z, scale, height] of hills) {
      this.builder.add(
        "hill",
        new THREE.IcosahedronGeometry(1, 2),
        x,
        -18,
        z,
        { scale: { x: 62 * scale, y: 30 * height, z: 42 * scale } },
      );
    }

    const clusters: Array<[number, number, number]> = [
      [-50, -8, 1.0],
      [51, 6, 0.92],
      [-50, 20, 1.08],
    ];
    for (const [cx, cz, scale] of clusters) {
      for (let index = 0; index < 7; index += 1) {
        const angle = (index / 7) * Math.PI * 2;
        const radius = 0.8 + (index % 3) * 0.35;
        const x = cx + Math.cos(angle) * radius;
        const z = cz + Math.sin(angle) * radius;
        const height = (6.2 + (index % 4) * 0.9) * scale;
        this.builder.cylinder("bamboo", 0.055, 0.09, height, 5, x, height / 2, z, {});
        this.builder.add(
          "foliageB",
          new THREE.IcosahedronGeometry(0.42, 0),
          x + Math.cos(angle) * 0.35,
          height - 0.5,
          z + Math.sin(angle) * 0.35,
          { scale: { x: 1.1, y: 0.7, z: 1.1 } },
        );
      }
    }
  }

  private buildGardensAndTrees(): void {
    // Interiors are open volumes now, so keep the scattered trees out of every
    // building footprint rather than only away from its exterior colliders.
    this.treeExclusions.push(
      { minX: -45, maxX: -15, minZ: -14, maxZ: 12 },
      { minX: 23, maxX: 45, minZ: -30, maxZ: -13 },
      { minX: 43, maxX: 55, minZ: -29, maxZ: -10 },
      { minX: 7, maxX: 19, minZ: 39, maxZ: 48 },
      { minX: -14.5, maxX: 18.5, minZ: -45, maxZ: -31 },
      { minX: -45.5, maxX: -26.5, minZ: -38, maxZ: -22 },
      { minX: 28, maxX: 44, minZ: -44, maxZ: -32 },
      { minX: 15.5, maxX: 44.5, minZ: -6.5, maxZ: 22.5 },
      { minX: -13, maxX: -8, minZ: 42.5, maxZ: 46.5 },
      { minX: -49, maxX: -16, minZ: 34, maxZ: 42 },
      { minX: 18, maxX: 26, minZ: -44, maxZ: -36 },
      { minX: 45, maxX: 51, minZ: 14, maxZ: 18 },
    );
    const rand = seededRandom(2024);
    const spots: Array<{ x: number; z: number; scale: number }> = [];
    let attempts = 0;
    while (spots.length < 34 && attempts < 420) {
      attempts += 1;
      const x = -51 + rand() * 102;
      const z = -51 + rand() * 102;
      if (!this.isClearForTree(x, z)) continue;
      if (spots.some((spot) => Math.hypot(spot.x - x, spot.z - z) < 5.4)) continue;
      spots.push({ x, z, scale: 0.82 + rand() * 0.55 });
    }
    // Hand-placed trees frame the campus even if the scatter was unlucky.
    [
      [-49, 44, 1.05],
      [-47, 33, 0.95],
      [-18, 27, 1.0],
      [20, 27, 0.9],
      [-8, 30, 0.85],
      [9, 27, 0.95],
      [-48, -15, 1.0],
      [-20, -24, 0.95],
      [16, -20, 0.9],
      [46, -20, 1.0],
      [47, 6, 0.95],
    ].forEach(([x, z, scale]) => {
      if (!spots.some((spot) => Math.hypot(spot.x - x, spot.z - z) < 4.2)) spots.push({ x, z, scale });
    });

    spots.forEach((spot, index) => this.addTree(spot.x, spot.z, spot.scale, 3000 + index));

    // Flower beds.
    const beds: Array<[number, number, number, number]> = [
      [-12.7, 14.6, 4.5, 1.4],
      [12.7, 14.6, 4.5, 1.4],
      [-12.7, -7.2, 4.5, 1.4],
      [12.7, -7.2, 4.5, 1.4],
      [-18, 4.2, 2.6, 1.2],
      [19, 3.2, 2.6, 1.2],
    ];
    beds.forEach(([x, z, w, d], bedIndex) => {
      this.builder.box("woodDark", { w, h: 0.28, d, }, x, 0.14, z, {});
      const count = 12;
      for (let i = 0; i < count; i += 1) {
        const bx = x - w / 2 + 0.4 + rand() * (w - 0.8);
        const bz = z - d / 2 + 0.3 + rand() * (d - 0.6);
        const key = (i + bedIndex) % 3 === 0 ? "blossomRed" : (i + bedIndex) % 3 === 1 ? "blossomYellow" : "blossomWhite";
        this.builder.add(key, new THREE.IcosahedronGeometry(0.12, 0), bx, 0.42 + rand() * 0.12, bz);
        this.builder.cylinder("hedge", 0.03, 0.03, 0.22, 4, bx, 0.3, bz);
      }
    });

    // A few hedge runs and rocks.
    this.builder.box("hedge", { w: 0.9, h: 0.7, d: 9 }, -44.4, 0.35, 0, {});
    this.builder.box("hedge", { w: 0.9, h: 0.7, d: 9 }, 44.4, 0.35, 30, {});
    for (let i = 0; i < 14; i += 1) {
      const x = -50 + rand() * 100;
      const z = -50 + rand() * 100;
      if (!this.isClearForTree(x, z)) continue;
      this.builder.add("plinth", new THREE.IcosahedronGeometry(0.3 + rand() * 0.35, 0), x, 0.18, z, {
        scale: { x: 1.3, y: 0.7, z: 1 },
        rotY: rand() * Math.PI,
      });
    }
  }

  private buildStreetProps(): void {
    [-14, 14].forEach((x) => {
      this.addLamp(x, 16.6);
      this.addLamp(x, -6.5);
    });
    this.addLamp(-5, 26);
    this.addLamp(5, 26);
    this.addLamp(4, -18);
    this.addLamp(-4, -18);
    this.addLamp(24, 26);
    this.addBench(-12.4, 13.2, -0.35);
    this.addBench(12.4, 13.2, 0.35);
    this.addBench(4, 22, Math.PI);
    this.addBench(-4, 22, Math.PI);

    // Low steps at the assembly stage.
    for (let i = 0; i < 2; i += 1) {
      this.builder.box("stageStone", { w: 5, h: 0.16, d: 0.7 }, 0, 0.08 + i * 0.16, -3.7 - i * 0.5, {});
    }
  }

  private buildNpc(): void {
    const rig = createCharacter({
      uniform: getHouse("nilgiri")?.color ?? "#16A34A",
      skin: "#a8734c",
      senior: true,
    });
    rig.group.position.copy(this.npcPosition);
    rig.group.rotation.y = 0.25;
    this.group.add(rig.group);
    this.npc = rig;
    this.npcBaseY = rig.group.position.y;

    const tagTexture = nameTagTexture("Meera", "Senior · Nilgiri House");
    this.disposables.push(tagTexture);
    const tagMaterial = new THREE.SpriteMaterial({
      map: tagTexture,
      transparent: true,
      depthTest: false,
      depthWrite: false,
    });
    this.disposables.push(tagMaterial);
    const tag = new THREE.Sprite(tagMaterial);
    tag.position.set(this.npcPosition.x, 2.25, this.npcPosition.z);
    tag.scale.set(1.5, 0.47, 1);
    tag.renderOrder = 10;
    this.group.add(tag);
    this.npcNameTag = tag;
  }

  private createDoor(options: {
    hinge: THREE.Vector3;
    width: number;
    height: number;
    openAngle: number;
    label: string;
    opening: string;
    closing: string;
    baseRotationY?: number;
  }): Door {
    const door = new Door(
      options.openAngle,
      options.label,
      options.opening,
      options.closing,
      options.baseRotationY ?? 0,
    );
    door.group.position.copy(options.hinge);
    door.group.rotation.y = options.baseRotationY ?? 0;
    const leafMaterial = this.materials.wood as THREE.MeshStandardMaterial;
    const panelMaterial = this.materials.woodDark as THREE.MeshStandardMaterial;
    const leaf = new THREE.Mesh(new THREE.BoxGeometry(0.1, options.height, options.width), leafMaterial);
    leaf.position.set(0, options.height / 2, options.width / 2);
    leaf.castShadow = true;
    leaf.receiveShadow = true;
    door.group.add(leaf);
    [-0.5, 0.5].forEach((offset) => {
      const panel = new THREE.Mesh(
        new THREE.BoxGeometry(0.04, options.height * 0.28, options.width * 0.72),
        panelMaterial,
      );
      panel.position.set(0.06, options.height / 2 + offset, options.width / 2);
      door.group.add(panel);
    });
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.055, 10, 8), this.materials.brass);
    knob.position.set(0.09, options.height * 0.48, options.width - 0.22);
    door.group.add(knob);
    this.group.add(door.group);
    this.doors.push(door);
    return door;
  }

  private createMarker(): void {
    const group = new THREE.Group();
    const ringMaterial = new THREE.MeshBasicMaterial({
      color: "#f0c276",
      transparent: true,
      opacity: 0.75,
      side: THREE.DoubleSide,
      depthWrite: false,
      fog: false,
    });
    const beamMaterial = new THREE.MeshBasicMaterial({
      color: "#f5d59a",
      transparent: true,
      opacity: 0.18,
      depthWrite: false,
      side: THREE.DoubleSide,
      fog: false,
    });
    this.markerMaterials.push(ringMaterial);

    const ring = new THREE.Mesh(new THREE.RingGeometry(0.85, 1.1, 40), ringMaterial);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = START_MARKER_Y;
    group.add(ring);

    const inner = new THREE.Mesh(new THREE.RingGeometry(0.18, 0.26, 28), ringMaterial);
    inner.rotation.x = -Math.PI / 2;
    inner.position.y = START_MARKER_Y + 0.01;
    group.add(inner);

    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 3.2, 24, 1, true), beamMaterial);
    beam.position.y = 1.65;
    group.add(beam);

    group.visible = false;
    group.name = "objective-marker";
    this.group.add(group);
    this.marker = group;
  }

  private buildInteractables(): void {
    const hostelDoor = this.doors.find((door) => door.label === "hostel");
    if (hostelDoor) {
      this.interactables.push({
        id: "hostel-door",
        kind: "door",
        label: "Hostel room",
        position: new THREE.Vector3(15.1, 0, 9.1),
        radius: 2.6,
        door: hostelDoor,
      });
    }
    this.interactables.push({
      id: "notice-board",
      kind: "notice",
      label: "Notice board",
      position: new THREE.Vector3(9.9, 0, 20),
      radius: 3.1,
    });
    this.interactables.push({
      id: "meera",
      kind: "npc",
      label: "Meera",
      position: this.npcPosition.clone(),
      radius: 3.4,
    });
  }

  private finalize(): void {
    this.builder.build(this.group);
    this.group.traverse((object) => {
      if (object instanceof THREE.Mesh && object.name.startsWith("batch-")) {
        object.frustumCulled = true;
      }
    });
  }

  // ------------------------------------------------------------------ update

  setQuality(quality: "low" | "medium" | "high"): void {
    const size = quality === "high" ? 2048 : quality === "medium" ? 1024 : 512;
    if (this.sun.shadow.mapSize.x !== size) {
      this.sun.shadow.mapSize.set(size, size);
      if (this.sun.shadow.map) {
        this.sun.shadow.map.dispose();
        this.sun.shadow.map = null;
      }
    }
    this.sun.castShadow = quality !== "low";
    for (const light of this.pointLights) light.visible = quality !== "low";
  }

  setCharacter(uniform: string, skin: string): void {
    // NPC keeps its own identity; only point lights are updated by quality.
    void uniform;
    void skin;
  }

  setHouse(houseId: HouseId): void {
    if (!this.houseHostels[houseId]) return;
    this.activeHouseId = houseId;
    const material = this.houseFlagMaterials[houseId];
    if (this.flag && material) this.flag.material = material;
    if (this.night) this.showRoommate(houseId);
  }

  setNight(night: boolean): void {
    this.night = night;
    this.nightGroup.visible = night;
    if (this.sunGlow) this.sunGlow.visible = !night;

    const uniforms = this.skyMaterial?.uniforms;
    if (uniforms) {
      (uniforms.topColor.value as THREE.Color).set(night ? "#050a16" : "#3f5d80");
      (uniforms.midColor.value as THREE.Color).set(night ? "#111b2d" : "#a8a184");
      (uniforms.bottomColor.value as THREE.Color).set(night ? "#26324a" : "#f0cc9a");
      (uniforms.sunDirection.value as THREE.Vector3)
        .set(night ? 0.35 : -0.55, night ? 0.55 : 0.32, night ? -0.75 : 0.55)
        .normalize();
    }

    if (this.sun) {
      this.sun.color.set(night ? 0xa9c5ff : 0xffd9a3);
      this.sun.intensity = night ? 0.72 : 3.1;
      this.sun.position.set(night ? 38 : -48, night ? 56 : 42, night ? -28 : 46);
    }
    if (this.hemisphere) {
      this.hemisphere.color.set(night ? 0x26334f : 0xd6dde9);
      this.hemisphere.groundColor.set(night ? 0x141820 : 0x5c5642);
      this.hemisphere.intensity = night ? 0.3 : 0.75;
    }
    if (this.ambient) {
      this.ambient.color.set(night ? 0x9db4e6 : 0xffe8c8);
      this.ambient.intensity = night ? 0.17 : 0.22;
    }
    if (this.fill) this.fill.intensity = night ? 0.12 : 0.35;

    const glassWarm = this.materials.glassWarm as THREE.MeshStandardMaterial | undefined;
    if (glassWarm) glassWarm.emissiveIntensity = night ? 1.8 : 0.55;
    const glass = this.materials.glass as THREE.MeshStandardMaterial | undefined;
    if (glass) glass.emissiveIntensity = night ? 0.12 : 0.5;
    for (const light of this.houseLights) light.visible = night;

    this.setGardenInteractablesActive(night);
    if (night) {
      this.showRoommate(this.activeHouseId);
    } else {
      this.hideRoommate();
    }
  }

  setGardenInteractablesActive(active: boolean): void {
    for (const plot of this.gardenPlots) plot.active = active;
  }

  setGardenPlotVerb(verb: string | null): void {
    for (const plot of this.gardenPlots) plot.verb = verb ?? undefined;
  }

  isInsideGarden(position: THREE.Vector3): boolean {
    return Math.hypot(position.x - this.gardenCenter.x, position.z - this.gardenCenter.z) < this.gardenRadius;
  }

  isInsideHouseHostel(houseId: HouseId, position: THREE.Vector3): boolean {
    const info = this.houseHostels[houseId];
    if (!info) return false;
    const inset = 0.35;
    return (
      position.x > info.zone.minX + inset &&
      position.x < info.zone.maxX - inset &&
      position.z > info.zone.minZ + inset &&
      position.z < info.zone.maxZ - inset
    );
  }

  /** Read-only diagnostic snapshot used by the development test hooks. */
  inspect() {
    return {
      nightGroup: this.nightGroup.visible,
      stars: this.stars?.visible ?? false,
      moon: this.moon?.visible ?? false,
      houseLights: this.houseLights.map((light) => light.visible),
      patrols: this.patrols.map((patrol) => ({
        x: Number(patrol.rig.group.position.x.toFixed(2)),
        z: Number(patrol.rig.group.position.z.toFixed(2)),
        facing: Number(patrol.facing.toFixed(2)),
        routePoints: patrol.route.length,
      })),
      gardenPlots: this.gardenPlots.map((plot) => ({
        id: plot.itemId,
        active: plot.active !== false,
        verb: plot.verb ?? "Search",
      })),
      roommate: this.roommate?.group.visible ?? false,
      roommateActive: this.roommateInteractable?.active ?? false,
      houseNpcs: this.houseNpcs.map((npc) => ({
        id: npc.id,
        visible: npc.rig.group.visible,
        tag: npc.tag.visible,
      })),
      activeHouseId: this.activeHouseId,
      marker: this.marker.visible,
      detection: { ...this.patrolDetection },
      hideZones: this.hideZones.map((zone) => ({ ...zone })),
      garden: { x: this.gardenCenter.x, z: this.gardenCenter.z, radius: this.gardenRadius },
    };
  }

  isHidden(position: THREE.Vector3, crouching: boolean): boolean {
    if (!crouching) return false;
    return this.hideZones.some(
      (zone) =>
        position.x > zone.minX &&
        position.x < zone.maxX &&
        position.z > zone.minZ &&
        position.z < zone.maxZ,
    );
  }

  showRoommate(houseId: HouseId): void {
    const info = this.houseHostels[houseId];
    const rig = this.roommate;
    if (!info || !rig) return;
    const house = getHouse(houseId);
    if (house) setRigUniform(rig, house.color);
    rig.group.position.set(info.roommatePoint.x, 0, info.roommatePoint.z);
    rig.group.rotation.y = Math.PI;
    rig.group.visible = true;
    if (this.roommateTag) {
      this.roommateTag.position.set(info.roommatePoint.x, 2.22, info.roommatePoint.z);
      this.roommateTag.visible = true;
    }
    if (this.roommateInteractable) {
      this.roommateInteractable.position.set(info.roommatePoint.x, 0, info.roommatePoint.z);
      this.roommateInteractable.active = true;
    }
  }

  hideRoommate(): void {
    if (this.roommate) this.roommate.group.visible = false;
    if (this.roommateTag) this.roommateTag.visible = false;
    if (this.roommateInteractable) this.roommateInteractable.active = false;
  }

  showMarkerAt(point: THREE.Vector3 | null): void {
    if (!point) {
      this.marker.visible = false;
      return;
    }
    this.marker.position.set(point.x, 0, point.z);
    this.marker.visible = true;
  }

  hideMarker(): void {
    this.marker.visible = false;
  }

  private updatePatrols(dt: number, playerPosition: THREE.Vector3, crouching: boolean, noise: number): void {
    const hidden = this.isHidden(playerPosition, crouching);
    let seen = false;
    let nearest = Number.POSITIVE_INFINITY;
    for (const patrol of this.patrols) {
      const target = patrol.route[patrol.nextIndex];
      const dx = target.x - patrol.rig.group.position.x;
      const dz = target.z - patrol.rig.group.position.z;
      const length = Math.hypot(dx, dz);
      if (length < 0.35) {
        patrol.nextIndex = (patrol.nextIndex + 1) % patrol.route.length;
      } else {
        const step = Math.min(length, patrol.speed * dt);
        patrol.rig.group.position.x += (dx / length) * step;
        patrol.rig.group.position.z += (dz / length) * step;
        patrol.facing += shortestAngle(patrol.facing, Math.atan2(dx, dz)) * Math.min(1, dt * 6);
        patrol.rig.group.rotation.y = patrol.facing;
        patrol.cone.position.set(patrol.rig.group.position.x, 0.07, patrol.rig.group.position.z);
        patrol.cone.rotation.y = patrol.facing - Math.PI / 2;
        patrol.tag.position.set(patrol.rig.group.position.x, 2.22, patrol.rig.group.position.z);
        const stride = Math.sin(this.flagTime * 5 + patrol.nextIndex) * 0.22;
        patrol.rig.leftLeg.rotation.x = stride;
        patrol.rig.rightLeg.rotation.x = -stride;
        patrol.rig.leftArm.rotation.x = -stride * 0.7;
        patrol.rig.rightArm.rotation.x = stride * 0.7;
      }

      const toX = playerPosition.x - patrol.rig.group.position.x;
      const toZ = playerPosition.z - patrol.rig.group.position.z;
      const distance = Math.hypot(toX, toZ);
      const range = 7.2 * (crouching ? 0.58 : 1) + Math.max(0, noise) * 2.4;
      const forwardX = Math.sin(patrol.facing);
      const forwardZ = Math.cos(patrol.facing);
      const dot = (toX / Math.max(0.001, distance)) * forwardX + (toZ / Math.max(0.001, distance)) * forwardZ;
      const spotted = !hidden && distance < range && dot > 0.28;
      if (spotted) {
        seen = true;
        nearest = Math.min(nearest, distance);
      }
      patrol.coneMaterial.color.set(spotted ? "#d66b4e" : "#e5c27e");
      patrol.coneMaterial.opacity = spotted ? 0.22 : 0.13;
    }
    this.patrolDetection = { seen, hidden, distance: nearest };
  }

  update(dt: number, elapsed: number, playerPosition: THREE.Vector3, crouching = false, noise = 0): void {
    for (const door of this.doors) door.update(dt);

    if (this.flag && this.flagBase) {
      this.flagTime += dt;
      const position = this.flag.geometry.attributes.position as THREE.BufferAttribute;
      const array = position.array as Float32Array;
      for (let i = 0; i < position.count; i += 1) {
        const x = this.flagBase[i * 3];
        const y = this.flagBase[i * 3 + 1];
        const t = (x + 1.65) / 3.3;
        array[i * 3 + 2] = Math.sin(this.flagTime * 2.2 - t * 4.5) * 0.22 * t + Math.sin(y * 2 + this.flagTime) * 0.04;
      }
      position.needsUpdate = true;
      this.flag.geometry.computeVertexNormals();
    }

    if (this.npc) {
      this.npc.group.position.y = this.npcBaseY + Math.sin(elapsed * 1.5) * 0.012;
      this.npc.torso.rotation.z = Math.sin(elapsed * 0.8) * 0.012;
      const toPlayer = Math.atan2(
        playerPosition.x - this.npc.group.position.x,
        playerPosition.z - this.npc.group.position.z,
      );
      const distanceToPlayer = Math.hypot(
        playerPosition.x - this.npc.group.position.x,
        playerPosition.z - this.npc.group.position.z,
      );
      if (distanceToPlayer < 9) {
        this.npc.group.rotation.y += shortestAngle(this.npc.group.rotation.y, toPlayer) * Math.min(1, dt * 3.5);
        this.npc.head.rotation.y = Math.sin(elapsed * 0.45) * 0.06;
      } else {
        this.npc.head.rotation.y = Math.sin(elapsed * 0.45) * 0.18;
      }
      this.npc.leftArm.rotation.x = Math.sin(elapsed * 0.7) * 0.045;
      this.npc.rightArm.rotation.x = -0.05 + Math.sin(elapsed * 0.7 + 1) * 0.04;
      if (this.npcNameTag) {
        const distance = this.npcNameTag.position.distanceTo(playerPosition);
        const material = this.npcNameTag.material as THREE.SpriteMaterial;
        material.opacity = THREE.MathUtils.clamp(1 - (distance - 10) / 18, 0, 1);
      }
    }

    this.houseNpcs.forEach((npc, index) => {
      npc.rig.group.position.y = npc.baseY + Math.sin(elapsed * 1.3 + index * 1.7) * 0.008;
      npc.rig.torso.rotation.z = Math.sin(elapsed * 0.7 + index) * 0.01;
      npc.rig.group.rotation.y = npc.baseRotation;
    });
    if (this.roommate?.group.visible) {
      this.roommate.group.position.y = Math.sin(elapsed * 1.4) * 0.008;
      this.roommate.torso.rotation.z = Math.sin(elapsed * 0.8) * 0.012;
    }

    if (this.night) this.updatePatrols(dt, playerPosition, crouching, noise);

    if (this.marker.visible) {
      this.marker.rotation.y += dt * 0.6;
      this.marker.position.y = Math.sin(elapsed * 1.6) * 0.04;
      for (const material of this.markerMaterials) {
        material.opacity = 0.55 + Math.sin(elapsed * 2.2) * 0.16;
      }
    }
  }

  showMarker(stepId: string | null, done: boolean): void {
    if (!stepId || done) {
      this.marker.visible = false;
      return;
    }
    const point =
      stepId === "hostel"
        ? this.houseHostels[this.activeHouseId]?.markerPoint
        : OBJECTIVE_POINTS[stepId];
    if (!point) {
      this.marker.visible = false;
      return;
    }
    this.marker.position.set(point.x, 0, point.z);
    this.marker.visible = true;
  }

  dispose(): void {
    this.group.traverse((object) => {
      if (object instanceof THREE.Mesh || object instanceof THREE.Sprite) {
        const geometry = (object as THREE.Mesh).geometry;
        if (geometry) geometry.dispose();
      }
    });
    for (const disposable of this.disposables) disposable.dispose();
    this.disposables = [];
  }
}

function distanceToSegment(
  px: number,
  pz: number,
  x1: number,
  z1: number,
  x2: number,
  z2: number,
): number {
  const dx = x2 - x1;
  const dz = z2 - z1;
  const lengthSq = dx * dx + dz * dz;
  if (lengthSq === 0) return Math.hypot(px - x1, pz - z1);
  let t = ((px - x1) * dx + (pz - z1) * dz) / lengthSq;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x1 + t * dx), pz - (z1 + t * dz));
}
