import { motion } from "framer-motion";
import { ArrowRight, Compass, Map, Moon, ShieldCheck } from "lucide-react";
import type { GameEngine } from "../core/GameEngine";
import type { GameUIState } from "../core/types";
import { getHouse } from "../data/houses";
import { HouseEmblem } from "./HouseVisuals";

export function CampusPlan({
  state,
  engine,
}: {
  state: GameUIState;
  engine: GameEngine | null;
}) {
  const house = state.profile ? getHouse(state.profile.houseId) : null;
  const profile = state.profile;

  return (
    <div
      className="film-grain absolute inset-0 z-50 overflow-x-hidden overflow-y-auto bg-[#0a0c08]/92 px-5 py-8 sm:px-8 sm:py-10"
      role="dialog"
      aria-modal="true"
      aria-label="Choose today's activity"
      data-testid="plan-choice"
    >
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(80%_60%_at_20%_10%,#26351f66,transparent_60%),radial-gradient(70%_50%_at_90%_90%,#30281b66,transparent_65%)]" />
      <div className="pointer-events-none fixed inset-0 vignette opacity-85" />

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
        className="relative mx-auto flex min-h-full w-full max-w-5xl flex-col justify-center"
      >
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#8d9a75]/20 pb-5">
          <div>
            <p className="label-cinema text-[#b9c69d]/80">Day plan · Navodaya campus</p>
            <h2 className="mt-2 max-w-2xl font-display text-[clamp(2.2rem,5vw,3.8rem)] leading-[1.03] text-[#f1e8d5]">
              Your day at JNV begins.
              <br />
              What&apos;s your plan?
            </h2>
          </div>
          {profile && house && (
            <div className="flex items-center gap-3 border border-[#8d9a75]/20 bg-black/20 px-3 py-2">
              <HouseEmblem houseId={house.id} size={34} />
              <div>
                <p className="font-display text-base leading-tight text-[#f2e7d2]">
                  {profile.characterName}
                </p>
                <p className="mt-0.5 font-ui text-[8px] uppercase tracking-[0.18em] text-foreground/40">
                  {house.shortName} · Class {profile.className}
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-2">
          <button
            type="button"
            onClick={() => engine?.choosePlan("explore")}
            data-testid="plan-explore"
            className="group relative overflow-hidden border border-[#9aaa79]/35 bg-[#12180f] p-5 text-left transition hover:border-[#c4d3a5]/70 hover:bg-[#182014] sm:p-7"
          >
            <span className="absolute right-5 top-5 font-ui text-[9px] uppercase tracking-[0.26em] text-[#9aaa79]/50">
              Option A
            </span>
            <span className="flex size-11 items-center justify-center rounded-full border border-[#9aaa79]/40 text-[#c6d3aa]">
              <Compass className="size-5" />
            </span>
            <h3 className="mt-5 font-display text-3xl leading-none text-[#f1e8d5] sm:text-4xl">
              Explore the campus
            </h3>
            <p className="mt-1.5 font-ui text-[10px] uppercase tracking-[0.22em] text-[#aebc8d]/70">
              Campus tour · free roam
            </p>
            <p className="mt-4 max-w-md font-ui text-[12px] leading-relaxed text-foreground/55">
              Visit the academic block, laboratories, library, dining hall, sports ground, gardens
              and house hostels. Discover campus notes, unlock route stops and earn exploration XP.
            </p>
            <span className="mt-6 flex items-center justify-between border-t border-[#9aaa79]/20 pt-3 font-ui text-[9px] uppercase tracking-[0.22em] text-[#b9c69d]/60">
              <span className="inline-flex items-center gap-1.5">
                <Map className="size-3" /> Opens the campus map
              </span>
              <ArrowRight className="size-3.5 transition group-hover:translate-x-1" />
            </span>
          </button>

          <button
            type="button"
            onClick={() => engine?.choosePlan("stealth")}
            data-testid="plan-stealth"
            className="group relative overflow-hidden border border-[#b5a06d]/30 bg-[#15130e] p-5 text-left transition hover:border-[#d7bd83]/70 hover:bg-[#1b1811] sm:p-7"
          >
            <span className="absolute right-5 top-5 font-ui text-[9px] uppercase tracking-[0.26em] text-[#b5a06d]/50">
              Option B
            </span>
            <span className="flex size-11 items-center justify-center rounded-full border border-[#b5a06d]/40 text-[#dfc99b]">
              <Moon className="size-5" />
            </span>
            <h3 className="mt-5 font-display text-3xl leading-none text-[#f1e8d5] sm:text-4xl">
              Operation Midnight Mischief
            </h3>
            <p className="mt-1.5 font-ui text-[10px] uppercase tracking-[0.22em] text-[#c5ae7c]/70">
              Adventure menu · stealth & obstacle course
            </p>
            <p className="mt-4 max-w-md font-ui text-[12px] leading-relaxed text-foreground/55">
              Pick a fictional after-hours caper: sneak through the garden in Operation Midnight
              Mischief, or run the Campus Escape obstacle course. Personal XP only — no house
              points and no real trespassing.
            </p>
            <span className="mt-6 flex items-center justify-between border-t border-[#b5a06d]/20 pt-3 font-ui text-[9px] uppercase tracking-[0.22em] text-[#dfc99b]/60">
              <span className="inline-flex items-center gap-1.5">
                <ShieldCheck className="size-3" /> Two fictional capers
              </span>
              <ArrowRight className="size-3.5 transition group-hover:translate-x-1" />
            </span>
          </button>
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <p className="max-w-2xl font-ui text-[9px] leading-relaxed text-foreground/30">
            Both activities are optional and can be changed from the pause menu. The campus is an
            interpretive recreation inspired by JNV Bishnupur, Manipur — not a surveyed plan.
          </p>
          <button
            type="button"
            onClick={() => engine?.choosePlan("later")}
            data-testid="plan-later"
            className="inline-flex items-center gap-2 border border-foreground/15 px-4 py-2.5 font-ui text-[9px] uppercase tracking-[0.22em] text-foreground/55 transition hover:border-foreground/35 hover:text-foreground/80"
          >
            Decide later <ArrowRight className="size-3" />
          </button>
        </div>
      </motion.div>
    </div>
  );
}
