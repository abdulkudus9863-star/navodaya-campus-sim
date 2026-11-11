import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

export type MaterialLibrary = Record<string, THREE.Material>;

const _matrix = new THREE.Matrix4();
const _quaternion = new THREE.Quaternion();
const _euler = new THREE.Euler();
const _position = new THREE.Vector3();
const _scale = new THREE.Vector3();

export interface PartOptions {
  rotY?: number;
  rotX?: number;
  rotZ?: number;
  scale?: { x: number; y: number; z: number };
}

/**
 * Accumulates geometry per material and merges it once, keeping the campus at a
 * low draw-call count. Static geometry only (everything in the world).
 */
export class MeshBuilder {
  private materials: MaterialLibrary;
  private buckets = new Map<string, THREE.BufferGeometry[]>();
  private castShadow = new Set<string>();

  constructor(materials: MaterialLibrary) {
    this.materials = materials;
  }

  add(key: string, geometry: THREE.BufferGeometry, x: number, y: number, z: number, options: PartOptions = {}): void {
    const material = this.materials[key];
    if (!material) throw new Error(`Unknown material: ${key}`);
    _position.set(x, y, z);
    _euler.set(options.rotX ?? 0, options.rotY ?? 0, options.rotZ ?? 0);
    _quaternion.setFromEuler(_euler);
    _scale.set(options.scale?.x ?? 1, options.scale?.y ?? 1, options.scale?.z ?? 1);
    _matrix.compose(_position, _quaternion, _scale);

    const cloned = geometry.index ? geometry.toNonIndexed() : geometry.clone();
    geometry.dispose();
    cloned.applyMatrix4(_matrix);
    const existing = this.buckets.get(key);
    if (existing) existing.push(cloned);
    else this.buckets.set(key, [cloned]);
    this.castShadow.add(key);
  }

  box(
    key: string,
    size: { w: number; h: number; d: number },
    x: number,
    y: number,
    z: number,
    options: PartOptions = {},
  ): void {
    this.add(key, new THREE.BoxGeometry(size.w, size.h, size.d), x, y, z, options);
  }

  cylinder(
    key: string,
    radiusTop: number,
    radiusBottom: number,
    height: number,
    segments: number,
    x: number,
    y: number,
    z: number,
    options: PartOptions = {},
  ): void {
    this.add(key, new THREE.CylinderGeometry(radiusTop, radiusBottom, height, segments), x, y, z, options);
  }

  plane(
    key: string,
    width: number,
    height: number,
    x: number,
    y: number,
    z: number,
    options: PartOptions = {},
  ): void {
    this.add(key, new THREE.PlaneGeometry(width, height), x, y, z, options);
  }

  build(parent: THREE.Object3D): THREE.Group {
    const group = new THREE.Group();
    group.name = "merged-campus";
    for (const [key, geometries] of this.buckets) {
      const merged = geometries.length === 1 ? geometries[0] : mergeGeometries(geometries, false);
      geometries.forEach((geometry) => {
        if (geometry !== merged) geometry.dispose();
      });
      if (!merged) continue;
      merged.computeBoundingSphere();
      const mesh = new THREE.Mesh(merged, this.materials[key]);
      mesh.castShadow = this.castShadow.has(key);
      mesh.receiveShadow = true;
      mesh.matrixAutoUpdate = false;
      mesh.name = `batch-${key}`;
      group.add(mesh);
    }
    parent.add(group);
    this.buckets.clear();
    return group;
  }
}

export function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

export function damp(current: number, target: number, lambda: number, dt: number): number {
  return THREE.MathUtils.lerp(current, target, 1 - Math.exp(-lambda * dt));
}

export function shortestAngle(from: number, to: number): number {
  let delta = (to - from) % (Math.PI * 2);
  if (delta > Math.PI) delta -= Math.PI * 2;
  if (delta < -Math.PI) delta += Math.PI * 2;
  return delta;
}
