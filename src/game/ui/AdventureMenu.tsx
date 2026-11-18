import { motion } from "framer-motion";
import { ArrowLeft, ChevronRight, Clock3, DoorOpen, Eye, Flag, Moon, MoonStar, ShieldCheck, Trophy, Users, Utensils } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router";
import type { GameEngine } from "../core/GameEngine";
import type { GameUIState } from "../core/types";
import { CLASS_BUNK_DIFFICULTIES, type ClassBunkDifficulty } from "../data/classBunk";
import { MESS_MEAL_DIFFICULTIES, type MessMealDifficulty } from "../data/messMeal";
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
  const navigate = useNavigate();
  const profile = state.profile;
  const house = profile ? getHouse(profile.houseId) : null;
  const escape = state.escapeSave;
  const completedLevels = new Set(escape?.records.map((record) => record.levelId) ?? []).size;
  const best = escape?.records.reduce((value, record) => Math.max(value, record.bestScore), 0) ?? 0;
  const nightDone = profile?.achievements.includes("midnight-garden") ?? false;
  const nightActive = state.night?.active ?? false;
  const [bunkDifficulty, setBunkDifficulty] = useState<ClassBunkDifficulty>("normal");
  const [messDifficulty, setMessDifficulty] = useState<MessMealDifficulty>("normal");

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
            <p className="label-cinema text-[#d9b56d]/80">Adventure menu · Optional capers</p>
            <h2 className="mt-2 max-w-2xl font-display text-[clamp(2.4rem,5.4vw,4.2rem)] leading-[0.98] text-[#f2e8d4]">
              Choose your caper.
            </h2>
            <p className="mt-2 max-w-xl font-ui text-[11px] leading-relaxed text-[#e9ddc8]/50">
              Skip a class, sneak through the garden after dark, or run the obstacle course. Every
              caper is optional, personal and separate from official house points.
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
          <div
            data-testid="adventure-mess-meal"
            className="group relative overflow-hidden border border-[#78a9c4]/40 bg-[linear-gradient(122deg,#0b141d_0%,#0d1c26_52%,#101a16_100%)] p-5 text-left transition hover:border-[#a9d6ee]/70 sm:p-7 md:col-span-2"
          >
            <span className="absolute right-5 top-5 border border-[#9ed3ee]/30 bg-[#9ed3ee]/10 px-2 py-1 font-ui text-[8px] uppercase tracking-[0.24em] text-[#cdeaf9]/80">
              PLAYABLE · NIGHT
            </span>
            <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
              <div className="max-w-2xl">
                <span className="flex size-11 items-center justify-center rounded-full border border-[#9ed3ee]/45 text-[#cdeaf9]">
                  <Utensils className="size-5" />
                </span>
                <h3 className="mt-4 font-display text-[clamp(2.1rem,5vw,3.4rem)] leading-none text-[#edf6fb]">
                  MESS MEAL SNEAK
                </h3>
                <p className="mt-2 font-ui text-[12px] leading-relaxed text-[#d8e8f1]/72">
                  Slip out after lights-out, collect a hot meal and bring it home to your roommates.
                </p>
                <p className="mt-3 max-w-xl font-ui text-[10px] leading-relaxed text-[#d8e8f1]/42">
                  The real campus at night: hostel windows, streetlights and patrolling teachers. A
                  teacher who sees you walks over, pauses the run and sends you to Principal Moinm
                  Rahman. Resume after the referral with your meal still in hand.
                </p>
                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 font-ui text-[8px] uppercase tracking-[0.16em] text-[#b9dced]/60">
                  <span className="inline-flex items-center gap-1.5"><MoonStar className="size-3" /> Night campus</span>
                  <span className="inline-flex items-center gap-1.5"><Eye className="size-3" /> Real line-of-sight patrols</span>
                  <span className="inline-flex items-center gap-1.5"><Utensils className="size-3" /> Roommate celebration</span>
                </div>
              </div>

              <div className="w-full shrink-0 md:w-[19rem]">
                <div className="grid grid-cols-3 gap-1.5">
                  {(Object.keys(MESS_MEAL_DIFFICULTIES) as MessMealDifficulty[]).map((difficulty) => {
                    const config = MESS_MEAL_DIFFICULTIES[difficulty];
                    const selected = messDifficulty === difficulty;
                    return (
                      <button
                        key={difficulty}
                        type="button"
                        onClick={() => setMessDifficulty(difficulty)}
                        aria-pressed={selected}
                        className={`border px-2 py-2 font-ui text-[9px] uppercase tracking-[0.16em] transition ${
                          selected
                            ? "border-[#a9d6ee]/80 bg-[#a9d6ee]/15 text-[#e2f4ff]"
                            : "border-[#d8e8f1]/15 text-[#d8e8f1]/50 hover:border-[#d8e8f1]/35"
                        }`}
                      >
                        {config.label}
                      </button>
                    );
                  })}
                </div>
                <p className="mt-2 min-h-8 font-ui text-[9px] leading-relaxed text-[#d8e8f1]/45">
                  {MESS_MEAL_DIFFICULTIES[messDifficulty].detail}
                </p>
                <button
                  type="button"
                  onClick={() => engine?.startMessMeal(messDifficulty)}
                  data-testid="adventure-mess-meal-start"
                  className="mt-2 inline-flex w-full items-center justify-center gap-2 border border-[#8fc7e8]/65 bg-[#8fc7e8]/12 px-4 py-3 font-ui text-[10px] uppercase tracking-[0.22em] text-[#e2f4ff] transition hover:border-[#bfe5fa]/90 hover:bg-[#8fc7e8]/22"
                >
                  <Moon className="size-3.5" /> Start night run · {MESS_MEAL_DIFFICULTIES[messDifficulty].label}
                </button>
              </div>
            </div>
          </div>

          <div
            data-testid="adventure-class-bunk"
            className="group relative overflow-hidden border border-[#c9a45d]/40 bg-[linear-gradient(125deg,#1a1a10_0%,#12180f_58%,#0d1512_100%)] p-5 text-left transition hover:border-[#e8cc8e]/75 sm:p-7 md:col-span-2"
          >
            <span className="absolute right-5 top-5 border border-[#9fc38d]/35 bg-[#9fc38d]/10 px-2 py-1 font-ui text-[8px] uppercase tracking-[0.24em] text-[#cfe0bd]/80">
              PLAYABLE
            </span>
            <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
              <div className="max-w-2xl">
                <span className="flex size-11 items-center justify-center rounded-full border border-[#d7b873]/45 text-[#efd79f]">
                  <DoorOpen className="size-5" />
                </span>
                <h3 className="mt-4 font-display text-[clamp(2.1rem,5vw,3.4rem)] leading-none text-[#f5ead4]">
                  CLASS BUNK
                </h3>
                <p className="mt-2 font-ui text-[12px] leading-relaxed text-[#e9ddc8]/70">
                  Skip the class. Explore the campus. Don't get caught!
                </p>
                <p className="mt-3 max-w-xl font-ui text-[10px] leading-relaxed text-[#e9ddc8]/40">
                  Start inside Room 101, cover real campus stops, watch the patrols on the minimap and
                  return before the bell. A teacher who spots you sends you straight to Principal Moinm
                  Rahman.
                </p>
                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 font-ui text-[8px] uppercase tracking-[0.16em] text-[#cfe0bd]/55">
                  <span className="inline-flex items-center gap-1.5"><Clock3 className="size-3" /> Class period timer</span>
                  <span className="inline-flex items-center gap-1.5"><Eye className="size-3" /> Line-of-sight patrols</span>
                  <span className="inline-flex items-center gap-1.5"><ShieldCheck className="size-3" /> Referral consequences</span>
                </div>
              </div>

              <div className="w-full shrink-0 md:w-[19rem]">
                <div className="grid grid-cols-3 gap-1.5">
                  {(Object.keys(CLASS_BUNK_DIFFICULTIES) as ClassBunkDifficulty[]).map((difficulty) => {
                    const config = CLASS_BUNK_DIFFICULTIES[difficulty];
                    const selected = bunkDifficulty === difficulty;
                    return (
                      <button
                        key={difficulty}
                        type="button"
                        onClick={() => setBunkDifficulty(difficulty)}
                        aria-pressed={selected}
                        className={`border px-2 py-2 font-ui text-[9px] uppercase tracking-[0.16em] transition ${
                          selected
                            ? "border-[#e8cc8e]/80 bg-[#e8cc8e]/15 text-[#f6e4bb]"
                            : "border-[#e9ddc8]/15 text-[#e9ddc8]/50 hover:border-[#e9ddc8]/35"
                        }`}
                      >
                        {config.label}
                      </button>
                    );
                  })}
                </div>
                <p className="mt-2 min-h-8 font-ui text-[9px] leading-relaxed text-[#e9ddc8]/40">
                  {CLASS_BUNK_DIFFICULTIES[bunkDifficulty].detail}
                </p>
                <button
                  type="button"
                  onClick={() => engine?.startClassBunk(bunkDifficulty)}
                  data-testid="adventure-bunk-start"
                  className="mt-2 inline-flex w-full items-center justify-center gap-2 border border-[#c9a45d]/65 bg-[#c9a45d]/14 px-4 py-3 font-ui text-[10px] uppercase tracking-[0.22em] text-[#f5e3ba] transition hover:border-[#f0d79d]/90 hover:bg-[#c9a45d]/24"
                >
                  <DoorOpen className="size-3.5" /> Skip class · {CLASS_BUNK_DIFFICULTIES[bunkDifficulty].label}
                </button>
              </div>
            </div>
          </div>

          <div className="group relative overflow-hidden border border-[#8fa4b4]/30 bg-[#10151a] p-5 text-left transition hover:border-[#b8cbd8]/65 hover:bg-[#151c22] sm:p-7">
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
            <div className="mt-5 grid gap-2 border-t border-[#9fb9c9]/15 pt-4 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => engine?.startNight()}
                data-testid="adventure-night"
                className="inline-flex items-center justify-center gap-2 border border-[#9fb9c9]/55 bg-[#9fb9c9]/10 px-3 py-2.5 font-ui text-[9px] uppercase tracking-[0.18em] text-[#dbe7f0] transition hover:border-[#b9cee2]/80 hover:bg-[#9fb9c9]/16"
              >
                <Moon className="size-3" /> Single player
              </button>
              <button
                type="button"
                onClick={() => navigate("/multiplayer")}
                data-testid="adventure-multiplayer"
                className="inline-flex items-center justify-center gap-2 border border-[#8fbf95]/45 bg-[#8fbf95]/10 px-3 py-2.5 font-ui text-[9px] uppercase tracking-[0.18em] text-[#c8e3ca] transition hover:border-[#a8d6ad]/80 hover:bg-[#8fbf95]/16"
              >
                <Users className="size-3" /> Multiplayer · 2–4
              </button>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-3 font-ui text-[8px] uppercase tracking-[0.16em] text-[#b9cee2]/50">
              <span className="inline-flex items-center gap-1.5">
                <ShieldCheck className="size-3" /> No house points
              </span>
              <span>{nightActive ? `Attempt ${state.night?.attempts ?? 1}` : nightDone ? "Replay available" : "Not yet completed"}</span>
              <ChevronRight className="ml-auto size-4" />
            </div>
          </div>

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
