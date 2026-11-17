/**
 * One authoritative identity for the Principal, the chamber and the discipline
 * referral. The 3D office, minimap marker and interaction all read these values.
 */
export const PRINCIPAL = {
  name: "Moinm Rahman",
  role: "School Principal",
  chamberName: "Principal's Chamber",
  /** Centre of the existing administrative office behind the reception. */
  chamber: { x: 16.4, z: 45.2 },
  /** Clear floor immediately in front of the desk, used by route navigation. */
  routePoint: { x: 15.7, z: 44.8 },
  npcPosition: { x: 16.3, z: 46.75 },
  interactionPoint: { x: 16.3, z: 45.0 },
  interactionRadius: 2.85,
  zone: { minX: 13.4, maxX: 18.15, minZ: 44.05, maxZ: 47.1 },
  door: {
    hinge: { x: 16.1, z: 43.9 },
    gap: [14.6, 16.1] as const,
    width: 1.5,
  },
} as const;

export const PRINCIPAL_MISSION = {
  id: "principal-chamber",
  title: "REPORT TO PRINCIPAL'S CHAMBER",
  objective: "Reach the Principal's Chamber and report to the Principal.",
  shortLabel: "Principal's Chamber",
} as const;

export function isInsidePrincipalChamber(
  x: number,
  z: number,
  zone: { minX: number; maxX: number; minZ: number; maxZ: number } = PRINCIPAL.zone,
): boolean {
  return x >= zone.minX && x <= zone.maxX && z >= zone.minZ && z <= zone.maxZ;
}
