import { motion } from "framer-motion";
import {
  AlertTriangle,
  ChevronRight,
  Clock,
  CornerDownLeft,
  Eye,
  EyeOff,
  Footprints,
  Gauge,
  Keyboard,
  Leaf,
  Loader2,
  LogOut,
  Map as MapIcon,
  Moon,
  Mouse,
  Pause,
  Play,
  RotateCcw,
  Shield,
  Smartphone,
  UserRound,
  X,
} from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { GameEngine } from "../core/GameEngine";
import { GameStore, useGameState } from "../core/GameStore";
import { SaveSystem } from "../core/SaveSystem";
import { DEFAULT_SETTINGS, type GameUIState } from "../core/types";
import { getHouse } from "../data/houses";
import { AdventureMenu } from "./AdventureMenu";
import { CampusEscape } from "./CampusEscape";
import { CampusMap } from "./CampusMap";
import { CampusPlan } from "./CampusPlan";
import { CharacterCreation } from "./CharacterCreation";
import { HouseEmblem } from "./HouseVisuals";
import { MobileControls } from "./MobileControls";
import { NightResultOverlay } from "./NightResult";
import { ProfilePanel } from "./ProfilePanel";
import { SettingsPanel } from "./SettingsPanel";

function detectTouch(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(pointer: coarse)").matches || navigator.maxTouchPoints > 0;
}

function formatPlaytime(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(total / 60);
  const rest = total % 60;
  return `${minutes}m ${rest.toString().padStart(2, "0")}s`;
}

export function GameShell({
  menu = true,
  multiplayer = false,
  children,
  onEngineReady,
}: {
  menu?: boolean;
  multiplayer?: boolean;
  children?: ReactNode;
  onEngineReady?: (engine: GameEngine) => void;
} = {}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const onEngineReadyRef = useRef(onEngineReady);
  onEngineReadyRef.current = onEngineReady;
  const [store] = useState(() => {
    const save = new SaveSystem().load();
    const touch = detectTouch();
    const initialSettings = save.ok
      ? save.data.settings
      : { ...DEFAULT_SETTINGS, quality: (touch ? "medium" : "high") as "medium" | "high" };
    const instance = new GameStore(save.ok, touch, initialSettings);
    if (save.ok) {
      instance.patch({ character: save.data.character, playtime: Math.round(save.data.playtime) });
    }
    return instance;
  });
  const state = useGameState(store);
  const [engine, setEngine] = useState<GameEngine | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const instance = new GameEngine(container, store);
    setEngine(instance);
    void instance.init().then(() => onEngineReadyRef.current?.(instance));
    return () => {
      instance.dispose();
      setEngine((current) => (current === instance ? null : current));
    };
  }, [store]);

  const ready = state.load.status === "ready";
  const inGame =
    state.screen === "creation" ||
    state.screen === "playing" ||
    state.screen === "paused" ||
    state.screen === "dialogue" ||
    state.screen === "notice" ||
    state.screen === "ending" ||
    state.screen === "night-result" ||
    state.screen === "adventure";

  return (
    <div className="relative h-[100dvh] w-full select-none overflow-hidden bg-[#0a0907] font-ui text-foreground">
      <div ref={containerRef} className="absolute inset-0 z-0" />

      {ready && inGame && (
        <div className="pointer-events-none absolute inset-0 z-10 bg-[radial-gradient(120%_90%_at_50%_45%,transparent_55%,rgba(6,5,4,0.55)_100%)]" />
      )}

      {!ready && (
        <LoadingScreen
          state={state}
          onRetry={() => {
            window.location.reload();
          }}
        />
      )}

      {ready && state.screen === "creation" && !state.settingsOpen && (
        <CharacterCreation engine={engine} />
      )}

      {ready && menu && state.screen === "menu" && !state.settingsOpen && (
        <MainMenu state={state} engine={engine} />
      )}

      {ready && state.screen === "playing" && !state.settingsOpen && (
        <>
          <Hud state={state} engine={engine} multiplayer={multiplayer} />
          {state.isTouch && (
            <MobileControls
              engine={engine}
              promptActive={Boolean(state.prompt)}
              crouching={state.crouching}
            />
          )}
        </>
      )}

      {ready && !multiplayer && state.screen === "paused" && !state.settingsOpen && !state.planOpen && !state.campusMapOpen && (
        <PauseMenu state={state} engine={engine} />
      )}

      {ready && state.planOpen && <CampusPlan state={state} engine={engine} />}

      {ready && state.campusMapOpen && state.campusMap && (
        <CampusMap state={state} engine={engine} />
      )}

      {ready && state.dialogue && state.screen === "dialogue" && (
        <DialogueOverlay state={state} engine={engine} />
      )}

      {ready && state.notice && state.screen === "notice" && (
        <NoticeOverlay state={state} engine={engine} />
      )}

      {ready && state.screen === "ending" && state.ending && (
        <EndingOverlay state={state} engine={engine} />
      )}

      {ready && state.screen === "night-result" && state.nightResult && (
        <NightResultOverlay state={state} engine={engine} />
      )}

      {ready && state.screen === "adventure" && (
        <AdventureMenu state={state} engine={engine} />
      )}

      {ready && state.screen === "escape" && (
        <CampusEscape state={state} engine={engine} />
      )}

      {ready && state.profileOpen && state.profile && (
        <ProfilePanel state={state} engine={engine} />
      )}

      {ready && state.settingsOpen && (
        <SettingsPanel
          state={state}
          engine={engine}
          onClose={() => engine?.closeSettings()}
        />
      )}

      {children}

      <Toast message={state.toast} />
    </div>
  );
}

/* ------------------------------------------------------------------ loading */

function LoadingScreen({ state, onRetry }: { state: GameUIState; onRetry: () => void }) {
  const error = state.load.status === "error";
  const progress = Math.round(state.load.progress * 100);

  return (
    <div className="film-grain absolute inset-0 z-50 flex flex-col items-center justify-center bg-[#0b0a07] px-6">
      <div className="absolute inset-0 bg-[radial-gradient(75%_60%_at_50%_38%,rgba(183,140,82,0.16),transparent_70%)]" />
      <div className="relative w-full max-w-lg text-center">
        <p className="label-cinema text-primary/70">A Navodaya campus story</p>
        <h1 className="mt-5 font-display text-[clamp(2.6rem,9vw,4.6rem)] leading-none tracking-[0.12em] text-[#f1e7d2]">
          NAVODAYA
        </h1>
        <p className="mt-3 font-ui text-[11px] uppercase tracking-[0.55em] text-[#c9b18a]/80">
          The Campus Life
        </p>

        <div className="mx-auto mt-10 h-px w-24 bg-primary/40" />

        {error ? (
          <div className="mt-8">
            <div className="mx-auto flex size-11 items-center justify-center rounded-full border border-[#c2705a]/40 text-[#d99b84]">
              <AlertTriangle className="size-5" />
            </div>
            <p className="mt-5 font-display text-2xl text-foreground">The campus could not load</p>
            <p className="mx-auto mt-3 max-w-sm font-ui text-xs leading-relaxed text-muted-foreground">
              {state.load.error ??
                "WebGL is unavailable on this device. Enable hardware acceleration or try another browser."}
            </p>
            <button
              type="button"
              onClick={onRetry}
              className="mt-7 inline-flex items-center gap-2 rounded-sm border border-primary/60 px-6 py-3 font-ui text-[11px] uppercase tracking-[0.28em] text-primary transition hover:bg-primary/10"
            >
              <RotateCcw className="size-3.5" />
              Reload the campus
            </button>
          </div>
        ) : (
          <div className="mt-7">
            <div className="relative mx-auto h-[3px] w-full max-w-sm overflow-hidden rounded-full bg-foreground/10">
              <div
                className="absolute inset-y-0 left-0 bg-gradient-to-r from-[#8f6f3f] to-[#e6c78f] transition-[width] duration-300 ease-out"
                style={{ width: `${Math.max(4, progress)}%` }}
              />
              <div className="absolute inset-y-0 w-1/3 animate-sweep bg-gradient-to-r from-transparent via-white/25 to-transparent" />
            </div>
            <div className="mt-4 flex items-center justify-between font-ui text-[10px] uppercase tracking-[0.24em] text-muted-foreground">
              <span className="inline-flex items-center gap-2">
                <Loader2 className="size-3 animate-spin text-primary/70" />
                {state.load.stage}
              </span>
              <span className="tabular-nums text-primary/80">{progress}%</span>
            </div>
            <p className="mt-10 font-ui text-[10px] uppercase tracking-[0.3em] text-foreground/25">
              Interpretive JNV campus · Procedural textures · Local save
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- main menu */

function MenuRow({
  index,
  label,
  detail,
  onClick,
  disabled,
}: {
  index: string;
  label: string;
  detail?: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="group flex w-full items-center justify-between gap-4 border-b border-foreground/12 py-3.5 text-left transition-colors hover:border-primary/40 disabled:cursor-not-allowed disabled:opacity-40"
    >
      <span className="flex items-baseline gap-4">
        <span className="font-ui text-[10px] tracking-[0.28em] text-primary/50 transition-colors group-hover:text-primary/90">
          {index}
        </span>
        <span className="min-w-0">
          <span className="block font-display text-2xl leading-tight tracking-wide text-[#f1e7d2] transition-colors group-hover:text-primary">
            {label}
          </span>
          {detail && (
            <span className="mt-1 block font-ui text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              {detail}
            </span>
          )}
        </span>
      </span>
      <ChevronRight className="size-4 shrink-0 text-foreground/35 transition-all group-hover:translate-x-1 group-hover:text-primary" />
    </button>
  );
}

function MainMenu({ state, engine }: { state: GameUIState; engine: GameEngine | null }) {
  const [confirmNew, setConfirmNew] = useState(false);
  const [showControls, setShowControls] = useState(false);
  const profile = state.profile;
  const house = profile ? getHouse(profile.houseId) : null;

  return (
    <div className="film-grain absolute inset-0 z-20 overflow-y-auto">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(100deg,rgba(9,8,6,0.94)_0%,rgba(9,8,6,0.72)_38%,rgba(9,8,6,0.16)_72%,rgba(9,8,6,0.5)_100%)]" />
      <div className="pointer-events-none absolute inset-0 vignette opacity-80" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-black/70" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1 bg-black/70" />

      <div className="relative flex min-h-full flex-col px-6 py-6 sm:px-12 sm:py-9">
        <header className="flex items-start justify-between gap-6">
          <div className="flex items-center gap-3">
            <span className="block h-8 w-px bg-primary/60" />
            <div>
              <p className="font-display text-sm tracking-[0.32em] text-[#efe4cd]">NAVODAYA</p>
              <p className="mt-0.5 font-ui text-[9px] uppercase tracking-[0.3em] text-muted-foreground">
                The Campus Life
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="label-cinema text-primary/70">Term II</p>
            <p className="mt-1 font-ui text-[10px] uppercase tracking-[0.22em] text-foreground/40">
              Houses · Campus route
            </p>
          </div>
        </header>

        <div className="flex flex-1 items-end py-10 sm:items-center sm:py-6">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            className="w-full max-w-xl"
          >
            <p className="label-cinema text-primary/80">An interpretive JNV campus</p>
            <h1 className="mt-4 font-display text-[clamp(3.4rem,9vw,6rem)] leading-[0.92] tracking-[0.04em] text-[#f4ead6] drop-shadow-[0_10px_40px_rgba(0,0,0,0.6)]">
              NAVODAYA
            </h1>
            <p className="mt-3 font-ui text-[11px] uppercase tracking-[0.62em] text-[#d8bd8f]">
              The Campus Life
            </p>
            <p className="mt-6 max-w-md font-ui text-sm leading-relaxed text-foreground/70">
              Walk the gate, read the board, find your classroom. Then choose your own day: a
              campus route with hidden notes, or a fictional midnight caper.
            </p>

            {profile && house && (
              <button
                type="button"
                onClick={() => engine?.openProfile()}
                aria-label="Open player profile"
                className="mt-6 flex w-full max-w-md items-center gap-3 border border-foreground/12 bg-black/25 px-3.5 py-3 text-left transition hover:border-primary/40 hover:bg-black/35"
              >
                <HouseEmblem houseId={house.id} size={34} />
                <span className="min-w-0 flex-1">
                  <span className="block font-display text-lg leading-tight text-[#f2e7d2]">
                    {profile.characterName}
                  </span>
                  <span className="mt-0.5 block font-ui text-[9px] uppercase tracking-[0.18em] text-foreground/40">
                    {house.name} · Class {profile.className} · Level {profile.level}
                  </span>
                </span>
                <ChevronRight className="size-3.5 shrink-0 text-foreground/30" />
              </button>
            )}

            <div className="mt-8 max-w-md">
              {confirmNew ? (
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-sm border border-primary/30 bg-black/40 p-5 backdrop-blur-sm"
                >
                  <p className="font-display text-xl text-foreground">Start a new day?</p>
                  <p className="mt-2 font-ui text-xs leading-relaxed text-muted-foreground">
                    Your saved house, character and progress will be replaced. Settings are kept.
                  </p>
                  <div className="mt-4 flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setConfirmNew(false);
                        engine?.newGame();
                      }}
                      className="rounded-sm border border-primary/60 bg-primary/15 px-4 py-2.5 font-ui text-[10px] uppercase tracking-[0.24em] text-primary transition hover:bg-primary/25"
                    >
                      Begin again
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmNew(false)}
                      className="rounded-sm border border-foreground/20 px-4 py-2.5 font-ui text-[10px] uppercase tracking-[0.24em] text-foreground/70 transition hover:border-foreground/40"
                    >
                      Keep my save
                    </button>
                  </div>
                </motion.div>
              ) : (
                <nav aria-label="Main menu">
                  {state.hasSave && (
                    <MenuRow
                      index="01"
                      label="Continue"
                      detail={
                        profile && house
                          ? `${profile.characterName} · ${house.shortName} House`
                          : "Resume from your last save"
                      }
                      onClick={() => engine?.continueGame()}
                    />
                  )}
                  <MenuRow
                    index={state.hasSave ? "02" : "01"}
                    label="New Game"
                    detail="Choose a house & student"
                    onClick={() => {
                      if (state.hasSave) setConfirmNew(true);
                      else engine?.newGame();
                    }}
                  />
                  <MenuRow
                    index={state.hasSave ? "03" : "02"}
                    label="Settings"
                    detail="Graphics · camera · audio · character"
                    onClick={() => engine?.openSettings()}
                  />
                  <MenuRow
                    index={state.hasSave ? "04" : "03"}
                    label="Controls"
                    detail="Keyboard, mouse and touch"
                    onClick={() => {
                      setShowControls((value) => !value);
                      engine?.uiClick();
                    }}
                  />
                </nav>
              )}

              {showControls && !confirmNew && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  className="overflow-hidden"
                >
                  <div className="mt-5 grid gap-4 rounded-sm border border-foreground/12 bg-black/30 p-4 sm:grid-cols-2">
                    <div>
                      <p className="label-cinema flex items-center gap-2 text-primary/70">
                        <Keyboard className="size-3" /> Keyboard
                      </p>
                      <ul className="mt-3 space-y-1.5 font-ui text-[11px] text-foreground/70">
                        <li>W A S D — walk</li>
                        <li>Shift — run · C — crouch</li>
                        <li>Mouse — look · Space — jump</li>
                        <li>E — interact · Esc — pause</li>
                      </ul>
                    </div>
                    <div>
                      <p className="label-cinema flex items-center gap-2 text-primary/70">
                        <Smartphone className="size-3" /> Touch
                      </p>
                      <ul className="mt-3 space-y-1.5 font-ui text-[11px] text-foreground/70">
                        <li>Left stick — walk</li>
                        <li>Drag the right side — look</li>
                        <li>Crouch, Jump and Interact buttons</li>
                        <li>Tap the campus to begin looking</li>
                      </ul>
                    </div>
                  </div>
                </motion.div>
              )}
            </div>

            <div className="mt-9 flex flex-wrap items-center gap-x-6 gap-y-2 font-ui text-[10px] uppercase tracking-[0.2em] text-foreground/35">
              <span className="inline-flex items-center gap-2">
                <Mouse className="size-3" /> Third person
              </span>
              <span>No sign-in needed</span>
              <span>Saves on this device</span>
              {state.hasSave && <span className="text-primary/60">Local save found</span>}
            </div>
          </motion.div>
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-foreground/10 pt-4 font-ui text-[9px] uppercase tracking-[0.24em] text-foreground/30">
          <span>Interpretive JNV campus · Fictional people & caper · Not a surveyed plan</span>
          <span>Term II · Houses, route & caper</span>
        </footer>
      </div>
    </div>
  );
}

/* --------------------------------------------------------------------- HUD */

function Hud({
  state,
  engine,
  multiplayer = false,
}: {
  state: GameUIState;
  engine: GameEngine | null;
  multiplayer?: boolean;
}) {
  const mission = state.mission;
  const objectiveNumber = Math.min(mission.total, mission.step + 1);
  const night = state.night?.active ? state.night : null;
  const duty = state.gardenDuty;
  const profile = state.profile;
  const house = profile ? getHouse(profile.houseId) : null;

  return (
    <div className="pointer-events-none absolute inset-0 z-20 font-ui">
      <div className="absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-black/55 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/55 to-transparent" />

      {!night && !duty && !multiplayer && (
      <motion.div
        key={mission.objective}
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="absolute left-4 top-4 w-[calc(100%-5.5rem)] max-w-[15rem] border-l border-primary/50 pl-4 sm:left-6 sm:top-6 sm:max-w-[19rem]"
      >
        <p className="label-cinema text-[9px] text-primary/75">
          {mission.done ? "Mission complete" : `Objective ${String(objectiveNumber).padStart(2, "0")} / ${String(mission.total).padStart(2, "0")}`}
        </p>
        <p className="mt-1.5 font-display text-[15px] leading-snug text-[#f4ead6] drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)]">
          {mission.title}
        </p>
        <p className="mt-1 max-w-[18rem] font-ui text-[11px] leading-relaxed text-foreground/75 drop-shadow-[0_2px_6px_rgba(0,0,0,0.9)]">
          {mission.objective}
        </p>
        {mission.hint && (
          <p className="mt-1 hidden max-w-[18rem] font-ui text-[10px] leading-relaxed text-foreground/40 drop-shadow-[0_2px_6px_rgba(0,0,0,0.9)] sm:block">
            {mission.hint}
          </p>
        )}
        <p className="mt-1.5 font-ui text-[9px] uppercase tracking-[0.16em] text-[#b9c69d]/55">
          Campus route · {state.exploration?.discovered ?? 0}/{state.exploration?.total ?? 10}
        </p>
        <div className="mt-2.5 flex items-center gap-1.5">
          {Array.from({ length: mission.total }).map((_, index) => (
            <span
              key={index}
              className={`h-[3px] w-5 transition-colors ${
                index < mission.completed.length ? "bg-primary" : "bg-foreground/20"
              }`}
            />
          ))}
        </div>
      </motion.div>
      )}

      {night && <NightMissionHud night={night} />}
      {duty && <GardenDutyHud duty={duty} />}

      <div className="absolute right-4 top-4 flex items-center gap-2 sm:right-6 sm:top-6 sm:gap-3">
        {profile && !night && !multiplayer && (
          <button
            type="button"
            onClick={() => engine?.openCampusMap()}
            aria-label="Open campus map"
            data-testid="hud-map"
            className="pointer-events-auto flex items-center gap-2 border border-foreground/15 bg-black/35 px-2 py-1.5 backdrop-blur-sm transition hover:border-[#b9c69d]/55 hover:text-[#dce7c6]"
          >
            <MapIcon className="size-4 text-foreground/70" />
            <span className="hidden text-left sm:block">
              <span className="block font-ui text-[8px] uppercase tracking-[0.16em] text-foreground/55">
                Campus
              </span>
              <span className="mt-0.5 block font-ui text-[7px] uppercase tracking-[0.14em] text-foreground/30">
                {state.exploration?.discovered ?? 0} / {state.exploration?.total ?? 10} stops
              </span>
            </span>
          </button>
        )}
        {profile && house && !multiplayer && (
          <button
            type="button"
            onClick={() => engine?.openProfile()}
            aria-label="Open player profile"
            data-testid="hud-profile"
            className="pointer-events-auto flex items-center gap-2 border border-foreground/15 bg-black/35 px-2 py-1.5 backdrop-blur-sm transition hover:border-primary/50"
          >
            <HouseEmblem houseId={house.id} size={26} />
            <span className="text-left">
              <span className="hidden font-display text-[13px] leading-tight text-[#f2e7d2] sm:block">
                {profile.characterName}
              </span>
              <span className="mt-0.5 block font-ui text-[8px] uppercase tracking-[0.16em] text-foreground/40">
                {house.shortName} · Lv {profile.level}
              </span>
            </span>
          </button>
        )}
        <div className="hidden text-right lg:block">
          <p className="label-cinema text-[9px] text-foreground/45">
            {night ? "Lights out · 00:20" : "Golden hour · 17:40"}
          </p>
          <p className="mt-1 font-ui text-[10px] uppercase tracking-[0.2em] text-foreground/30">
            {night ? "Operation Midnight Mischief" : "Navodaya campus"}
          </p>
        </div>
        {!multiplayer && (
          <button
            type="button"
            onClick={() => engine?.pause()}
            aria-label="Pause game"
            className="pointer-events-auto flex size-10 items-center justify-center rounded-full border border-foreground/20 bg-black/35 text-foreground/80 backdrop-blur-sm transition hover:border-primary/60 hover:text-primary"
          >
            <Pause className="size-4" />
          </button>
        )}
      </div>

      {state.prompt && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          data-testid="interaction-prompt"
          className={`absolute left-1/2 -translate-x-1/2 ${state.isTouch ? "bottom-[188px]" : "bottom-10"}`}
        >
          <div className="hud-panel flex items-center gap-3 rounded-sm px-4 py-2.5">
            <span className="flex size-6 items-center justify-center rounded-[3px] border border-primary/50 font-ui text-[10px] text-primary">
              {state.isTouch ? "•" : "E"}
            </span>
            <span className="font-ui text-xs tracking-wide text-foreground/90">{state.prompt}</span>
          </div>
        </motion.div>
      )}

      {!state.isTouch && !state.pointerLocked && (
        <div className="absolute bottom-6 right-6 hidden items-center gap-2 font-ui text-[10px] uppercase tracking-[0.2em] text-foreground/40 sm:flex">
          <Mouse className="size-3" />
          Click to look · Esc to pause
        </div>
      )}
    </div>
  );
}

function GardenDutyHud({ duty }: { duty: NonNullable<GameUIState["gardenDuty"]> }) {
  return (
    <motion.div
      key={duty.complete ? "complete" : String(duty.watered)}
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      data-testid="garden-duty-hud"
      className="absolute left-4 top-4 w-[calc(100%-7.5rem)] max-w-[16rem] border-l border-[#9fc38d]/55 pl-4 sm:left-6 sm:top-6 sm:max-w-[20rem]"
    >
      <p className="label-cinema text-[9px] text-[#cfe0bd]/80">
        Garden duty · {duty.complete ? "Complete" : "Mr. Barua"}
      </p>
      <p className="mt-1.5 font-display text-[15px] leading-snug text-[#edf3e5] drop-shadow-[0_2px_8px_rgba(0,0,0,0.95)]">
        {duty.complete ? "Duty signed off" : "Water three garden beds"}
      </p>
      <p className="mt-1 max-w-[19rem] font-ui text-[11px] leading-relaxed text-foreground/75 drop-shadow-[0_2px_6px_rgba(0,0,0,0.95)]">
        {duty.complete
          ? "The tomatoes are accounted for. Breakfast is still warm."
          : "Use the garden plots behind the south lawn. No XP and no house points are awarded."}
      </p>
      <div className="mt-3 flex items-center gap-2 font-ui text-[9px] uppercase tracking-[0.18em] text-[#cfe0bd]/60">
        <Leaf className="size-3" /> {duty.watered} / {duty.total} beds watered
      </div>
      <div className="mt-2 flex items-center gap-1.5">
        {Array.from({ length: duty.total }).map((_, index) => (
          <span
            key={index}
            className={`h-[3px] w-8 ${index < duty.watered ? "bg-[#9fc38d]" : "bg-foreground/15"}`}
          />
        ))}
      </div>
    </motion.div>
  );
}

function NightMissionHud({
  night,
}: {
  night: NonNullable<GameUIState["night"]>;
}) {
  const collected = night.collected.length;
  const suspicion = Math.round(night.suspicion * 100);
  return (
    <motion.div
      key={night.objective}
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      data-testid="night-hud"
      className="absolute left-4 top-4 w-[calc(100%-7.5rem)] max-w-[16rem] border-l pl-4 sm:left-6 sm:top-6 sm:max-w-[20rem]"
      style={{ borderColor: "rgba(176,198,218,0.55)" }}
    >
      <p className="label-cinema text-[9px] text-[#b9cee2]/80">
        Operation Midnight Mischief · {Math.min(night.total, night.step + 1)} / {night.total}
      </p>
      <p className="mt-1.5 font-display text-[15px] leading-snug text-[#eaf0f7] drop-shadow-[0_2px_8px_rgba(0,0,0,0.95)]">
        {night.title}
      </p>
      <p className="mt-1 max-w-[19rem] font-ui text-[11px] leading-relaxed text-foreground/80 drop-shadow-[0_2px_6px_rgba(0,0,0,0.95)]">
        {night.objective}
      </p>
      <p className="mt-1 hidden max-w-[19rem] font-ui text-[10px] leading-relaxed text-foreground/40 sm:block">
        {night.hint}
      </p>

      <div className="mt-3 max-w-[15rem] rounded-sm border border-[#b9cee2]/15 bg-black/45 px-3 py-2 backdrop-blur-sm">
        <div className="flex items-center justify-between gap-3 font-ui text-[8px] uppercase tracking-[0.18em]">
          <span className="inline-flex items-center gap-1.5 text-foreground/50">
            <Eye className="size-2.5" /> Suspicion
          </span>
          <span className={suspicion > 55 ? "text-[#e3a28d]" : "text-[#d7c6a3]/70"}>{suspicion}%</span>
        </div>
        <div className="mt-1.5 h-[3px] overflow-hidden rounded-full bg-foreground/15" role="meter" aria-label="Suspicion" aria-valuemin={0} aria-valuemax={100} aria-valuenow={suspicion}>
          <div
            className="h-full rounded-full transition-[width] duration-200"
            style={{
              width: `${suspicion}%`,
              backgroundColor: suspicion > 70 ? "#d96f55" : suspicion > 35 ? "#e0b06a" : "#9fb9c9",
            }}
          />
        </div>
        <div className="mt-2 flex items-center justify-between gap-2 font-ui text-[8px] uppercase tracking-[0.14em]">
          <span className={`inline-flex items-center gap-1.5 ${night.hidden ? "text-[#a8d3ad]" : "text-foreground/35"}`}>
            {night.hidden ? <EyeOff className="size-2.5" /> : <Footprints className="size-2.5" />}
            {night.hidden ? "Hidden" : "Exposed"}
          </span>
          <span className="inline-flex items-center gap-1.5 text-foreground/45">
            <Leaf className="size-2.5" /> {collected}/4
          </span>
        </div>
      </div>

      <div className="mt-2.5 flex items-center gap-1.5">
        {Array.from({ length: night.total }).map((_, index) => (
          <span
            key={index}
            className={`h-[3px] w-5 ${index <= night.step ? "bg-[#9fb9c9]" : "bg-foreground/15"}`}
          />
        ))}
      </div>
    </motion.div>
  );
}

/* ----------------------------------------------------------------- pause UI */

function PauseMenu({ state, engine }: { state: GameUIState; engine: GameEngine | null }) {
  const [confirmQuit, setConfirmQuit] = useState(false);
  const dutyAvailable = Boolean(
    state.profile &&
      !state.night?.active &&
      state.profile.achievements.includes("caught-in-the-act") &&
      !state.profile.achievements.includes("garden-duty"),
  );
  const nightAvailable = Boolean(state.profile && (!state.night || state.night.active));
  const activityAvailable = Boolean(state.profile && !state.night?.active);

  return (
    <div className="absolute inset-0 z-30 flex overflow-y-auto bg-black/55 backdrop-blur-[3px]">
      <div className="pointer-events-none fixed inset-0 bg-[linear-gradient(90deg,rgba(8,7,5,0.92),rgba(8,7,5,0.55)_45%,rgba(8,7,5,0.25))]" />
      <motion.div
        initial={{ opacity: 0, x: -14 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="relative flex min-h-full w-full max-w-md flex-col justify-center px-7 py-10 sm:px-12"
      >
        <p className="label-cinema text-primary/80">Intermission</p>
        <h2 className="mt-3 font-display text-5xl leading-none text-[#f4ead6]">Paused</h2>
        <p className="mt-3 font-ui text-xs leading-relaxed text-foreground/50">
          The campus is still there. Take your time.
        </p>

        <div className="mt-8">
          <MenuRow index="01" label="Resume" detail="Back to the campus" onClick={() => engine?.resume()} />
          <MenuRow
            index="02"
            label="Save progress"
            detail="Write to this device"
            onClick={() => engine?.saveGame(true)}
          />
          {activityAvailable && (
            <MenuRow
              index="03"
              label="Campus map"
              detail={`${state.exploration?.discovered ?? 0} / ${state.exploration?.total ?? 10} route stops · travel`}
              onClick={() => engine?.openCampusMap("paused")}
            />
          )}
          {nightAvailable && (
            <MenuRow
              index="04"
              label={state.night?.active ? "Resume caper" : "Adventure menu"}
              detail={
                state.night?.active
                  ? `Fictional stealth caper · attempt ${state.night.attempts}`
                  : "Operation Midnight Mischief or Campus Escape"
              }
              onClick={() => (state.night?.active ? engine?.resume() : engine?.openAdventure())}
            />
          )}
          {state.profile && (
            <MenuRow
              index="05"
              label="Player profile"
              detail={`${getHouse(state.profile.houseId)?.shortName ?? "House"} · Level ${state.profile.level} · Achievements`}
              onClick={() => engine?.openProfile()}
            />
          )}
          {dutyAvailable && (
            <MenuRow
              index="06"
              label={state.gardenDuty?.active ? "Resume garden duty" : "Garden duty"}
              detail={
                state.gardenDuty?.active
                  ? `${state.gardenDuty.watered} / ${state.gardenDuty.total} beds watered`
                  : "Water three beds for Mr. Barua"
              }
              onClick={() => (state.gardenDuty?.active ? engine?.resume() : engine?.startGardenDuty())}
            />
          )}
          {activityAvailable && (
            <MenuRow
              index="07"
              label="Choose activity"
              detail="Campus tour or Operation Midnight Mischief"
              onClick={() => engine?.openPlan()}
            />
          )}
          <MenuRow
            index="08"
            label="Settings"
            detail="Graphics · camera · audio"
            onClick={() => engine?.openSettings()}
          />
          <MenuRow
            index="09"
            label="Return to title"
            detail="Your day is saved"
            onClick={() => setConfirmQuit(true)}
          />
        </div>

        {confirmQuit && (
          <div className="mt-4 rounded-sm border border-primary/25 bg-black/40 p-4">
            <p className="font-ui text-xs text-foreground/80">Save your progress and return to the title?</p>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() => engine?.quitToMenu()}
                className="rounded-sm border border-primary/60 px-3 py-2 font-ui text-[10px] uppercase tracking-[0.22em] text-primary transition hover:bg-primary/15"
              >
                Save & exit
              </button>
              <button
                type="button"
                onClick={() => setConfirmQuit(false)}
                className="rounded-sm border border-foreground/20 px-3 py-2 font-ui text-[10px] uppercase tracking-[0.22em] text-foreground/60 transition hover:border-foreground/40"
              >
                Stay
              </button>
            </div>
          </div>
        )}

        <div className="mt-9 grid grid-cols-2 gap-x-6 gap-y-4 border-t border-foreground/10 pt-5">
          <div>
            <p className="label-cinema flex items-center gap-2 text-[9px] text-foreground/35">
              <Clock className="size-3" /> Time on campus
            </p>
            <p className="mt-1 font-display text-lg text-foreground/85">{formatPlaytime(state.playtime)}</p>
          </div>
          <div>
            <p className="label-cinema flex items-center gap-2 text-[9px] text-foreground/35">
              <Gauge className="size-3" /> Performance
            </p>
            <p className="mt-1 font-display text-lg text-foreground/85">
              {state.quality} · {state.fps} fps
            </p>
          </div>
          <div>
            <p className="label-cinema text-[9px] text-foreground/35">Objectives</p>
            <p className="mt-1 font-display text-lg text-foreground/85">
              {state.mission.completed.length} / {state.mission.total}
            </p>
          </div>
          <div>
            <p className="label-cinema text-[9px] text-foreground/35">Save</p>
            <p className="mt-1 font-display text-lg text-foreground/85">
              {state.hasSave ? "Local" : "Not yet"}
            </p>
          </div>
          {state.profile && (
            <>
              <div>
                <p className="label-cinema text-[9px] text-foreground/35">House</p>
                <p className="mt-1 font-display text-lg text-foreground/85">
                  {getHouse(state.profile.houseId)?.shortName ?? "—"}
                </p>
              </div>
              <div>
                <p className="label-cinema text-[9px] text-foreground/35">Level · XP</p>
                <p className="mt-1 font-display text-lg text-foreground/85">
                  {state.profile.level} · {state.profile.xp}
                </p>
              </div>
            </>
          )}
        </div>

        <div className="mt-6 flex items-center justify-between">
          <button
            type="button"
            onClick={() => engine?.deleteSave()}
            className="font-ui text-[9px] uppercase tracking-[0.22em] text-foreground/30 underline-offset-4 transition hover:text-[#d99b84] hover:underline"
          >
            Delete save & exit
          </button>
          <button
            type="button"
            onClick={() => engine?.resume()}
            className="inline-flex items-center gap-2 font-ui text-[10px] uppercase tracking-[0.22em] text-primary/70 transition hover:text-primary"
          >
            <Play className="size-3" /> Back to campus
          </button>
        </div>
      </motion.div>
    </div>
  );
}

/* ---------------------------------------------------------------- dialogue */

function DialogueOverlay({ state, engine }: { state: GameUIState; engine: GameEngine | null }) {
  const dialogue = state.dialogue;
  if (!dialogue) return null;

  return (
    <div className="absolute inset-0 z-40 flex flex-col justify-end">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-black/40" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-10 bg-black/85" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-black/85" />

      <motion.div
        initial={{ opacity: 0, y: 22 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="relative mx-auto w-full max-w-3xl px-5 pb-14 sm:px-8 sm:pb-16"
      >
        <div className="mb-4 flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-full border border-primary/50 bg-[#1a1610] font-display text-lg text-primary">
            M
          </span>
          <div>
            <p className="font-display text-lg leading-none text-[#f4ead6]">{dialogue.speaker}</p>
            <p className="mt-1 font-ui text-[9px] uppercase tracking-[0.26em] text-primary/60">
              {dialogue.role}
            </p>
          </div>
        </div>

        <div className="hud-panel no-scrollbar max-h-[58dvh] overflow-y-auto rounded-sm px-5 py-5 sm:px-7 sm:py-6">
          <p className="font-display text-lg leading-relaxed text-[#efe4cd] sm:text-xl">
            {dialogue.text}
          </p>

          {dialogue.choices.length > 0 && (
            <div className="mt-5 space-y-2">
              {dialogue.choices.map((choice, index) => (
                <button
                  key={choice.label}
                  type="button"
                  onClick={() => engine?.chooseDialogue(index)}
                  className="group flex w-full items-center gap-3 border-t border-foreground/10 py-3 text-left transition-colors hover:text-primary"
                >
                  <span className="font-ui text-[10px] tracking-[0.22em] text-primary/50 group-hover:text-primary">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className="font-ui text-sm text-foreground/85 group-hover:text-primary">
                    {choice.label}
                  </span>
                  <ChevronRight className="ml-auto size-3.5 text-foreground/25 transition group-hover:translate-x-0.5 group-hover:text-primary" />
                </button>
              ))}
            </div>
          )}

          {dialogue.canAdvance ? (
            <div className="mt-5 flex items-center justify-between gap-4 border-t border-foreground/10 pt-4">
              <span className="font-ui text-[9px] uppercase tracking-[0.22em] text-foreground/35">
                {state.isTouch ? "Tap to continue" : "Space or E to continue"}
              </span>
              <button
                type="button"
                onClick={() => engine?.advanceDialogue()}
                className="inline-flex items-center gap-2 rounded-sm border border-primary/50 px-4 py-2 font-ui text-[10px] uppercase tracking-[0.22em] text-primary transition hover:bg-primary/12"
              >
                Continue <CornerDownLeft className="size-3" />
              </button>
            </div>
          ) : (
            <p className="mt-4 border-t border-foreground/10 pt-3 font-ui text-[9px] uppercase tracking-[0.22em] text-foreground/35">
              Choose a reply
            </p>
          )}
        </div>
      </motion.div>
    </div>
  );
}

/* ------------------------------------------------------------------ notice */

function NoticeOverlay({ state, engine }: { state: GameUIState; engine: GameEngine | null }) {
  const notice = state.notice;
  if (!notice) return null;

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center overflow-y-auto bg-black/60 px-4 py-10 backdrop-blur-[2px]">
      <motion.div
        initial={{ opacity: 0, y: 18, rotateX: -3 }}
        animate={{ opacity: 1, y: 0, rotateX: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="relative w-full max-w-2xl border border-[#2f4a38] bg-[#1d3327] p-2 shadow-[0_50px_120px_-40px_rgba(0,0,0,0.9)]"
        role="dialog"
        aria-modal="true"
        aria-label="Campus notice board"
      >
        <div className="paper-sheet relative px-6 py-7 sm:px-10 sm:py-9">
          <button
            type="button"
            onClick={() => engine?.closeNotice()}
            aria-label="Close notice board"
            className="absolute right-3 top-3 flex size-8 items-center justify-center rounded-full border border-[#6b5b3d]/30 text-[#4a3d28] transition hover:border-[#6b5b3d]/70 hover:text-[#2f2417]"
          >
            <X className="size-3.5" />
          </button>

          <p className="font-ui text-[9px] uppercase tracking-[0.32em] text-[#8a6f42]">
            {notice.subtitle}
          </p>
          <h2 className="mt-2 font-display text-3xl tracking-wide text-[#33291a] sm:text-4xl">
            {notice.title}
          </h2>
          <div className="mt-3 h-px w-full bg-[#8a6f42]/35" />

          <div className="mt-6 space-y-5">
            {notice.items.map((item) => (
              <div key={item.heading} className="grid gap-1 border-b border-[#8a6f42]/20 pb-4 last:border-0 last:pb-0">
                <p className="font-display text-lg text-[#3a2f1f]">{item.heading}</p>
                <p className="font-ui text-[12.5px] leading-relaxed text-[#5b4c34]">{item.body}</p>
              </div>
            ))}
          </div>

          <div className="mt-7 flex flex-wrap items-center justify-between gap-3">
            <span className="font-ui text-[9px] uppercase tracking-[0.24em] text-[#8a6f42]">
              Pinned by the house prefect · Term II
            </span>
            <button
              type="button"
              onClick={() => engine?.closeNotice()}
              className="inline-flex items-center gap-2 rounded-sm border border-[#5e4a2c]/50 bg-[#33291a]/5 px-4 py-2.5 font-ui text-[10px] uppercase tracking-[0.22em] text-[#3a2f1f] transition hover:bg-[#33291a]/10"
            >
              Back to campus <ChevronRight className="size-3" />
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

/* ------------------------------------------------------------------ ending */

function EndingOverlay({ state, engine }: { state: GameUIState; engine: GameEngine | null }) {
  const ending = state.ending;
  if (!ending) return null;

  return (
    <div className="film-grain absolute inset-0 z-40 flex items-center justify-center overflow-y-auto bg-black/70 px-5 py-10 backdrop-blur-[2px]">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        className="relative w-full max-w-lg border border-primary/25 bg-[#100e0b]/90 px-7 py-9 text-center shadow-[0_60px_140px_-50px_rgba(0,0,0,0.95)] sm:px-10 sm:py-11"
      >
        <p className="label-cinema text-primary/80">Day one · Complete</p>
        <h2 className="mt-4 font-display text-4xl leading-tight text-[#f4ead6] sm:text-5xl">
          You found your place.
        </h2>
        <p className="mx-auto mt-4 max-w-sm font-ui text-[12.5px] leading-relaxed text-foreground/60">
          Gate, notice board, classroom, hostel. The bell will ring again tomorrow — the library,
          the dining hall and the sports ground are yours to wander now.
        </p>

        <div className="mt-8 grid grid-cols-2 gap-px overflow-hidden border border-foreground/12 bg-foreground/10">
          <div className="bg-[#15120e] px-4 py-4">
            <p className="label-cinema text-[9px] text-foreground/35">Time on campus</p>
            <p className="mt-1 font-display text-2xl text-foreground/90">{ending.minutes} min</p>
          </div>
          <div className="bg-[#15120e] px-4 py-4">
            <p className="label-cinema text-[9px] text-foreground/35">Objectives</p>
            <p className="mt-1 font-display text-2xl text-foreground/90">
              {ending.steps} / {ending.steps}
            </p>
          </div>
        </div>

        <div className="mt-8 flex flex-col gap-2.5">
          <button
            type="button"
            onClick={() => engine?.continueExploring()}
            className="inline-flex items-center justify-center gap-2 rounded-sm border border-primary/60 bg-primary/12 px-5 py-3 font-ui text-[10px] uppercase tracking-[0.26em] text-primary transition hover:bg-primary/20"
          >
            <Play className="size-3" /> Keep exploring
          </button>
          <button
            type="button"
            onClick={() => engine?.quitToMenu()}
            className="inline-flex items-center justify-center gap-2 rounded-sm border border-foreground/15 px-5 py-3 font-ui text-[10px] uppercase tracking-[0.26em] text-foreground/60 transition hover:border-foreground/30 hover:text-foreground"
          >
            <LogOut className="size-3" /> Return to title
          </button>
        </div>
        <p className="mt-5 font-ui text-[9px] uppercase tracking-[0.22em] text-foreground/25">
          Progress saved · Campus route & fictional caper available
        </p>
      </motion.div>
    </div>
  );
}

/* ------------------------------------------------------------------- toast */

function Toast({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <motion.div
      key={message}
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="pointer-events-none absolute left-1/2 top-28 z-50 -translate-x-1/2 sm:top-6"
    >
      <div className="flex max-w-[92vw] items-start gap-2.5 rounded-sm border border-primary/30 bg-[#100e0b]/92 px-4 py-2.5 shadow-[0_20px_50px_-20px_rgba(0,0,0,0.9)] backdrop-blur-md">
        <span className="mt-1 size-1.5 shrink-0 rounded-full bg-primary" />
        <p className="font-ui text-[11px] leading-relaxed tracking-wide text-foreground/85">{message}</p>
      </div>
    </motion.div>
  );
}
