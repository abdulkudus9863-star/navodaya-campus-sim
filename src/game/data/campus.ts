import { HOUSES, getHouse, type HouseId } from "./houses";

/**
 * An interpretive campus route. The stops and walking order are game design,
 * not a survey of Jawahar Navodaya Vidyalaya, Bishnupur. The world keeps a
 * recognisable JNV programme of spaces (gate, assembly, academic block, labs,
 * library, dining/kitchen, sports ground and house hostels) while the exact
 * layout and any midnight caper are fictional.
 */
export type CampusLocationKind =
  | "entrance"
  | "assembly"
  | "academic"
  | "laboratory"
  | "library"
  | "administration"
  | "dining"
  | "sports"
  | "garden"
  | "hostel";

export type CampusProvenance = "interpretive" | "fictional";

export interface CampusLocationDefinition {
  id: string;
  name: string;
  shortName: string;
  kind: CampusLocationKind;
  description: string;
  story: string;
  x: number;
  z: number;
  radius: number;
  mapX: number;
  mapY: number;
  /** Number of discoveries needed before this stop can be travelled to. */
  unlockAt: number;
  provenance: CampusProvenance;
  dynamicHostel?: boolean;
}

export const CAMPUS_LOCATIONS: readonly CampusLocationDefinition[] = [
  {
    id: "main-gate",
    name: "Main Gate & Entrance",
    shortName: "Main gate",
    kind: "entrance",
    description:
      "The campus entrance opens onto the main drive, with the guard cabin and the Navodaya gateboard.",
    story:
      "The gate is where every term begins: trunks unloaded, house lists checked, and someone always forgets a bucket.",
    x: 0,
    z: 42,
    radius: 9,
    mapX: 50,
    mapY: 90,
    unlockAt: 0,
    provenance: "interpretive",
  },
  {
    id: "assembly-ground",
    name: "Assembly Ground",
    shortName: "Assembly",
    kind: "assembly",
    description:
      "The paved assembly ground and stage face the flag pole at the centre of the campus.",
    story:
      "At 6:20 the ground belongs to the whole school. By breakfast it belongs to the footballs again.",
    x: 0,
    z: 4,
    radius: 13,
    mapX: 50,
    mapY: 55,
    unlockAt: 0,
    provenance: "interpretive",
  },
  {
    id: "academic-block",
    name: "Academic Block",
    shortName: "Academic block",
    kind: "academic",
    description:
      "Classrooms, the Class VII room, a covered veranda and the notice-board route through the middle of campus.",
    story:
      "Room 12 has the good windows, the loud ceiling fan and a geography map that is older than most of the class.",
    x: -23,
    z: 0,
    radius: 12,
    mapX: 25,
    mapY: 49,
    unlockAt: 0,
    provenance: "interpretive",
  },
  {
    id: "administration",
    name: "Administration",
    shortName: "Admin office",
    kind: "administration",
    description:
      "The low administrative building beside the entrance, with a walk-in reception, the principal's office, staff room and records area.",
    story:
      "The corridor smells of paper and tea. A hand-painted board reminds everyone that the office closes for assembly.",
    x: 13,
    z: 43,
    radius: 9,
    mapX: 80,
    mapY: 86,
    unlockAt: 2,
    provenance: "interpretive",
  },
  {
    id: "library",
    name: "Library & Reading Room",
    shortName: "Library",
    kind: "library",
    description:
      "The Gyan Mandir library: a walk-in reading room with timber shelves, reading tables, a librarian's counter and a quiet corner.",
    story:
      "The reading room is quiet except for the ceiling fan and the occasional argument about which atlas is best.",
    x: -29,
    z: -30,
    radius: 11,
    mapX: 21,
    mapY: 23,
    unlockAt: 2,
    provenance: "interpretive",
  },
  {
    id: "science-labs",
    name: "Science Laboratories",
    shortName: "Science labs",
    kind: "laboratory",
    description:
      "A separate laboratory wing for practical science, with a walk-in practical hall, demonstration bench and apparatus cupboards.",
    story:
      "The lab assistant keeps the good microscope behind glass and a handwritten list of who has not returned a prism.",
    x: 36,
    z: -29,
    radius: 11,
    mapX: 75,
    mapY: 24,
    unlockAt: 4,
    provenance: "interpretive",
  },
  {
    id: "dining-hall",
    name: "Dining Hall & Kitchen",
    shortName: "Dining hall",
    kind: "dining",
    description:
      "Annapoorna: a walk-in dining hall with long tables, a serving counter, menu board and wash area. The kitchen wing stays staff-only.",
    story:
      "The kitchen bell is the most reliable clock on campus. The menu board is the most debated document.",
    x: 2,
    z: -30,
    radius: 13,
    mapX: 47,
    mapY: 20,
    unlockAt: 2,
    provenance: "interpretive",
  },
  {
    id: "sports-ground",
    name: "Playground & Sports Ground",
    shortName: "Sports ground",
    kind: "sports",
    description:
      "The Khel Maidan oval, goalposts, track and pavilion, plus the outdoor basketball and volleyball courts behind the labs.",
    story:
      "The oval is used for assembly practice, football, athletics and the annual argument about boundary rules.",
    x: 37,
    z: 36,
    radius: 17,
    mapX: 82,
    mapY: 70,
    unlockAt: 3,
    provenance: "interpretive",
  },
  {
    id: "harbour-garden",
    name: "Gardens & Walking Paths",
    shortName: "Campus gardens",
    kind: "garden",
    description:
      "The kitchen garden, shaded paths and green edges that connect the residential and academic sides.",
    story:
      "The garden is practical botany by day. After dark, in the fictional caper, it becomes the scene of Operation Midnight Mischief.",
    x: -38,
    z: 26,
    radius: 11,
    mapX: 22,
    mapY: 63,
    unlockAt: 5,
    provenance: "fictional",
  },
  {
    id: "house-hostel",
    name: "Your House Hostel",
    shortName: "House hostel",
    kind: "hostel",
    description:
      "The four house hostels stand on the south lawn. Your assigned house has its own colours, sign and door.",
    story:
      "Four doors, four colours, one corridor light that always stays on. Your house captain knows exactly which room is yours.",
    x: 0,
    z: 38,
    radius: 11,
    mapX: 50,
    mapY: 77,
    unlockAt: 0,
    provenance: "interpretive",
    dynamicHostel: true,
  },
] as const;

export const CAMPUS_TOTAL = CAMPUS_LOCATIONS.length;

export interface CampusLocationView extends CampusLocationDefinition {
  discovered: boolean;
  unlocked: boolean;
  isPlayerHouseHostel: boolean;
}

export interface CampusMapView {
  locations: CampusLocationView[];
  discovered: number;
  total: number;
  nextUnlock: { count: number; names: string[] } | null;
  playerX: number;
  playerZ: number;
  houseMarkers: {
    houseId: HouseId;
    name: string;
    shortName: string;
    color: string;
    mapX: number;
    mapY: number;
    isPlayerHouse: boolean;
  }[];
  houseId: HouseId;
  note: string;
}

const HOSTEL_X: Record<HouseId, number> = {
  aravali: -45,
  nilgiri: -36.5,
  shivalik: -28,
  udaygiri: -19.5,
};

const HOSTEL_MAP_X: Record<HouseId, number> = {
  aravali: 38,
  nilgiri: 46,
  shivalik: 54,
  udaygiri: 62,
};

export function locationsForHouse(houseId: HouseId): CampusLocationDefinition[] {
  const house = getHouse(houseId);
  return CAMPUS_LOCATIONS.map((location) => {
    if (!location.dynamicHostel) return { ...location };
    const hostel = house ? house.hostelName : "House hostel";
    return {
      ...location,
      name: hostel,
      shortName: house ? `${house.shortName} hostel` : "House hostel",
      description: house
        ? `${house.hostelName} is the ${house.name} hostel on the south lawn. The door, sign and flag carry the house colours.`
        : location.description,
      x: HOSTEL_X[houseId],
      z: 35.2,
      radius: 7,
      mapX: HOSTEL_MAP_X[houseId],
      mapY: 77,
    };
  });
}

export function houseMapMarkers(houseId: HouseId) {
  return HOUSES.map((house, index) => ({
    houseId: house.id,
    name: house.hostelName,
    shortName: house.shortName,
    color: house.color,
    mapX: 38 + index * 8,
    mapY: 77,
    isPlayerHouse: house.id === houseId,
  }));
}

export function isCampusLocationId(value: unknown): boolean {
  return typeof value === "string" && CAMPUS_LOCATIONS.some((location) => location.id === value);
}
