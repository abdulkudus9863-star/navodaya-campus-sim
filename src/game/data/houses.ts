/**
 * The four official Navodaya houses. These are game identities, not claims
 * about any real house or student. Colours are the canonical design tokens.
 */
export type HouseId = "aravali" | "nilgiri" | "shivalik" | "udaygiri";

export type HouseEmblemId = "mountain" | "wave" | "pine" | "sun";

export interface House {
  id: HouseId;
  name: string;
  shortName: string;
  color: string;
  motto: string;
  description: string;
  hostelName: string;
  emblem: HouseEmblemId;
  captainId: string;
  prefectId: string;
}

export const HOUSES: readonly House[] = [
  {
    id: "aravali",
    name: "Aravali House",
    shortName: "Aravali",
    color: "#159447",
    motto: "Steady as the ridge",
    description:
      "The green house of the western ridge. Known for long walks, patient practice and the quietest study tables in the hostel.",
    hostelName: "Aravali Nilayam",
    emblem: "mountain",
    captainId: "ARV-006",
    prefectId: "ARV-004",
  },
  {
    id: "nilgiri",
    name: "Nilgiri House",
    shortName: "Nilgiri",
    color: "#2878DB",
    motto: "Deep water, clear thought",
    description:
      "The blue house of the southern hills. Debate, music and the best-kept common-room library on campus.",
    hostelName: "Nilgiri Nilayam",
    emblem: "wave",
    captainId: "NIL-007",
    prefectId: "NIL-006",
  },
  {
    id: "shivalik",
    name: "Shivalik House",
    shortName: "Shivalik",
    color: "#E6B72E",
    motto: "Roots before wings",
    description:
      "The yellow house of the northern foothills. First on the field, last to leave the workshop, always ready with a spare pencil.",
    hostelName: "Shivalik Nilayam",
    emblem: "pine",
    captainId: "SHV-004",
    prefectId: "SHV-003",
  },
  {
    id: "udaygiri",
    name: "Udaygiri House",
    shortName: "Udaygiri",
    color: "#D94343",
    motto: "First light, first effort",
    description:
      "The red house of the eastern sunrise. Early risers, loud cheers and a rivalry with the dining-hall bell that nobody has settled.",
    hostelName: "Udaygiri Nilayam",
    emblem: "sun",
    captainId: "UDY-004",
    prefectId: "UDY-002",
  },
] as const;

export const DEFAULT_HOUSE_ID: HouseId = "aravali";
export const DEFAULT_CHARACTER_ID = "ARV-001";

export function isHouseId(value: unknown): value is HouseId {
  return HOUSES.some((house) => house.id === value);
}

export function getHouse(id: string | null | undefined): House | undefined {
  return HOUSES.find((house) => house.id === id);
}

export function requireHouse(id: string): House {
  const house = getHouse(id);
  if (!house) throw new Error(`Unknown house: ${id}`);
  return house;
}

export function houseRankPointsLabel(points: number): string {
  return `${points} pts`;
}
