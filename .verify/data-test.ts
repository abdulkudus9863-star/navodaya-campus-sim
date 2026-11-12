import { STUDENT_ROSTER, inspectRosterIntegrity, validateCharacterSelection } from "../src/game/data/students";
import { HOUSES, getHouse } from "../src/game/data/houses";
import { buildStandings, validateCompetitionResult, COMPETITION_RESULTS } from "../src/game/data/competitions";
import { awardProgress, newPlayerProfile } from "../src/game/data/profile";
import { SaveSystem, saveKey } from "../src/game/core/SaveSystem";
import {
  DEFAULT_CHARACTER,
  DEFAULT_SETTINGS,
  MISSION_STEPS,
  emptyNightSave,
  type SaveData,
} from "../src/game/core/types";

class MemoryStorage {
  private data = new Map<string, string>();
  getItem(key: string) {
    return this.data.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.data.set(key, String(value));
  }
  removeItem(key: string) {
    this.data.delete(key);
  }
}

const storage = new MemoryStorage();
(globalThis as unknown as { window: { localStorage: MemoryStorage } }).window = {
  localStorage: storage,
};

let failures = 0;
function check(label: string, condition: boolean, detail?: unknown) {
  if (condition) {
    console.log("PASS", label);
  } else {
    failures += 1;
    console.log("FAIL", label, detail === undefined ? "" : JSON.stringify(detail));
  }
}

// Roster and house integrity.
check("exactly 24 records", STUDENT_ROSTER.length === 24, STUDENT_ROSTER.length);
check("roster integrity is clean", inspectRosterIntegrity().length === 0, inspectRosterIntegrity());
check("exactly four houses", HOUSES.length === 4);
check(
  "exact house colours",
  JSON.stringify(HOUSES.map((house) => house.color)) ===
    JSON.stringify(["#159447", "#2878DB", "#E6B72E", "#D94343"]),
  HOUSES.map((house) => house.color),
);
const houseCounts = Object.fromEntries(
  HOUSES.map((house) => [house.id, STUDENT_ROSTER.filter((student) => student.houseId === house.id).length]),
);
check("house counts 9/7/4/4", JSON.stringify(houseCounts) === JSON.stringify({ aravali: 9, nilgiri: 7, shivalik: 4, udaygiri: 4 }), houseCounts);
const surajs = STUDENT_ROSTER.filter((student) => student.displayName === "Suraj");
check("two Suraj records", surajs.length === 2, surajs.map((student) => student.id));
check("Suraj IDs and houses are separate", surajs[0].id !== surajs[1].id && new Set(surajs.map((student) => student.houseId)).size === 2, surajs.map((student) => [student.id, student.houseId]));
check(
  "exact supplied names",
  JSON.stringify(STUDENT_ROSTER.map((student) => student.displayName)) ===
    JSON.stringify([
      "Abdul Kudus", "Suraj", "Paikhomba", "Starson", "Anish", "Naresh", "Pritson", "Loya", "Yeningthoiba",
      "Sakil", "Goutam", "Albish", "Honey", "Suraj", "Ronil", "Deccan",
      "Sakir", "Mukhtar", "Dipson", "Kabir",
      "Nayimmuddin", "Pravin", "Sakeel", "William",
    ]),
);
check("no invented photos", STUDENT_ROSTER.every((student) => student.photoStatus === "not-supplied" && student.photoAssetId === null));
check("models are procedural", STUDENT_ROSTER.every((student) => student.modelStatus === "procedural" && student.modelAssetId === null));
for (const house of HOUSES) {
  const captain = STUDENT_ROSTER.find((student) => student.id === house.captainId);
  const prefect = STUDENT_ROSTER.find((student) => student.id === house.prefectId);
  check(`${house.shortName} captain/prefect are in-house`, captain?.houseId === house.id && prefect?.houseId === house.id, {
    captain: captain?.id,
    prefect: prefect?.id,
  });
}

// Assignment validation.
check("valid Aravali assignment", validateCharacterSelection("ARV-001", "aravali").ok);
check("valid Nilgiri Suraj assignment", validateCharacterSelection("NIL-005", "nilgiri").ok);
check("invalid house rejected", !validateCharacterSelection("ARV-001", "hufflepuff").ok);
check("cross-house student rejected", !validateCharacterSelection("ARV-001", "nilgiri").ok);
check("unknown student rejected", !validateCharacterSelection("ARV-999", "aravali").ok);

// Competition archive and duplicate protection.
const standings = buildStandings();
check("five approved events accepted", standings.acceptedResults.length === 5, standings.acceptedResults.length);
check("no archive result rejected", standings.rejectedResultIds.length === 0, standings.rejectedResultIds);
const points = Object.fromEntries(standings.standings.map((entry) => [entry.house.id, entry.points]));
check("points total 250", Object.values(points).reduce((sum, value) => sum + value, 0) === 250, points);
check("expected standings", JSON.stringify(points) === JSON.stringify({ aravali: 75, nilgiri: 65, udaygiri: 60, shivalik: 50 }), points);
check("expected rankings", JSON.stringify(standings.standings.map((entry) => entry.house.id)) === JSON.stringify(["aravali", "nilgiri", "udaygiri", "shivalik"]));
check("five championships", standings.championships.length === 5, standings.championships.length);
const invalidCompetition = {
  ...COMPETITION_RESULTS[0],
  placements: [
    { houseId: "aravali" as const, position: 1 as const, detail: "x" },
    { houseId: "aravali" as const, position: 1 as const, detail: "x" },
  ],
};
check("invalid/duplicate placements rejected", !validateCompetitionResult(invalidCompetition).ok, validateCompetitionResult(invalidCompetition).errors);

// XP deduplication.
let profile = newPlayerProfile("NIL-005", "nilgiri", { playerId: "test-player-0001", assignedAt: 1_760_000_000_000 });
const firstAward = awardProgress(profile, 60, "midnight-garden");
const secondAward = awardProgress(firstAward.profile, 60, "midnight-garden");
check("night XP awarded once", firstAward.awardedXp === 60 && secondAward.awardedXp === 0 && secondAward.profile.xp === 60, {
  first: firstAward.awardedXp,
  second: secondAward.awardedXp,
  xp: secondAward.profile.xp,
});

// Valid save round-trip with night progress.
const validSave: SaveData = {
  version: 2,
  savedAt: 1_760_000_100_000,
  playtime: 300,
  player: { position: { x: -38, y: 0, z: 26 }, rotationY: 0 },
  settings: DEFAULT_SETTINGS,
  character: DEFAULT_CHARACTER,
  mission: { started: true, step: MISSION_STEPS.length, completed: MISSION_STEPS.map((step) => step.id) },
  profile: {
    ...firstAward.profile,
    xp: 180,
    level: 2,
    achievements: ["house-colours", "first-day", "midnight-garden"],
  },
  night: {
    active: true,
    started: true,
    step: 3,
    collected: ["tomato"],
    attempts: 1,
    caught: false,
    success: false,
    completedAt: null,
  },
};
const saveSystem = new SaveSystem();
check("save writes", saveSystem.save(validSave));
const loaded = saveSystem.load();
check("valid save loads", loaded.ok);
if (loaded.ok) {
  check("house/character preserved", loaded.data.profile.houseId === "nilgiri" && loaded.data.profile.characterId === "NIL-005");
  check("night progress preserved", loaded.data.night.active && loaded.data.night.step === 3 && loaded.data.night.collected[0] === "tomato", loaded.data.night);
  check("XP preserved within earned cap", loaded.data.profile.xp === 180 && loaded.data.profile.level === 2, {
    xp: loaded.data.profile.xp,
    level: loaded.data.profile.level,
  });
}

// Tampered XP is capped to earned achievements.
storage.setItem(saveKey, JSON.stringify({ ...validSave, profile: { ...validSave.profile, xp: 999_999 } }));
const capped = saveSystem.load();
check("tampered XP capped", capped.ok && capped.data.profile.xp === 180, capped.ok ? capped.data.profile.xp : capped);

// Invalid house is rejected and cleared.
storage.setItem(saveKey, JSON.stringify({ ...validSave, profile: { ...validSave.profile, houseId: "hufflepuff" } }));
const invalidHouse = saveSystem.load();
check("invalid house save rejected", !invalidHouse.ok && invalidHouse.reason === "corrupt");
check("invalid save removed", storage.getItem(saveKey) === null);

// Student/house mismatch is rejected and cleared.
storage.setItem(saveKey, JSON.stringify({ ...validSave, profile: { ...validSave.profile, characterId: "ARV-001" } }));
const mismatch = saveSystem.load();
check("mismatched student/house rejected", !mismatch.ok && mismatch.reason === "corrupt");
check("mismatch save removed", storage.getItem(saveKey) === null);

// Duplicate mission steps cannot fake completion.
storage.setItem(
  saveKey,
  JSON.stringify({
    ...validSave,
    mission: { started: true, step: 4, completed: ["meet-meera", "meet-meera", "meet-meera", "meet-meera"] },
    night: emptyNightSave(),
  }),
);
const duplicateMission = saveSystem.load();
check(
  "duplicate mission steps cannot complete mission",
  duplicateMission.ok && duplicateMission.data.mission.completed.length === 1 && !duplicateMission.data.night.started,
  duplicateMission.ok ? duplicateMission.data.mission : duplicateMission,
);

// Success without four items is not accepted.
storage.setItem(
  saveKey,
  JSON.stringify({
    ...validSave,
    night: { ...validSave.night, active: false, step: 4, collected: [], success: true, completedAt: 1_760_000_000_000 },
  }),
);
const invalidSuccess = saveSystem.load();
check("success requires four collected items", invalidSuccess.ok && !invalidSuccess.data.night.success, invalidSuccess.ok ? invalidSuccess.data.night : invalidSuccess);

// v1 migration.
storage.setItem(
  saveKey,
  JSON.stringify({
    version: 1,
    savedAt: 1_760_000_000_000,
    player: { position: { x: 0, y: 0, z: 42 }, rotationY: Math.PI },
    settings: DEFAULT_SETTINGS,
    character: DEFAULT_CHARACTER,
    mission: { started: true, step: MISSION_STEPS.length, completed: MISSION_STEPS.map((step) => step.id) },
  }),
);
const migrated = saveSystem.load();
check("v1 save migrates", migrated.ok && migrated.data.version === 2);
if (migrated.ok) {
  check("v1 migration assigns Aravali Abdul Kudus", migrated.data.profile.houseId === "aravali" && migrated.data.profile.characterId === "ARV-001", migrated.data.profile);
  check("v1 migration is idempotent for rewards", migrated.data.profile.xp === 120 && migrated.data.profile.achievements.includes("first-day"), migrated.data.profile);
  check("v1 migration has no night progress", !migrated.data.night.active && !migrated.data.night.success && !migrated.data.night.caught, migrated.data.night);
}

// House captain/prefect lookup sanity.
for (const house of HOUSES) {
  check(`${house.shortName} identity e.g. hostel`, Boolean(getHouse(house.id)?.hostelName));
}

console.log(failures === 0 ? "DATA_TESTS_OK" : `DATA_TESTS_FAILED:${failures}`);
if (failures > 0) process.exit(1);
