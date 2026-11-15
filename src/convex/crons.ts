import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

/**
 * Multiplayer housekeeping. Expires stale presence and abandoned rooms even
 * when nobody has a tab open, so closed rooms never accept new players.
 */
crons.interval(
  "multiplayer-cleanup",
  { minutes: 1 },
  internal.multiplayer.cleanup,
  {},
);

export default crons;
