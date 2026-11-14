import { motion } from "framer-motion";
import { ArrowLeft, ChevronRight, Flag, Moon, ShieldCheck, Trophy } from "lucide-react";
import type { GameEngine } from "../core/GameEngine";
import type { GameUIState } from "../core/types";
import { escapeLevelNumber, totalEscapeXp } from "../data/escape";
import { getHouse } from "../data/houses";
import { HouseEmblem } from "./HouseVisuals";

export function AdventureMenu({
  state,
  engine,
}: {
  state: GameUIState;
  engine: GameEngine | null;
}) {
  const profile = state.profile;
  const house = profile ? getHouse(profile.houseId) : null;
  const escape = state.escapeSave;
  const completedLevels = new Set(escape?.records.map((record) => record.levelId) ?? []).size;
  const best = escape?.records.reduce((value, record) => Math.max(value, record.bestScore), 0) ?? 0;
  const nightDone = profile?.achievements.includes("midnight-garden") ?? false;
  const nightActive = state.night?.active ?? false;

  return (
    <div
      className="film-grain absolute inset-0 z-50 overflow-y-auto bg-[#080b08]/94 px-5 py-7 sm:px-8 sm:py-10"
      role="dialog"
      aria-modal="true"
      aria-label="Adventure menu"
      data-testid="adventure-menu"
    >
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(80%_60%_at_18%_0%,#26351f66,transparent_60%),radial-gradient(70%_50%_at_90%_92%,#3a2b1966,transparent_65%)]" />
      <div className="pointer-events-none fixed inset-0 vignette opacity-85" />

      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        className="relative mx-auto flex min-h-full w-full max-w-5xl flex-col justify-center"
      >
        <header className="flex flex-wrap items-start justify-between gap-4 border-b border-[#d9c9a4]/15 pb-5">
          <div>
            <p className="label-cinema text-[#d9b56d]/80">Operation Midnight Mischief · Adventure menu</p>
            <h2 className="mt-2 max-w-2xl font-display text-[clamp(2.4rem,5.4vw,4.2rem)] leading-[0.98] text-[#f2e8d4]">
              Choose your caper.
            </h2>
            <p className="mt-2 max-w-xl font-ui text-[11px] leading-relaxed text-[#e9ddc8]/50">
              A fictional after-hours stealth game, or the campus obstacle challenge. Both are
              optional, personal and separate from official house points.
            </p>
          </div>
          {profile && house && (
            <div className="flex items-center gap-3 border border-[#d9c9a4]/18 bg-black/20 px-3 py-2">
              <HouseEmblem houseId={house.id} size={34} />
              <div>
                <p className="font-display text-base leading-tight text-[#f2e7d2]">{profile.characterName}</p>
                <p className="mt-0.5 font-ui text-[8px] uppercase tracking-[0.18em] text-[#e9ddc8]/40">
                  {house.shortName} · Lv {profile.level}
                </p>
              </div>
            </div>
          )}
        </header>

        <div className="mt-6 grid gap-3 md:grid-cols-2">
          <button
            type="button"
            onClick={() => engine?.startNight()}
            data-testid="adventure-night"
            className="group relative overflow-hidden border border-[#8fa4b4]/30 bg-[#10151a] p-5 text-left transition hover:border-[#b8cbd8]/65 hover:bg-[#151c22] sm:p-7"
          >
            <span className="absolute right-5 top-5 font-ui text-[9px] uppercase tracking-[0.24em] text-[#9fb9c9]/45">
              Stealth
            </span>
            <span className="flex size-11 items-center justify-center rounded-full border border-[#9fb9c9]/40 text-[#c7d8e4]">
              <Moon className="size-5" />
            </span>
            <h3 className="mt-5 font-display text-3xl leading-none text-[#f0e8da] sm:text-4xl">
              Operation Midnight Mischief
            </h3>
            <p className="mt-1.5 font-ui text-[9px] uppercase tracking-[0.22em] text-[#aebfca]/65">
              Fictional stealth caper
            </p>
            <p className="mt-4 max-w-md font-ui text-[12px] leading-relaxed text-[#e9ddc8]/55">
              Search the garden for four club markers, avoid torchlight and patrol cones, and sneak
              back to the hostel without being caught.
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-[#9fb9c9]/15 pt-3 font-ui text-[8px] uppercase tracking-[0.16em] text-[#b9cee2]/55">
              <span className="inline-flex items-center gap-1.5">
                <ShieldCheck className="size-3" /> No house points
              </span>
              <span>{nightActive ? `Attempt ${state.night?.attempts ?? 1}` : nightDone ? "Replay available" : "Not yet completed"}</span>
              <ChevronRight className="ml-auto size-4 transition group-hover:translate-x-1" />
            </div>
          </button>

          <button
            type="button"
            onClick={() => engine?.openEscape()}
            data-testid="adventure-escape"
            className="group relative overflow-hidden border border-[#d9b56d]/35 bg-[#15130e] p-5 text-left transition hover:border-[#e7c987]/75 hover:bg-[#1b1811] sm:p-7"
          >
            <span className="absolute right-5 top-5 font-ui text-[9px] uppercase tracking-[0.24em] text-[#d9b56d]/55">Obstacle</span>
            <span className="flex size-11 items-center justify-center rounded-full border border-[#d9b56d]/45 text-[#e8cf9b]">
              <Flag className="size-5" />
            </span>
            <h3 className="mt-5 font-display text-3xl leading-none text-[#f5ead4] sm:text-4xl">
              Campus Escape
            </h3>
            <p className="mt-1.5 font-ui text-[9px] uppercase tracking-[0.22em] text-[#d9c08a]/70">
              Timed campus obstacle course
            </p>
            <p className="mt-4 max-w-md font-ui text-[12px] leading-relaxed text-[#e9ddc8]/58">
              Run the sports ground, clear hurdles and moving obstacles, collect energy tokens and
              reach the finish before the timer expires. Three courses and three difficulties.
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-[#d9b56d]/15 pt-3 font-ui text-[8px] uppercase tracking-[0.16em] text-[#e8d4a8]/60">
              <span className="inline-flex items-center gap-1.5">
                <Trophy className="size-3" /> {completedLevels}/3 complete · Lv {escape ? escapeLevelNumber(escape) : 1}
              </span>
              <span className="text-[#e9ddc8]/35">Best {best || "—"} · {escape ? totalEscapeXp(escape) : 0} XP</span>
              <ChevronRight className="ml-auto size-4 transition group-hover:translate-x-1" />
            </div>
          </button>
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-[#d9c9a4]/10 pt-4">
          <p className="max-w-2xl font-ui text-[9px] leading-relaxed text-[#e9ddc8]/30">
            Campus Escape records are personal and saved on this device under your player ID.
            Completing a level never changes your house assignment or official house points.
          </p>
          <button
            type="button"
            onClick={() => engine?.closeAdventure()}
            data-testid="adventure-back"
            className="inline-flex items-center gap-2 border border-[#e9ddc8]/15 px-4 py-2.5 font-ui text-[9px] uppercase tracking-[0.22em] text-[#e9ddc8]/55 transition hover:border-[#e9ddc8]/35 hover:text-[#e9ddc8]/80"
          >
            <ArrowLeft className="size-3" /> Back to pause
          </button>
        </div>
      </motion.div>
    </div>
  );
}
