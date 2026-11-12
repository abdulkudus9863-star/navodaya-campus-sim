import { HOUSES, isHouseId, type HouseId } from "./houses";

export type CompetitionCategory = "sports" | "academic" | "cultural" | "athletics" | "special";
export type CompetitionFormat = "individual" | "team";
export type Placement = 1 | 2 | 3 | 4;

export const CATEGORY_LABELS: Record<CompetitionCategory, string> = {
  sports: "Sports",
  academic: "Academic",
  cultural: "Cultural",
  athletics: "Athletics",
  special: "Campus challenge",
};

export const PLACEMENT_POINTS: Record<Placement, number> = {
  1: 20,
  2: 15,
  3: 10,
  4: 5,
};

export interface CompetitionPlacement {
  houseId: HouseId;
  position: Placement;
  detail: string;
}

export interface CompetitionResult {
  id: string;
  eventId: string;
  eventName: string;
  category: CompetitionCategory;
  season: string;
  format: CompetitionFormat;
  placements: CompetitionPlacement[];
  approved: boolean;
  awardedAt: string;
}

/**
 * Term I archive. These are approved, immutable results used to seed the
 * standings. Future competitions must append a uniquely identified, validated
 * result; the night mission deliberately cannot award house points.
 */
export const COMPETITION_RESULTS: readonly CompetitionResult[] = [
  {
    id: "term1-cricket-final",
    eventId: "cricket",
    eventName: "Inter-House Cricket Final",
    category: "sports",
    season: "Term I",
    format: "team",
    placements: [
      { houseId: "udaygiri", position: 1, detail: "Won by 18 runs" },
      { houseId: "aravali", position: 2, detail: "Runners-up" },
      { houseId: "nilgiri", position: 3, detail: "Third place" },
      { houseId: "shivalik", position: 4, detail: "Fourth place" },
    ],
    approved: true,
    awardedAt: "2026-08-21T10:00:00.000Z",
  },
  {
    id: "term1-football-league",
    eventId: "football",
    eventName: "Inter-House Football League",
    category: "sports",
    season: "Term I",
    format: "team",
    placements: [
      { houseId: "nilgiri", position: 1, detail: "Unbeaten in four matches" },
      { houseId: "shivalik", position: 2, detail: "Runners-up" },
      { houseId: "aravali", position: 3, detail: "Third place" },
      { houseId: "udaygiri", position: 4, detail: "Fourth place" },
    ],
    approved: true,
    awardedAt: "2026-09-04T10:00:00.000Z",
  },
  {
    id: "term1-athletics-meet",
    eventId: "athletics",
    eventName: "Annual Athletics Meet",
    category: "athletics",
    season: "Term I",
    format: "individual",
    placements: [
      { houseId: "aravali", position: 1, detail: "Overall track champions" },
      { houseId: "udaygiri", position: 2, detail: "Second overall" },
      { houseId: "nilgiri", position: 3, detail: "Third overall" },
      { houseId: "shivalik", position: 4, detail: "Fourth overall" },
    ],
    approved: true,
    awardedAt: "2026-09-19T10:00:00.000Z",
  },
  {
    id: "term1-academic-quiz",
    eventId: "academic-quiz",
    eventName: "Inter-House Academic Quiz",
    category: "academic",
    season: "Term I",
    format: "team",
    placements: [
      { houseId: "shivalik", position: 1, detail: "Won the tie-breaker" },
      { houseId: "aravali", position: 2, detail: "Runners-up" },
      { houseId: "udaygiri", position: 3, detail: "Third place" },
      { houseId: "nilgiri", position: 4, detail: "Fourth place" },
    ],
    approved: true,
    awardedAt: "2026-10-02T10:00:00.000Z",
  },
  {
    id: "term1-cultural-festival",
    eventId: "cultural",
    eventName: "Inter-House Cultural Festival",
    category: "cultural",
    season: "Term I",
    format: "team",
    placements: [
      { houseId: "nilgiri", position: 1, detail: "Best overall presentation" },
      { houseId: "aravali", position: 2, detail: "Runners-up" },
      { houseId: "udaygiri", position: 3, detail: "Third place" },
      { houseId: "shivalik", position: 4, detail: "Fourth place" },
    ],
    approved: true,
    awardedAt: "2026-10-18T10:00:00.000Z",
  },
];

export interface CompetitionValidation {
  ok: boolean;
  errors: string[];
}

/** Structural validation for a result before it can affect standings. */
export function validateCompetitionResult(result: CompetitionResult): CompetitionValidation {
  const errors: string[] = [];
  if (!result.id.trim()) errors.push("A result needs a unique id.");
  if (!result.eventId.trim()) errors.push("A result needs an event id.");
  if (!result.eventName.trim()) errors.push("A result needs an event name.");
  if (!result.approved) errors.push("The result is not approved.");
  const positions = new Set<number>();
  const houses = new Set<string>();
  for (const placement of result.placements) {
    if (!isHouseId(placement.houseId)) errors.push(`Invalid house: ${placement.houseId}`);
    if (houses.has(placement.houseId)) errors.push(`House appears twice: ${placement.houseId}`);
    houses.add(placement.houseId);
    if (![1, 2, 3, 4].includes(placement.position)) errors.push(`Invalid position: ${placement.position}`);
    if (positions.has(placement.position)) errors.push(`Position appears twice: ${placement.position}`);
    positions.add(placement.position);
  }
  if (result.placements.length !== 4) errors.push("A full result must place all four houses.");
  return { ok: errors.length === 0, errors };
}

export interface HouseStanding {
  house: (typeof HOUSES)[number];
  points: number;
  rank: number;
  firstPlaces: number;
}

export interface ChampionshipRecord {
  eventName: string;
  category: CompetitionCategory;
  season: string;
  winner: HouseId;
}

export interface Standings {
  standings: HouseStanding[];
  championships: ChampionshipRecord[];
  acceptedResults: CompetitionResult[];
  rejectedResultIds: string[];
}

/**
 * Pure aggregation. Duplicate result IDs and duplicate event IDs are ignored,
 * so re-submitting an approved result cannot double-award points.
 */
export function buildStandings(): Standings {
  const points = new Map<HouseId, number>(HOUSES.map((house) => [house.id, 0]));
  const firstPlaces = new Map<HouseId, number>(HOUSES.map((house) => [house.id, 0]));
  const seenResultIds = new Set<string>();
  const seenEventIds = new Set<string>();
  const acceptedResults: CompetitionResult[] = [];
  const rejectedResultIds: string[] = [];
  const championships: ChampionshipRecord[] = [];

  for (const result of COMPETITION_RESULTS) {
    if (
      seenResultIds.has(result.id) ||
      seenEventIds.has(result.eventId) ||
      !validateCompetitionResult(result).ok
    ) {
      rejectedResultIds.push(result.id);
      continue;
    }
    seenResultIds.add(result.id);
    seenEventIds.add(result.eventId);
    acceptedResults.push(result);
    for (const placement of result.placements) {
      points.set(placement.houseId, (points.get(placement.houseId) ?? 0) + PLACEMENT_POINTS[placement.position]);
      if (placement.position === 1) {
        firstPlaces.set(placement.houseId, (firstPlaces.get(placement.houseId) ?? 0) + 1);
        championships.push({
          eventName: result.eventName,
          category: result.category,
          season: result.season,
          winner: placement.houseId,
        });
      }
    }
  }

  const ordered = HOUSES.map((house) => ({
    house,
    points: points.get(house.id) ?? 0,
    firstPlaces: firstPlaces.get(house.id) ?? 0,
    rank: 0,
  })).sort((a, b) => b.points - a.points || b.firstPlaces - a.firstPlaces);

  ordered.forEach((entry, index) => {
    entry.rank = index + 1;
  });

  return { standings: ordered, championships, acceptedResults, rejectedResultIds };
}

export function standingsForHouse(houseId: HouseId): HouseStanding | undefined {
  return buildStandings().standings.find((entry) => entry.house.id === houseId);
}
