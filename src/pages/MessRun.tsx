import { api } from "@/convex/_generated/api";
import { useAuth } from "@/hooks/use-auth";
import { usePlayerIdentity } from "@/identity/PlayerIdentityProvider";
import { DEFAULT_CHARACTER, type TeacherDialogueMeta } from "@/game/core/types";
import { getHouse } from "@/game/data/houses";
import { MessRunEngine } from "@/game/messrun/MessRunEngine";
import {
  DEFAULT_MESS_RUN_MODE,
  DEFAULT_MESS_RUN_TEACHER,
  MESS_RUN_FEAST_SIZE,
  MESS_RUN_MODES,
  MESS_RUN_TEACHERS,
  formatMessRunDistance,
  formatMessRunScore,
  formatMessRunTime,
  formatStoredRunDate,
  messRunMode,
  messRunTeacher,
  readMessRunStats,
  recordMessRunResult,
  type MessRunCollectibles,
  type MessRunLocalStats,
  type MessRunModeId,
  type MessRunResult,
  type MessRunTeacher,
  type MessRunTeacherId,
} from "@/game/messrun/messRunData";
import type { MessRunSnapshot } from "@/game/messrun/MessRunSimulation";
import type { PickupKind, SimEvent } from "@/game/messrun/MessRunSimulation";
import { TeacherPortrait } from "@/game/ui/TeacherPortrait";
import { useMutation, useQuery } from "convex/react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  ChevronLeft,
  Coins,
  CupSoda,
  Drumstick,
  Flame,
  Footprints,
  Gauge,
  HeartPulse,
  Loader2,
  Music2,
  Sandwich,
  Soup,
  Pause,
  Play,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Target,
  Trophy,
  Utensils,
  Volume2,
  VolumeX,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router";

const AUDIO_KEY = "navodaya.messrun.audio.v1";

function readAudioSettings(): { sfx: boolean; music: boolean } {
  if (typeof window === "undefined") return { sfx: true, music: true };
  try {
    const raw = JSON.parse(window.localStorage.getItem(AUDIO_KEY) ?? "null") as
      | { sfx?: boolean; music?: boolean }
      | null;
    return { sfx: raw?.sfx !== false, music: raw?.music !== false };
  } catch {
    return { sfx: true, music: true };
  }
}

function teacherDialogueMeta(teacher: MessRunTeacher): TeacherDialogueMeta {
  const config = teacher.chaserConfig;
  return {
    teacherId: config.id,
    name: teacher.name,
    subject: teacher.subject,
    gender: config.gender,
    personality: config.personality,
    personalityLabel: teacher.personalityLabel,
    period: "",
    location: "",
    warningCount: 0,
    reputation: 0,
    mood: "calm",
    portrait: {
      skin: config.appearance.skin,
      hair: config.appearance.hair,
      shirt: config.appearance.shirt,
      accents: config.appearance.accents,
      glasses: config.appearance.glasses,
      beard: config.appearance.beard,
      moustache: config.appearance.moustache,
    },
    notice: null,
  };
}

function DifficultyBar({ value }: { value: number }) {
  return (
    <span className="flex items-center gap-1" aria-label={`Difficulty ${value} of 5`}>
      {Array.from({ length: 5 }, (_, index) => (
        <span
          key={index}
          className={`h-1.5 w-3.5 rounded-full ${
            index < value ? "bg-[#d7b46a]" : "bg-[#f1ead8]/12"
          }`}
        />
      ))}
    </span>
  );
}

function CollectibleGlyph({ kind, className }: { kind: PickupKind; className?: string }) {
  if (kind === "chicken") return <Drumstick className={className} />;
  if (kind === "fries") return <Flame className={className} />;
  if (kind === "samosa") return <Soup className={className} />;
  if (kind === "burger") return <Sandwich className={className} />;
  if (kind === "coldDrink") return <CupSoda className={className} />;
  return <Coins className={className} />;
}

const COLLECTIBLE_LABELS: Record<PickupKind, string> = {
  chicken: "Chicken",
  fries: "Fries",
  samosa: "Samosa",
  burger: "Burger",
  coldDrink: "Drink",
  token: "Tokens",
};

function CollectibleCounters({
  collectibles,
  tokens,
  className = "grid-cols-3",
}: {
  collectibles: MessRunCollectibles;
  tokens: number;
  className?: string;
}) {
  const items: Array<[PickupKind, number]> = [
    ["chicken", collectibles.chicken],
    ["fries", collectibles.fries],
    ["samosa", collectibles.samosa],
    ["burger", collectibles.burger],
    ["coldDrink", collectibles.coldDrink],
    ["token", tokens],
  ];
  return (
    <div className={`grid gap-1.5 ${className}`}>
      {items.map(([kind, count]) => (
        <span
          key={kind}
          className="flex min-w-0 items-center gap-1 border border-[#f1ead8]/8 bg-black/20 px-1.5 py-1 font-ui text-[7px] uppercase tracking-[0.08em] text-[#e9ddc8]/52"
        >
          <CollectibleGlyph kind={kind} className="size-3 shrink-0 text-[#d7b46a]" />
          <span className="truncate">{COLLECTIBLE_LABELS[kind]}</span>
          <span className="ml-auto font-display text-[11px] leading-none tabular-nums text-[#f1e3c8]">
            {count}
          </span>
        </span>
      ))}
    </div>
  );
}

function FoodPlateArt() {
  return (
    <motion.div
      aria-label="Two dark serving trays carrying a cup, cake, drink, burger and side dishes"
      role="img"
      animate={{ y: [0, -8, 0], rotate: [-0.5, 0.5, -0.5] }}
      transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
      className="pointer-events-none select-none"
    >
      <svg viewBox="0 0 600 330" className="h-auto w-full overflow-visible">
        <defs>
          <linearGradient id="trayGloss" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#30291f" />
            <stop offset="0.55" stopColor="#17130f" />
            <stop offset="1" stopColor="#0a0907" />
          </linearGradient>
          <linearGradient id="bunTop" x1="0" y1="0" x2="0.8" y2="1">
            <stop offset="0" stopColor="#e0aa64" />
            <stop offset="1" stopColor="#a86631" />
          </linearGradient>
          <linearGradient id="drink" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#e79a52" />
            <stop offset="1" stopColor="#9c4923" />
          </linearGradient>
          <filter id="trayShadow" x="-30%" y="-30%" width="170%" height="180%">
            <feDropShadow dx="0" dy="13" stdDeviation="12" floodColor="#000000" floodOpacity="0.6" />
          </filter>
          <filter id="softGlow" x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur stdDeviation="8" />
          </filter>
        </defs>

        <ellipse cx="300" cy="278" rx="220" ry="27" fill="#000" opacity="0.28" filter="url(#softGlow)" />

        <g transform="translate(16 82) rotate(-5 140 90)" filter="url(#trayShadow)">
          <rect x="0" y="86" width="260" height="116" rx="8" fill="url(#trayGloss)" stroke="#4b3d2b" strokeWidth="2" />
          <rect x="10" y="96" width="240" height="96" rx="5" fill="none" stroke="#6d5840" strokeWidth="2" />
          <rect x="0" y="80" width="260" height="14" rx="7" fill="#292218" />
          <rect x="11" y="110" width="40" height="10" rx="4" fill="#d7b46a" opacity="0.48" />
          <g transform="translate(55 88)">
            <path d="M0 28h62l-7 52H7z" fill="#efe7d4" stroke="#cfc2a5" strokeWidth="2" />
            <ellipse cx="31" cy="28" rx="31" ry="10" fill="#f7f0df" />
            <ellipse cx="31" cy="29" rx="23" ry="6" fill="#b87426" />
            <path d="M62 38c20-3 20 26 0 23" fill="none" stroke="#e6d8bd" strokeWidth="5" />
            <path d="M13 18c5-11 12-15 18-17M34 15c2-8 7-12 13-15" stroke="#f1dfc0" strokeWidth="2" opacity="0.3" fill="none" />
          </g>
          <g transform="translate(155 86)">
            <path d="M0 82h92l-9-62H9z" fill="#f4ead7" />
            <ellipse cx="46" cy="23" rx="46" ry="15" fill="#fffaf0" />
            <path d="M9 48c12-9 23-9 35 0s25 9 39-1l3 17c-14 10-25 10-39 1s-24-9-36 0z" fill="#c98b55" />
            <path d="M17 33c8-7 15-8 23-2s16 6 25-1" stroke="#8a4f2d" strokeWidth="5" fill="none" strokeLinecap="round" />
            <circle cx="34" cy="64" r="7" fill="#7b9b4a" />
            <circle cx="57" cy="69" r="6" fill="#9a3e2f" />
          </g>
          <rect x="18" y="206" width="222" height="9" rx="4" fill="#000" opacity="0.35" />
        </g>

        <g transform="translate(314 62) rotate(4 140 90)" filter="url(#trayShadow)">
          <rect x="0" y="86" width="260" height="116" rx="8" fill="url(#trayGloss)" stroke="#4b3d2b" strokeWidth="2" />
          <rect x="10" y="96" width="240" height="96" rx="5" fill="none" stroke="#6d5840" strokeWidth="2" />
          <rect x="0" y="80" width="260" height="14" rx="7" fill="#292218" />
          <rect x="11" y="110" width="40" height="10" rx="4" fill="#d7b46a" opacity="0.48" />
          <g transform="translate(42 93)">
            <path d="M8 16h58l-8 65H16z" fill="#e7f5f2" opacity="0.28" stroke="#cce2dd" strokeWidth="2" />
            <path d="M13 50h48l-5 29H18z" fill="url(#drink)" opacity="0.92" />
            <ellipse cx="37" cy="16" rx="29" ry="8" fill="#f4ffff" opacity="0.36" />
            <path d="M44 7 61 76" stroke="#e8cf8c" strokeWidth="5" strokeLinecap="round" />
            <path d="M18 22c7-5 15-5 22 0" stroke="#fff" strokeWidth="2" opacity="0.34" fill="none" />
          </g>
          <g transform="translate(129 72)">
            <ellipse cx="54" cy="100" rx="53" ry="17" fill="#d7b46a" opacity="0.1" />
            <path d="M5 68c0-14 22-25 49-25s49 11 49 25c0 13-22 24-49 24S5 81 5 68z" fill="#b9763f" />
            <rect x="9" y="53" width="90" height="14" rx="7" fill="#e9b964" />
            <path d="M12 68c8-13 22-20 42-20s34 7 42 20z" fill="#9c4a2b" />
            <path d="M8 48c4-14 22-24 46-24s42 10 46 24c-13-8-28-11-46-11S21 40 8 48z" fill="url(#bunTop)" />
            <path d="M22 38c9-9 19-13 31-13M55 25c12 0 22 4 31 12" stroke="#f5d7a5" strokeWidth="3" opacity="0.42" fill="none" strokeLinecap="round" />
            <path d="M3 49c10 8 23 11 39 11 20 0 39-5 55-14" stroke="#7c9b4d" strokeWidth="7" fill="none" strokeLinecap="round" />
            <circle cx="27" cy="55" r="4" fill="#f6ead6" />
            <circle cx="83" cy="57" r="4" fill="#f6ead6" />
          </g>
          <g transform="translate(184 155)">
            <ellipse cx="35" cy="20" rx="35" ry="12" fill="#e8dcc2" />
            <ellipse cx="35" cy="18" rx="26" ry="8" fill="#7e9a48" />
            <circle cx="25" cy="16" r="5" fill="#b48d4f" />
            <circle cx="43" cy="17" r="4" fill="#a04f32" />
          </g>
          <rect x="18" y="206" width="222" height="9" rx="4" fill="#000" opacity="0.35" />
        </g>

        <g opacity="0.65" fill="#e7c47d">
          <circle cx="294" cy="74" r="3" />
          <circle cx="317" cy="52" r="2" />
          <circle cx="274" cy="55" r="2.4" />
          <path d="M286 87c7-12 12-13 18-18" stroke="#d7b46a" strokeWidth="2" fill="none" strokeLinecap="round" />
        </g>
      </svg>
    </motion.div>
  );
}

function FoodMeter({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "left" | "right";
}) {
  const safe = Math.max(0, Math.min(100, value));
  return (
    <div className="min-w-0">
      <div className="flex items-center justify-between gap-2">
        <span className="font-ui text-[8px] uppercase tracking-[0.18em] text-[#e9ddc8]/52">
          {label}
        </span>
        <span className="font-ui text-[10px] tabular-nums text-[#f7ecd6]">{Math.round(safe)}%</span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-black/55">
        <div
          className={`h-full rounded-full transition-[width] duration-150 ${
            tone === "left" ? "bg-[#8fbf9f]" : "bg-[#d7b46a]"
          }`}
          style={{ width: `${safe}%` }}
        />
      </div>
    </div>
  );
}

function RunHud({
  hud,
  teacher,
  paused,
  onPause,
  sfx,
  music,
  onToggleSfx,
  onToggleMusic,
}: {
  hud: MessRunSnapshot;
  teacher: MessRunTeacher;
  paused: boolean;
  onPause: () => void;
  sfx: boolean;
  music: boolean;
  onToggleSfx: () => void;
  onToggleMusic: () => void;
}) {
  return (
    <>
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 h-40 bg-gradient-to-b from-black/72 via-black/22 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 h-44 bg-gradient-to-t from-black/72 via-black/20 to-transparent" />

      <div className="absolute left-[max(0.9rem,env(safe-area-inset-left))] top-[max(0.9rem,env(safe-area-inset-top))] z-30 w-[min(17rem,calc(100%-9rem))]">
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center border border-[#d7b46a]/40 bg-[#0a100c]/75 text-[#e7c47d] backdrop-blur-sm">
            <Utensils className="size-4" />
          </span>
          <div className="min-w-0">
            <p className="font-ui text-[8px] uppercase tracking-[0.24em] text-[#d7b46a]/80">
              Mess Run
            </p>
            <p className="font-display text-2xl leading-none text-[#f6ead4]">
              {formatMessRunScore(hud.score)}
            </p>
          </div>
          <div className="ml-auto text-right">
            <p className="font-ui text-[8px] uppercase tracking-[0.16em] text-[#e9ddc8]/40">
              Distance
            </p>
            <p className="font-display text-xl leading-none text-[#f1e3c8]">
              {formatMessRunDistance(hud.distance)}
            </p>
          </div>
        </div>

        <div className="mt-3 border border-[#f1ead8]/12 bg-[#08100b]/80 p-3 backdrop-blur-md">
          <div className="flex items-center justify-between gap-3">
            <p className="font-ui text-[8px] uppercase tracking-[0.2em] text-[#e9ddc8]/42">
              Tray condition
            </p>
            <p className="font-ui text-[10px] tabular-nums text-[#e7c47d]">
              {hud.foodLeft}% total
            </p>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-3">
            <FoodMeter label="Left tray" value={hud.leftTray} tone="left" />
            <FoodMeter label="Right tray" value={hud.rightTray} tone="right" />
          </div>
          <div className="mt-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="font-ui text-[8px] uppercase tracking-[0.18em] text-[#e9ddc8]/42">
                Plate stability
              </span>
              <span className="font-ui text-[9px] tabular-nums text-[#e9ddc8]/70">
                {hud.plateStability}%
              </span>
            </div>
            <div className="mt-1 h-1 overflow-hidden rounded-full bg-black/55">
              <div
                className={`h-full rounded-full transition-[width] duration-150 ${
                  hud.plateStability > 55
                    ? "bg-[#a9c7b0]"
                    : hud.plateStability > 28
                      ? "bg-[#d7b46a]"
                      : "bg-[#c2705a]"
                }`}
                style={{ width: `${hud.plateStability}%` }}
              />
            </div>
          </div>
          <div className="mt-2.5 border-t border-[#f1ead8]/8 pt-2">
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <span className="font-ui text-[8px] uppercase tracking-[0.18em] text-[#e9ddc8]/42">
                Collected
              </span>
              <span className="inline-flex items-center gap-1 font-ui text-[8px] uppercase tracking-[0.1em] text-[#d7b46a]/80">
                <Drumstick className="size-3" /> Feast {hud.chickenFeastProgress}/{MESS_RUN_FEAST_SIZE}
                {hud.chickenFeasts > 0 ? ` · ×${hud.chickenFeasts}` : ""}
              </span>
            </div>
            <CollectibleCounters collectibles={hud.collectibles} tokens={hud.coins} />
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-[#f1ead8]/8 pt-2 font-ui text-[9px] text-[#e9ddc8]/53">
            <span className="inline-flex items-center gap-1">
              <Footprints className="size-3 text-[#9fc4a6]" /> {Math.round(hud.speed * 3.6)} km/h
            </span>
            <span className="inline-flex items-center gap-1">
              <Sparkles className="size-3 text-[#d7b46a]" /> Food ×{hud.foodMultiplier.toFixed(2)}
            </span>
            {hud.scoreMultiplier > 1 && (
              <span className="inline-flex items-center gap-1 text-[#efd79f]">
                <Flame className="size-3" /> Score ×{hud.scoreMultiplier.toFixed(2)}
              </span>
            )}
            <span className="inline-flex items-center gap-1 text-[#d7b46a]/65 sm:hidden">
              {teacher.name} · {hud.teacherGap.toFixed(1)}m
            </span>
          </div>
        </div>
      </div>

      <div className="absolute right-[max(0.9rem,env(safe-area-inset-right))] top-[max(0.9rem,env(safe-area-inset-top))] z-30 flex items-start gap-2">
        <div className="hidden border border-[#f1ead8]/14 bg-[#08100b]/84 px-3 py-2.5 backdrop-blur-md sm:block">
          <div className="flex items-center gap-2.5">
            <TeacherPortrait teacher={teacherDialogueMeta(teacher)} size={38} />
            <div>
              <p className="font-ui text-[7px] uppercase tracking-[0.2em] text-[#d7b46a]/70">
                Chasing
              </p>
              <p className="font-display text-base leading-tight text-[#f2e6d0]">{teacher.name}</p>
              <p className="font-ui text-[8px] uppercase tracking-[0.12em] text-[#e9ddc8]/40">
                {hud.teacherGap.toFixed(1)} m behind
              </p>
            </div>
          </div>
          {hud.scoreMultiplier > 1 && (
            <p className="mt-2 flex items-center gap-1.5 border-t border-[#d7b46a]/20 pt-2 font-ui text-[8px] uppercase tracking-[0.16em] text-[#efd79f]">
              <Flame className="size-3" /> Score ×{hud.scoreMultiplier.toFixed(2)} ·{" "}
              {hud.multiplierSeconds}s
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={onPause}
          aria-label="Pause MESS RUN"
          className="pointer-events-auto flex size-10 items-center justify-center border border-[#f1ead8]/16 bg-[#08100b]/84 text-[#f2e6d0]/75 backdrop-blur-md transition hover:border-[#d7b46a]/60 hover:text-[#d7b46a]"
        >
          <Pause className="size-4" />
        </button>
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-[max(1rem,env(safe-area-inset-bottom))] z-30 flex justify-center px-4">
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 border border-[#f1ead8]/10 bg-[#08100b]/68 px-4 py-2 font-ui text-[8px] uppercase tracking-[0.18em] text-[#e9ddc8]/45 backdrop-blur-sm">
          <span>Swipe or arrow keys</span>
          <span className="text-[#d7b46a]/65">← → lanes</span>
          <span className="text-[#d7b46a]/65">↑ jump · ↓ slide</span>
          <span className="hidden sm:inline">Esc pause</span>
        </div>
      </div>

      <div className="absolute bottom-[max(3.4rem,calc(env(safe-area-inset-bottom)+3.4rem))] right-[max(0.9rem,env(safe-area-inset-right))] z-30 flex gap-1.5">
        <button
          type="button"
          onClick={onToggleSfx}
          aria-label={sfx ? "Mute sound effects" : "Enable sound effects"}
          className="flex size-9 items-center justify-center border border-[#f1ead8]/12 bg-[#08100b]/72 text-[#e9ddc8]/55 backdrop-blur-sm transition hover:text-[#d7b46a]"
        >
          {sfx ? <Volume2 className="size-3.5" /> : <VolumeX className="size-3.5" />}
        </button>
        <button
          type="button"
          onClick={onToggleMusic}
          aria-label={music ? "Mute music" : "Enable music"}
          className={`flex size-9 items-center justify-center border border-[#f1ead8]/12 bg-[#08100b]/72 backdrop-blur-sm transition hover:text-[#d7b46a] ${
            music ? "text-[#d7b46a]/75" : "text-[#e9ddc8]/35"
          }`}
        >
          <Music2 className="size-3.5" />
        </button>
      </div>

      {paused && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-[#050a07]/72 px-4 backdrop-blur-sm">
          <div className="w-full max-w-sm border border-[#d7b46a]/30 bg-[#0b1511]/96 p-6 shadow-[0_30px_100px_rgba(0,0,0,0.75)]">
            <p className="font-ui text-[8px] uppercase tracking-[0.24em] text-[#d7b46a]/75">
              Run paused
            </p>
            <h2 className="mt-2 font-display text-3xl text-[#f4ead6]">Catch your breath</h2>
            <p className="mt-2 font-ui text-[11px] leading-relaxed text-[#e9ddc8]/52">
              {teacher.name} is waiting. The trays are safe while you are here.
            </p>
            <button
              type="button"
              onClick={onPause}
              className="mt-5 flex w-full items-center justify-center gap-2 border border-[#d7b46a] bg-[#d7b46a] px-4 py-3 font-ui text-[10px] font-semibold uppercase tracking-[0.22em] text-[#0b1511] transition hover:bg-[#efd79f]"
            >
              <Play className="size-3.5" /> Resume run
            </button>
          </div>
        </div>
      )}
    </>
  );
}

function ResultsOverlay({
  result,
  teacher,
  bestScore,
  isNewBest,
  submitting,
  saveError,
  onRetry,
  onChangeTeacher,
}: {
  result: MessRunResult;
  teacher: MessRunTeacher;
  bestScore: number;
  isNewBest: boolean;
  submitting: boolean;
  saveError: string | null;
  onRetry: () => void;
  onChangeTeacher: () => void;
}) {
  const caught = result.outcome === "caught";
  const delivered = result.outcome === "delivered";
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="absolute inset-0 z-50 flex items-center justify-center overflow-y-auto bg-[#040806]/78 px-4 py-8 backdrop-blur-[3px]"
    >
      <motion.div
        initial={{ y: 18, scale: 0.98, opacity: 0 }}
        animate={{ y: 0, scale: 1, opacity: 1 }}
        transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-2xl border border-[#d7b46a]/32 bg-[#0b1511]/97 shadow-[0_40px_130px_rgba(0,0,0,0.8)]"
      >
        <div className="flex items-start gap-4 border-b border-[#f1ead8]/10 p-5 sm:p-7">
          <TeacherPortrait teacher={teacherDialogueMeta(teacher)} size={64} />
          <div className="min-w-0 flex-1">
            <p className="font-ui text-[8px] uppercase tracking-[0.26em] text-[#d7b46a]/80">
              {caught ? "Chase ended" : delivered ? "Delivery complete" : "Plates empty"}
            </p>
            <h2 className="mt-1 font-display text-[clamp(1.8rem,5vw,2.8rem)] leading-none text-[#f4ead6]">
              {caught
                ? `Caught by ${teacher.name}`
                : delivered
                  ? "Food delivered"
                  : "The trays gave out"}
            </h2>
            <p className="mt-2 font-ui text-[11px] leading-relaxed text-[#e9ddc8]/52">
              {caught
                ? teacher.intro
                : delivered
                  ? "The meal made it across campus. The chase is another story."
                  : "Not enough food survived the run. The mess will remember this."}
            </p>
          </div>
          {isNewBest && (
            <span className="inline-flex shrink-0 items-center gap-1.5 border border-[#d7b46a]/55 bg-[#d7b46a]/10 px-2.5 py-1.5 font-ui text-[8px] uppercase tracking-[0.16em] text-[#efd79f]">
              <Trophy className="size-3" /> Best
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 gap-px bg-[#f1ead8]/10 sm:grid-cols-4">
          {[
            ["Score", formatMessRunScore(result.score)],
            ["Distance", formatMessRunDistance(result.distance)],
            ["Food", `${Math.round(result.foodLeft)}%`],
            ["Tokens", String(result.coins)],
            ["Survived", formatMessRunTime(result.durationMs)],
            ["Near misses", String(result.nearMisses)],
            ["Left tray", `${result.leftTray}%`],
            ["Right tray", `${result.rightTray}%`],
          ].map(([label, value]) => (
            <div key={label} className="bg-[#0b1511] px-4 py-3.5">
              <p className="font-ui text-[7px] uppercase tracking-[0.18em] text-[#e9ddc8]/35">
                {label}
              </p>
              <p className="mt-1 font-display text-xl leading-none text-[#f1e3c8]">{value}</p>
            </div>
          ))}
        </div>

        <div className="border-b border-[#f1ead8]/10 px-5 py-3 sm:px-7">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <p className="font-ui text-[7px] uppercase tracking-[0.18em] text-[#d7b46a]/65">
              Food collected
            </p>
            <p className="inline-flex items-center gap-1.5 font-ui text-[8px] uppercase tracking-[0.13em] text-[#efd79f]">
              <Drumstick className="size-3" /> Chicken feasts ×{result.chickenFeasts}
              {result.bestMultiplier > 1 ? (
                <span className="text-[#e9ddc8]/38">· best ×{result.bestMultiplier.toFixed(2)}</span>
              ) : null}
            </p>
          </div>
          <CollectibleCounters
            collectibles={result.collectibles}
            tokens={result.coins}
            className="grid-cols-3 sm:grid-cols-6"
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#f1ead8]/10 px-5 py-3 sm:px-7">
          <p className="font-ui text-[9px] uppercase tracking-[0.14em] text-[#e9ddc8]/40">
            Personal best · <span className="text-[#d7b46a]">{formatMessRunScore(bestScore)}</span>
            <span className="mx-2 text-[#e9ddc8]/20">/</span>
            {result.obstaclesAvoided} obstacles avoided
          </p>
          <p className="inline-flex items-center gap-1.5 font-ui text-[8px] uppercase tracking-[0.14em] text-[#e9ddc8]/35">
            {submitting ? (
              <>
                <Loader2 className="size-3 animate-spin" /> Saving
              </>
            ) : saveError ? (
              <>
                <AlertTriangle className="size-3 text-[#d99b84]" /> Saved locally
              </>
            ) : (
              <>
                <Check className="size-3 text-[#9fc4a6]" /> Result saved
              </>
            )}
          </p>
        </div>

        <div className="grid gap-2 p-5 sm:grid-cols-3 sm:p-7">
          <button
            type="button"
            onClick={onRetry}
            className="flex min-h-12 items-center justify-center gap-2 border border-[#d7b46a] bg-[#d7b46a] px-4 py-3 font-ui text-[10px] font-semibold uppercase tracking-[0.2em] text-[#0b1511] transition hover:bg-[#efd79f]"
          >
            <RotateCcw className="size-3.5" /> Retry
          </button>
          <button
            type="button"
            onClick={onChangeTeacher}
            className="flex min-h-12 items-center justify-center gap-2 border border-[#f1ead8]/22 px-4 py-3 font-ui text-[10px] uppercase tracking-[0.2em] text-[#f1ead8]/78 transition hover:border-[#d7b46a]/65 hover:text-[#d7b46a]"
          >
            <Target className="size-3.5" /> Change teacher
          </button>
          <Link
            to="/play?intent=continue"
            className="flex min-h-12 items-center justify-center gap-2 border border-[#f1ead8]/22 px-4 py-3 font-ui text-[10px] uppercase tracking-[0.2em] text-[#f1ead8]/78 transition hover:border-[#d7b46a]/65 hover:text-[#d7b46a]"
          >
            <ArrowLeft className="size-3.5" /> Campus
          </Link>
        </div>
      </motion.div>
    </motion.div>
  );
}

export default function MessRun() {
  const { identity, local } = usePlayerIdentity();
  const { isAuthenticated } = useAuth();
  const submitRun = useMutation(api.messRun.submitRun);
  const serverSummary = useQuery(api.messRun.mySummary, isAuthenticated ? {} : "skip");
  const audioDefaults = readAudioSettings();
  const [sfx, setSfx] = useState(audioDefaults.sfx);
  const [music, setMusic] = useState(audioDefaults.music);
  const [teacherId, setTeacherId] = useState<MessRunTeacherId>(DEFAULT_MESS_RUN_TEACHER);
  const [mode, setMode] = useState<MessRunModeId>(DEFAULT_MESS_RUN_MODE);
  const [screen, setScreen] = useState<"menu" | "run">("menu");
  const [runToken, setRunToken] = useState(0);
  const [hud, setHud] = useState<MessRunSnapshot | null>(null);
  const [result, setResult] = useState<MessRunResult | null>(null);
  const [paused, setPaused] = useState(false);
  const [engineError, setEngineError] = useState<string | null>(null);
  const [eventMessage, setEventMessage] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [serverBest, setServerBest] = useState(0);
  const [localStats, setLocalStats] = useState<MessRunLocalStats>(() => readMessRunStats());
  const canvasRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<MessRunEngine | null>(null);
  const submitted = useRef(new Set<string>());
  const eventTimer = useRef<number | null>(null);
  const audioRef = useRef({ sfx, music });
  audioRef.current = { sfx, music };

  const teacher = messRunTeacher(teacherId);
  const selectedMode = messRunMode(mode);
  const playerCharacter = local?.character ?? identity?.appearance ?? DEFAULT_CHARACTER;
  const house = getHouse(local?.profile.houseId ?? identity?.houseId ?? "aravali");
  const playerName = identity?.displayName ?? local?.profile.characterName ?? "Student";
  const firstName = playerName.split(/\s+/)[0] || "Student";
  const bestScore = Math.max(localStats.bestScore, serverSummary?.bestScore ?? 0, serverBest);
  const recentRuns = localStats.runs.length > 0 ? localStats.runs : serverSummary?.recent ?? [];
  const lastRun = recentRuns[0] ?? null;
  const isNewBest = Boolean(result && result.score >= bestScore && result.score > 0);

  useEffect(() => {
    document.title = "MESS RUN — THE GREAT FOOD ESCAPE · NAVODAYA";
    return () => {
      document.title = "NAVODAYA: THE CAMPUS LIFE";
    };
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(AUDIO_KEY, JSON.stringify({ sfx, music }));
    } catch {
      // Settings still apply for this session.
    }
    engineRef.current?.setAudio(sfx, music);
  }, [music, sfx]);

  const showEvent = useCallback((event: SimEvent) => {
    let hold = 1100;
    if (event.type === "hit") {
      setEventMessage(`Plate hit — ${event.tray === "left" ? "left" : "right"} tray spilled`);
    } else if (event.type === "near-miss") {
      setEventMessage("Clean dodge · +15 point near miss");
    } else if (event.type === "feast") {
      setEventMessage(
        `Chicken Feast · +${event.amount} · score ×${event.multiplier.toFixed(2)}`,
      );
      hold = 1900;
    } else if (event.type === "collect") {
      if (event.kind === "token") {
        setEventMessage("Mess token collected · +25");
      } else if (event.kind === "samosa") {
        setEventMessage(`Samosa · both trays restored · +${event.points}`);
      } else if (event.kind === "burger") {
        setEventMessage(`Burger · score ×1.50 for 12s · +${event.points}`);
      } else if (event.kind === "coldDrink") {
        setEventMessage(`Cold drink · plate stability restored · +${event.points}`);
      } else {
        setEventMessage(`${COLLECTIBLE_LABELS[event.kind]} · +${event.points}`);
      }
    } else {
      return;
    }
    if (eventTimer.current) window.clearTimeout(eventTimer.current);
    eventTimer.current = window.setTimeout(() => setEventMessage(null), hold);
  }, []);

  const handleResult = useCallback((next: MessRunResult) => {
    setResult(next);
    setPaused(true);
    setLocalStats(recordMessRunResult(next));
  }, []);

  useEffect(() => {
    if (screen !== "run" || !canvasRef.current) return;
    const node = canvasRef.current;
    setEngineError(null);
    setHud(null);
    setPaused(false);
    let engine: MessRunEngine | null = null;
    const frame = window.requestAnimationFrame(() => {
      try {
        engine = new MessRunEngine(node, {
          character: playerCharacter,
          houseColor: house?.color ?? "#3e6b55",
          teacherId,
          mode,
          playerName: firstName,
          sfxEnabled: audioRef.current.sfx,
          musicEnabled: audioRef.current.music,
          onHud: setHud,
          onResult: handleResult,
          onEvent: showEvent,
          onPauseRequest: setPaused,
        });
        engine.start();
        engineRef.current = engine;
      } catch (error) {
        setEngineError(
          error instanceof Error
            ? error.message
            : "WebGL could not start. Enable hardware acceleration and try again.",
        );
      }
    });
    return () => {
      window.cancelAnimationFrame(frame);
      engine?.dispose();
      if (engineRef.current === engine) engineRef.current = null;
      if (eventTimer.current) window.clearTimeout(eventTimer.current);
    };
    // A new run token remounts the engine; audio is updated separately.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen, runToken, teacherId, mode]);

  useEffect(() => {
    if (!result || !isAuthenticated || submitted.current.has(result.id)) return;
    submitted.current.add(result.id);
    setSubmitting(true);
    setSaveError(null);
    void submitRun({
      teacherId: result.teacherId,
      mode: result.mode,
      outcome: result.outcome,
      distance: result.distance,
      durationMs: result.durationMs,
      leftTray: result.leftTray,
      rightTray: result.rightTray,
      coins: result.coins,
      nearMisses: result.nearMisses,
      obstaclesAvoided: result.obstaclesAvoided,
      chicken: result.collectibles.chicken,
      fries: result.collectibles.fries,
      samosa: result.collectibles.samosa,
      burger: result.collectibles.burger,
      coldDrink: result.collectibles.coldDrink,
      chickenFeasts: result.chickenFeasts,
      boostScore: result.boostScore,
    })
      .then((saved) => {
        setServerBest(saved.bestScore);
      })
      .catch(() => {
        setSaveError("Saved on this device. Sign in or retry later to sync.");
      })
      .finally(() => setSubmitting(false));
  }, [isAuthenticated, result, submitRun]);

  const startRun = () => {
    setResult(null);
    setSaveError(null);
    setEventMessage(null);
    setHud(null);
    setPaused(false);
    setRunToken((token) => token + 1);
    setScreen("run");
  };

  const retry = () => {
    setResult(null);
    setSaveError(null);
    setEventMessage(null);
    setPaused(false);
    setRunToken((token) => token + 1);
  };

  const togglePause = () => {
    const engine = engineRef.current;
    if (!engine) return;
    engine.setPaused(!engine.isPaused);
  };

  const backToMenu = () => {
    setScreen("menu");
    setResult(null);
    setPaused(false);
    setHud(null);
  };

  if (screen === "run") {
    return (
      <main className="relative min-h-[100dvh] overflow-hidden bg-[#08100b] text-[#f1ead8]">
        <div ref={canvasRef} className="absolute inset-0" />
        {!hud && !engineError && (
          <div className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-[#08100b]">
            <span className="flex size-14 items-center justify-center rounded-full border border-[#d7b46a]/40">
              <Loader2 className="size-6 animate-spin text-[#d7b46a]" />
            </span>
            <p className="mt-5 font-ui text-[9px] uppercase tracking-[0.26em] text-[#d7b46a]/70">
              Balancing the trays
            </p>
          </div>
        )}
        {engineError && (
          <div className="absolute inset-0 z-40 flex items-center justify-center bg-[#08100b] px-5">
            <div className="max-w-md border border-[#c2705a]/35 bg-[#0b1511] p-6 text-center">
              <AlertTriangle className="mx-auto size-7 text-[#d99b84]" />
              <h1 className="mt-4 font-display text-2xl text-[#f4ead6]">
                The kitchen door would not open
              </h1>
              <p className="mt-2 font-ui text-xs leading-relaxed text-[#e9ddc8]/55">{engineError}</p>
              <div className="mt-5 flex gap-2">
                <button
                  type="button"
                  onClick={startRun}
                  className="flex-1 border border-[#d7b46a] bg-[#d7b46a] px-4 py-2.5 font-ui text-[10px] uppercase tracking-[0.2em] text-[#0b1511]"
                >
                  Try again
                </button>
                <button
                  type="button"
                  onClick={backToMenu}
                  className="flex-1 border border-[#f1ead8]/20 px-4 py-2.5 font-ui text-[10px] uppercase tracking-[0.2em] text-[#f1ead8]/70"
                >
                  Back
                </button>
              </div>
            </div>
          </div>
        )}
        {hud && (
          <RunHud
            hud={hud}
            teacher={teacher}
            paused={paused && !result}
            onPause={togglePause}
            sfx={sfx}
            music={music}
            onToggleSfx={() => setSfx((value) => !value)}
            onToggleMusic={() => setMusic((value) => !value)}
          />
        )}
        <AnimatePresence>
          {eventMessage && !result && (
            <motion.div
              key={eventMessage}
              initial={{ opacity: 0, y: 8, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8 }}
              className={`pointer-events-none absolute left-1/2 top-[30%] z-30 flex -translate-x-1/2 items-center gap-2 border px-4 py-2 font-ui text-[10px] uppercase tracking-[0.18em] text-[#f0dfba] shadow-xl backdrop-blur-sm ${
                eventMessage.startsWith("Chicken Feast")
                  ? "border-[#e7c47d]/80 bg-[#2b2413]/95 text-[#fff1c9] shadow-[0_0_50px_rgba(215,180,106,0.28)]"
                  : "border-[#d7b46a]/35 bg-[#08100b]/88"
              }`}
            >
              {eventMessage.startsWith("Chicken Feast") && (
                <Drumstick className="size-4 text-[#e7c47d]" />
              )}
              {eventMessage}
            </motion.div>
          )}
        </AnimatePresence>
        {result && (
          <ResultsOverlay
            result={result}
            teacher={teacher}
            bestScore={bestScore}
            isNewBest={isNewBest}
            submitting={submitting}
            saveError={saveError}
            onRetry={retry}
            onChangeTeacher={backToMenu}
          />
        )}
      </main>
    );
  }

  return (
    <main className="relative min-h-[100dvh] overflow-x-clip bg-[#0b1511] font-ui text-[#f1ead8]">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(90%_65%_at_75%_20%,rgba(215,180,106,0.12),transparent_62%),radial-gradient(60%_50%_at_15%_80%,rgba(51,90,67,0.42),transparent_70%)]" />
      <div className="pointer-events-none fixed inset-0 opacity-[0.045] [background-image:linear-gradient(rgba(241,234,216,0.8)_1px,transparent_1px),linear-gradient(90deg,rgba(241,234,216,0.8)_1px,transparent_1px)] [background-size:48px_48px]" />

      <header className="relative z-20 border-b border-[#f1ead8]/10 bg-[#0b1511]/82 backdrop-blur-xl">
        <div className="mx-auto flex h-[72px] max-w-[1280px] items-center justify-between gap-4 px-4 sm:px-7">
          <Link
            to="/play?intent=continue"
            className="group inline-flex items-center gap-2 font-ui text-[9px] uppercase tracking-[0.2em] text-[#b4bba9] transition hover:text-[#f1ead8]"
          >
            <ChevronLeft className="size-3.5 transition group-hover:-translate-x-0.5" />
            Back to campus
          </Link>
          <div className="flex items-center gap-3">
            <span className="h-7 w-px bg-[#d7b46a]/45" />
            <div>
              <p className="font-display text-sm tracking-[0.24em] text-[#f1ead8]">MESS RUN</p>
              <p className="font-ui text-[7px] uppercase tracking-[0.28em] text-[#b4bba9]">
                The great food escape
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setSfx((value) => !value)}
              aria-label={sfx ? "Mute sound effects" : "Enable sound effects"}
              className={`flex size-9 items-center justify-center border transition ${
                sfx
                  ? "border-[#d7b46a]/30 text-[#d7b46a]"
                  : "border-[#f1ead8]/10 text-[#b4bba9]/45"
              }`}
            >
              {sfx ? <Volume2 className="size-3.5" /> : <VolumeX className="size-3.5" />}
            </button>
            <button
              type="button"
              onClick={() => setMusic((value) => !value)}
              aria-label={music ? "Mute music" : "Enable music"}
              className={`flex size-9 items-center justify-center border transition ${
                music
                  ? "border-[#d7b46a]/30 text-[#d7b46a]"
                  : "border-[#f1ead8]/10 text-[#b4bba9]/45"
              }`}
            >
              <Music2 className="size-3.5" />
            </button>
          </div>
        </div>
      </header>

      <div className="relative z-10 mx-auto max-w-[1280px] px-4 pb-16 pt-8 sm:px-7 sm:pt-12">
        <section className="grid gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-2 border border-[#d7b46a]/30 bg-[#d7b46a]/8 px-3 py-1.5 font-ui text-[8px] uppercase tracking-[0.24em] text-[#d7b46a]">
                <Utensils className="size-3" /> Campus mini-game · 1.0
              </span>
              <span className="font-ui text-[8px] uppercase tracking-[0.22em] text-[#b4bba9]/50">
                Endless runner
              </span>
            </div>
            <h1 className="mt-5 font-display text-[clamp(3.6rem,10vw,7.4rem)] leading-[0.8] tracking-[0.02em] text-[#f4ead6]">
              MESS
              <span className="block text-[#d7b46a]">RUN</span>
            </h1>
            <p className="mt-4 font-display text-[clamp(1.1rem,2.4vw,1.55rem)] italic text-[#ded0b6]">
              The great food escape.
            </p>
            <p className="mt-4 max-w-xl text-[13px] leading-7 text-[#b4bba9]">
              Two full trays. One very determined teacher. Read the campus lanes, protect every
              plate and keep running until the gate — or until someone catches up.
            </p>

            <div className="mt-7 max-w-xl">
              <FoodPlateArt />
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 font-ui text-[9px] uppercase tracking-[0.15em] text-[#b4bba9]/65">
              <span className="inline-flex items-center gap-1.5">
                <ShieldCheck className="size-3 text-[#8fbf9f]" /> Both trays tracked
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Footprints className="size-3 text-[#d7b46a]" /> 3 lanes
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Gauge className="size-3 text-[#d7b46a]" /> Speed builds
              </span>
            </div>
          </div>

          <div className="relative">
            <div className="pointer-events-none absolute -inset-4 border border-[#d7b46a]/8" />
            <div className="relative border border-[#f1ead8]/12 bg-[#08100b]/68 p-4 backdrop-blur-sm sm:p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-ui text-[8px] uppercase tracking-[0.22em] text-[#d7b46a]/75">
                    Your runner
                  </p>
                  <p className="mt-1 font-display text-2xl leading-tight text-[#f1e3c8]">
                    {firstName}
                  </p>
                  <p className="mt-0.5 font-ui text-[9px] uppercase tracking-[0.14em] text-[#b4bba9]/55">
                    {house?.name ?? "Aravali House"} · {selectedMode.name}
                  </p>
                </div>
                {lastRun ? (
                  <div className="text-right">
                    <p className="font-ui text-[7px] uppercase tracking-[0.18em] text-[#b4bba9]/40">
                      Best
                    </p>
                    <p className="font-display text-2xl leading-none text-[#d7b46a]">
                      {formatMessRunScore(bestScore)}
                    </p>
                  </div>
                ) : (
                  <Trophy className="size-5 text-[#d7b46a]/60" />
                )}
              </div>

              <div className="mt-4 grid grid-cols-3 gap-2">
                <div className="border border-[#f1ead8]/8 bg-black/15 p-2.5">
                  <p className="font-ui text-[7px] uppercase tracking-[0.15em] text-[#b4bba9]/40">
                    Last score
                  </p>
                  <p className="mt-1 font-display text-lg leading-none text-[#f1e3c8]">
                    {lastRun ? formatMessRunScore(lastRun.score) : "—"}
                  </p>
                </div>
                <div className="border border-[#f1ead8]/8 bg-black/15 p-2.5">
                  <p className="font-ui text-[7px] uppercase tracking-[0.15em] text-[#b4bba9]/40">
                    Best distance
                  </p>
                  <p className="mt-1 font-display text-lg leading-none text-[#f1e3c8]">
                    {lastRun ? formatMessRunDistance(Math.max(...recentRuns.map((run) => run.distance))) : "—"}
                  </p>
                </div>
                <div className="border border-[#f1ead8]/8 bg-black/15 p-2.5">
                  <p className="font-ui text-[7px] uppercase tracking-[0.15em] text-[#b4bba9]/40">
                    Last food
                  </p>
                  <p className="mt-1 font-display text-lg leading-none text-[#f1e3c8]">
                    {lastRun ? `${Math.round(lastRun.foodLeft)}%` : "—"}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={startRun}
                className="group mt-4 flex min-h-14 w-full items-center justify-between gap-4 border border-[#d7b46a] bg-[#d7b46a] px-5 py-4 text-left text-[#0b1511] transition hover:bg-[#efd79f]"
              >
                <span>
                  <span className="block font-ui text-[8px] font-semibold uppercase tracking-[0.24em] opacity-65">
                    {selectedMode.kicker} · {teacher.name} chasing
                  </span>
                  <span className="mt-0.5 block font-display text-2xl leading-none">
                    Start the escape
                  </span>
                </span>
                <span className="flex size-9 items-center justify-center rounded-full border border-[#0b1511]/25 transition group-hover:bg-[#0b1511]/10">
                  <Play className="ml-0.5 size-4 fill-current" />
                </span>
              </button>

              <p className="mt-3 text-center font-ui text-[8px] uppercase tracking-[0.14em] text-[#b4bba9]/35">
                Swipe on mobile · Arrows or WASD on desktop
              </p>
            </div>
          </div>
        </section>

        <section className="mt-14">
          <div className="flex flex-wrap items-end justify-between gap-3 border-b border-[#f1ead8]/12 pb-4">
            <div>
              <p className="font-ui text-[8px] uppercase tracking-[0.26em] text-[#d7b46a]/75">
                Choose the chase
              </p>
              <h2 className="mt-1 font-display text-3xl text-[#f1ead8]">Select a teacher</h2>
            </div>
            <p className="max-w-md text-right font-ui text-[9px] leading-5 text-[#b4bba9]/55">
              Existing campus staff. Existing personalities. One of them will be directly behind
              you.
            </p>
          </div>
          <div className="mt-5 grid max-h-[34rem] gap-3 overflow-y-auto pr-1 sm:grid-cols-2 xl:grid-cols-3">
            {MESS_RUN_TEACHERS.map((entry) => {
              const active = entry.id === teacherId;
              return (
                <button
                  key={entry.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setTeacherId(entry.id)}
                  className={`group relative flex gap-3 border p-3.5 text-left transition ${
                    active
                      ? "border-[#d7b46a]/70 bg-[#d7b46a]/10 shadow-[0_14px_40px_rgba(0,0,0,0.24)]"
                      : "border-[#f1ead8]/10 bg-[#08100b]/55 hover:border-[#d7b46a]/35 hover:bg-[#0a1510]"
                  }`}
                >
                  <TeacherPortrait teacher={teacherDialogueMeta(entry)} size={54} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-start justify-between gap-2">
                      <span>
                        <span className="block font-display text-lg leading-tight text-[#f1e3c8]">
                          {entry.name}
                        </span>
                        <span className="mt-0.5 block font-ui text-[8px] uppercase tracking-[0.16em] text-[#b4bba9]/55">
                          {entry.role} · {entry.subject}
                        </span>
                      </span>
                      {active && <Check className="mt-0.5 size-4 shrink-0 text-[#d7b46a]" />}
                    </span>
                    <span className="mt-2 flex items-center gap-2">
                      <DifficultyBar value={entry.difficulty} />
                      <span className="font-ui text-[8px] uppercase tracking-[0.12em] text-[#d7b46a]/70">
                        {entry.difficultyLabel}
                      </span>
                    </span>
                    <span className="mt-2 block text-[10px] leading-4 text-[#b4bba9]/55">
                      {entry.intro}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        <section className="mt-12">
          <div className="flex items-end justify-between gap-4 border-b border-[#f1ead8]/12 pb-4">
            <div>
              <p className="font-ui text-[8px] uppercase tracking-[0.26em] text-[#d7b46a]/75">
                Pick the pressure
              </p>
              <h2 className="mt-1 font-display text-3xl text-[#f1ead8]">Game mode</h2>
            </div>
            <p className="hidden font-ui text-[9px] uppercase tracking-[0.13em] text-[#b4bba9]/40 sm:block">
              All modes use the same campus run
            </p>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {MESS_RUN_MODES.map((entry) => {
              const active = entry.id === mode;
              return (
                <button
                  key={entry.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setMode(entry.id)}
                  className={`relative border p-4 text-left transition ${
                    active
                      ? "border-[#d7b46a]/70 bg-[#d7b46a]/9"
                      : "border-[#f1ead8]/10 bg-[#08100b]/45 hover:border-[#d7b46a]/35"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-ui text-[8px] uppercase tracking-[0.2em] text-[#d7b46a]/70">
                      {entry.kicker}
                    </span>
                    {active ? (
                      <Check className="size-3.5 text-[#d7b46a]" />
                    ) : (
                      <span className="size-3.5 rounded-full border border-[#f1ead8]/18" />
                    )}
                  </div>
                  <p className="mt-3 font-display text-xl text-[#f1e3c8]">{entry.name}</p>
                  <p className="mt-1.5 text-[10px] leading-5 text-[#b4bba9]/55">
                    {entry.description}
                  </p>
                  <p className="mt-3 flex items-start gap-1.5 border-t border-[#f1ead8]/8 pt-2 font-ui text-[8px] leading-4 text-[#d7b46a]/60">
                    <Target className="mt-0.5 size-3 shrink-0" />
                    {entry.objective}
                  </p>
                </button>
              );
            })}
          </div>
        </section>

        <section className="mt-12 grid gap-4 border-t border-[#f1ead8]/10 pt-6 sm:grid-cols-[1fr_auto] sm:items-center">
          <div>
            <p className="font-ui text-[8px] uppercase tracking-[0.24em] text-[#d7b46a]/65">
              Previous runs
            </p>
            {recentRuns.length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
                {recentRuns.slice(0, 3).map((run, index) => {
                  const runTeacher = MESS_RUN_TEACHERS.find((item) => item.id === run.teacherId);
                  return (
                    <div
                      key={`${run.at}-${index}`}
                      className="flex items-center gap-2 font-ui text-[9px] text-[#b4bba9]/55"
                    >
                      <span className="font-display text-base text-[#e7c47d]">
                        {formatMessRunScore(run.score)}
                      </span>
                      <span>
                        {runTeacher?.name ?? "Staff"} · {formatMessRunDistance(run.distance)} ·{" "}
                        {formatStoredRunDate(run.at)}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="mt-2 text-[11px] text-[#b4bba9]/50">
                No runs yet. The first tray is always the hardest.
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={startRun}
            className="inline-flex min-h-12 items-center justify-center gap-2 border border-[#d7b46a] bg-[#d7b46a] px-6 py-3 font-ui text-[10px] font-semibold uppercase tracking-[0.22em] text-[#0b1511] transition hover:bg-[#efd79f]"
          >
            <Play className="size-3.5 fill-current" /> Play now
          </button>
        </section>

        <footer className="mt-10 flex flex-wrap items-center justify-between gap-3 border-t border-[#f1ead8]/8 pt-4 font-ui text-[8px] uppercase tracking-[0.16em] text-[#b4bba9]/30">
          <span>Original Navodaya campus mini-game · No existing progress is changed</span>
          <span className="inline-flex items-center gap-1.5">
            <HeartPulse className="size-3" /> Two trays, one escape
          </span>
        </footer>
      </div>
    </main>
  );
}
