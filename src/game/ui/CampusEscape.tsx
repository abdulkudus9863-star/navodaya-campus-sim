import { motion } from "framer-motion";
import {
  ArrowLeft,
  Award,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Flag,
  Keyboard,
  Lock,
  Pause,
  Play,
  RotateCcw,
  ShieldCheck,
  Smartphone,
  Trophy,
  Zap,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import type { GameEngine } from "../core/GameEngine";
import type { GameUIState } from "../core/types";
import type { EscapeRunResult } from "../data/escape";
import {
  ESCAPE_DIFFICULTIES,
  ESCAPE_DIFFICULTY_LABELS,
  ESCAPE_DIFFICULTY_NOTES,
  ESCAPE_LEVELS,
  buildEscapeCourse,
  calculateEscapeScore,
  escapeLevelNumber,
  formatEscapeTime,
  getEscapeLevel,
  getEscapeRecord,
  isEscapeLevelUnlocked,
  type EscapeCheckpointSave,
  type EscapeCourse,
  type EscapeDifficulty,
  type EscapeLevelId,
  type EscapeObstacle,
} from "../data/escape";
import { getHouse } from "../data/houses";

type Phase = "intro" | "countdown" | "playing" | "paused" | "result";

interface InputState {
  forward: number;
  lateral: number;
  sprint: boolean;
  jump: boolean;
}

interface RunState {
  course: EscapeCourse;
  x: number;
  z: number;
  y: number;
  vy: number;
  grounded: boolean;
  elapsed: number;
  tokens: Set<string>;
  checkpointIndex: number;
  collisions: number;
  falls: number;
  respawnX: number;
  ignoreUntil: number;
  finished: boolean;
  startedAt: number;
}

interface HudState {
  remaining: number;
  tokens: number;
  totalTokens: number;
  checkpoints: number;
  totalCheckpoints: number;
  liveScore: number;
  elapsed: number;
  checkpointIndex: number;
}

const KEY_LEFT = ["KeyA", "ArrowLeft"];
const KEY_RIGHT = ["KeyD", "ArrowRight"];
const KEY_FORWARD = ["KeyW", "ArrowUp"];
const KEY_BACK = ["KeyS", "ArrowDown"];

function freshRun(course: EscapeCourse, checkpoint?: EscapeCheckpointSave | null): RunState {
  const cpIndex = checkpoint ? checkpoint.checkpointIndex : -1;
  const tokenSet = new Set(checkpoint?.tokens ?? []);
  return {
    course,
    x: checkpoint?.x ?? 0,
    z: 0,
    y: 0,
    vy: 0,
    grounded: true,
    elapsed: checkpoint?.elapsed ?? 0,
    tokens: tokenSet,
    checkpointIndex: cpIndex,
    collisions: checkpoint?.collisions ?? 0,
    falls: checkpoint?.falls ?? 0,
    respawnX: checkpoint?.x ?? 0,
    ignoreUntil: 0,
    finished: false,
    startedAt: performance.now(),
  };
}

function liveScore(run: RunState): number {
  return Math.max(
    0,
    run.tokens.size * 20 +
      (run.checkpointIndex + 1) * 50 -
      run.collisions * 10 -
      run.falls * 20,
  );
}

export function CampusEscape({
  state,
  engine,
}: {
  state: GameUIState;
  engine: GameEngine | null;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const runtimeRef = useRef<RunState | null>(null);
  const phaseRef = useRef<Phase>("intro");
  const keysRef = useRef<Set<string>>(new Set());
  const joystickRef = useRef({ x: 0, y: 0 });
  const jumpRequestRef = useRef(false);
  const sprintTouchRef = useRef(false);
  const joystickPadRef = useRef<HTMLDivElement>(null);
  const joystickKnobRef = useRef<HTMLDivElement>(null);
  const motionRef = useRef(false);

  const save = state.escapeSave;
  const [phase, setPhaseState] = useState<Phase>("intro");
  const [selectedLevel, setSelectedLevel] = useState<EscapeLevelId>(
    save?.lastLevelId ?? "playground-dash",
  );
  const [difficulty, setDifficulty] = useState<EscapeDifficulty>(save?.difficulty ?? "normal");
  const [countdown, setCountdown] = useState(3);
  const [hud, setHud] = useState<HudState | null>(null);
  const [result, setResult] = useState<EscapeRunResult | null>(null);
  const [newAchievements, setNewAchievements] = useState<string[]>([]);
  const [isBest, setIsBest] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const [showPauseControls, setShowPauseControls] = useState(false);

  const setPhase = useCallback((next: Phase) => {
    phaseRef.current = next;
    setPhaseState(next);
  }, []);

  const engineRef = useRef(engine);
  engineRef.current = engine;
  const profileColor = state.profile
    ? getHouse(state.profile.houseId)?.color ?? "#d9b56d"
    : "#d9b56d";

  const announce = useCallback((message: string) => {
    setFlash(message);
    window.setTimeout(() => setFlash((current) => (current === message ? null : current)), 1900);
  }, []);

  useEffect(() => {
    motionRef.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!save) return;
    setSelectedLevel(save.lastLevelId);
    setDifficulty(save.difficulty);
  }, [save?.playerId, save?.lastLevelId, save?.difficulty]);

  /* ------------------------------------------------------------- start run */

  const beginRun = useCallback(
    (levelId: EscapeLevelId, diff: EscapeDifficulty, resume: boolean) => {
      if (!engineRef.current) return;
      const course = buildEscapeCourse(levelId, diff);
      const checkpoint =
        resume && save?.checkpoint?.levelId === levelId && save.checkpoint.difficulty === diff
          ? save.checkpoint
          : null;
      if (!resume) engineRef.current.clearEscapeCheckpoint();
      engineRef.current.setEscapeSelection(levelId, diff);
      runtimeRef.current = freshRun(course, checkpoint);
      setSelectedLevel(levelId);
      setDifficulty(diff);
      setResult(null);
      setNewAchievements([]);
      setIsBest(false);
      setHud(null);
      setCountdown(3);
      setPhase("countdown");
      engineRef.current.escapeSound("start");
    },
    [save?.checkpoint, setPhase],
  );

  const finishRun = useCallback(
    (completed: boolean) => {
      const run = runtimeRef.current;
      if (!run || run.finished) return;
      run.finished = true;
      const outcome = calculateEscapeScore({
        course: run.course,
        completed,
        elapsed: run.elapsed,
        tokens: run.tokens.size,
        checkpoints: run.checkpointIndex + 1,
        collisions: run.collisions,
        falls: run.falls,
      });
      const record = engineRef.current?.recordEscapeResult(outcome) ?? {
        newAchievements: [],
        isBest: false,
      };
      setResult(outcome);
      setNewAchievements(record.newAchievements);
      setIsBest(record.isBest);
      setHud({
        remaining: Math.max(0, run.course.timer - run.elapsed),
        tokens: run.tokens.size,
        totalTokens: run.course.tokens.length,
        checkpoints: run.checkpointIndex + 1,
        totalCheckpoints: run.course.checkpoints.length,
        liveScore: outcome.score,
        elapsed: run.elapsed,
        checkpointIndex: run.checkpointIndex,
      });
      setPhase("result");
      engineRef.current?.escapeSound(completed ? "win" : "fail");
    },
    [setPhase],
  );

  const saveCheckpoint = useCallback((run: RunState) => {
    engineRef.current?.saveEscapeCheckpoint({
      levelId: run.course.levelId,
      difficulty: run.course.difficulty,
      checkpointIndex: run.checkpointIndex,
      x: run.respawnX,
      elapsed: run.elapsed,
      tokens: [...run.tokens],
      collisions: run.collisions,
      falls: run.falls,
      savedAt: Date.now(),
    });
    engineRef.current?.escapeSound("checkpoint");
  }, []);

  const finishRef = useRef(finishRun);
  finishRef.current = finishRun;
  const checkpointRef = useRef(saveCheckpoint);
  checkpointRef.current = saveCheckpoint;
  const announceRef = useRef(announce);
  announceRef.current = announce;

  /* --------------------------------------------------------------- countdown */

  useEffect(() => {
    if (phase !== "countdown") return;
    const timer = window.setTimeout(() => {
      if (countdown > 1) {
        setCountdown((value) => value - 1);
      } else {
        setPhase("playing");
      }
    }, 720);
    return () => window.clearTimeout(timer);
  }, [phase, countdown, setPhase]);

  /* ------------------------------------------------------------------- loop */

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let raf = 0;
    let last = performance.now();
    let lastHud = 0;
    let camX = 20;
    let camZ = 0;
    let viewX = 20;
    let viewZ = 0;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const width = wrap.clientWidth || 1;
      const height = wrap.clientHeight || 1;
      if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) {
        canvas.width = Math.round(width * dpr);
        canvas.height = Math.round(height * dpr);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(wrap);

    const update = (run: RunState, dt: number) => {
      const keys = keysRef.current;
      const joy = joystickRef.current;
      let forward =
        (KEY_FORWARD.some((key) => keys.has(key)) ? 1 : 0) -
        (KEY_BACK.some((key) => keys.has(key)) ? 1 : 0) -
        joy.y;
      let lateral =
        (KEY_RIGHT.some((key) => keys.has(key)) ? 1 : 0) -
        (KEY_LEFT.some((key) => keys.has(key)) ? 1 : 0) +
        joy.x;
      const magnitude = Math.hypot(forward, lateral);
      if (magnitude > 1) {
        forward /= magnitude;
        lateral /= magnitude;
      }
      const sprint = keys.has("ShiftLeft") || keys.has("ShiftRight") || sprintTouchRef.current;
      const speed = 7.3 + (sprint ? 3.7 : 0);
      run.x += forward * speed * dt * (forward < 0 ? 0.6 : 1);
      run.z += lateral * 6.1 * dt;
      run.x = Math.max(0, run.x);
      run.z = Math.max(-2.12, Math.min(2.12, run.z));

      if (jumpRequestRef.current && run.grounded) {
        jumpRequestRef.current = false;
        run.vy = 7.25;
        run.grounded = false;
      } else {
        jumpRequestRef.current = false;
      }

      run.vy -= 21.5 * dt;
      run.y += run.vy * dt;
      let support = 0;
      for (const obstacle of run.course.obstacles) {
        if (obstacle.kind !== "platform") continue;
        const oz =
          obstacle.z +
          Math.sin(run.elapsed * obstacle.moveSpeed + obstacle.phase) * obstacle.moveAmp;
        if (
          Math.abs(run.x - obstacle.x) < obstacle.width / 2 &&
          Math.abs(run.z - oz) < obstacle.depth / 2 + 0.2 &&
          run.y >= obstacle.height - 0.28 &&
          run.vy <= 0.6
        ) {
          support = Math.max(support, obstacle.height);
        }
      }
      if (run.y <= support && run.vy <= 0) {
        run.y = support;
        run.vy = 0;
        run.grounded = true;
      } else if (run.y > support + 0.02) {
        run.grounded = false;
      }

      run.elapsed += dt;
      if (run.elapsed >= run.course.timer) {
        finishRef.current(false);
        return;
      }

      for (const obstacle of run.course.obstacles) {
        const oz =
          obstacle.z +
          Math.sin(run.elapsed * obstacle.moveSpeed + obstacle.phase) * obstacle.moveAmp;
        if (obstacle.kind === "gap") {
          if (
            Math.abs(run.x - obstacle.x) < obstacle.width / 2 &&
            Math.abs(run.z) < 2.55 &&
            run.y < 0.1 &&
            run.elapsed > run.ignoreUntil
          ) {
            run.falls += 1;
            run.x = Math.max(0, run.respawnX);
            run.z = 0;
            run.y = 0;
            run.vy = 0;
            run.ignoreUntil = run.elapsed + 0.9;
            announceRef.current("Into the safety pit — back to the checkpoint.");
            engineRef.current?.escapeSound("fall");
          }
          continue;
        }
        if (obstacle.height <= 0) continue;
        if (
          Math.abs(run.x - obstacle.x) < obstacle.width / 2 + 0.34 &&
          Math.abs(run.z - oz) < obstacle.depth / 2 + 0.34 &&
          run.y < obstacle.height - 0.08 &&
          run.elapsed > run.ignoreUntil
        ) {
          run.collisions += 1;
          run.x = Math.max(0, run.x - 0.95);
          run.ignoreUntil = run.elapsed + 0.65;
          announceRef.current("Obstacle clipped · −10 XP");
          engineRef.current?.escapeSound("hit");
        }
      }

      for (const token of run.course.tokens) {
        if (run.tokens.has(token.id)) continue;
        if (
          Math.abs(run.x - token.x) < 0.85 &&
          Math.abs(run.z - token.z) < 0.75 &&
          Math.abs(run.y + 0.85 - token.y) < 1.25
        ) {
          run.tokens.add(token.id);
          engineRef.current?.escapeSound("token");
        }
      }

      const next = run.course.checkpoints[run.checkpointIndex + 1];
      if (next && run.x >= next.x) {
        run.checkpointIndex += 1;
        run.respawnX = next.x;
        checkpointRef.current(run);
        announceRef.current(`Checkpoint ${run.checkpointIndex + 1} secured · +50 XP`);
      }

      if (run.x >= run.course.length) {
        finishRef.current(true);
      }
    };

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const run = runtimeRef.current;
      if (phaseRef.current === "playing" && run && !run.finished && !document.hidden) {
        update(run, dt);
      }

      const course =
        run?.course ?? buildEscapeCourse(selectedLevel, difficulty);
      const preview = run ?? {
        x: 19 + (motionRef.current ? 0 : Math.sin(now / 2400) * 1.2),
        z: 0,
        y: 0,
        elapsed: now / 1000,
        tokens: new Set<string>(),
        checkpointIndex: -1,
        collisions: 0,
        falls: 0,
        course,
      };
      viewX += (preview.x - viewX) * Math.min(1, dt * 6);
      viewZ += (preview.z - viewZ) * Math.min(1, dt * 5);
      camX = Math.max(0.5, viewX - 7.2);
      camZ = viewZ * 0.58;
      renderCourse(
        ctx,
        wrap.clientWidth || 1,
        wrap.clientHeight || 1,
        course,
        preview,
        camX,
        camZ,
        profileColor,
        motionRef.current,
      );

      if (run && phaseRef.current === "playing" && now - lastHud > 100) {
        lastHud = now;
        setHud({
          remaining: Math.max(0, run.course.timer - run.elapsed),
          tokens: run.tokens.size,
          totalTokens: run.course.tokens.length,
          checkpoints: run.checkpointIndex + 1,
          totalCheckpoints: run.course.checkpoints.length,
          liveScore: liveScore(run),
          elapsed: run.elapsed,
          checkpointIndex: run.checkpointIndex,
        });
      }
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
    };
  }, [difficulty, selectedLevel, profileColor]);

  /* --------------------------------------------------------------- keyboard */

  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      if (phaseRef.current === "result" || phaseRef.current === "intro") {
        if (event.code === "Escape" && phaseRef.current === "intro") {
          engineRef.current?.closeEscape();
        }
        return;
      }
      if (event.code === "Escape") {
        event.preventDefault();
        if (phaseRef.current === "playing") {
          setPhase("paused");
          setShowPauseControls(false);
        } else if (phaseRef.current === "paused") {
          setPhase("playing");
        }
        return;
      }
      if (phaseRef.current !== "playing") return;
      if (event.code === "Space") {
        event.preventDefault();
        if (!event.repeat) jumpRequestRef.current = true;
        return;
      }
      if (KEY_FORWARD.includes(event.code) || KEY_BACK.includes(event.code) ||
          KEY_LEFT.includes(event.code) || KEY_RIGHT.includes(event.code)) {
        event.preventDefault();
        keysRef.current.add(event.code);
      }
      if (event.code === "ShiftLeft" || event.code === "ShiftRight") {
        keysRef.current.add(event.code);
      }
    };
    const up = (event: KeyboardEvent) => {
      keysRef.current.delete(event.code);
    };
    const blur = () => {
      keysRef.current.clear();
      joystickRef.current = { x: 0, y: 0 };
      sprintTouchRef.current = false;
    };
    const visibility = () => {
      if (document.hidden && phaseRef.current === "playing") {
        setPhase("paused");
        keysRef.current.clear();
      }
    };
    window.addEventListener("keydown", down, { passive: false });
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [setPhase]);

  /* --------------------------------------------------------------- dev hooks */

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const host = window as unknown as Record<string, unknown>;
    const api = {
      snapshot() {
        const run = runtimeRef.current;
        return {
          phase: phaseRef.current,
          selectedLevel,
          difficulty,
          course: run
            ? {
                levelId: run.course.levelId,
                difficulty: run.course.difficulty,
                length: run.course.length,
                timer: run.course.timer,
                tokens: run.course.tokens.length,
                checkpoints: run.course.checkpoints.length,
                obstacles: run.course.obstacles.map((obstacle) => ({
                  kind: obstacle.kind,
                  x: obstacle.x,
                  z: obstacle.z,
                  height: obstacle.height,
                })),
              }
            : null,
          run: run
            ? {
                x: Number(run.x.toFixed(2)),
                z: Number(run.z.toFixed(2)),
                y: Number(run.y.toFixed(2)),
                elapsed: Number(run.elapsed.toFixed(2)),
                tokens: run.tokens.size,
                checkpointIndex: run.checkpointIndex,
                collisions: run.collisions,
                falls: run.falls,
                finished: run.finished,
              }
            : null,
        };
      },
      start(levelId: EscapeLevelId, diff: EscapeDifficulty) {
        beginRun(levelId, diff, false);
      },
      teleport(x: number, z = 0) {
        if (!runtimeRef.current) return false;
        runtimeRef.current.x = Math.max(0, Math.min(runtimeRef.current.course.length, x));
        runtimeRef.current.z = Math.max(-2, Math.min(2, z));
        return true;
      },
      checkpoint() {
        const run = runtimeRef.current;
        if (!run) return false;
        const next = run.course.checkpoints[run.checkpointIndex + 1];
        if (!next) return false;
        run.x = next.x;
        run.z = 0;
        return true;
      },
      collectAll() {
        const run = runtimeRef.current;
        if (!run) return false;
        for (const token of run.course.tokens) run.tokens.add(token.id);
        return true;
      },
      setStats(collisions: number, falls: number) {
        const run = runtimeRef.current;
        if (!run) return false;
        run.collisions = Math.max(0, Math.floor(collisions));
        run.falls = Math.max(0, Math.floor(falls));
        return true;
      },
      complete() {
        const run = runtimeRef.current;
        if (!run) return false;
        run.x = run.course.length;
        return true;
      },
      fail() {
        const run = runtimeRef.current;
        if (!run) return false;
        run.elapsed = run.course.timer;
        return true;
      },
    };
    host.__campusEscape = api;
    return () => {
      if (host.__campusEscape === api) delete host.__campusEscape;
    };
  }, [beginRun, difficulty, selectedLevel]);

  /* ------------------------------------------------------------ touch stick */

  const moveStick = (event: ReactPointerEvent<HTMLDivElement>) => {
    const pad = joystickPadRef.current;
    if (!pad) return;
    const rect = pad.getBoundingClientRect();
    const radius = rect.width / 2;
    let x = (event.clientX - (rect.left + radius)) / radius;
    let y = (event.clientY - (rect.top + radius)) / radius;
    const length = Math.hypot(x, y);
    if (length > 1) {
      x /= length;
      y /= length;
    }
    joystickRef.current = { x, y };
    if (joystickKnobRef.current) {
      joystickKnobRef.current.style.transform = `translate(${x * radius * 0.55}px, ${y * radius * 0.55}px)`;
    }
  };

  const releaseStick = () => {
    joystickRef.current = { x: 0, y: 0 };
    if (joystickKnobRef.current) joystickKnobRef.current.style.transform = "translate(0px, 0px)";
  };

  /* ------------------------------------------------------------------ views */

  const level = getEscapeLevel(selectedLevel) ?? ESCAPE_LEVELS[0];
  const record = save ? getEscapeRecord(save, selectedLevel, difficulty) : undefined;
  const checkpointAvailable = Boolean(
    save?.checkpoint &&
      save.checkpoint.levelId === selectedLevel &&
      save.checkpoint.difficulty === difficulty,
  );
  const completedLevels = new Set(save?.records.map((item) => item.levelId) ?? []).size;

  return (
    <div className="absolute inset-0 z-30 overflow-hidden bg-[#0c100b] font-ui text-[#f3ead8]" data-testid="campus-escape">
      <div ref={wrapRef} className="absolute inset-0">
        <canvas ref={canvasRef} className="block h-full w-full" aria-hidden="true" />
      </div>
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(7,10,7,0.36),transparent_24%,transparent_74%,rgba(7,10,7,0.55))]" />

      {phase === "intro" && (
        <div className="absolute inset-0 z-10 overflow-y-auto bg-[#090d09]/72 backdrop-blur-[2px]">
          <div className="mx-auto flex min-h-full w-full max-w-6xl flex-col px-5 py-6 sm:px-9 sm:py-8">
            <header className="flex items-center justify-between gap-4 border-b border-[#e7dcc0]/15 pb-4">
              <button
                type="button"
                onClick={() => engine?.closeEscape()}
                data-testid="escape-back"
                className="inline-flex items-center gap-2 border border-[#e7dcc0]/20 px-3 py-2 font-ui text-[9px] uppercase tracking-[0.2em] text-[#e7dcc0]/70 transition hover:border-[#d9b56d]/60 hover:text-[#f1dfb9]"
              >
                <ArrowLeft className="size-3.5" /> Adventure menu
              </button>
              <div className="flex items-center gap-2.5">
                <span className="size-2 rounded-full" style={{ backgroundColor: profileColor }} />
                <span className="font-ui text-[9px] uppercase tracking-[0.22em] text-[#efe3ca]/55">
                  {state.profile ? `${getHouse(state.profile.houseId)?.shortName} · ${state.profile.characterName}` : "Campus challenge"}
                </span>
              </div>
            </header>

            <div className="grid flex-1 items-start gap-8 py-7 lg:grid-cols-[1.05fr_1.3fr] lg:py-10">
              <div>
                <p className="font-ui text-[10px] uppercase tracking-[0.42em] text-[#d9b56d]/80">
                  Operation Midnight Mischief · Campus challenge
                </p>
                <h1 className="mt-3 font-display text-[clamp(3.2rem,9vw,6.4rem)] leading-[0.86] tracking-[0.02em] text-[#f6ecd6] drop-shadow-[0_18px_50px_rgba(0,0,0,0.65)]">
                  CAMPUS
                  <br />
                  <span style={{ color: profileColor }}>ESCAPE</span>
                </h1>
                <p className="mt-5 max-w-md font-ui text-[13px] leading-relaxed text-[#e8ddc7]/72">
                  The campus challenge has begun. Run the sports ground, clear the obstacle course,
                  collect energy tokens and reach the final checkpoint before the timer runs out.
                </p>
                <div className="mt-5 flex flex-wrap gap-2 font-ui text-[8px] uppercase tracking-[0.18em]">
                  <span className="inline-flex items-center gap-1.5 border border-[#d9b56d]/30 px-2.5 py-1.5 text-[#e6d4ac]/75">
                    <ShieldCheck className="size-3" /> No house points
                  </span>
                  <span className="inline-flex items-center gap-1.5 border border-[#8fa77b]/30 px-2.5 py-1.5 text-[#c9d7b7]/70">
                    <Trophy className="size-3" /> Personal records
                  </span>
                  <span className="inline-flex items-center gap-1.5 border border-[#e7dcc0]/15 px-2.5 py-1.5 text-[#e7dcc0]/50">
                    Level {save ? escapeLevelNumber(save) : 1} · {completedLevels}/3 challenges
                  </span>
                </div>

                <div className="mt-7 border border-[#e7dcc0]/12 bg-black/22 p-4">
                  <p className="font-ui text-[9px] uppercase tracking-[0.26em] text-[#d9b56d]/75">Controls</p>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5 font-ui text-[10px] leading-relaxed text-[#ede3cf]/65">
                      <p className="flex items-center gap-2 font-ui text-[8px] uppercase tracking-[0.2em] text-[#efe3ca]/40"><Keyboard className="size-3" /> Desktop</p>
                      <p>W / S or ↑ / ↓ — run forward & back</p>
                      <p>A / D or ← / → — change lane</p>
                      <p>Space — jump · Shift — sprint · Esc — pause</p>
                    </div>
                    <div className="space-y-1.5 font-ui text-[10px] leading-relaxed text-[#ede3cf]/65">
                      <p className="flex items-center gap-2 font-ui text-[8px] uppercase tracking-[0.2em] text-[#efe3ca]/40"><Smartphone className="size-3" /> Touch</p>
                      <p>Left stick — move with all four directions</p>
                      <p>Right side — Jump, Sprint and Pause</p>
                      <p>Hold Sprint for extra speed</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="border border-[#e7dcc0]/15 bg-[#0d120d]/80 p-4 shadow-[0_40px_100px_-50px_rgba(0,0,0,0.9)] sm:p-5">
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <p className="font-ui text-[9px] uppercase tracking-[0.28em] text-[#d9b56d]/70">Select challenge</p>
                    <h2 className="mt-1 font-display text-2xl text-[#f1e7d2]">{level.name}</h2>
                  </div>
                  <span className="font-ui text-[8px] uppercase tracking-[0.16em] text-[#efe3ca]/40">{level.location}</span>
                </div>

                <div className="mt-3 space-y-1.5">
                  {ESCAPE_LEVELS.map((item) => {
                    const unlocked = save ? isEscapeLevelUnlocked(save, item.id) : item.number === 1;
                    const selected = item.id === selectedLevel;
                    const best = save
                      ? Math.max(0, ...save.records.filter((r) => r.levelId === item.id).map((r) => r.bestScore))
                      : 0;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        disabled={!unlocked}
                        onClick={() => {
                          setSelectedLevel(item.id);
                          engineRef.current?.setEscapeSelection(item.id, difficulty);
                          engineRef.current?.uiClick();
                        }}
                        data-testid={`escape-level-${item.id}`}
                        className={`group flex w-full items-center gap-3 border px-3 py-2.5 text-left transition ${
                          selected
                            ? "border-[#d9b56d]/70 bg-[#d9b56d]/10"
                            : "border-[#e7dcc0]/12 bg-black/15 hover:border-[#e7dcc0]/30"
                        } ${!unlocked ? "cursor-not-allowed opacity-40" : ""}`}
                      >
                        <span className="flex size-8 shrink-0 items-center justify-center border border-[#e7dcc0]/18 font-display text-sm text-[#e9dcc3]">
                          {unlocked ? String(item.number).padStart(2, "0") : <Lock className="size-3.5" />}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex flex-wrap items-baseline gap-2">
                            <span className="font-display text-base text-[#f2e8d3]">{item.name}</span>
                            <span className="font-ui text-[8px] uppercase tracking-[0.16em] text-[#d9b56d]/60">{item.difficultyLabel}</span>
                          </span>
                          <span className="mt-0.5 block truncate font-ui text-[9px] text-[#e9ddc8]/45">
                            {!unlocked ? "Complete the previous challenge to unlock" : item.objective}
                          </span>
                        </span>
                        {best > 0 && <span className="font-display text-sm text-[#d9b56d]/80">{best}</span>}
                      </button>
                    );
                  })}
                </div>

                <div className="mt-4">
                  <p className="font-ui text-[9px] uppercase tracking-[0.28em] text-[#d9b56d]/70">Difficulty</p>
                  <div className="mt-2 grid grid-cols-3 gap-1.5">
                    {ESCAPE_DIFFICULTIES.map((item) => (
                      <button
                        key={item}
                        type="button"
                        onClick={() => {
                          setDifficulty(item);
                          engineRef.current?.setEscapeSelection(selectedLevel, item);
                          engineRef.current?.uiClick();
                        }}
                        data-testid={`escape-difficulty-${item}`}
                        className={`border px-2 py-2 font-ui text-[9px] uppercase tracking-[0.14em] transition ${
                          item === difficulty
                            ? "border-[#d9b56d]/70 bg-[#d9b56d]/14 text-[#f1dfb9]"
                            : "border-[#e7dcc0]/15 text-[#e9ddc8]/50 hover:border-[#e7dcc0]/35"
                        }`}
                      >
                        {ESCAPE_DIFFICULTY_LABELS[item]}
                      </button>
                    ))}
                  </div>
                  <p className="mt-2 font-ui text-[9px] leading-relaxed text-[#e9ddc8]/40">{ESCAPE_DIFFICULTY_NOTES[difficulty]}</p>
                </div>

                <div className="mt-4 grid grid-cols-3 gap-px overflow-hidden border border-[#e7dcc0]/12 bg-[#e7dcc0]/12">
                  <Stat label="Best score" value={record ? String(record.bestScore) : "—"} />
                  <Stat label="Best time" value={record ? formatEscapeTime(record.bestTime) : "—"} />
                  <Stat label="Timer" value={`${Math.round(level.baseTimer * (difficulty === "easy" ? 1.25 : difficulty === "hard" ? 0.8 : 1))}s`} />
                </div>

                {checkpointAvailable && (
                  <p className="mt-3 border-l border-[#9fc38d]/60 pl-3 font-ui text-[9px] leading-relaxed text-[#cfe0bd]/70">
                    Saved checkpoint found · checkpoint {(save?.checkpoint?.checkpointIndex ?? 0) + 1} · {formatEscapeTime(save?.checkpoint?.elapsed ?? 0)}
                  </p>
                )}

                <div className="mt-4 flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => beginRun(selectedLevel, difficulty, checkpointAvailable)}
                    data-testid="escape-start"
                    className="inline-flex items-center justify-center gap-2 border border-[#d9b56d]/70 bg-[#d9b56d]/16 px-5 py-3 font-ui text-[10px] uppercase tracking-[0.26em] text-[#f2dfb7] transition hover:bg-[#d9b56d]/26"
                  >
                    <Play className="size-3.5" /> {checkpointAvailable ? "Resume checkpoint" : "Start challenge"}
                  </button>
                  {checkpointAvailable && (
                    <button
                      type="button"
                      onClick={() => beginRun(selectedLevel, difficulty, false)}
                      className="font-ui text-[8px] uppercase tracking-[0.2em] text-[#e9ddc8]/45 underline-offset-4 transition hover:text-[#e9ddc8]/80 hover:underline"
                    >
                      Start this level from the beginning
                    </button>
                  )}
                </div>
                <p className="mt-3 font-ui text-[8px] leading-relaxed text-[#e9ddc8]/30">
                  Fictional obstacle layouts inspired by a Navodaya campus. Personal XP only; your house and house points do not change.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {phase === "countdown" && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/35">
          <motion.div
            key={countdown}
            initial={{ opacity: 0, scale: 0.82 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="text-center"
          >
            <p className="font-ui text-[10px] uppercase tracking-[0.42em] text-[#d9b56d]/80">Get set</p>
            <p className="font-display text-[8rem] leading-none text-[#f6ecd6] drop-shadow-[0_16px_50px_rgba(0,0,0,0.6)]">
              {countdown}
            </p>
            <p className="mt-2 font-ui text-[9px] uppercase tracking-[0.26em] text-[#e9ddc8]/55">{level.name} · {ESCAPE_DIFFICULTY_LABELS[difficulty]}</p>
          </motion.div>
        </div>
      )}

      {(phase === "playing" || phase === "paused") && (
        <>
          <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-3 p-4 sm:p-6">
            <div className="border border-[#e7dcc0]/15 bg-[#0b100b]/76 px-3 py-2 backdrop-blur-sm">
              <p className="font-ui text-[8px] uppercase tracking-[0.2em] text-[#d9b56d]/75">{level.name} · {ESCAPE_DIFFICULTY_LABELS[difficulty]}</p>
              <p className={`mt-0.5 font-display text-3xl tabular-nums leading-none ${hud && hud.remaining < 15 ? "text-[#e8957e]" : "text-[#f4ead6]"}`} data-testid="escape-timer">
                {formatEscapeTime(hud?.remaining ?? level.baseTimer)}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div className="border border-[#e7dcc0]/15 bg-[#0b100b]/76 px-3 py-2 text-right backdrop-blur-sm">
                <p className="font-ui text-[8px] uppercase tracking-[0.18em] text-[#e9ddc8]/45">Live score</p>
                <p className="font-display text-xl leading-tight text-[#d9b56d]" data-testid="escape-score">{hud?.liveScore ?? 0}</p>
              </div>
              <button
                type="button"
                onClick={() => setPhase(phase === "paused" ? "playing" : "paused")}
                aria-label="Pause Campus Escape"
                data-testid="escape-pause"
                className="pointer-events-auto flex size-11 items-center justify-center border border-[#e7dcc0]/20 bg-[#0b100b]/76 text-[#f0e5cf]/80 backdrop-blur-sm transition hover:border-[#d9b56d]/60"
              >
                {phase === "paused" ? <Play className="size-4" /> : <Pause className="size-4" />}
              </button>
            </div>
          </div>

          <div className="pointer-events-none absolute left-4 top-[5.8rem] z-20 flex flex-wrap gap-2 sm:left-6 sm:top-[6.4rem]">
            <Chip icon={<Zap className="size-3" />} label={`${hud?.tokens ?? 0}/${hud?.totalTokens ?? 0} tokens`} testid="escape-token-count" />
            <Chip icon={<Flag className="size-3" />} label={`CP ${hud?.checkpoints ?? 0}/${hud?.totalCheckpoints ?? 0}`} testid="escape-checkpoint-count" />
            {hud?.checkpointIndex !== undefined && hud.checkpointIndex >= 0 && (
              <Chip icon={<CheckCircle2 className="size-3" />} label={`Fallback CP ${hud.checkpointIndex + 1}`} />
            )}
          </div>

          {flash && (
            <motion.div
              key={flash}
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              className="pointer-events-none absolute left-1/2 top-28 z-30 -translate-x-1/2 border border-[#d9b56d]/35 bg-[#0b100b]/92 px-4 py-2 font-ui text-[10px] tracking-wide text-[#f1e2c2]"
              data-testid="escape-flash"
            >
              {flash}
            </motion.div>
          )}

          {state.isTouch && phase === "playing" && (
            <div className="absolute inset-x-0 bottom-0 z-20 flex items-end justify-between p-5 pb-7 pointer-events-none">
              <div
                ref={joystickPadRef}
                className="pointer-events-auto relative flex size-28 touch-none items-center justify-center rounded-full border border-[#f2e8d4]/25 bg-black/30 backdrop-blur-sm"
                onPointerDown={(event) => {
                  event.currentTarget.setPointerCapture(event.pointerId);
                  moveStick(event);
                }}
                onPointerMove={(event) => {
                  if (event.currentTarget.hasPointerCapture(event.pointerId)) moveStick(event);
                }}
                onPointerUp={releaseStick}
                onPointerCancel={releaseStick}
                aria-label="Movement joystick"
                data-testid="escape-joystick"
              >
                <div className="absolute inset-4 rounded-full border border-[#f2e8d4]/10" />
                <div ref={joystickKnobRef} className="size-12 rounded-full border border-[#d9b56d]/50 bg-[#d9b56d]/20" />
              </div>
              <div className="pointer-events-auto flex flex-col items-end gap-3">
                <button
                  type="button"
                  onPointerDown={() => { sprintTouchRef.current = true; }}
                  onPointerUp={() => { sprintTouchRef.current = false; }}
                  onPointerCancel={() => { sprintTouchRef.current = false; }}
                  data-testid="escape-sprint"
                  aria-label="Hold to sprint"
                  className="flex size-16 items-center justify-center rounded-full border border-[#d9b56d]/45 bg-black/35 font-ui text-[8px] uppercase tracking-[0.14em] text-[#f0dfb9] backdrop-blur-sm active:bg-[#d9b56d]/30"
                >
                  Sprint
                </button>
                <button
                  type="button"
                  onPointerDown={() => { jumpRequestRef.current = true; }}
                  data-testid="escape-jump"
                  aria-label="Jump"
                  className="flex size-20 items-center justify-center rounded-full border border-[#9fc38d]/55 bg-black/40 font-ui text-[9px] uppercase tracking-[0.18em] text-[#e6f0db] backdrop-blur-sm active:bg-[#9fc38d]/25"
                >
                  Jump
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {phase === "paused" && (
        <div className="absolute inset-0 z-30 flex items-center justify-center overflow-y-auto bg-black/62 px-5 py-8 backdrop-blur-[3px]">
          <div className="w-full max-w-sm border border-[#e7dcc0]/20 bg-[#0d120d]/94 p-6">
            <p className="font-ui text-[9px] uppercase tracking-[0.32em] text-[#d9b56d]/75">Intermission</p>
            <h2 className="mt-2 font-display text-4xl text-[#f4ead6]">Paused</h2>
            <p className="mt-2 font-ui text-[11px] leading-relaxed text-[#e9ddc8]/50">The timer is held exactly where you left it.</p>
            <div className="mt-5 space-y-1">
              <PauseRow label="Resume" onClick={() => setPhase("playing")} primary icon={<Play className="size-3.5" />} />
              <PauseRow label="Restart level" onClick={() => beginRun(selectedLevel, difficulty, false)} icon={<RotateCcw className="size-3.5" />} />
              <PauseRow label="Controls" onClick={() => setShowPauseControls((value) => !value)} icon={<Keyboard className="size-3.5" />} />
              <PauseRow label="Exit to adventure menu" onClick={() => engineRef.current?.exitEscape()} icon={<ArrowLeft className="size-3.5" />} />
            </div>
            {showPauseControls && (
              <div className="mt-4 space-y-1 border-t border-[#e7dcc0]/10 pt-3 font-ui text-[10px] leading-relaxed text-[#e9ddc8]/55">
                <p>W/S or ↑/↓ — forward & back · A/D or ←/→ — lanes</p>
                <p>Space — jump (once per landing) · Shift — sprint</p>
                <p>Esc — pause & resume · On touch: stick + Jump/Sprint</p>
              </div>
            )}
            <p className="mt-4 font-ui text-[8px] uppercase tracking-[0.18em] text-[#e9ddc8]/30">Checkpoint progress is saved automatically.</p>
          </div>
        </div>
      )}

      {phase === "result" && result && (
        <div className="absolute inset-0 z-30 flex items-center justify-center overflow-y-auto bg-[#080b08]/78 px-4 py-8 backdrop-blur-[3px]">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            className="w-full max-w-xl border border-[#e7dcc0]/18 bg-[#0d120d]/96 p-5 shadow-[0_60px_140px_-50px_rgba(0,0,0,0.95)] sm:p-7"
            data-testid="escape-result"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className={`font-ui text-[9px] uppercase tracking-[0.3em] ${result.completed ? "text-[#b7d39f]/80" : "text-[#e3a28d]/85"}`}>
                  {result.completed ? "Course complete" : "Time expired"}
                </p>
                <h2 className="mt-2 font-display text-4xl leading-none text-[#f5ead5]">
                  {result.completed ? "Campus cleared." : "Not this time."}
                </h2>
                <p className="mt-2 font-ui text-[10px] uppercase tracking-[0.18em] text-[#e9ddc8]/45">
                  {level.name} · {ESCAPE_DIFFICULTY_LABELS[difficulty]}
                </p>
              </div>
              <div className="flex size-12 shrink-0 items-center justify-center rounded-full border border-[#d9b56d]/35 text-[#d9b56d]">
                {result.completed ? <Trophy className="size-5" /> : <Clock3 className="size-5" />}
              </div>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-px overflow-hidden border border-[#e7dcc0]/12 bg-[#e7dcc0]/12 sm:grid-cols-4">
              <Stat label="Score" value={String(result.score)} big testid="escape-result-score" />
              <Stat label="Time" value={formatEscapeTime(result.elapsed)} testid="escape-result-time" />
              <Stat label="Tokens" value={`${result.tokens}/${result.totalTokens}`} testid="escape-result-tokens" />
              <Stat label="Checkpoints" value={`${result.checkpoints}/${result.totalCheckpoints}`} />
            </div>

            {result.completed && (
              <div className="mt-4 border border-[#e7dcc0]/10 bg-black/18 px-3 py-2.5 font-ui text-[10px]">
                <ScoreRow label="Level complete" value={`+${result.completionScore}`} />
                <ScoreRow label={`Energy tokens · ${result.tokens} × 20`} value={`+${result.tokenScore}`} />
                <ScoreRow label={`Checkpoints · ${result.checkpoints} × 50`} value={`+${result.checkpointScore}`} />
                <ScoreRow label="Time bonus" value={`+${result.timeBonus}`} />
                <ScoreRow label={`Penalties · ${result.collisions} collisions, ${result.falls} falls`} value={`−${result.penalty}`} danger={result.penalty > 0} />
                <div className="mt-2 flex items-center justify-between border-t border-[#e7dcc0]/12 pt-2">
                  <span className="font-ui text-[9px] uppercase tracking-[0.2em] text-[#e9ddc8]/55">Total XP</span>
                  <span className="font-display text-xl text-[#d9b56d]">+{result.score}</span>
                </div>
              </div>
            )}

            {!result.completed && (
              <p className="mt-4 border-l border-[#e3a28d]/50 pl-3 font-ui text-[10px] leading-relaxed text-[#e9ddc8]/55">
                The course closed before the finish line. Your completed levels and personal bests were kept.
                {result.checkpoints > 0 ? " Retry from your latest checkpoint below." : " Restart when you are ready."}
              </p>
            )}

            {isBest && result.completed && (
              <p className="mt-3 inline-flex items-center gap-2 border border-[#d9b56d]/30 px-3 py-1.5 font-ui text-[8px] uppercase tracking-[0.2em] text-[#efd9a8]">
                <Award className="size-3" /> New personal best
              </p>
            )}

            {newAchievements.length > 0 && (
              <div className="mt-3 border border-[#9fc38d]/25 bg-[#9fc38d]/7 px-3 py-2">
                <p className="font-ui text-[8px] uppercase tracking-[0.2em] text-[#cfe0bd]/70">Achievement unlocked</p>
                <p className="mt-1 font-display text-lg text-[#eaf2e0]">
                  {newAchievements.map((id) => id.replace("escape-", "").replace("-", " ")).join(" · ")}
                </p>
              </div>
            )}

            <div className="mt-5 grid gap-2 sm:grid-cols-2">
              {result.completed ? (
                <>
                  <button type="button" onClick={() => beginRun(selectedLevel, difficulty, false)} data-testid="escape-replay" className="inline-flex items-center justify-center gap-2 border border-[#d9b56d]/55 bg-[#d9b56d]/12 px-4 py-3 font-ui text-[9px] uppercase tracking-[0.22em] text-[#f0ddb4] transition hover:bg-[#d9b56d]/20">
                    <RotateCcw className="size-3.5" /> Replay level
                  </button>
                  {ESCAPE_LEVELS.find((item) => item.number === level.number + 1) ? (
                    <button
                      type="button"
                      onClick={() => {
                        const next = ESCAPE_LEVELS.find((item) => item.number === level.number + 1);
                        if (next) beginRun(next.id, difficulty, false);
                      }}
                      data-testid="escape-next"
                      className="inline-flex items-center justify-center gap-2 border border-[#e7dcc0]/20 px-4 py-3 font-ui text-[9px] uppercase tracking-[0.22em] text-[#e9ddc8]/75 transition hover:border-[#e7dcc0]/40"
                    >
                      Next level <ChevronRight className="size-3.5" />
                    </button>
                  ) : (
                    <button type="button" onClick={() => engineRef.current?.closeEscape()} className="inline-flex items-center justify-center gap-2 border border-[#e7dcc0]/20 px-4 py-3 font-ui text-[9px] uppercase tracking-[0.22em] text-[#e9ddc8]/75 transition hover:border-[#e7dcc0]/40">
                      Adventure menu <ChevronRight className="size-3.5" />
                    </button>
                  )}
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => beginRun(selectedLevel, difficulty, checkpointAvailable)}
                    data-testid="escape-retry-checkpoint"
                    disabled={!checkpointAvailable}
                    className="inline-flex items-center justify-center gap-2 border border-[#d9b56d]/55 bg-[#d9b56d]/12 px-4 py-3 font-ui text-[9px] uppercase tracking-[0.22em] text-[#f0ddb4] transition hover:bg-[#d9b56d]/20 disabled:cursor-not-allowed disabled:opacity-35"
                  >
                    <Flag className="size-3.5" /> Retry checkpoint
                  </button>
                  <button type="button" onClick={() => beginRun(selectedLevel, difficulty, false)} data-testid="escape-restart" className="inline-flex items-center justify-center gap-2 border border-[#e7dcc0]/20 px-4 py-3 font-ui text-[9px] uppercase tracking-[0.22em] text-[#e9ddc8]/75 transition hover:border-[#e7dcc0]/40">
                    <RotateCcw className="size-3.5" /> Restart level
                  </button>
                </>
              )}
            </div>
            <button
              type="button"
              onClick={() => engineRef.current?.closeEscape()}
              className="mt-2 flex w-full items-center justify-center gap-2 py-2 font-ui text-[8px] uppercase tracking-[0.2em] text-[#e9ddc8]/38 transition hover:text-[#e9ddc8]/70"
            >
              <ArrowLeft className="size-3" /> Return to adventure menu
            </button>
          </motion.div>
        </div>
      )}

      {phase === "intro" && (
        <div className="pointer-events-none absolute bottom-3 left-1/2 z-20 -translate-x-1/2 font-ui text-[7px] uppercase tracking-[0.22em] text-[#e9ddc8]/25">
          Fictional campus challenge · Local personal records
        </div>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  big,
  testid,
}: {
  label: string;
  value: string;
  big?: boolean;
  testid?: string;
}) {
  return (
    <div className="bg-[#0d120d] px-3 py-2.5">
      <p className="font-ui text-[7px] uppercase tracking-[0.18em] text-[#e9ddc8]/40">{label}</p>
      <p className={`mt-1 font-display ${big ? "text-2xl text-[#d9b56d]" : "text-lg text-[#efe4cf]"} leading-none`} data-testid={testid}>{value}</p>
    </div>
  );
}

function Chip({ icon, label, testid }: { icon: React.ReactNode; label: string; testid?: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 border border-[#e7dcc0]/15 bg-[#0b100b]/72 px-2.5 py-1.5 font-ui text-[8px] uppercase tracking-[0.16em] text-[#efe4cf]/70 backdrop-blur-sm" data-testid={testid}>
      {icon} {label}
    </span>
  );
}

function ScoreRow({ label, value, danger }: { label: string; value: string; danger?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 py-0.5">
      <span className="font-ui text-[9px] text-[#e9ddc8]/50">{label}</span>
      <span className={`font-display text-sm ${danger ? "text-[#e3a28d]" : "text-[#e9ddc8]/80"}`}>{value}</span>
    </div>
  );
}

function PauseRow({
  label,
  onClick,
  icon,
  primary,
}: {
  label: string;
  onClick: () => void;
  icon: React.ReactNode;
  primary?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-3 border-b border-[#e7dcc0]/10 px-1 py-3 text-left font-ui text-[11px] transition ${
        primary ? "text-[#f0ddb4]" : "text-[#e9ddc8]/70 hover:text-[#f2e8d4]"
      }`}
    >
      <span className={primary ? "text-[#d9b56d]" : "text-[#e9ddc8]/40"}>{icon}</span>
      {label}
      <ChevronRight className="ml-auto size-3.5 opacity-35" />
    </button>
  );
}

/* ---------------------------------------------------------------- renderer */

interface RenderView {
  x: number;
  z: number;
  y: number;
  elapsed: number;
  tokens: Set<string>;
  checkpointIndex: number;
  collisions: number;
  falls: number;
  course: EscapeCourse;
}

function renderCourse(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  course: EscapeCourse,
  view: RenderView,
  camX: number,
  camZ: number,
  houseColor: string,
  reducedMotion: boolean,
) {
  const level = getEscapeLevel(course.levelId);
  const focal = Math.min(width * 0.62, height * 0.96);
  const horizon = height * 0.245;
  const camY = 4.15;

  const project = (x: number, z: number, y: number) => {
    const dx = Math.max(1.15, x - camX);
    const scale = focal / dx;
    return {
      x: width / 2 + (z - camZ) * scale * 1.55,
      y: horizon + (camY - y) * scale,
      scale,
    };
  };

  const sky = ctx.createLinearGradient(0, 0, 0, horizon * 1.55);
  sky.addColorStop(0, "#1a2723");
  sky.addColorStop(0.55, "#536450");
  sky.addColorStop(1, "#d3bd93");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width, height);

  const sun = ctx.createRadialGradient(width * 0.76, horizon * 0.4, 2, width * 0.76, horizon * 0.4, Math.max(80, width * 0.25));
  sun.addColorStop(0, "rgba(246,221,168,0.55)");
  sun.addColorStop(1, "rgba(246,221,168,0)");
  ctx.fillStyle = sun;
  ctx.fillRect(0, 0, width, horizon * 1.4);

  ctx.fillStyle = "#2d3d31";
  ctx.beginPath();
  ctx.moveTo(0, horizon + 18);
  for (let index = 0; index <= 8; index += 1) {
    const x = (width * index) / 8;
    const y = horizon - 18 - Math.sin(index * 1.7 + course.levelId.length) * 22;
    ctx.lineTo(x, y);
  }
  ctx.lineTo(width, horizon + 26);
  ctx.fill();

  drawTreeLine(ctx, width, height, horizon, camX, camZ, course, project);
  drawPitch(ctx, width, height, camX, camZ, project, course);

  const items: { x: number; draw: () => void }[] = [];
  for (const obstacle of course.obstacles) {
    const oz =
      obstacle.z +
      Math.sin(view.elapsed * obstacle.moveSpeed + obstacle.phase) * obstacle.moveAmp;
    items.push({ x: obstacle.x, draw: () => drawObstacle(ctx, obstacle, oz, project) });
  }
  for (const token of course.tokens) {
    if (view.tokens.has(token.id)) continue;
    const bob = reducedMotion ? 0 : Math.sin(view.elapsed * 2.4 + token.x) * 0.12;
    items.push({ x: token.x, draw: () => drawToken(ctx, token.x, token.z, token.y + bob, project) });
  }
  for (const checkpoint of course.checkpoints) {
    items.push({
      x: checkpoint.x,
      draw: () => drawCheckpoint(ctx, checkpoint.x, checkpoint.index, view.checkpointIndex, project),
    });
  }
  items.push({ x: course.length, draw: () => drawFinish(ctx, course.length, project, level?.accent ?? "#d9b56d") });
  items.sort((a, b) => b.x - a.x);
  for (const item of items) item.draw();

  drawPlayer(ctx, view, project, houseColor, reducedMotion, course);
  drawVignette(ctx, width, height);
}

function drawPitch(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  camX: number,
  camZ: number,
  project: (x: number, z: number, y: number) => { x: number; y: number; scale: number },
  course: EscapeCourse,
) {
  const near = project(camX + 0.5, 0, 0);
  const far = project(camX + 58, 0, 0);
  const horizon = far.y;
  const grass = ctx.createLinearGradient(0, far.y, 0, height);
  grass.addColorStop(0, "#35422f");
  grass.addColorStop(1, "#1c261b");
  ctx.fillStyle = grass;
  ctx.fillRect(0, far.y, width, height - far.y);

  const roadPoints = (offset: number) => {
    const n = project(camX + 0.5, offset, 0);
    const f = project(camX + 58, offset, 0);
    return { n, f };
  };
  const left = roadPoints(-2.7);
  const right = roadPoints(2.7);
  ctx.beginPath();
  ctx.moveTo(left.n.x, left.n.y);
  ctx.lineTo(left.f.x, left.f.y);
  ctx.lineTo(right.f.x, right.f.y);
  ctx.lineTo(right.n.x, right.n.y);
  ctx.closePath();
  const road = ctx.createLinearGradient(0, far.y, 0, height);
  road.addColorStop(0, "#535845");
  road.addColorStop(1, "#3f4436");
  ctx.fillStyle = road;
  ctx.fill();

  ctx.strokeStyle = "rgba(224,211,178,0.35)";
  ctx.lineWidth = Math.max(1.5, width * 0.002);
  for (const offset of [-2.55, 2.55]) {
    const a = project(camX + 1, offset, 0);
    const b = project(camX + 52, offset, 0);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
  for (let x = Math.ceil((camX + 3) / 6) * 6; x < camX + 52; x += 6) {
    const a = project(x, 0, 0.01);
    const b = project(x + 2.1, 0, 0.01);
    ctx.strokeStyle = "rgba(231,220,191,0.22)";
    ctx.lineWidth = Math.max(1, a.scale * 0.06);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }

  // Side line and safety flags.
  for (let x = Math.ceil(camX / 10) * 10; x < camX + 55; x += 10) {
    for (const z of [-3.15, 3.15]) {
      const p = project(x, z, 0);
      if (p.y > height || p.y < horizon) continue;
      ctx.strokeStyle = z < 0 ? "rgba(217,181,109,0.4)" : "rgba(159,195,141,0.35)";
      ctx.lineWidth = Math.max(1, p.scale * 0.04);
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x, p.y - p.scale * 1.2);
      ctx.stroke();
    }
  }

  if (course.levelId === "academic-run") {
    for (const z of [-7.5, 7.5]) {
      const p = project(camX + 16, z, 0);
      if (p.y < height && p.y > horizon) {
        ctx.fillStyle = "#2a3429";
        ctx.fillRect(p.x - p.scale * 0.9, p.y - p.scale * 2.3, p.scale * 1.8, p.scale * 2.3);
        ctx.fillStyle = "rgba(222,208,173,0.18)";
        for (let i = 0; i < 3; i += 1) {
          ctx.fillRect(p.x - p.scale * 0.7, p.y - p.scale * (1.9 - i * 0.45), p.scale * 0.4, p.scale * 0.22);
        }
      }
    }
  }
}

function drawTreeLine(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  horizon: number,
  camX: number,
  camZ: number,
  course: EscapeCourse,
  project: (x: number, z: number, y: number) => { x: number; y: number; scale: number },
) {
  for (let i = 0; i < 12; i += 1) {
    const side = i % 2 === 0 ? -1 : 1;
    const x = camX + 8 + i * 5.5;
    const z = side * (5.8 + (i % 3) * 1.3);
    const p = project(x, z, 0);
    if (p.y < horizon - 20 || p.y > height + 30) continue;
    const h = p.scale * (1.8 + (i % 4) * 0.35);
    ctx.fillStyle = i % 2 ? "#1d2a1d" : "#233020";
    ctx.fillRect(p.x - p.scale * 0.09, p.y - h * 0.55, p.scale * 0.18, h * 0.55);
    ctx.beginPath();
    ctx.ellipse(p.x, p.y - h * 0.62, p.scale * 0.72, h * 0.48, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = "rgba(238,224,191,0.28)";
  ctx.font = `${Math.max(8, width * 0.009)}px serif`;
  ctx.fillText(course.levelId === "hostel-challenge" ? "RECREATION GROUND" : "SPORTS GROUND", 18, horizon - 12);
}

function drawObstacle(
  ctx: CanvasRenderingContext2D,
  obstacle: EscapeObstacle,
  z: number,
  project: (x: number, z: number, y: number) => { x: number; y: number; scale: number },
) {
  if (obstacle.kind === "gap") {
    const half = obstacle.width / 2;
    const corners = [
      project(obstacle.x - half, -2.7, 0.02),
      project(obstacle.x + half, -2.7, 0.02),
      project(obstacle.x + half, 2.7, 0.02),
      project(obstacle.x - half, 2.7, 0.02),
    ];
    ctx.beginPath();
    ctx.moveTo(corners[0].x, corners[0].y);
    for (const corner of corners.slice(1)) ctx.lineTo(corner.x, corner.y);
    ctx.closePath();
    ctx.fillStyle = "#111a14";
    ctx.fill();
    ctx.strokeStyle = "rgba(227,162,141,0.7)";
    ctx.lineWidth = 2;
    ctx.stroke();
    const mid = project(obstacle.x, 0, 0.02);
    ctx.strokeStyle = "rgba(227,162,141,0.3)";
    for (let i = -2; i <= 2; i += 1) {
      const a = project(obstacle.x - half, i, 0.03);
      const b = project(obstacle.x + half, i, 0.03);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
    ctx.fillStyle = "rgba(227,162,141,0.65)";
    ctx.font = `${Math.max(7, mid.scale * 0.2)}px sans-serif`;
    ctx.fillText("SAFETY PIT", mid.x - mid.scale * 0.45, mid.y + mid.scale * 0.35);
    return;
  }

  const base = project(obstacle.x, z, 0);
  ctx.save();
  ctx.fillStyle = "rgba(5,9,5,0.26)";
  ctx.beginPath();
  ctx.ellipse(base.x, base.y + 2, obstacle.width * base.scale * 0.52, base.scale * 0.18, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  if (obstacle.kind === "hurdle") {
    drawBox(ctx, obstacle.x, z - obstacle.depth / 2, 0.55, obstacle.width, 0.18, 0.62, project, "#e7dcc0");
    drawBox(ctx, obstacle.x, z + obstacle.depth / 2, 0.55, obstacle.width, 0.18, 0.62, project, "#e7dcc0");
    drawBox(ctx, obstacle.x, z, 0.58, obstacle.width, obstacle.depth + 0.2, 0.16, project, "#b65d46");
  } else if (obstacle.kind === "cone") {
    const p = project(obstacle.x, z, 0);
    const h = p.scale * 0.65;
    ctx.fillStyle = "#d8843f";
    ctx.beginPath();
    ctx.moveTo(p.x, p.y - h);
    ctx.lineTo(p.x - h * 0.34, p.y);
    ctx.lineTo(p.x + h * 0.34, p.y);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "rgba(248,238,214,0.8)";
    ctx.fillRect(p.x - h * 0.24, p.y - h * 0.5, h * 0.48, h * 0.12);
  } else if (obstacle.kind === "narrow") {
    drawBox(ctx, obstacle.x, z, 0, obstacle.width, obstacle.depth, obstacle.height, project, "#8f805e");
    for (let i = 0; i < 3; i += 1) {
      drawBox(ctx, obstacle.x - 0.3, z, 0.25 + i * 0.46, obstacle.width, obstacle.depth + 0.03, 0.16, project, "#c5a45e");
    }
  } else if (obstacle.kind === "sweeper") {
    const p = project(obstacle.x, z, 0);
    drawBox(ctx, obstacle.x, z, 0.2, 0.48, 0.48, 0.2, project, "#7e6e4d");
    ctx.fillStyle = "#b95f48";
    ctx.fillRect(p.x - p.scale * 0.06, p.y - p.scale * 0.95, p.scale * 0.12, p.scale * 0.75);
    drawBox(ctx, obstacle.x, z, 0.35, 0.28, 3.2, 0.28, project, "#d1b06b");
    drawBox(ctx, obstacle.x, z, 0.58, 0.36, 3.2, 0.12, project, "#b95f48");
  } else if (obstacle.kind === "platform") {
    drawBox(ctx, obstacle.x, z, 0, obstacle.width, obstacle.depth, obstacle.height, project, "#7d744f");
    drawBox(ctx, obstacle.x, z, obstacle.height - 0.03, obstacle.width - 0.1, obstacle.depth - 0.1, 0.1, project, "#b9a974");
  } else if (obstacle.kind === "barrier") {
    drawBox(ctx, obstacle.x, z, 0, obstacle.width, obstacle.depth, obstacle.height, project, "#d7c9a6");
    drawBox(ctx, obstacle.x, z, obstacle.height * 0.52, obstacle.width + 0.06, obstacle.depth + 0.04, 0.2, project, "#b65d46");
  } else {
    drawBox(ctx, obstacle.x, z, 0, obstacle.width, obstacle.depth, obstacle.height, project, "#706b56");
    drawBox(ctx, obstacle.x, z, obstacle.height - 0.22, obstacle.width + 0.03, obstacle.depth + 0.03, 0.16, project, "#9f9069");
  }
}

function drawBox(
  ctx: CanvasRenderingContext2D,
  x: number,
  z: number,
  y: number,
  width: number,
  depth: number,
  height: number,
  project: (x: number, z: number, y: number) => { x: number; y: number; scale: number },
  color: string,
) {
  const p = project(x, z, y + height / 2);
  if (p.scale < 1) return;
  const near = project(x - width / 2, z, y);
  const nearTop = project(x - width / 2, z, y + height);
  const far = project(x + width / 2, z, y);
  const farTop = project(x + width / 2, z, y + height);
  const left = project(x, z + depth / 2, y);
  const leftTop = project(x, z + depth / 2, y + height);
  const right = project(x, z - depth / 2, y);
  const rightTop = project(x, z - depth / 2, y + height);

  ctx.fillStyle = shade(color, 0.7);
  ctx.beginPath();
  ctx.moveTo(near.x, near.y);
  ctx.lineTo(left.x, left.y);
  ctx.lineTo(far.x, far.y);
  ctx.lineTo(right.x, right.y);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = shade(color, 0.92);
  ctx.beginPath();
  ctx.moveTo(near.x, near.y);
  ctx.lineTo(left.x, left.y);
  ctx.lineTo(leftTop.x, leftTop.y);
  ctx.lineTo(nearTop.x, nearTop.y);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(nearTop.x, nearTop.y);
  ctx.lineTo(leftTop.x, leftTop.y);
  ctx.lineTo(farTop.x, farTop.y);
  ctx.lineTo(rightTop.x, rightTop.y);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = "rgba(8,12,8,0.28)";
  ctx.lineWidth = 1;
  ctx.stroke();
}

function shade(hex: string, factor: number): string {
  const value = hex.replace("#", "");
  if (!/^[0-9a-f]{6}$/i.test(value)) return hex;
  const r = Math.round(parseInt(value.slice(0, 2), 16) * factor);
  const g = Math.round(parseInt(value.slice(2, 4), 16) * factor);
  const b = Math.round(parseInt(value.slice(4, 6), 16) * factor);
  return `rgb(${r},${g},${b})`;
}

function drawToken(
  ctx: CanvasRenderingContext2D,
  x: number,
  z: number,
  y: number,
  project: (x: number, z: number, y: number) => { x: number; y: number; scale: number },
) {
  const p = project(x, z, y);
  if (p.scale < 0.6) return;
  const r = Math.max(4, p.scale * 0.2);
  ctx.save();
  ctx.shadowBlur = r * 1.8;
  ctx.shadowColor = "rgba(232,199,120,0.8)";
  ctx.fillStyle = "#f2d38d";
  ctx.beginPath();
  ctx.moveTo(p.x, p.y - r);
  ctx.lineTo(p.x + r * 0.72, p.y);
  ctx.lineTo(p.x, p.y + r);
  ctx.lineTo(p.x - r * 0.72, p.y);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = "rgba(255,244,210,0.7)";
  ctx.lineWidth = 1;
  ctx.stroke();
}

function drawCheckpoint(
  ctx: CanvasRenderingContext2D,
  x: number,
  index: number,
  reached: number,
  project: (x: number, z: number, y: number) => { x: number; y: number; scale: number },
) {
  const active = index <= reached;
  const color = active ? "#b9d3a2" : "#d9b56d";
  for (const z of [-2.7, 2.7]) drawBox(ctx, x, z, 0, 0.16, 0.16, 2.35, project, color);
  drawBox(ctx, x, 0, 2.2, 0.12, 5.56, 0.18, project, color);
  const p = project(x, 0, 2.55);
  ctx.fillStyle = color;
  ctx.font = `${Math.max(7, p.scale * 0.18)}px sans-serif`;
  ctx.textAlign = "center";
  ctx.fillText(active ? "CHECKPOINT ✓" : `CHECKPOINT ${index + 1}`, p.x, p.y);
  ctx.textAlign = "left";
}

function drawFinish(
  ctx: CanvasRenderingContext2D,
  x: number,
  project: (x: number, z: number, y: number) => { x: number; y: number; scale: number },
  accent: string,
) {
  for (const z of [-3, 3]) drawBox(ctx, x, z, 0, 0.25, 0.25, 3.1, project, accent);
  drawBox(ctx, x, 0, 3.0, 0.2, 6.3, 0.6, project, accent);
  const p = project(x, 0, 2.55);
  ctx.fillStyle = "#182015";
  ctx.font = `bold ${Math.max(8, p.scale * 0.24)}px sans-serif`;
  ctx.textAlign = "center";
  ctx.fillText("FINISH", p.x, p.y);
  ctx.textAlign = "left";
  const left = project(x, -3, 0.02);
  const right = project(x, 3, 0.02);
  ctx.strokeStyle = "#e7dcc0";
  ctx.lineWidth = Math.max(1, p.scale * 0.07);
  ctx.beginPath();
  ctx.moveTo(left.x, left.y);
  ctx.lineTo(right.x, right.y);
  ctx.stroke();
}

function drawPlayer(
  ctx: CanvasRenderingContext2D,
  run: RenderView,
  project: (x: number, z: number, y: number) => { x: number; y: number; scale: number },
  houseColor: string,
  reducedMotion: boolean,
  course: EscapeCourse,
) {
  const p = project(run.x, run.z, run.y);
  if (p.scale < 1) return;
  const scale = p.scale;
  const running = run.x > 0.2 || run.y > 0.05;
  const cycle = reducedMotion ? 0 : Math.sin(run.elapsed * 14);
  const leg = running && run.y < 0.1 ? cycle * scale * 0.12 : 0;

  ctx.fillStyle = "rgba(4,8,4,0.4)";
  ctx.beginPath();
  ctx.ellipse(p.x, p.y + 2, scale * 0.32, scale * 0.12, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "#1b1b18";
  ctx.lineWidth = Math.max(2.5, scale * 0.11);
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(p.x - scale * 0.1, p.y - scale * 0.52);
  ctx.lineTo(p.x - scale * 0.12 + leg, p.y - scale * 0.02);
  ctx.moveTo(p.x + scale * 0.1, p.y - scale * 0.52);
  ctx.lineTo(p.x + scale * 0.12 - leg, p.y - scale * 0.02);
  ctx.stroke();

  ctx.fillStyle = houseColor;
  ctx.beginPath();
  ctx.roundRect(p.x - scale * 0.24, p.y - scale * 1.22, scale * 0.48, scale * 0.7, scale * 0.1);
  ctx.fill();
  ctx.fillStyle = "rgba(248,238,214,0.5)";
  ctx.fillRect(p.x - scale * 0.03, p.y - scale * 1.18, scale * 0.06, scale * 0.4);

  ctx.strokeStyle = houseColor;
  ctx.lineWidth = Math.max(2, scale * 0.09);
  ctx.beginPath();
  ctx.moveTo(p.x - scale * 0.2, p.y - scale * 1.1);
  ctx.lineTo(p.x - scale * 0.3, p.y - scale * 0.83 + leg * 0.6);
  ctx.moveTo(p.x + scale * 0.2, p.y - scale * 1.1);
  ctx.lineTo(p.x + scale * 0.3, p.y - scale * 0.83 - leg * 0.6);
  ctx.stroke();

  ctx.fillStyle = "#c59772";
  ctx.beginPath();
  ctx.arc(p.x, p.y - scale * 1.42, scale * 0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#211c18";
  ctx.beginPath();
  ctx.arc(p.x, p.y - scale * 1.47, scale * 0.215, Math.PI, Math.PI * 2);
  ctx.fill();

  if (run.y > 0.2) {
    ctx.fillStyle = "rgba(240,226,194,0.5)";
    ctx.font = `${Math.max(7, scale * 0.16)}px sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText("JUMP", p.x, p.y + scale * 0.28);
    ctx.textAlign = "left";
  }

  // Upcoming marker keeps the finish visible when the course bends.
  const finish = project(course.length, 0, 2.7);
  if (finish.x > 20 && finish.x < 3000) {
    ctx.fillStyle = "rgba(240,226,194,0.45)";
    ctx.font = `bold ${Math.max(7, scale * 0.15)}px sans-serif`;
    ctx.fillText("→", Math.min(finish.x, 32), p.y - scale * 0.9);
  }
}

function drawVignette(ctx: CanvasRenderingContext2D, width: number, height: number) {
  const vignette = ctx.createRadialGradient(width / 2, height * 0.52, width * 0.18, width / 2, height * 0.52, width * 0.75);
  vignette.addColorStop(0, "rgba(0,0,0,0)");
  vignette.addColorStop(1, "rgba(4,7,4,0.48)");
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, width, height);
}
