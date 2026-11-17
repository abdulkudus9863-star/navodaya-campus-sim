import * as THREE from "three";
import type { TeacherConfig, TeacherRoutePoint } from "../data/teachers";
import { createCharacter, type CharacterRig } from "../world/CharacterFactory";

export interface TeacherRig extends CharacterRig {
  tag: THREE.Sprite;
  indicator: THREE.Group;
  staffId: string;
}

function standard(color: string, roughness: number, metalness = 0): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness });
}

/**
 * Adult teacher variants built on the same lightweight rig as students. The
 * silhouettes, palettes, faces, accessories and heights differ per teacher;
 * these are not recoloured clones.
 */
export function createTeacherRig(config: TeacherConfig, spawn: TeacherRoutePoint): TeacherRig {
  const rig = createCharacter({
    uniform: config.appearance.accents,
    skin: config.appearance.skin,
    detail: "low",
    face: config.appearance.face ?? "round",
    hairStyle: config.appearance.hairStyle ?? "short",
    hairColor: "black",
    eyeColor: "dark",
    brows: config.personality === "strict" ? "bold" : "straight",
    build: config.appearance.build,
    glasses: config.appearance.glasses ? "round" : "none",
    watch: config.appearance.watch ?? (config.id === "rahul" ? "steel" : "none"),
  });

  rig.group.name = `teacher-${config.id}`;
  rig.group.scale.set(1.04, config.appearance.height, 1.04);
  rig.group.position.set(spawn.x, 0, spawn.z);
  // Teachers are supporting NPCs; keep them out of the shadow pass so three
  // adults never multiply the player/campus shadow draw calls on mobile.
  rig.group.traverse((object) => {
    if (object instanceof THREE.Mesh) {
      object.castShadow = false;
      object.receiveShadow = false;
    }
  });

  // Teaching staff wear their own shirts/trousers; only the accent material is
  // the house badge. Each teacher gets a distinct palette and silhouette.
  rig.parts.shirtMaterial.color.set(config.appearance.shirt);
  rig.parts.trouserMaterial.color.set(config.appearance.trousers);
  rig.parts.badgeMaterial.color.set(config.appearance.accents);
  rig.parts.hairMaterials.forEach((material) => material.color.set(config.appearance.hair));
  const hairStyle = config.appearance.hairStyle ?? "short";
  rig.parts.hairGroups.short.visible = hairStyle === "short";
  rig.parts.hairGroups.side.visible = hairStyle === "side";
  rig.parts.hairGroups.curly.visible = hairStyle === "curly";
  rig.parts.hairGroups.bun.visible = hairStyle === "bun";
  rig.parts.hairGroups.braid.visible = hairStyle === "braid";
  rig.parts.glassesRound.visible = config.appearance.glasses;
  rig.parts.glassesRect.visible = false;

  // Adult neck/torso proportions: the stock shirt collar is a little high for
  // an adult, so the head sits slightly forward with a visible collar.
  rig.head.position.y += 0.025;
  rig.torso.position.y += 0.02;

  const accents = standard(config.appearance.accents, 0.6, 0.1);
  const skin = standard(config.appearance.skin, 0.72);
  const hair = standard(config.appearance.hair, 0.9);

  if (config.appearance.moustache) {
    const moustache = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.018, 0.018), hair);
    moustache.position.set(0, -0.038, 0.151);
    rig.head.add(moustache);
  }
  if (config.appearance.beard) {
    const beard = new THREE.Mesh(new THREE.SphereGeometry(0.105, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.56), hair);
    beard.scale.set(1.02, 0.74, 0.86);
    beard.position.set(0, -0.075, 0.032);
    beard.rotation.x = Math.PI;
    rig.head.add(beard);
  }
  if (config.appearance.lanyard) {
    const cord = new THREE.Mesh(new THREE.TorusGeometry(0.145, 0.006, 4, 18), accents);
    cord.rotation.x = Math.PI / 2;
    cord.position.set(0, 0.21, 0.055);
    cord.scale.set(1, 0.7, 1);
    rig.torso.add(cord);
    const card = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.105, 0.012), standard("#e8e2d3", 0.72));
    card.position.set(0, 0.08, 0.135);
    rig.torso.add(card);
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.014, 0.014), accents);
    stripe.position.set(0, 0.115, 0.144);
    rig.torso.add(stripe);
  }
  if (config.appearance.whistle) {
    const cord = new THREE.Mesh(new THREE.TorusGeometry(0.135, 0.006, 4, 18), standard("#2a2b2c", 0.8));
    cord.rotation.x = Math.PI / 2;
    cord.position.set(0, 0.22, 0.05);
    cord.scale.set(1, 0.72, 1);
    rig.torso.add(cord);
    const whistle = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.03, 0.055, 10), standard("#c9b47a", 0.35, 0.55));
    whistle.rotation.z = Math.PI / 2;
    whistle.position.set(0.03, 0.11, 0.15);
    rig.torso.add(whistle);
    const bead = new THREE.Mesh(new THREE.SphereGeometry(0.014, 8, 6), standard("#2a2b2c", 0.7));
    bead.position.set(-0.025, 0.12, 0.15);
    rig.torso.add(bead);
  }

  if (config.appearance.apron) {
    const apron = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.44, 0.022), standard("#e7e1d3", 0.92));
    apron.position.set(0, -0.03, 0.146);
    rig.torso.add(apron);
    const strap = new THREE.Mesh(new THREE.BoxGeometry(0.033, 0.22, 0.012), standard("#d4cbba", 0.92));
    strap.position.set(0.08, 0.28, 0.13);
    strap.rotation.z = -0.16;
    rig.torso.add(strap);
    const pocket = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.075, 0.012), standard("#cfc6b3", 0.94));
    pocket.position.set(0, -0.08, 0.16);
    rig.torso.add(pocket);
  }
  if (config.appearance.cap) {
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.185, 0.2, 0.085, 16), standard("#2c342b", 0.9));
    cap.position.set(0, 0.235, 0);
    rig.head.add(cap);
    const brim = new THREE.Mesh(new THREE.BoxGeometry(0.29, 0.022, 0.15), standard("#222a22", 0.9));
    brim.position.set(0, 0.198, 0.12);
    rig.head.add(brim);
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.202, 0.202, 0.024, 16), accents);
    band.position.set(0, 0.205, 0);
    rig.head.add(band);
  }

  // Staff pocket detail keeps the adult shirts from reading as blank panels.
  if (config.appearance.lanyard || config.id === "rahul" || config.id === "sushil") {
    const pocket = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.01, 0.006), skin);
    pocket.position.set(0.09, 0.02, 0.133);
    rig.torso.add(pocket);
  }

  const tag = makeTeacherTag(config);
  tag.position.set(spawn.x, 2.38, spawn.z);
  tag.scale.set(2.05, 0.62, 1);
  tag.renderOrder = 10;

  const indicator = makeInteractionIndicator(config);
  indicator.position.set(spawn.x, 0.06, spawn.z);
  indicator.visible = false;

  return {
    ...rig,
    tag,
    indicator,
    staffId: config.id,
  };
}

function makeTeacherTag(config: TeacherConfig): THREE.Sprite {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 160;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Teacher tag canvas unavailable");
  ctx.clearRect(0, 0, 512, 160);
  ctx.fillStyle = "rgba(9, 17, 12, 0.84)";
  roundRect(ctx, 8, 8, 496, 144, 16);
  ctx.fill();
  ctx.strokeStyle = "rgba(214, 190, 143, 0.52)";
  ctx.lineWidth = 2;
  roundRect(ctx, 8, 8, 496, 144, 16);
  ctx.stroke();

  ctx.fillStyle = config.appearance.accents;
  ctx.fillRect(26, 35, 5, 88);
  ctx.fillStyle = "#f4ead6";
  ctx.font = "600 39px Georgia, serif";
  ctx.fillText(config.name, 48, 69);
  ctx.fillStyle = "rgba(233, 221, 200, 0.72)";
  ctx.font = "500 22px Arial, sans-serif";
  ctx.fillText(`${config.subject} · STAFF`, 48, 105);
  ctx.fillStyle = "rgba(233, 221, 200, 0.34)";
  ctx.font = "500 16px Arial, sans-serif";
  ctx.fillText("Navodaya Vidyalaya", 48, 131);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: false,
    depthWrite: false,
  });
  return new THREE.Sprite(material);
}

function makeInteractionIndicator(config: TeacherConfig): THREE.Group {
  const group = new THREE.Group();
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.46, 0.58, 32),
    new THREE.MeshBasicMaterial({
      color: config.appearance.accents,
      transparent: true,
      opacity: 0.65,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );
  ring.rotation.x = -Math.PI / 2;
  group.add(ring);
  const dot = new THREE.Mesh(
    new THREE.CircleGeometry(0.07, 16),
    new THREE.MeshBasicMaterial({ color: "#f4ead6", transparent: true, opacity: 0.9 }),
  );
  dot.rotation.x = -Math.PI / 2;
  dot.position.y = 0.005;
  group.add(dot);
  group.userData.ring = ring;
  return group;
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + width, y, x + width, y + height, radius);
  ctx.arcTo(x + width, y + height, x, y + height, radius);
  ctx.arcTo(x, y + height, x, y, radius);
  ctx.arcTo(x, y, x + width, y, radius);
  ctx.closePath();
}
