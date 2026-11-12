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

export interface BlockCollider {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  active: boolean;
  label: string;
}

export interface WorldInteractable {
  id: string;
  kind: "npc" | "notice" | "door" | "student" | "roommate" | "garden";
  label: string;
  position: THREE.Vector3;
  radius: number;
  active?: boolean;
  door?: Door;
  studentId?: string;
  itemId?: GardenItemId;
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
  readonly occluders: THREE.Box3[] = [];
  readonly interactables: WorldInteractable[] = [];
  readonly doors: Door[] = [];
  readonly paths: PathSegment[] = [];
  readonly zones: Record<"classroom" | "hostel", WorldZone> = {
    classroom: { minX: -30, maxX: -16, minZ: -6, maxZ: 6 },
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
  private houseNpcs: Array<{ rig: CharacterRig; baseY: number; baseRotation: number }> = [];
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
    const light = new THREE.PointLight(0xffd8a4, intensity, 13, 2);
    light.position.set(x, 2.9, z);
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

    await this.stage(0.74, "Serving the dining hall", onProgress);
    this.buildDiningHall();
    this.buildLibrary();

    await this.stage(0.84, "Marking the sports ground", onProgress);
    this.buildSportsGround();

    await this.stage(0.88, "Raising the house hostels", onProgress);
    this.buildHouseHostels();

    await this.stage(0.91, "Planting the kitchen garden", onProgress);
    this.buildNightLife();

    await this.stage(0.94, "Planting gardens", onProgress);
    this.buildGardensAndTrees();
    this.buildStreetProps();
    this.buildNpc();

    await this.stage(0.98, "Finalising lighting", onProgress);
    this.finalize();

    // Colliders need the final geometry; remove camera occluders that would
    // sit inside walkable rooms by construction (we never added those).
    this.buildInteractables();
    await this.stage(1, "Ready", onProgress);
  }

  private collider(minX: number, maxX: number, minZ: number, maxZ: number, label: string): BlockCollider {
    const box: BlockCollider = { minX, maxX, minZ, maxZ, active: true, label };
    this.colliders.push(box);
    return box;
  }

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

    // Guard cabin just inside the gate.
    this.solid("plasterWarm", 4.2, 3.0, 3.4, -10.5, 44.5, "guard-cabin");
    this.builder.box("roof", { w: 5.0, h: 0.25, d: 4.2 }, -10.5, 3.15, 44.5, {});
    this.builder.box("glass", { w: 0.1, h: 1.1, d: 2.2 }, -8.42, 1.75, 44.5, {});
    this.builder.box("wood", { w: 0.95, h: 2.1, d: 0.16 }, -9.3, 1.05, 46.17, {});
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

  private buildAcademicBlock(): void {
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
        this.addHouseNpc(captain.displayName, `${house.shortName} · House captain`, cx + 1.85, 38.2, Math.PI, house.color, true);
      }
      if (prefect) {
        this.addHouseNpc(prefect.displayName, `${house.shortName} · House prefect`, cx + 2.55, 33.15, Math.PI, house.color, false);
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
    this.houseNpcs.push({ rig, baseY: 0, baseRotation: rotationY });

    const tagTexture = nameTagTexture(name, role);
    this.disposables.push(tagTexture);
    const tagMaterial = new THREE.SpriteMaterial({ map: tagTexture, transparent: true, depthTest: false, depthWrite: false });
    this.disposables.push(tagMaterial);
    const tag = new THREE.Sprite(tagMaterial);
    tag.position.set(x, 2.22, z);
    tag.scale.set(1.7, 0.53, 1);
    tag.renderOrder = 10;
    this.group.add(tag);
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
      ["tomato", -41.2, 24.1, "Tomatoes"],
      ["potato", -38, 24.1, "Potatoes"],
      ["carrot", -34.8, 24.1, "Carrots"],
      ["cabbage", -38, 27.2, "Cabbage"],
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
    this.solid("plasterCool", 32, 6.2, 14, 2, -38, "dining-hall");
    this.builder.box("roof", { w: 33.5, h: 0.35, d: 15.5 }, 2, 6.4, -38, {});
    this.builder.box("plinth", { w: 34, h: 0.5, d: 16 }, 2, 6.85, -38, {});
    // Southern veranda.
    this.builder.box("roof", { w: 33, h: 0.24, d: 3.4 }, 2, 3.5, -28.9, {});
    for (let col = 0; col < 7; col += 1) {
      const x = -12.5 + col * 4.8;
      this.builder.cylinder("plasterCool", 0.2, 0.24, 3.4, 8, x, 1.7, -27.8, {});
      this.collider(x - 0.3, x + 0.3, -28.1, -27.5, "dining-column");
    }
    // Wide doors + windows.
    this.builder.box("wood", { w: 4.4, h: 2.9, d: 0.2 }, 2, 1.45, -30.9, {});
    this.builder.box("glassWarm", { w: 3.4, h: 2.2, d: 0.1 }, 2, 1.55, -30.78, {});
    for (let i = 0; i < 5; i += 1) {
      const x = -12.6 + i * 3.6;
      if (Math.abs(x - 2) < 2.6) continue;
      this.builder.box("whitePaint", { w: 2.2, h: 1.9, d: 0.14 }, x, 4.4, -30.9, {});
      this.builder.box("glassWarm", { w: 1.9, h: 1.6, d: 0.1 }, x, 4.4, -30.78, {});
    }
    this.builder.box("stageStone", { w: 6, h: 0.05, d: 2.4 }, 2, 0.025, -29.6, {});
    this.sign("signDining", 5.4, 1.35, 2, 3.7, -30.82, 0);
    this.builder.box("metal", { w: 0.5, h: 0.5, d: 0.5 }, -11, 6.9, -36, {});
  }

  private buildLibrary(): void {
    this.solid("plaster", 18, 7.4, 15, -36, -30, "library");
    this.builder.box("roof", { w: 19.4, h: 0.4, d: 16.4 }, -36, 7.6, -30, {});
    this.builder.box("plinth", { w: 20, h: 0.6, d: 17 }, -36, 8.1, -30, {});
    this.builder.box("plinth", { w: 14, h: 0.28, d: 12 }, -36, 8.5, -30, {});
    // Portico facing east toward the campus.
    this.builder.box("roof", { w: 3.2, h: 0.26, d: 8 }, -26, 3.9, -30, {});
    [-33.4, -26.6].forEach((z) => {
      this.builder.cylinder("plasterCool", 0.24, 0.28, 3.7, 10, -25, 1.85, z, {});
      this.collider(-25.3, -24.7, z - 0.35, z + 0.35, "library-column");
    });
    this.builder.box("wood", { w: 0.2, h: 2.8, d: 2.2 }, -26.9, 1.4, -30, {});
    this.builder.box("glassWarm", { w: 0.12, h: 2.2, d: 1.7 }, -26.97, 1.55, -30, {});
    for (let col = 0; col < 4; col += 1) {
      this.builder.box("whitePaint", { w: 0.14, h: 1.7, d: 1.9 }, -26.85, 5.0, -34.6 + col * 2.8, {});
      this.builder.box("glassWarm", { w: 0.1, h: 1.5, d: 1.65 }, -26.76, 5.0, -34.6 + col * 2.8, {});
    }
    this.sign("signLibrary", 4.8, 1.1, -26.94, 6.3, -30, Math.PI / 2);
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
  }

  private isClearForTree(x: number, z: number): boolean {
    if (x * x + z * z > 52 * 52) return false;
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

  private buildGardensAndTrees(): void {
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
    const rig = createCharacter({ uniform: "#2878DB", skin: "#a8734c", senior: true });
    rig.group.position.copy(this.npcPosition);
    rig.group.rotation.y = 0.25;
    this.group.add(rig.group);
    this.npc = rig;
    this.npcBaseY = rig.group.position.y;

    const tagTexture = nameTagTexture("Meera", "Senior · Ravi House");
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
    const classroomDoor = this.doors.find((door) => door.label === "classroom");
    const hostelDoor = this.doors.find((door) => door.label === "hostel");
    if (classroomDoor) {
      this.interactables.push({
        id: "classroom-door",
        kind: "door",
        label: "Classroom",
        position: new THREE.Vector3(-15.1, 0, 0),
        radius: 2.6,
        door: classroomDoor,
      });
    }
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

  private hideRoommate(): void {
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
