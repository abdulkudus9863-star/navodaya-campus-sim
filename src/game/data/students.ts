import { getHouse, isHouseId, type HouseId } from "./houses";

export type PublicationStatus = "published" | "unpublished" | "archived";
export type PhotoStatus = "not-supplied" | "approved" | "removed";
export type ModelStatus = "procedural" | "assigned" | "none";

export interface StudentCharacter {
  id: string;
  displayName: string;
  houseId: HouseId;
  houseName: string;
  houseColor: string;
  className: string;
  /** Fixed class roll for authored students; null means the roster has none. */
  rollNumber: number | null;
  section: string | null;
  nickname: string | null;
  biography: string | null;
  photoAssetId: string | null;
  photoStatus: PhotoStatus;
  modelAssetId: string | null;
  modelStatus: ModelStatus;
  publicationStatus: PublicationStatus;
  createdAt: string;
  updatedAt: string;
}

type Seed = [id: string, name: string, houseId: HouseId];

const SEEDS: Seed[] = [
  ["ARV-001", "Abdul Kuddus", "aravali"],
  ["ARV-002", "Suraj", "aravali"],
  ["ARV-003", "Paikhomba", "aravali"],
  ["ARV-004", "Starson", "aravali"],
  ["ARV-005", "Anish", "aravali"],
  ["ARV-006", "Naresh", "aravali"],
  ["ARV-007", "Pritson", "aravali"],
  ["ARV-008", "Loya", "aravali"],
  ["ARV-009", "Yeningthoiba", "aravali"],
  ["NIL-001", "Sakil", "nilgiri"],
  ["NIL-002", "Goutam", "nilgiri"],
  ["NIL-003", "Albish", "nilgiri"],
  ["NIL-004", "Honey", "nilgiri"],
  ["NIL-005", "Suraj", "nilgiri"],
  ["NIL-006", "Ronil", "nilgiri"],
  ["NIL-007", "Deccan", "nilgiri"],
  ["SHV-001", "Sakir", "shivalik"],
  ["SHV-002", "Mukhtar", "shivalik"],
  ["SHV-003", "Dipson", "shivalik"],
  ["SHV-004", "Kabir", "shivalik"],
  ["UDY-001", "Nayimmuddin", "udaygiri"],
  ["UDY-002", "Pravin", "udaygiri"],
  ["UDY-003", "Sakeel", "udaygiri"],
  ["UDY-004", "William", "udaygiri"],
];

const SEED_DATE = "2026-06-01T00:00:00.000Z";

function build(seed: Seed): StudentCharacter {
  const house = getHouse(seed[2]);
  if (!house) throw new Error(`Invalid house in roster seed: ${seed[2]}`);
  return {
    id: seed[0],
    displayName: seed[1],
    houseId: house.id,
    houseName: house.name,
    houseColor: house.color,
    // The playable student is the authored Class 10 identity. Other roster
    // records retain the starting cohort; no biography or likeness is invented.
    className: seed[0] === "ARV-001" ? "10" : "VII",
    rollNumber: seed[0] === "ARV-001" ? 34 : null,
    section: null,
    nickname: null,
    biography: null,
    photoAssetId: null,
    photoStatus: "not-supplied",
    modelAssetId: null,
    modelStatus: "procedural",
    publicationStatus: "published",
    createdAt: SEED_DATE,
    updatedAt: SEED_DATE,
  };
}

export const STUDENT_ROSTER: readonly StudentCharacter[] = SEEDS.map(build);

export const STUDENT_COUNT = STUDENT_ROSTER.length;

const BY_ID = new Map(STUDENT_ROSTER.map((student) => [student.id, student]));

export function getStudent(id: string | null | undefined): StudentCharacter | undefined {
  return id ? BY_ID.get(id) : undefined;
}

export function getStudentsForHouse(
  houseId: HouseId,
  options: { includeUnpublished?: boolean } = {},
): StudentCharacter[] {
  return STUDENT_ROSTER.filter(
    (student) =>
      student.houseId === houseId &&
      (options.includeUnpublished || student.publicationStatus === "published"),
  );
}

export function getHouseRoster(houseId: HouseId): StudentCharacter[] {
  return getStudentsForHouse(houseId);
}

export function getHouseCaptain(houseId: HouseId): StudentCharacter | undefined {
  const house = getHouse(houseId);
  return house ? getStudent(house.captainId) : undefined;
}

export function getHousePrefect(houseId: HouseId): StudentCharacter | undefined {
  const house = getHouse(houseId);
  return house ? getStudent(house.prefectId) : undefined;
}

export type SelectionValidation =
  | { ok: true; student: StudentCharacter }
  | { ok: false; error: string };

/**
 * The single authority for a player-house-character assignment. Both the
 * creation UI and the save loader go through this, so a made-up house ID or a
 * student/house mismatch cannot enter gameplay.
 */
export function validateCharacterSelection(
  characterId: string,
  houseId: string,
): SelectionValidation {
  if (!isHouseId(houseId)) return { ok: false, error: "That house ID is not valid." };
  const student = getStudent(characterId);
  if (!student) return { ok: false, error: "That student ID is not registered." };
  if (student.publicationStatus !== "published") {
    return { ok: false, error: "That student is not published for play." };
  }
  if (student.houseId !== houseId) {
    return { ok: false, error: "That student does not belong to the selected house." };
  }
  return { ok: true, student };
}

/** Used by tests and the development diagnostics panel. */
export function inspectRosterIntegrity(): string[] {
  const problems: string[] = [];
  if (STUDENT_COUNT !== 24) problems.push(`Expected 24 records, found ${STUDENT_COUNT}`);
  const ids = new Set<string>();
  for (const student of STUDENT_ROSTER) {
    if (ids.has(student.id)) problems.push(`Duplicate ID: ${student.id}`);
    ids.add(student.id);
    if (!isHouseId(student.houseId)) problems.push(`Bad house on ${student.id}`);
    if (!getHouse(student.houseId)) problems.push(`Missing house on ${student.id}`);
  }
  const surajs = STUDENT_ROSTER.filter((student) => student.displayName === "Suraj");
  if (surajs.length !== 2) problems.push(`Expected two separate Suraj records, found ${surajs.length}`);
  if (surajs.length === 2 && surajs[0].id === surajs[1].id) problems.push("Suraj records share an ID");
  return problems;
}

export const houseMembers: Record<HouseId, readonly string[]> = {
  aravali: STUDENT_ROSTER.filter((s) => s.houseId === "aravali").map((s) => s.displayName),
  nilgiri: STUDENT_ROSTER.filter((s) => s.houseId === "nilgiri").map((s) => s.displayName),
  shivalik: STUDENT_ROSTER.filter((s) => s.houseId === "shivalik").map((s) => s.displayName),
  udaygiri: STUDENT_ROSTER.filter((s) => s.houseId === "udaygiri").map((s) => s.displayName),
};
