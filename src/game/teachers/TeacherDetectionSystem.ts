import type { TeacherAreaId } from "../core/types";

export interface DetectionResult {
  distance: number;
  inFront: boolean;
  noticed: boolean;
  canInteract: boolean;
  approach: boolean;
}

export interface DetectionContext {
  playerX: number;
  playerZ: number;
  teacherX: number;
  teacherZ: number;
  teacherRotation: number;
  detectionRadius: number;
  approachRadius: number;
  lineOfSight: boolean;
  cooldownReady: boolean;
  talking: boolean;
  playerBusy: boolean;
}

const INTERACT_RADIUS = 3.15;

export class TeacherDetectionSystem {
  evaluate(context: DetectionContext): DetectionResult {
    const dx = context.playerX - context.teacherX;
    const dz = context.playerZ - context.teacherZ;
    const distance = Math.hypot(dx, dz);
    const angleToPlayer = Math.atan2(dx, dz);
    const delta = Math.abs(shortest(angleToPlayer - context.teacherRotation));
    const inFront = delta < Math.PI * 0.62;
    const noticed =
      !context.talking &&
      !context.playerBusy &&
      context.cooldownReady &&
      context.lineOfSight &&
      distance <= context.detectionRadius &&
      inFront;
    return {
      distance,
      inFront,
      noticed,
      canInteract: noticed && distance <= INTERACT_RADIUS + 1.1,
      approach:
        noticed &&
        distance > context.approachRadius &&
        distance <= context.detectionRadius * 0.82,
    };
  }
}

/** Converts a world position to the area vocabulary used by routes. */
export function classifyCampusArea(
  x: number,
  z: number,
  houseHostel?: { x: number; z: number } | null,
): TeacherAreaId {
  if (houseHostel && Math.hypot(x - houseHostel.x, z - (houseHostel.z + 2)) < 5.5) return "hostel";
  if (z > 34.5 && x > -14.5) {
    if (x > 18) return "hostel";
    if (z > 39) return "entrance";
    return "assembly";
  }
  if (x < 20 && z > 28.5) return "hostel";
  if (x < -15 && z > 16) return "garden";
  if (x < -15 && z < -20) return "academic";
  if (x < -14.5 && z > -18 && z < 16) return "academic";
  if (z < -29) return "dining";
  if (x > 21 && z > 20) return "playground";
  if (z > 37) return "entrance";
  if (z > 35) return "hostel";
  return "assembly";
}

export function areaLabel(area: TeacherAreaId): string {
  switch (area) {
    case "hostel":
      return "the house hostel";
    case "academic":
      return "the academic block";
    case "playground":
      return "the playground";
    case "dining":
      return "the dining hall";
    case "entrance":
      return "the main gate";
    case "assembly":
      return "the assembly ground";
    case "garden":
      return "the campus gardens";
    default:
      return "the campus";
  }
}

function shortest(angle: number): number {
  let value = angle;
  while (value > Math.PI) value -= Math.PI * 2;
  while (value < -Math.PI) value += Math.PI * 2;
  return value;
}
