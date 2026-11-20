import { api } from "@/convex/_generated/api";
import { useAuth } from "@/hooks/use-auth";
import { getHouse, houseInkColor, type HouseId } from "../data/houses";
import {
  CUPBOARD_FOOD_LABELS,
  CUPBOARD_FOOD_ORDER,
  CUPBOARD_FOOD_SHORT_LABELS,
  cupboardTotal,
  type CupboardFoodId,
} from "../data/houseCupboard";
import type { GameEngine } from "../core/GameEngine";
import { useMutation, useQuery } from "convex/react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Check,
  CupSoda,
  DoorOpen,
  Drumstick,
  Flame,
  Loader2,
  Sandwich,
  Sparkles,
  Soup,
  Triangle,
  Users,
  X,
} from "lucide-react";
import { useEffect, useRef, useState, type ComponentType } from "react";
import { Link } from "react-router";
import { HouseEmblem } from "./HouseVisuals";

const FOOD_ICONS: Record<CupboardFoodId, ComponentType<{ className?: string }>> = {
  chicken: Drumstick,
  fries: Flame,
  samosa: Triangle,
  burger: Sandwich,
  coldDrink: CupSoda,
};

const FOOD_NOTES: Record<CupboardFoodId, string> = {
  chicken: "Crisp, warm and first to disappear.",
  fries: "Salted, shared and best eaten quickly.",
  samosa: "A hostel classic after evening prep.",
  burger: "The big trade of any MESS RUN.",
  coldDrink: "Cold relief after the long walk back.",
};

function ink(hex: string): string {
  return houseInkColor(hex);
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    const cleaned = error.message.replace(/^.*Uncaught ConvexError:\s*/i, "").trim();
    return cleaned || "The cupboard could not complete that action.";
  }
  return "The cupboard could not complete that action.";
}

export function HouseCupboardPanel({
  engine,
  houseId,
  onClose,
}: {
  engine: GameEngine | null;
  houseId: HouseId | null;
  onClose: () => void;
}) {
  const { isAuthenticated } = useAuth();
  const cupboard = useQuery(api.houseCupboard.myCupboard, isAuthenticated ? {} : "skip");
  const consumeFood = useMutation(api.houseCupboard.consumeFood);
  const [eating, setEating] = useState<CupboardFoodId | null>(null);
  const [busy, setBusy] = useState<CupboardFoodId | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const timeout = useRef<number | null>(null);
  const activeHouseId = (cupboard?.houseId as HouseId | undefined) ?? houseId ?? "aravali";
  const house = getHouse(activeHouseId) ?? getHouse("aravali")!;
  const colour = house.color;
  const textInk = ink(colour);
  const items = cupboard?.items ?? null;
  const total = items ? cupboardTotal(items) : 0;

  useEffect(() => {
    return () => {
      if (timeout.current) window.clearTimeout(timeout.current);
    };
  }, []);

  useEffect(() => {
    setError(null);
    setNotice(null);
  }, [cupboard?.houseId]);

  const eat = async (item: CupboardFoodId) => {
    if (busy) return;
    setBusy(item);
    setEating(item);
    setError(null);
    setNotice(null);
    engine?.playCupboardEat();
    try {
      const result = await consumeFood({ item });
      setNotice(
        result.remaining > 0
          ? `${CUPBOARD_FOOD_LABELS[item]} eaten. ${result.remaining} left on the shelf.`
          : `You took the last ${CUPBOARD_FOOD_LABELS[item].toLowerCase()}.`,
      );
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(null);
      if (timeout.current) window.clearTimeout(timeout.current);
      timeout.current = window.setTimeout(() => setEating(null), 1050);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="absolute inset-0 z-50 flex items-end justify-center bg-[#04100a]/68 px-0 pb-0 backdrop-blur-[3px] sm:items-center sm:px-5 sm:py-6"
      role="dialog"
      aria-modal="true"
      aria-label={`${house.name} shared food cupboard`}
      data-testid="house-cupboard-panel"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <motion.div
        initial={{ y: 36, opacity: 0, scale: 0.985 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        transition={{ duration: 0.36, ease: [0.22, 1, 0.36, 1] }}
        className="relative flex max-h-[94dvh] w-full max-w-5xl flex-col overflow-hidden border border-[#d9b66d]/35 bg-[#0a140f] shadow-[0_40px_140px_rgba(0,0,0,0.8)] sm:max-h-[90dvh]"
      >
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px" style={{ backgroundColor: colour }} />
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.09]"
          style={{
            background: `radial-gradient(75% 55% at 82% 0%, ${colour}, transparent 62%), radial-gradient(60% 45% at 8% 100%, #d9b66d, transparent 65%)`,
          }}
        />
        <div className="pointer-events-none absolute inset-0 opacity-[0.035] [background-image:linear-gradient(rgba(245,235,210,0.9)_1px,transparent_1px),linear-gradient(90deg,rgba(245,235,210,0.9)_1px,transparent_1px)] [background-size:38px_38px]" />

        <header className="relative flex items-start gap-3 border-b border-[#f5ebd2]/10 px-4 py-4 sm:items-center sm:gap-4 sm:px-7 sm:py-5">
          <div
            className="flex size-12 shrink-0 items-center justify-center border sm:size-14"
            style={{ borderColor: `${colour}99`, backgroundColor: `${colour}1f` }}
          >
            <HouseEmblem houseId={house.id} size={32} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-ui text-[8px] uppercase tracking-[0.26em] text-[#d9b66d]/85">
                House food cupboard
              </p>
              <span
                className="inline-flex items-center gap-1 border px-1.5 py-0.5 font-ui text-[7px] uppercase tracking-[0.16em]"
                style={{ borderColor: `${colour}66`, color: colour === "#EAB308" ? "#f0d477" : colour }}
              >
                <span className="size-1.5 rounded-full bg-current" /> live
              </span>
            </div>
            <h2 className="mt-1 truncate font-display text-[clamp(1.35rem,4vw,2rem)] leading-tight text-[#f5ebd2]">
              {house.name} pantry
            </h2>
            <p className="mt-0.5 truncate font-ui text-[9px] uppercase tracking-[0.16em] text-[#f5ebd2]/40">
              {house.hostelName} · shared with every {house.shortName} member
            </p>
          </div>
          <div className="hidden items-center gap-2 border-l border-[#f5ebd2]/10 pl-4 sm:flex">
            <div className="text-right">
              <p className="font-ui text-[7px] uppercase tracking-[0.2em] text-[#f5ebd2]/35">
                On the shelves
              </p>
              <p className="font-display text-2xl leading-none text-[#f0dfb7] tabular-nums">{total}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close cupboard"
            className="flex size-10 shrink-0 items-center justify-center border border-[#f5ebd2]/16 text-[#f5ebd2]/60 transition hover:border-[#d9b66d]/60 hover:text-[#f0dfb7]"
          >
            <X className="size-4" />
          </button>
        </header>

        {!isAuthenticated && (
          <div className="relative flex flex-1 flex-col items-center justify-center px-6 py-14 text-center">
            <DoorOpen className="size-10 text-[#d9b66d]/70" />
            <h3 className="mt-4 font-display text-2xl text-[#f5ebd2]">Sign in to open the cupboard</h3>
            <p className="mt-2 max-w-sm font-ui text-[11px] leading-relaxed text-[#f5ebd2]/48">
              House cupboards are shared by authenticated members. Your saved house assignment controls
              which pantry you can open.
            </p>
            <Link
              to="/auth"
              className="mt-5 inline-flex items-center gap-2 border border-[#d9b66d] bg-[#d9b66d] px-4 py-2.5 font-ui text-[9px] font-semibold uppercase tracking-[0.2em] text-[#0a140f] transition hover:bg-[#efd89e]"
            >
              Sign in
            </Link>
          </div>
        )}

        {isAuthenticated && cupboard === undefined && (
          <div className="relative flex flex-1 flex-col items-center justify-center gap-3 px-6 py-16 font-ui text-[10px] uppercase tracking-[0.2em] text-[#f5ebd2]/45">
            <Loader2 className="size-5 animate-spin text-[#d9b66d]" />
            Unlocking {house.shortName} cupboard
          </div>
        )}

        {isAuthenticated && cupboard === null && (
          <div className="relative flex flex-1 flex-col items-center justify-center px-6 py-14 text-center">
            <Users className="size-9 text-[#d9b66d]/70" />
            <h3 className="mt-4 font-display text-2xl text-[#f5ebd2]">Student profile required</h3>
            <p className="mt-2 max-w-sm font-ui text-[11px] leading-relaxed text-[#f5ebd2]/48">
              Your account needs a NAVODAYA student identity with a house before you can share food.
            </p>
          </div>
        )}

        {cupboard && items && (
          <div className="relative grid min-h-0 flex-1 grid-rows-[auto_1fr] overflow-y-auto lg:grid-cols-[1.45fr_0.9fr] lg:grid-rows-none lg:overflow-hidden">
            <div className="min-h-0 overflow-y-auto px-4 py-4 sm:px-7 sm:py-5">
              <div className="flex flex-wrap items-end justify-between gap-2">
                <div>
                  <p className="font-ui text-[8px] uppercase tracking-[0.24em] text-[#d9b66d]/75">
                    Shared shelves
                  </p>
                  <p className="mt-1 font-ui text-[10px] leading-relaxed text-[#f5ebd2]/38">
                    Any {house.shortName} member can take one item. Every change is server-checked and
                    appears here instantly.
                  </p>
                </div>
                <div className="flex items-center gap-3 text-right">
                  <div>
                    <p className="font-ui text-[7px] uppercase tracking-[0.16em] text-[#f5ebd2]/30">Deposited</p>
                    <p className="font-display text-base text-[#e8d6ac] tabular-nums">{cupboard.totalDeposited}</p>
                  </div>
                  <div>
                    <p className="font-ui text-[7px] uppercase tracking-[0.16em] text-[#f5ebd2]/30">Eaten</p>
                    <p className="font-display text-base text-[#e8d6ac] tabular-nums">{cupboard.totalConsumed}</p>
                  </div>
                </div>
              </div>

              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {CUPBOARD_FOOD_ORDER.map((item) => {
                  const Icon = FOOD_ICONS[item];
                  const quantity = items[item];
                  const empty = quantity <= 0;
                  const isEating = eating === item;
                  return (
                    <motion.div
                      key={item}
                      layout
                      className={`relative overflow-hidden border transition ${
                        empty
                          ? "border-[#f5ebd2]/8 bg-[#08110c]/55"
                          : "border-[#f5ebd2]/14 bg-[#0d1a13]/85"
                      }`}
                      style={!empty ? { boxShadow: `inset 3px 0 0 ${colour}` } : undefined}
                    >
                      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(115deg,rgba(255,255,255,0.035),transparent_45%)]" />
                      <div className="relative flex items-center gap-3 p-3">
                        <div
                          className={`flex size-11 shrink-0 items-center justify-center border ${
                            empty ? "border-[#f5ebd2]/10 text-[#f5ebd2]/20" : "text-[#f0dfb7]"
                          }`}
                          style={
                            empty
                              ? undefined
                              : { borderColor: `${colour}55`, backgroundColor: `${colour}17` }
                          }
                        >
                          <Icon className="size-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-baseline justify-between gap-2">
                            <p
                              className={`truncate font-display text-[15px] leading-tight ${
                                empty ? "text-[#f5ebd2]/30" : "text-[#f5ebd2]"
                              }`}
                            >
                              {CUPBOARD_FOOD_LABELS[item]}
                            </p>
                            <span
                              className={`shrink-0 font-display text-lg leading-none tabular-nums ${
                                empty ? "text-[#f5ebd2]/20" : "text-[#eed9a8]"
                              }`}
                              aria-label={`${quantity} available`}
                            >
                              {quantity}
                            </span>
                          </div>
                          <p className="mt-0.5 truncate font-ui text-[8px] uppercase tracking-[0.1em] text-[#f5ebd2]/30">
                            {empty ? "Shelf empty" : FOOD_NOTES[item]}
                          </p>
                          <button
                            type="button"
                            disabled={empty || busy !== null}
                            onClick={() => void eat(item)}
                            className={`mt-2 inline-flex w-full items-center justify-center gap-1.5 border px-3 py-2 font-ui text-[8px] font-semibold uppercase tracking-[0.2em] transition ${
                              empty
                                ? "cursor-not-allowed border-[#f5ebd2]/8 text-[#f5ebd2]/20"
                                : "border-[#d9b66d]/70 bg-[#d9b66d]/12 text-[#f0dfb7] hover:bg-[#d9b66d] hover:text-[#0a140f]"
                            }`}
                          >
                            {busy === item ? (
                              <Loader2 className="size-3 animate-spin" />
                            ) : (
                              <Sparkles className="size-3" />
                            )}
                            {isEating ? "Eating" : "Eat one"}
                          </button>
                        </div>
                      </div>
                      <AnimatePresence>
                        {isEating && (
                          <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="pointer-events-none absolute inset-0 flex items-center justify-center bg-[#0a140f]/82"
                          >
                            <motion.div
                              initial={{ y: 10, scale: 0.8 }}
                              animate={{ y: [-2, -12, 0], scale: [0.9, 1.18, 1] }}
                              transition={{ duration: 0.7, repeat: 1 }}
                              className="flex flex-col items-center gap-1.5"
                            >
                              <Icon className="size-7 text-[#f0dfb7]" />
                              <span className="font-ui text-[7px] uppercase tracking-[0.24em] text-[#d9b66d]">
                                taken
                              </span>
                            </motion.div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  );
                })}
              </div>

              <AnimatePresence>
                {(error || notice) && (
                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className={`mt-3 flex items-start gap-2 border px-3 py-2.5 font-ui text-[10px] leading-relaxed ${
                      error
                        ? "border-[#d78e74]/40 bg-[#2a1510]/70 text-[#e8b6a2]"
                        : "border-[#9fc4a6]/35 bg-[#0e2117]/80 text-[#bcd9c2]"
                    }`}
                  >
                    {error ? <X className="mt-0.5 size-3 shrink-0" /> : <Check className="mt-0.5 size-3 shrink-0" />}
                    <span>{error ?? notice}</span>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <aside className="min-h-0 border-t border-[#f5ebd2]/10 bg-[#07110c]/60 px-4 py-4 sm:px-7 sm:py-5 lg:overflow-y-auto lg:border-l lg:border-t-0">
              <p className="font-ui text-[8px] uppercase tracking-[0.24em] text-[#d9b66d]/75">
                Cupboard ledger
              </p>
              <p className="mt-1 font-ui text-[9px] leading-relaxed text-[#f5ebd2]/34">
                Deposits and meals from every {house.shortName} member.
              </p>
              {cupboard.recent.length === 0 ? (
                <div className="mt-4 border border-dashed border-[#f5ebd2]/12 px-3 py-6 text-center">
                  <p className="font-display text-sm text-[#f5ebd2]/45">The shelves are waiting.</p>
                  <p className="mt-1 font-ui text-[9px] leading-relaxed text-[#f5ebd2]/28">
                    Finish a MESS RUN and deposit your collected food.
                  </p>
                </div>
              ) : (
                <ol className="mt-3 space-y-2">
                  {cupboard.recent.map((entry) => {
                    const item = entry.item as CupboardFoodId;
                    const Icon = FOOD_ICONS[item] ?? Drumstick;
                    return (
                      <li
                        key={entry.id}
                        className="flex items-start gap-2.5 border-b border-[#f5ebd2]/7 pb-2 last:border-0"
                      >
                        <span
                          className={`mt-0.5 flex size-7 shrink-0 items-center justify-center border ${
                            entry.action === "deposit"
                              ? "border-[#9fc4a6]/30 bg-[#163123]/50 text-[#a9cfb2]"
                              : "border-[#d9b66d]/25 bg-[#2a2211]/50 text-[#e3c98f]"
                          }`}
                        >
                          <Icon className="size-3.5" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-ui text-[10px] text-[#f5ebd2]/78">
                            <span className="text-[#f0dfb7]">{entry.playerName}</span>{" "}
                            {entry.action === "deposit" ? "deposited" : "ate"}{" "}
                            {entry.quantity > 1 ? `${entry.quantity} ` : ""}
                            {CUPBOARD_FOOD_SHORT_LABELS[item] ?? entry.item}
                          </p>
                          <p className="mt-0.5 font-ui text-[7px] uppercase tracking-[0.14em] text-[#f5ebd2]/25">
                            {entry.isMine ? "You · " : ""}
                            {new Date(entry.createdAt).toLocaleString(undefined, {
                              month: "short",
                              day: "numeric",
                              hour: "numeric",
                              minute: "2-digit",
                            })}
                          </p>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              )}
              <div className="mt-4 border-t border-[#f5ebd2]/10 pt-3">
                <p className="font-ui text-[8px] uppercase tracking-[0.18em] text-[#f5ebd2]/28">
                  House rule
                </p>
                <p className="mt-1 font-display text-[13px] italic leading-snug text-[#f5ebd2]/55">
                  “Take one, leave the shelf for the next {house.shortName} student.”
                </p>
              </div>
            </aside>
          </div>
        )}

        <footer className="relative flex flex-wrap items-center justify-between gap-2 border-t border-[#f5ebd2]/10 px-4 py-3 sm:px-7">
          <p className="inline-flex items-center gap-1.5 font-ui text-[8px] uppercase tracking-[0.16em] text-[#f5ebd2]/30">
            <DoorOpen className="size-3" /> {house.shortName} · {house.motto}
          </p>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-1.5 border border-[#d9b66d]/45 px-3 py-1.5 font-ui text-[8px] uppercase tracking-[0.18em] text-[#e3c98f] transition hover:bg-[#d9b66d]/12"
          >
            Close cupboard
          </button>
        </footer>
      </motion.div>
    </motion.div>
  );
}
