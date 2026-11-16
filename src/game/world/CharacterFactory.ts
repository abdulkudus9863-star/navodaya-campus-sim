import * as THREE from "three";
import type {
  BackpackStyle,
  BodyBuild,
  BrowStyle,
  CharacterSettings,
  EyeColor,
  FaceShape,
  GlassesStyle,
  HairColor,
  HairStyle,
  WatchStyle,
} from "../core/types";

export interface CharacterRig {
  group: THREE.Group;
  torso: THREE.Group;
  head: THREE.Group;
  hair: THREE.Mesh;
  leftArm: THREE.Group;
  rightArm: THREE.Group;
  leftLeg: THREE.Group;
  rightLeg: THREE.Group;
  /** House-coloured chest badge; kept under the original name for compatibility. */
  vest: THREE.Mesh;
  sleeveMaterial: THREE.MeshStandardMaterial;
  skinMaterial: THREE.MeshStandardMaterial;
  parts: {
    skull: THREE.Mesh;
    hairGroups: Record<HairStyle, THREE.Group>;
    glassesRound: THREE.Group;
    glassesRect: THREE.Group;
    watch: THREE.Group;
    backpack: THREE.Group;
    brows: THREE.Mesh[];
    eyeMaterials: THREE.MeshStandardMaterial[];
    skinMaterials: THREE.MeshStandardMaterial[];
    badgeMaterial: THREE.MeshStandardMaterial;
    shirtMaterial: THREE.MeshStandardMaterial;
    trouserMaterial: THREE.MeshStandardMaterial;
    shoeMaterial: THREE.MeshStandardMaterial;
    hairMaterials: THREE.MeshStandardMaterial[];
    tie: THREE.Group;
    torsoShell: THREE.Mesh;
    leftLeg: THREE.Group;
    rightLeg: THREE.Group;
  };
  current: CharacterOptions;
}

export interface CharacterOptions {
  uniform: string;
  skin: string;
  /** High is used for the player and creator preview; low for NPCs/remotes. */
  detail?: "high" | "low";
  senior?: boolean;
  face?: FaceShape;
  hairStyle?: HairStyle;
  hairColor?: HairColor;
  eyeColor?: EyeColor;
  brows?: BrowStyle;
  build?: BodyBuild;
  glasses?: GlassesStyle;
  watch?: WatchStyle;
  backpack?: BackpackStyle;
}

const SHIRT = "#ece8dc";
const TROUSER = "#202a42";
const TIE = "#1b2740";
const SHOE = "#161513";
const SOCK = "#22242a";
const BRASS = "#b39255";

const HAIR_COLORS: Record<HairColor, string> = {
  black: "#171412",
  brown: "#3c291d",
  soft: "#2b2521",
};

const EYE_COLORS: Record<EyeColor, string> = {
  brown: "#5a3a22",
  dark: "#211a15",
  hazel: "#796333",
};

const FACE_SCALE: Record<FaceShape, [number, number, number]> = {
  oval: [0.94, 1.06, 0.96],
  round: [1.0, 0.98, 0.99],
  square: [1.04, 1.0, 1.0],
};

const BUILD_SCALE: Record<BodyBuild, { width: number; shoulder: number; leg: number }> = {
  slim: { width: 0.92, shoulder: 0.25, leg: 0.108 },
  regular: { width: 1, shoulder: 0.27, leg: 0.115 },
  broad: { width: 1.1, shoulder: 0.295, leg: 0.123 },
};

const BROW_TRANSFORM: Record<BrowStyle, { scale: number; tilt: number }> = {
  straight: { scale: 1, tilt: 0 },
  soft: { scale: 0.9, tilt: 0.08 },
  bold: { scale: 1.2, tilt: 0.02 },
};

function standard(color: string, roughness: number, metalness = 0): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness });
}

function shadowed<T extends THREE.Mesh>(mesh: T): T {
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function normalizeOptions(options: CharacterOptions): Required<CharacterOptions> {
  return {
    uniform: options.uniform,
    skin: options.skin,
    detail: options.detail ?? "low",
    senior: options.senior ?? false,
    face: options.face ?? "oval",
    hairStyle: options.hairStyle ?? (options.senior ? "braid" : "short"),
    hairColor: options.hairColor ?? "black",
    eyeColor: options.eyeColor ?? "brown",
    brows: options.brows ?? "straight",
    build: options.build ?? "regular",
    glasses: options.glasses ?? "none",
    watch: options.watch ?? "none",
    backpack: options.backpack ?? "none",
  };
}

function hairCap(material: THREE.Material): THREE.Mesh {
  const cap = shadowed(new THREE.Mesh(new THREE.SphereGeometry(0.152, 18, 12), material));
  cap.position.set(0, 0.058, -0.012);
  cap.scale.set(0.99, 0.84, 1.02);
  return cap;
}

function makeHairVariants(material: THREE.MeshStandardMaterial): {
  groups: Record<HairStyle, THREE.Group>;
  primary: THREE.Mesh;
} {
  const makeGroup = () => {
    const group = new THREE.Group();
    group.add(hairCap(material));
    return group;
  };

  const short = makeGroup();
  const side = makeGroup();
  const fringe = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.05, 0.06), material);
  fringe.position.set(0.055, 0.055, 0.122);
  fringe.rotation.z = -0.18;
  side.add(fringe);

  const curly = makeGroup();
  for (const [x, y, z, radius] of [
    [-0.11, 0.1, 0.06, 0.048],
    [0.02, 0.14, 0.06, 0.052],
    [0.11, 0.1, 0.04, 0.045],
    [-0.08, 0.13, -0.07, 0.05],
    [0.07, 0.13, -0.08, 0.047],
    [0, 0.11, -0.12, 0.05],
  ] as const) {
    const curl = shadowed(new THREE.Mesh(new THREE.SphereGeometry(radius, 10, 8), material));
    curl.position.set(x, y, z);
    curly.add(curl);
  }

  const bun = makeGroup();
  const bunMesh = shadowed(new THREE.Mesh(new THREE.SphereGeometry(0.068, 12, 10), material));
  bunMesh.position.set(0, 0.02, -0.145);
  bunMesh.scale.set(1, 0.9, 0.9);
  bun.add(bunMesh);

  const braid = makeGroup();
  const plait = shadowed(new THREE.Mesh(new THREE.CapsuleGeometry(0.045, 0.24, 4, 8), material));
  plait.position.set(0, -0.14, -0.12);
  braid.add(plait);
  const tie = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.035, 0.025), standard("#6b3b2d", 0.8));
  tie.position.set(0, -0.26, -0.12);
  braid.add(tie);

  return {
    groups: { short, side, curly, bun, braid },
    primary: short.children[0] as THREE.Mesh,
  };
}

function makeGlasses(kind: GlassesStyle): THREE.Group | null {
  if (kind === "none") return null;
  const group = new THREE.Group();
  const frame = standard("#2a2620", 0.35, 0.4);
  const round = kind === "round";
  for (const x of [-0.054, 0.054]) {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(round ? 0.034 : 0.03, 0.0055, 6, 16),
      frame,
    );
    ring.position.set(x, 0.018, 0.148);
    ring.scale.y = round ? 1 : 0.78;
    group.add(ring);
  }
  const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.008, 0.008), frame);
  bridge.position.set(0, 0.022, 0.148);
  group.add(bridge);
  for (const side of [-1, 1]) {
    const temple = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.006, 0.12), frame);
    temple.position.set(side * 0.09, 0.022, 0.09);
    temple.rotation.y = side * 0.18;
    group.add(temple);
  }
  return group;
}

/** Builds a lightweight semi-realistic student out of reusable modular parts. */
export function createCharacter(options: CharacterOptions): CharacterRig {
  const normalized = normalizeOptions(options);
  const highDetail = normalized.detail === "high";
  const group = new THREE.Group();
  const skinMaterial = standard(normalized.skin, 0.7);
  const shirtMaterial = standard(SHIRT, 0.88);
  const trouserMaterial = standard(TROUSER, 0.9);
  const shoeMaterial = standard(SHOE, 0.55);
  const sockMaterial = standard(SOCK, 0.85);
  const hairMaterial = standard(HAIR_COLORS[normalized.hairColor], 0.8);
  const badgeMaterial = standard(normalized.uniform, 0.62, 0.15);
  const brassMaterial = standard(BRASS, 0.38, 0.5);
  const eyeMaterial = standard(EYE_COLORS[normalized.eyeColor], 0.32);
  const browMaterial = standard(HAIR_COLORS[normalized.hairColor], 0.85);
  const whiteMaterial = standard("#f8f5eb", 0.4);
  const glassesMaterial = standard("#2a2620", 0.35, 0.35);

  const torso = new THREE.Group();
  torso.position.y = 1.02;
  group.add(torso);

  // White shirt, tapered rather than a rectangular block.
  const torsoShell = shadowed(
    new THREE.Mesh(new THREE.CylinderGeometry(0.225, 0.185, 0.48, 10), shirtMaterial),
  );
  torsoShell.scale.z = 0.62;
  torsoShell.position.y = 0.08;
  torso.add(torsoShell);

  const shoulderYoke = shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.1, 0.22), shirtMaterial));
  shoulderYoke.position.y = 0.3;
  torso.add(shoulderYoke);

  if (highDetail) {
    const collar = new THREE.Group();
    for (const side of [-1, 1]) {
      const flap = shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.06, 0.02), shirtMaterial));
      flap.position.set(side * 0.042, 0.345, 0.12);
      flap.rotation.z = side * 0.42;
      collar.add(flap);
    }
    torso.add(collar);
  }

  const tie = new THREE.Group();
  const tieKnot = shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.045, 0.02), standard(TIE, 0.8)));
  tieKnot.position.set(0, 0.31, 0.145);
  tie.add(tieKnot);
  const tieBlade = shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.3, 0.012), standard(TIE, 0.8)));
  tieBlade.position.set(0, 0.14, 0.15);
  tieBlade.rotation.x = -0.03;
  tie.add(tieBlade);
  // The reference uniform has a subtle striped tie; keep it geometry-cheap.
  if (highDetail) {
    for (const y of [0.23, 0.17, 0.11, 0.05]) {
      const stripe = new THREE.Mesh(
        new THREE.BoxGeometry(0.046, 0.007, 0.003),
        standard("#8a99b5", 0.55),
      );
      stripe.position.set(0, y, 0.157);
      stripe.rotation.z = -0.28;
      tie.add(stripe);
    }
  }
  torso.add(tie);

  // School crest at the left chest and the house badge beside it.
  const crest = shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.052, 0.065, 0.012), standard("#e9dfc8", 0.5)));
  crest.position.set(-0.105, 0.215, 0.14);
  torso.add(crest);
  if (highDetail) {
    const crestInk = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.038, 0.006), brassMaterial);
    crestInk.position.set(-0.105, 0.215, 0.148);
    torso.add(crestInk);
  }

  const vest = shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.072, 0.082, 0.014), badgeMaterial));
  vest.position.set(0.105, 0.215, 0.145);
  torso.add(vest);
  if (highDetail) {
    const badgeInk = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.045, 0.006), whiteMaterial);
    badgeInk.position.set(0.105, 0.215, 0.153);
    torso.add(badgeInk);
  }

  const belt = shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.37, 0.05, 0.22), standard("#1b1a19", 0.7)));
  belt.position.y = -0.165;
  torso.add(belt);
  if (highDetail) {
    const buckle = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.035, 0.012), brassMaterial);
    buckle.position.set(0, -0.165, 0.122);
    torso.add(buckle);
  }

  const backpack = new THREE.Group();
  if (highDetail) {
    const packMaterial = standard(normalized.backpack === "olive" ? "#48553d" : "#283650", 0.85);
    const pack = shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.36, 0.16), packMaterial));
    pack.position.set(0, 0.1, -0.17);
    backpack.add(pack);
    const pocket = shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.16, 0.05), packMaterial));
    pocket.position.set(0, 0.04, -0.265);
    backpack.add(pocket);
    for (const side of [-1, 1]) {
      const strap = shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.34, 0.025), packMaterial));
      strap.position.set(side * 0.11, 0.12, -0.085);
      strap.rotation.x = -0.08;
      backpack.add(strap);
    }
  }
  torso.add(backpack);

  const head = new THREE.Group();
  head.position.y = 1.52;
  group.add(head);
  const neck = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.062, 0.13, 10), skinMaterial));
  neck.position.y = -0.09;
  head.add(neck);

  const skull = shadowed(new THREE.Mesh(new THREE.SphereGeometry(0.145, 20, 16), skinMaterial));
  skull.position.y = 0.02;
  head.add(skull);
  const jaw = shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.075, 0.12), skinMaterial));
  jaw.position.set(0, -0.075, 0.025);
  head.add(jaw);

  if (highDetail) {
    for (const side of [-1, 1]) {
      const ear = shadowed(new THREE.Mesh(new THREE.SphereGeometry(0.028, 8, 8), skinMaterial));
      ear.position.set(side * 0.143, 0.01, 0);
      ear.scale.set(0.6, 1, 0.85);
      head.add(ear);
    }
  }

  const eyeMaterials: THREE.MeshStandardMaterial[] = [];
  const eyes: THREE.Mesh[] = [];
  for (const x of [-0.052, 0.052]) {
    if (highDetail) {
      const white = new THREE.Mesh(new THREE.SphereGeometry(0.022, 10, 8), whiteMaterial);
      white.position.set(x, 0.022, 0.128);
      white.scale.set(1, 0.78, 0.5);
      head.add(white);
    }
    const iris = new THREE.Mesh(new THREE.SphereGeometry(0.0105, 10, 8), eyeMaterial);
    iris.position.set(x, 0.022, 0.144);
    iris.scale.set(1, 1, 0.42);
    head.add(iris);
    eyeMaterials.push(eyeMaterial);
    eyes.push(iris);
    if (highDetail) {
      const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.0048, 8, 6), standard("#100d0b", 0.5));
      pupil.position.set(x, 0.022, 0.148);
      pupil.scale.set(1, 1, 0.4);
      head.add(pupil);
    }
  }

  const brows: THREE.Mesh[] = [];
  if (highDetail) {
    for (const side of [-1, 1]) {
      const brow = shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.048, 0.009, 0.008), browMaterial));
      brow.position.set(side * 0.052, 0.058, 0.143);
      brow.rotation.z = side * 0.08;
      head.add(brow);
      brows.push(brow);
    }
  }

  const nose = shadowed(new THREE.Mesh(new THREE.ConeGeometry(0.022, 0.055, 8), skinMaterial));
  nose.rotation.x = Math.PI / 2;
  nose.position.set(0, -0.018, 0.144);
  head.add(nose);
  const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.009, 0.006), standard("#7a4d42", 0.65));
  mouth.position.set(0, -0.064, 0.142);
  head.add(mouth);

  const hairResult = makeHairVariants(hairMaterial);
  head.add(hairResult.groups.short, hairResult.groups.side, hairResult.groups.curly, hairResult.groups.bun, hairResult.groups.braid);
  const glassesRound = highDetail ? makeGlasses("round") : null;
  const glassesRect = highDetail ? makeGlasses("rect") : null;
  if (glassesRound) head.add(glassesRound);
  if (glassesRect) head.add(glassesRect);

  const makeArm = (side: number): THREE.Group => {
    const arm = new THREE.Group();
    arm.position.set(side * 0.27, 1.32, 0);
    const sleeve = shadowed(new THREE.Mesh(new THREE.CapsuleGeometry(0.072, 0.16, 4, 8), shirtMaterial));
    sleeve.position.y = -0.12;
    arm.add(sleeve);
    const cuff = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.074, 0.066, 0.055, 8), shirtMaterial));
    cuff.position.y = -0.22;
    arm.add(cuff);
    const forearm = shadowed(new THREE.Mesh(new THREE.CapsuleGeometry(0.05, 0.21, 4, 8), skinMaterial));
    forearm.position.y = -0.35;
    arm.add(forearm);
    const hand = shadowed(new THREE.Mesh(new THREE.SphereGeometry(0.058, 10, 8), skinMaterial));
    hand.position.y = -0.49;
    hand.scale.set(0.9, 1.15, 0.78);
    arm.add(hand);
    return arm;
  };

  const makeLeg = (side: number): THREE.Group => {
    const leg = new THREE.Group();
    leg.position.set(side * 0.115, 0.78, 0);
    const thigh = shadowed(new THREE.Mesh(new THREE.CapsuleGeometry(0.092, 0.52, 4, 8), trouserMaterial));
    thigh.position.y = -0.29;
    leg.add(thigh);
    const sock = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.062, 0.058, 0.1, 8), sockMaterial));
    sock.position.set(0, -0.62, 0);
    leg.add(sock);
    const shoe = shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.09, 0.26), shoeMaterial));
    shoe.position.set(0, -0.72, 0.045);
    leg.add(shoe);
    return leg;
  };

  const leftArm = makeArm(1);
  const rightArm = makeArm(-1);
  const leftLeg = makeLeg(1);
  const rightLeg = makeLeg(-1);

  const watch = new THREE.Group();
  if (highDetail) {
    const watchBand = new THREE.Mesh(
      new THREE.CylinderGeometry(0.056, 0.056, 0.035, 12, 1, true),
      standard(normalized.watch === "black" ? "#1b1b1b" : "#6d7379", 0.4, 0.4),
    );
    watchBand.position.y = -0.43;
    watch.add(watchBand);
    const watchFace = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.012, 12), standard("#d7cba9", 0.3, 0.2));
    watchFace.rotation.z = Math.PI / 2;
    watchFace.position.set(0.052, -0.43, 0);
    watch.add(watchFace);
  }
  leftArm.add(watch);

  group.add(leftArm, rightArm, leftLeg, rightLeg);

  const rig: CharacterRig = {
    group,
    torso,
    head,
    hair: hairResult.primary,
    leftArm,
    rightArm,
    leftLeg,
    rightLeg,
    vest,
    sleeveMaterial: shirtMaterial,
    skinMaterial,
    parts: {
      skull,
      hairGroups: hairResult.groups,
      glassesRound: glassesRound ?? new THREE.Group(),
      glassesRect: glassesRect ?? new THREE.Group(),
      watch,
      backpack,
      brows,
      eyeMaterials,
      skinMaterials: [skinMaterial],
      badgeMaterial,
      shirtMaterial,
      trouserMaterial,
      shoeMaterial,
      hairMaterials: [hairMaterial, browMaterial],
      tie,
      torsoShell,
      leftLeg,
      rightLeg,
    },
    current: normalized,
  };

  applyCharacterOptions(rig, normalized);
  return rig;
}

/** Applies live customization without replacing the rig or its animation pivots. */
export function applyCharacterOptions(rig: CharacterRig, raw: CharacterOptions): void {
  const options = normalizeOptions({ ...rig.current, ...raw });
  rig.current = options;

  rig.skinMaterial.color.set(options.skin);
  rig.parts.hairMaterials.forEach((material) => material.color.set(HAIR_COLORS[options.hairColor]));
  rig.parts.eyeMaterials.forEach((material) => material.color.set(EYE_COLORS[options.eyeColor]));
  rig.parts.badgeMaterial.color.set(options.uniform);

  Object.entries(rig.parts.hairGroups).forEach(([style, group]) => {
    group.visible = style === options.hairStyle;
  });
  rig.parts.glassesRound.visible = options.glasses === "round";
  rig.parts.glassesRect.visible = options.glasses === "rect";
  rig.parts.watch.visible = options.watch !== "none";
  const watchBand = rig.parts.watch.children[0] as THREE.Mesh | undefined;
  if (watchBand) {
    const material = watchBand.material as THREE.MeshStandardMaterial;
    material.color.set(options.watch === "black" ? "#1b1b1b" : "#6d7379");
  }
  rig.parts.backpack.visible = options.backpack !== "none";
  const pack = rig.parts.backpack.children[0] as THREE.Mesh | undefined;
  if (pack) {
    const material = pack.material as THREE.MeshStandardMaterial;
    material.color.set(options.backpack === "olive" ? "#48553d" : "#283650");
  }

  const face = FACE_SCALE[options.face];
  rig.parts.skull.scale.set(face[0], face[1], face[2]);
  const build = BUILD_SCALE[options.build];
  rig.parts.torsoShell.scale.x = build.width;
  rig.parts.torsoShell.scale.z = 0.62 * build.width;
  rig.leftArm.position.x = build.shoulder;
  rig.rightArm.position.x = -build.shoulder;
  rig.leftLeg.position.x = build.leg;
  rig.rightLeg.position.x = -build.leg;

  const brow = BROW_TRANSFORM[options.brows];
  rig.parts.brows.forEach((mesh, index) => {
    mesh.scale.set(brow.scale, 1, 1);
    mesh.rotation.z = (index === 0 ? 1 : -1) * (0.08 + brow.tilt);
  });
}

export function setRigUniform(rig: CharacterRig, color: string): void {
  rig.current.uniform = color;
  rig.parts.badgeMaterial.color.set(color);
}

export function setRigSkin(rig: CharacterRig, color: string): void {
  rig.current.skin = color;
  rig.skinMaterial.color.set(color);
}

/** Maps the persisted character schema into renderer options. */
export function characterOptions(
  character: CharacterSettings,
  uniform: string,
  skin: string,
  detail: "high" | "low" = "low",
): CharacterOptions {
  return {
    uniform,
    skin,
    detail,
    face: character.face,
    hairStyle: character.hairStyle,
    hairColor: character.hairColor,
    eyeColor: character.eyeColor,
    brows: character.brows,
    build: character.build,
    glasses: character.glasses,
    watch: character.watch,
    backpack: character.backpack,
  };
}
