import { motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Check, Leaf, Moon, RotateCcw, ShieldAlert } from "lucide-react";
import type { GameEngine } from "../core/GameEngine";
import type { GameUIState } from "../core/types";
import { getAchievement } from "../data/achievements";
import { getHouse } from "../data/houses";
import { gardenItem } from "../data/night";
import { HouseEmblem } from "./HouseVisuals";

export function NightResultOverlay({
  state,
  engine,
}: {
  state: GameUIState;
  engine: GameEngine | null;
}) {
  const result = state.nightResult;
  if (!result) return null;
  const success = result.outcome === "success";
  const house = state.profile ? getHouse(state.profile.houseId) : undefined;
  const achievement = result.achievementId ? getAchievement(result.achievementId) : undefined;

  return (
    <div
      className="film-grain absolute inset-0 z-50 overflow-y-auto bg-[#070b12]/88 px-5 py-10 backdrop-blur-[3px]"
      data-testid="night-result"
      role="dialog"
      aria-modal="true"
      aria-label={success ? "Operation Midnight Mischief complete" : "Operation Midnight Mischief failed"}
    >
      <div
        className="pointer-events-none fixed inset-0 opacity-55"
        style={{
          background: success
            ? `radial-gradient(80% 60% at 50% 20%, ${house?.color ?? "#2563EB"}25, transparent 62%), radial-gradient(60% 50% at 10% 70%, #1b3a2a66, transparent 65%)`
            : "radial-gradient(75% 60% at 50% 20%, #8d342833, transparent 62%), radial-gradient(60% 50% at 90% 70%, #42332666, transparent 65%)",
        }}
      />
      <div className="pointer-events-none fixed inset-0 vignette opacity-85" />
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
        className="relative mx-auto w-full max-w-2xl py-6 sm:py-10"
      >
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-full border border-[#f0e0c0]/25 bg-black/30">
              {success ? <Moon className="size-4 text-[#f0d29b]" /> : <ShieldAlert className="size-4 text-[#e0a08c]" />}
            </span>
            <div>
              <p className="label-cinema text-[#ecd7af]/70">Operation Midnight Mischief</p>
              <p className="mt-1 font-ui text-[9px] uppercase tracking-[0.2em] text-foreground/35">
                Attempt {result.attempts} · {success ? "Undetected return" : "Patrol interception"}
              </p>
            </div>
          </div>
          {house && (
            <div className="flex items-center gap-2">
              <HouseEmblem houseId={house.id} size={28} />
              <span className="hidden font-ui text-[9px] uppercase tracking-[0.18em] text-foreground/40 sm:block">
                {house.name}
              </span>
            </div>
          )}
        </div>

        <div className="mt-8 border border-[#f0e0c0]/15 bg-[#0c0d0c]/85 shadow-[0_60px_140px_-55px_rgba(0,0,0,1)]">
          <div className="border-b border-[#f0e0c0]/12 px-6 py-7 sm:px-9">
            <p className={`label-cinema ${success ? "text-[#9fd7a8]" : "text-[#e0a08c]"}`}>
              {success ? "Mission complete" : "Caught"}
            </p>
            <h2 className="mt-3 font-display text-4xl leading-tight text-[#f4ead6] sm:text-5xl">
              {result.title}
            </h2>
            <p className="mt-4 max-w-xl font-ui text-[12px] leading-relaxed text-foreground/55">
              {result.message}
            </p>
          </div>

          <div className="grid gap-px border-b border-[#f0e0c0]/12 bg-[#f0e0c0]/10 sm:grid-cols-3">
            <div className="bg-[#11120f] px-5 py-4">
              <p className="label-cinema text-[8px] text-foreground/35">XP</p>
              <p className="mt-1 font-display text-2xl text-foreground/90">
                {result.xpAwarded > 0 ? `+${result.xpAwarded}` : "0"}
              </p>
              <p className="mt-1 font-ui text-[9px] uppercase tracking-[0.16em] text-foreground/30">
                {result.rewardAlreadyClaimed ? "Reward already claimed" : "One-time reward"}
              </p>
            </div>
            <div className="bg-[#11120f] px-5 py-4">
              <p className="label-cinema text-[8px] text-foreground/35">House points</p>
              <p className="mt-1 font-display text-2xl text-foreground/90">0</p>
              <p className="mt-1 font-ui text-[9px] uppercase tracking-[0.16em] text-foreground/30">
                No competition rule
              </p>
            </div>
            <div className="bg-[#11120f] px-5 py-4">
              <p className="label-cinema text-[8px] text-foreground/35">Markers</p>
              <p className="mt-1 font-display text-2xl text-foreground/90">
                {success ? result.collected.length : 0} / 4
              </p>
              <p className="mt-1 font-ui text-[9px] uppercase tracking-[0.16em] text-foreground/30">
                {success ? "Returned to the club" : "Confiscated by Mr. Barua"}
              </p>
            </div>
          </div>

          {result.collected.length > 0 && (
            <div className="flex flex-wrap gap-2 border-b border-[#f0e0c0]/12 px-6 py-4 sm:px-9">
              {result.collected.map((itemId) => {
                const item = gardenItem(itemId);
                return (
                  <span key={itemId} className="inline-flex items-center gap-1.5 border border-[#f0e0c0]/15 px-2.5 py-1 font-ui text-[9px] uppercase tracking-[0.14em] text-foreground/55">
                    <Leaf className="size-2.5 text-[#9fc38d]" /> {item.markerShortName}
                  </span>
                );
              })}
            </div>
          )}

          {achievement && (
            <div className="flex items-start gap-3 border-b border-[#f0e0c0]/12 px-6 py-4 sm:px-9">
              <Check className="mt-0.5 size-3.5 text-primary/80" />
              <div>
                <p className="font-display text-sm text-foreground/80">
                  {achievement.name}
                  {result.rewardAlreadyClaimed ? " · already unlocked" : " · unlocked"}
                </p>
                <p className="mt-0.5 font-ui text-[10px] leading-relaxed text-foreground/40">
                  {achievement.description}
                </p>
              </div>
            </div>
          )}

          <div className="flex flex-col gap-2.5 px-6 py-6 sm:flex-row sm:items-center sm:justify-between sm:px-9">
            {success ? (
              <>
                <button
                  type="button"
                  onClick={() => engine?.finishNight()}
                  className="inline-flex items-center justify-center gap-2 border border-primary/60 bg-primary/12 px-5 py-3 font-ui text-[10px] uppercase tracking-[0.24em] text-primary transition hover:bg-primary/20"
                >
                  <ArrowRight className="size-3.5" /> Return to campus
                </button>
                <button
                  type="button"
                  onClick={() => engine?.retryNight()}
                  className="inline-flex items-center justify-center gap-2 border border-foreground/15 px-4 py-3 font-ui text-[9px] uppercase tracking-[0.2em] text-foreground/50 transition hover:border-foreground/35"
                >
                  <RotateCcw className="size-3" /> Run it again
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => engine?.retryNight()}
                  className="inline-flex items-center justify-center gap-2 border border-primary/60 bg-primary/12 px-5 py-3 font-ui text-[10px] uppercase tracking-[0.24em] text-primary transition hover:bg-primary/20"
                >
                  <RotateCcw className="size-3.5" /> Try again
                </button>
                {state.profile && !state.profile.achievements.includes("garden-duty") && (
                  <button
                    type="button"
                    onClick={() => engine?.startGardenDuty()}
                    className="inline-flex items-center justify-center gap-2 border border-[#9fc38d]/35 px-4 py-3 font-ui text-[9px] uppercase tracking-[0.2em] text-[#cfe0bd]/75 transition hover:border-[#9fc38d]/60 hover:text-[#e4efd8]"
                  >
                    <Leaf className="size-3" /> Help the garden staff
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => engine?.finishNight()}
                  className="inline-flex items-center justify-center gap-2 border border-foreground/15 px-4 py-3 font-ui text-[9px] uppercase tracking-[0.2em] text-foreground/50 transition hover:border-foreground/35"
                >
                  <ArrowLeft className="size-3" /> Return to campus
                </button>
              </>
            )}
          </div>
        </div>

        <p className="mt-4 text-center font-ui text-[9px] uppercase tracking-[0.18em] text-foreground/25">
          Fictional campus caper · no real theft · markers exist only during the active run
        </p>
      </motion.div>
    </div>
  );
}
