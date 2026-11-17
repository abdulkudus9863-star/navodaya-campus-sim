import type { BlockCollider } from "../world/WorldEnvironment";

export interface PathPoint {
  x: number;
  z: number;
}

const STEP = 0.8;
const LIMIT = 53.2;
const PLAYER_RADIUS = 0.38;
const START_SEARCH = 5;

/**
 * Small grid A* over the same colliders used by the player controller. Doors
 * are treated as passable because the player can open them; walls, furniture
 * and building shells remain solid. This is deliberately independent of the
 * render loop and cheap enough to run only when the referral route is created
 * or the player strays from it.
 */
export class CampusPathfinder {
  private readonly colliders: BlockCollider[];
  private readonly cells: number;
  private readonly blocked: Uint8Array;

  constructor(colliders: BlockCollider[]) {
    this.colliders = colliders;
    this.cells = Math.floor((LIMIT * 2) / STEP) + 1;
    this.blocked = new Uint8Array(this.cells * this.cells);
    for (let ix = 0; ix < this.cells; ix += 1) {
      for (let iz = 0; iz < this.cells; iz += 1) {
        const point = this.centre(ix, iz);
        this.blocked[this.index(ix, iz)] = this.isSolid(point.x, point.z) ? 1 : 0;
      }
    }
  }

  findPath(start: PathPoint, goal: PathPoint): PathPoint[] | null {
    const startCell = this.nearestOpen(this.toIndex(start.x, start.z), START_SEARCH);
    const goalCell = this.nearestOpen(this.toIndex(goal.x, goal.z), START_SEARCH + 2);
    if (startCell < 0 || goalCell < 0) return null;
    if (startCell === goalCell) return [{ x: goal.x, z: goal.z }];

    const total = this.cells * this.cells;
    const gScore = new Float32Array(total);
    gScore.fill(Number.POSITIVE_INFINITY);
    const cameFrom = new Int32Array(total);
    cameFrom.fill(-1);
    const closed = new Uint8Array(total);
    const heap = new MinHeap();

    gScore[startCell] = 0;
    heap.push(startCell, this.heuristic(startCell, goalCell));

    while (heap.size > 0) {
      const current = heap.pop();
      if (current < 0 || closed[current]) continue;
      if (current === goalCell) {
        return this.reconstruct(cameFrom, goalCell, goal);
      }
      closed[current] = 1;
      const cx = current % this.cells;
      const cz = Math.floor(current / this.cells);

      for (let dx = -1; dx <= 1; dx += 1) {
        for (let dz = -1; dz <= 1; dz += 1) {
          if (dx === 0 && dz === 0) continue;
          const nx = cx + dx;
          const nz = cz + dz;
          if (nx < 0 || nz < 0 || nx >= this.cells || nz >= this.cells) continue;
          const next = this.index(nx, nz);
          if (closed[next] || this.blocked[next]) continue;
          // Do not cut through the corner between two walls.
          if (dx !== 0 && dz !== 0) {
            if (this.blocked[this.index(cx + dx, cz)] || this.blocked[this.index(cx, cz + dz)]) {
              continue;
            }
          }
          const travel = dx !== 0 && dz !== 0 ? 1.4142 : 1;
          const tentative = gScore[current] + travel;
          if (tentative >= gScore[next]) continue;
          gScore[next] = tentative;
          cameFrom[next] = current;
          heap.push(next, tentative + this.heuristic(next, goalCell));
        }
      }
    }
    return null;
  }

  /** Total distance along the route from the player to the destination. */
  remainingDistance(route: PathPoint[], x: number, z: number): number {
    if (route.length === 0) return 0;
    if (route.length === 1) return Math.hypot(route[0].x - x, route[0].z - z);
    // suffix[i] is the full distance from point i to the destination.
    const suffix = new Float64Array(route.length);
    for (let i = route.length - 2; i >= 0; i -= 1) {
      suffix[i] = suffix[i + 1] + Math.hypot(
        route[i + 1].x - route[i].x,
        route[i + 1].z - route[i].z,
      );
    }
    let bestDistance = Number.POSITIVE_INFINITY;
    let bestRemaining = suffix[0];
    for (let i = 0; i < route.length - 1; i += 1) {
      const a = route[i];
      const b = route[i + 1];
      const dx = b.x - a.x;
      const dz = b.z - a.z;
      const lengthSq = dx * dx + dz * dz;
      const t = lengthSq > 0.0001
        ? Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / lengthSq))
        : 0;
      const px = a.x + dx * t;
      const pz = a.z + dz * t;
      const distance = Math.hypot(x - px, z - pz);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestRemaining = Math.hypot(b.x - px, b.z - pz) + suffix[i + 1];
      }
    }
    const last = route[route.length - 1];
    if (Math.hypot(last.x - x, last.z - z) < 0.1) return 0;
    return bestRemaining;
  }

  /** Distance from the player to the planned polyline. */
  distanceToRoute(route: PathPoint[], x: number, z: number): number {
    if (route.length === 0) return Number.POSITIVE_INFINITY;
    let best = Number.POSITIVE_INFINITY;
    for (let i = 0; i < route.length - 1; i += 1) {
      const a = route[i];
      const b = route[i + 1];
      const dx = b.x - a.x;
      const dz = b.z - a.z;
      const lengthSq = dx * dx + dz * dz;
      const t = lengthSq > 0.0001
        ? Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / lengthSq))
        : 0;
      best = Math.min(best, Math.hypot(x - (a.x + dx * t), z - (a.z + dz * t)));
    }
    if (route.length === 1) best = Math.hypot(x - route[0].x, z - route[0].z);
    return best;
  }

  private isSolid(x: number, z: number): boolean {
    for (const collider of this.colliders) {
      if (!collider.active) continue;
      // Door leaves are openable and therefore valid route segments.
      if (collider.label.toLowerCase().includes("door")) continue;
      if (collider.maxY !== undefined && collider.maxY <= 0.12) continue;
      if (collider.minY !== undefined && collider.minY >= 1.7) continue;
      const closestX = Math.max(collider.minX, Math.min(x, collider.maxX));
      const closestZ = Math.max(collider.minZ, Math.min(z, collider.maxZ));
      if ((x - closestX) ** 2 + (z - closestZ) ** 2 < PLAYER_RADIUS ** 2) {
        return true;
      }
    }
    return false;
  }

  private reconstruct(cameFrom: Int32Array, cell: number, goal: PathPoint): PathPoint[] {
    const cells: PathPoint[] = [];
    let cursor = cell;
    while (cursor >= 0) {
      const ix = cursor % this.cells;
      const iz = Math.floor(cursor / this.cells);
      cells.push(this.centre(ix, iz));
      cursor = cameFrom[cursor];
    }
    cells.reverse();
    // Begin at the player's exact position rather than the nearest grid centre.
    const first = cells[0];
    const last = cells[cells.length - 1] ?? goal;
    const route: PathPoint[] = [{ x: first.x, z: first.z }, ...cells.slice(1)];
    if (Math.hypot(last.x - goal.x, last.z - goal.z) > 0.05) route.push({ x: goal.x, z: goal.z });
    return this.smooth(route);
  }

  private smooth(route: PathPoint[]): PathPoint[] {
    if (route.length <= 2) return route;
    const result: PathPoint[] = [route[0]];
    let anchor = 0;
    for (let i = 2; i < route.length; i += 1) {
      if (!this.segmentClear(route[anchor], route[i])) {
        anchor = i - 1;
        result.push(route[anchor]);
      }
    }
    result.push(route[route.length - 1]);
    return result;
  }

  private segmentClear(a: PathPoint, b: PathPoint): boolean {
    const distance = Math.hypot(b.x - a.x, b.z - a.z);
    const steps = Math.max(1, Math.ceil(distance / 0.35));
    for (let i = 1; i < steps; i += 1) {
      const t = i / steps;
      if (this.isSolid(a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t)) return false;
    }
    return true;
  }

  private nearestOpen(index: number, radius: number): number {
    if (!this.blocked[index]) return index;
    const cx = index % this.cells;
    const cz = Math.floor(index / this.cells);
    for (let r = 1; r <= radius; r += 1) {
      for (let dx = -r; dx <= r; dx += 1) {
        for (let dz = -r; dz <= r; dz += 1) {
          if (Math.abs(dx) !== r && Math.abs(dz) !== r) continue;
          const x = cx + dx;
          const z = cz + dz;
          if (x < 0 || z < 0 || x >= this.cells || z >= this.cells) continue;
          const next = this.index(x, z);
          if (!this.blocked[next]) return next;
        }
      }
    }
    return -1;
  }

  private toIndex(x: number, z: number): number {
    const ix = Math.max(0, Math.min(this.cells - 1, Math.round((x + LIMIT) / STEP)));
    const iz = Math.max(0, Math.min(this.cells - 1, Math.round((z + LIMIT) / STEP)));
    return this.index(ix, iz);
  }

  private index(ix: number, iz: number): number {
    return iz * this.cells + ix;
  }

  private centre(ix: number, iz: number): PathPoint {
    return { x: -LIMIT + ix * STEP, z: -LIMIT + iz * STEP };
  }

  private heuristic(cell: number, goal: number): number {
    const ax = cell % this.cells;
    const az = Math.floor(cell / this.cells);
    const bx = goal % this.cells;
    const bz = Math.floor(goal / this.cells);
    const dx = Math.abs(ax - bx);
    const dz = Math.abs(az - bz);
    return Math.max(dx, dz) + 0.4142 * Math.min(dx, dz);
  }
}

/** Binary min-heap keyed by f-score. */
class MinHeap {
  private items: Array<{ value: number; priority: number }> = [];

  get size(): number {
    return this.items.length;
  }

  push(value: number, priority: number): void {
    const items = this.items;
    items.push({ value, priority });
    let index = items.length - 1;
    while (index > 0) {
      const parent = (index - 1) >> 1;
      if (items[parent].priority <= items[index].priority) break;
      [items[parent], items[index]] = [items[index], items[parent]];
      index = parent;
    }
  }

  pop(): number {
    const items = this.items;
    if (items.length === 0) return -1;
    const top = items[0];
    const last = items.pop()!;
    if (items.length > 0) {
      items[0] = last;
      let index = 0;
      while (true) {
        const left = index * 2 + 1;
        const right = left + 1;
        let smallest = index;
        if (left < items.length && items[left].priority < items[smallest].priority) smallest = left;
        if (right < items.length && items[right].priority < items[smallest].priority) smallest = right;
        if (smallest === index) break;
        [items[index], items[smallest]] = [items[smallest], items[index]];
        index = smallest;
      }
    }
    return top.value;
  }
}
