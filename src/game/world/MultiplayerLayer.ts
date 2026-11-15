import * as THREE from "three";
import { createCharacter, type CharacterRig } from "./CharacterFactory";
import { shortestAngle } from "./geometry";
import { getHouse } from "../data/houses";
import {
  MP_HIDE_AFTER_MS,
  MP_SAFE_ZONE,
  MP_VEGETABLES,
  type MultiplayerRemotePlayer,
} from "../data/multiplayer";

interface RemoteEntry {
  rig: CharacterRig;
  label: THREE.Sprite;
  target: THREE.Vector3;
  baseY: number;
  targetRotation: number;
  anim: MultiplayerRemotePlayer["anim"];
  crouching: boolean;
  moving: boolean;
  lastSeen: number;
  walkPhase: number;
}

interface CrateEntry {
  id: string;
  name: string;
  group: THREE.Group;
  marker: THREE.Mesh;
  position: THREE.Vector3;
  baseY: number;
  phase: number;
}

/**
 * Adds remote students and the shared vegetable crates to the existing night
 * garden. Presentation only: no gameplay authority lives in this class.
 */
export class MultiplayerLayer {
  readonly group = new THREE.Group();
  private players = new Map<string, RemoteEntry>();
  private crates = new Map<string, CrateEntry>();
  private collected = new Set<string>();
  private clock = 0;
  private safeRingMaterial: THREE.MeshBasicMaterial;

  constructor(scene: THREE.Scene) {
    this.group.name = "multiplayer-layer";
    scene.add(this.group);

    // The marked extraction point at the garden gate.
    this.safeRingMaterial = new THREE.MeshBasicMaterial({
      color: "#8fbf95",
      transparent: true,
      opacity: 0.42,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const safeRing = new THREE.Mesh(
      new THREE.RingGeometry(MP_SAFE_ZONE.radius - 0.2, MP_SAFE_ZONE.radius, 48),
      this.safeRingMaterial,
    );
    safeRing.rotation.x = -Math.PI / 2;
    safeRing.position.set(MP_SAFE_ZONE.x, 0.035, MP_SAFE_ZONE.z);
    this.group.add(safeRing);

    const safeDisc = new THREE.Mesh(
      new THREE.CircleGeometry(MP_SAFE_ZONE.radius - 0.2, 48),
      new THREE.MeshBasicMaterial({
        color: "#8fbf95",
        transparent: true,
        opacity: 0.07,
        depthWrite: false,
      }),
    );
    safeDisc.rotation.x = -Math.PI / 2;
    safeDisc.position.set(MP_SAFE_ZONE.x, 0.03, MP_SAFE_ZONE.z);
    this.group.add(safeDisc);

    const safeLabel = makeNameLabel("Safe area · garden gate", "#8fbf95");
    safeLabel.scale.set(2.4, 0.6, 1);
    safeLabel.position.set(MP_SAFE_ZONE.x, 1.5, MP_SAFE_ZONE.z);
    this.group.add(safeLabel);

    const wood = new THREE.MeshStandardMaterial({ color: "#6d5334", roughness: 0.86 });
    const slat = new THREE.MeshStandardMaterial({ color: "#94714a", roughness: 0.8 });

    for (const item of MP_VEGETABLES) {
      const group = new THREE.Group();
      group.position.set(item.x, 0, item.z);

      const box = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.34, 0.44), wood);
      box.position.y = 0.19;
      box.castShadow = true;
      box.receiveShadow = true;
      group.add(box);

      for (const offset of [-0.2, 0.2]) {
        const band = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.05, 0.47), slat);
        band.position.y = 0.19 + offset;
        group.add(band);
      }

      const produce = new THREE.MeshStandardMaterial({
        color: item.color,
        roughness: 0.6,
        emissive: item.color,
        emissiveIntensity: 0.22,
      });
      for (let index = 0; index < 3; index += 1) {
        const veg = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), produce);
        veg.position.set((index - 1) * 0.15, 0.41, index === 1 ? 0.05 : -0.04);
        veg.castShadow = true;
        group.add(veg);
      }

      const markerMaterial = new THREE.MeshStandardMaterial({
        color: item.color,
        emissive: item.color,
        emissiveIntensity: 1.35,
        roughness: 0.35,
      });
      const marker = new THREE.Mesh(new THREE.OctahedronGeometry(0.11), markerMaterial);
      marker.position.y = 1.05;
      group.add(marker);

      this.group.add(group);
      this.crates.set(item.id, {
        id: item.id,
        name: item.name,
        group,
        marker,
        position: new THREE.Vector3(item.x, 0, item.z),
        baseY: 1.05,
        phase: Math.random() * Math.PI * 2,
      });
    }
  }

  setCollected(ids: readonly string[]): void {
    this.collected = new Set(ids);
    for (const crate of this.crates.values()) {
      crate.group.visible = !this.collected.has(crate.id);
    }
  }

  setPlayers(players: readonly MultiplayerRemotePlayer[]): void {
    const seen = new Set<string>();
    for (const player of players) {
      seen.add(player.memberId);
      let entry = this.players.get(player.memberId);
      if (!entry) {
        entry = this.createEntry(player);
        this.players.set(player.memberId, entry);
      }
      entry.target.set(player.x, player.y, player.z);
      entry.targetRotation = player.rotationY;
      entry.anim = player.anim;
      entry.crouching = player.crouching;
      entry.moving = player.moving;
      entry.lastSeen = player.lastSeen;
    }
    for (const [id, entry] of this.players) {
      if (seen.has(id)) continue;
      this.group.remove(entry.rig.group);
      disposeRig(entry.rig);
      this.players.delete(id);
    }
  }

  /** Development-only snapshot used by the browser QA harness. */
  snapshot(): Array<{ x: number; z: number; crouching: boolean; anim: string; visible: boolean }> {
    return [...this.players.values()].map((entry) => ({
      x: Number(entry.rig.group.position.x.toFixed(2)),
      z: Number(entry.rig.group.position.z.toFixed(2)),
      crouching: entry.crouching,
      anim: entry.anim,
      visible: entry.rig.group.visible,
    }));
  }

  /** Nearest uncollected crate within reach of the local player. */
  nearestCrate(x: number, z: number, radius = 2.3): CrateEntry | null {
    let best: CrateEntry | null = null;
    let bestDistance = radius;
    for (const crate of this.crates.values()) {
      if (this.collected.has(crate.id)) continue;
      const distance = Math.hypot(x - crate.position.x, z - crate.position.z);
      if (distance < bestDistance) {
        best = crate;
        bestDistance = distance;
      }
    }
    return best;
  }

  update(dt: number): void {
    this.clock += dt;
    const now = Date.now();
    this.safeRingMaterial.opacity = 0.28 + Math.sin(this.clock * 1.6) * 0.16;

    for (const crate of this.crates.values()) {
      crate.marker.position.y = crate.baseY + Math.sin(this.clock * 2.1 + crate.phase) * 0.06;
      crate.marker.rotation.y += dt * 1.4;
    }

    for (const entry of this.players.values()) {
      const stale = now - entry.lastSeen > MP_HIDE_AFTER_MS;
      entry.rig.group.visible = !stale;
      entry.label.visible = !stale;
      if (stale) continue;

      const position = entry.rig.group.position;
      const blend = 1 - Math.exp(-11 * dt);
      position.x += (entry.target.x - position.x) * blend;
      entry.baseY += (entry.target.y - entry.baseY) * blend;
      position.z += (entry.target.z - position.z) * blend;
      entry.rig.group.rotation.y += shortestAngle(entry.rig.group.rotation.y, entry.targetRotation) * blend;

      const crouchScale = entry.crouching ? 0.78 : 1;
      entry.rig.group.scale.y += (crouchScale - entry.rig.group.scale.y) * (1 - Math.exp(-10 * dt));

      animateRig(entry, dt);
      position.y = entry.baseY + (entry.moving ? Math.abs(Math.sin(entry.walkPhase)) * 0.035 : 0);
    }
  }

  dispose(): void {
    for (const entry of this.players.values()) disposeRig(entry.rig);
    this.players.clear();
    this.group.traverse((object) => {
      if (object instanceof THREE.Mesh) object.geometry.dispose();
    });
    this.group.removeFromParent();
    this.crates.clear();
  }

  private createEntry(player: MultiplayerRemotePlayer): RemoteEntry {
    const house = getHouse(player.houseId);
    const rig = createCharacter({
      uniform: house?.color ?? "#6b7280",
      skin: "#b57f56",
    });
    rig.group.position.set(player.x, player.y, player.z);
    rig.group.rotation.y = player.rotationY;
    this.group.add(rig.group);

    const label = makeNameLabel(player.name, house?.color ?? "#b9cee2");
    label.position.set(0, 2.02, 0);
    rig.group.add(label);

    return {
      rig,
      label,
      target: new THREE.Vector3(player.x, player.y, player.z),
      baseY: player.y,
      targetRotation: player.rotationY,
      anim: player.anim,
      crouching: player.crouching,
      moving: player.moving,
      lastSeen: player.lastSeen,
      walkPhase: 0,
    };
  }
}

function animateRig(entry: RemoteEntry, dt: number): void {
  const { rig } = entry;
  if (entry.crouching) {
    rig.leftLeg.rotation.x = 0.18;
    rig.rightLeg.rotation.x = 0.18;
    rig.leftArm.rotation.x = -0.1;
    rig.rightArm.rotation.x = -0.1;
    entry.walkPhase = 0;
    return;
  }
  if (!entry.moving) {
    for (const limb of [rig.leftLeg, rig.rightLeg, rig.leftArm, rig.rightArm]) {
      limb.rotation.x += (0 - limb.rotation.x) * Math.min(1, dt * 8);
    }
    entry.walkPhase = 0;
    return;
  }
  const speed = entry.anim === "run" ? 12 : 7;
  entry.walkPhase += dt * speed;
  const swing = Math.sin(entry.walkPhase) * (entry.anim === "run" ? 0.8 : 0.5);
  rig.leftLeg.rotation.x = swing;
  rig.rightLeg.rotation.x = -swing;
  rig.leftArm.rotation.x = -swing * 0.8;
  rig.rightArm.rotation.x = swing * 0.8;
  rig.head.rotation.z = Math.sin(entry.walkPhase) * 0.015;
}

function makeNameLabel(name: string, houseColor: string): THREE.Sprite {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "rgba(7, 12, 18, 0.74)";
    ctx.fillRect(24, 20, 464, 88);
    ctx.fillStyle = houseColor;
    ctx.fillRect(24, 20, 10, 88);
    ctx.fillStyle = "#f1ebdd";
    ctx.font = "600 46px ui-serif, Georgia, serif";
    ctx.textBaseline = "middle";
    ctx.fillText(name.slice(0, 16), 56, 66);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
  });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(1.7, 0.42, 1);
  return sprite;
}

function disposeRig(rig: CharacterRig): void {
  rig.group.traverse((object) => {
    if (object instanceof THREE.Mesh || object instanceof THREE.Sprite) {
      object.geometry?.dispose();
      const material = object.material;
      if (Array.isArray(material)) material.forEach((item) => item.dispose());
      else material?.dispose();
    }
  });
}
