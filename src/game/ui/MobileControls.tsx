import { ArrowUp, CircleHelp, Footprints, Hand, Pause, X, Zap } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import type { GameEngine } from "../core/GameEngine";

export function MobileControls({
  engine,
  promptActive,
  crouching,
}: {
  engine: GameEngine | null;
  promptActive: boolean;
  crouching: boolean;
}) {
  const baseRef = useRef<HTMLDivElement>(null);
  const joystickPointer = useRef<number | null>(null);
  const [stick, setStick] = useState({ x: 0, y: 0, active: false });
  const [runHeld, setRunHeld] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const lookPointers = useRef(new Map<number, { x: number; y: number }>());
  const pinchDistance = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      engine?.setJoystick(0, 0);
      engine?.setTouchRunning(false);
    };
  }, [engine]);

  const setRun = (running: boolean) => {
    setRunHeld(running);
    engine?.setTouchRunning(running);
  };

  const updateStick = (event: ReactPointerEvent<HTMLDivElement>) => {
    const base = baseRef.current;
    if (!base) return;
    const rect = base.getBoundingClientRect();
    const radius = rect.width / 2;
    let dx = (event.clientX - (rect.left + radius)) / radius;
    let dy = (event.clientY - (rect.top + radius)) / radius;
    const length = Math.hypot(dx, dy);
    if (length > 1) {
      dx /= length;
      dy /= length;
    }
    setStick({ x: dx, y: dy, active: true });
    engine?.setJoystick(dx, dy);
  };

  const handleStickDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    joystickPointer.current = event.pointerId;
    event.currentTarget.setPointerCapture(event.pointerId);
    updateStick(event);
  };

  const handleStickMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (joystickPointer.current !== event.pointerId) return;
    event.preventDefault();
    updateStick(event);
  };

  const endStick = (event?: ReactPointerEvent<HTMLDivElement>) => {
    if (event && joystickPointer.current !== event.pointerId) return;
    joystickPointer.current = null;
    setStick({ x: 0, y: 0, active: false });
    engine?.setJoystick(0, 0);
  };

  const pointerSpan = () => {
    const points = Array.from(lookPointers.current.values());
    if (points.length < 2) return null;
    return Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
  };

  const handleLookDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    lookPointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (event.pointerType === "touch" && lookPointers.current.size >= 2) {
      pinchDistance.current = pointerSpan();
    }
  };

  const handleLookMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const previous = lookPointers.current.get(event.pointerId);
    if (!previous) return;
    lookPointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (event.pointerType === "touch" && lookPointers.current.size >= 2) {
      const span = pointerSpan();
      if (span && pinchDistance.current) {
        const factor = span / pinchDistance.current;
        if (Number.isFinite(factor) && Math.abs(factor - 1) > 0.002) {
          engine?.zoomCamera(factor);
        }
      }
      pinchDistance.current = span;
      return;
    }

    const dx = event.clientX - previous.x;
    const dy = event.clientY - previous.y;
    engine?.addLook(dx * 1.9, dy * 1.9);
  };

  const handleLookEnd = (event: ReactPointerEvent<HTMLDivElement>) => {
    lookPointers.current.delete(event.pointerId);
    if (lookPointers.current.size < 2) pinchDistance.current = null;
  };

  const thumbOffset = 34;

  return (
    <>
      <div
        aria-label="Look around"
        className="absolute inset-0 z-10"
        style={{ touchAction: "none" }}
        onPointerDown={handleLookDown}
        onPointerMove={handleLookMove}
        onPointerUp={handleLookEnd}
        onPointerCancel={handleLookEnd}
        onLostPointerCapture={handleLookEnd}
      />

      <div
        ref={baseRef}
        role="group"
        aria-label="Movement joystick"
        data-testid="movement-joystick"
        className="pointer-events-auto absolute bottom-[max(1rem,env(safe-area-inset-bottom))] left-[max(0.9rem,env(safe-area-inset-left))] z-30 flex size-[clamp(100px,24vh,136px)] touch-none items-center justify-center rounded-full border border-[#e7d3a8]/25 bg-black/35 backdrop-blur-sm"
        style={{ touchAction: "none" }}
        onPointerDown={handleStickDown}
        onPointerMove={handleStickMove}
        onPointerUp={endStick}
        onPointerCancel={endStick}
        onLostPointerCapture={endStick}
      >
        <div className="absolute inset-3 rounded-full border border-dashed border-[#e7d3a8]/15" />
        <div
          className={`relative flex size-[clamp(40px,9vh,48px)] items-center justify-center rounded-full border transition-colors ${
            stick.active
              ? "border-[#e7c98f] bg-[#d9b877]/35"
              : "border-[#e7d3a8]/35 bg-[#d9b877]/15"
          }`}
          style={{
            transform: `translate(${stick.x * thumbOffset}px, ${stick.y * thumbOffset}px)`,
          }}
        >
          <div className="size-1.5 rounded-full bg-[#f0ddb4]" />
        </div>
        <span className="label-cinema absolute -top-6 left-0 text-[9px] text-foreground/45">Move</span>
      </div>

      {/* One safe-area-aware right rail keeps every action independent of the HUD. */}
      <div className="pointer-events-none absolute inset-y-0 right-[max(0.75rem,env(safe-area-inset-right))] z-40 flex flex-col items-end justify-between gap-3 py-[max(0.75rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))]">
        <div className="pointer-events-auto flex flex-col items-end gap-2.5">
        <button
          type="button"
          aria-label="Pause game"
          data-testid="mobile-pause"
          onPointerDown={(event) => {
            event.preventDefault();
            event.stopPropagation();
            engine?.pause();
          }}
          onContextMenu={(event) => event.preventDefault()}
          className="pointer-events-auto flex size-12 touch-none flex-col items-center justify-center gap-0.5 rounded-full border border-[#e7d3a8]/30 bg-black/45 text-[#efe4cd]/80 shadow-[0_8px_24px_rgba(0,0,0,0.35)] backdrop-blur-sm transition active:scale-95 active:border-[#e7c98f] active:text-[#f0ddb4]"
        >
          <Pause className="size-4" strokeWidth={1.8} />
          <span className="label-cinema text-[6px]">Pause</span>
        </button>
        <button
          type="button"
          aria-label="Help and controls"
          data-testid="mobile-help"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            setShowHelp(true);
          }}
          onContextMenu={(event) => event.preventDefault()}
          className="flex size-11 touch-none flex-col items-center justify-center gap-0.5 rounded-full border border-[#e7d3a8]/25 bg-black/40 text-[#efe4cd]/70 backdrop-blur-sm transition active:scale-95 active:border-[#e7c98f] active:text-[#f0ddb4]"
        >
          <CircleHelp className="size-4" strokeWidth={1.7} />
          <span className="label-cinema text-[6px]">Help</span>
        </button>
        </div>

        <div className="pointer-events-auto flex flex-col items-end gap-2.5">
          <button
            type="button"
            aria-label="Run"
            aria-pressed={runHeld}
            onPointerDown={(event) => {
              event.preventDefault();
              event.stopPropagation();
              event.currentTarget.setPointerCapture(event.pointerId);
              setRun(true);
            }}
            onPointerUp={(event) => {
              event.preventDefault();
              setRun(false);
            }}
            onPointerCancel={() => setRun(false)}
            onLostPointerCapture={() => setRun(false)}
            onContextMenu={(event) => event.preventDefault()}
            className={`flex size-[clamp(46px,10vh,54px)] touch-none flex-col items-center justify-center gap-0.5 rounded-full border backdrop-blur-sm transition active:scale-95 ${
              runHeld
                ? "border-[#e9c17c]/85 bg-[#d9b877]/30 text-[#ffe9bd] shadow-[0_0_22px_rgba(217,184,119,0.3)]"
                : "border-[#e7d3a8]/25 bg-black/35 text-foreground/75"
            }`}
          >
            <Zap className="size-4" strokeWidth={1.7} />
            <span className="label-cinema text-[6px]">Run</span>
          </button>
          <button
            type="button"
            aria-label="Crouch"
            aria-pressed={crouching}
            onClick={(event) => event.preventDefault()}
            onPointerDown={(event) => {
              event.preventDefault();
              event.stopPropagation();
              engine?.toggleCrouch();
            }}
            onContextMenu={(event) => event.preventDefault()}
            className={`flex size-[clamp(46px,10vh,54px)] touch-none flex-col items-center justify-center gap-0.5 rounded-full border backdrop-blur-sm transition active:scale-95 ${
              crouching
                ? "border-[#9fc5a8]/80 bg-[#5f9b6e]/25 text-[#d7f0da]"
                : "border-[#e7d3a8]/22 bg-black/35 text-foreground/65"
            }`}
          >
            <Footprints className="size-4" strokeWidth={1.6} />
            <span className="label-cinema text-[6px]">Crouch</span>
          </button>
        </div>

        <div className="pointer-events-auto flex items-end gap-2.5">
          <button
            type="button"
            aria-label="Jump"
            onPointerDown={(event) => {
              event.preventDefault();
              event.stopPropagation();
              engine?.jump();
            }}
            onContextMenu={(event) => event.preventDefault()}
            className="flex size-[clamp(52px,12vh,62px)] touch-none flex-col items-center justify-center gap-0.5 rounded-full border border-[#e7d3a8]/30 bg-black/40 text-foreground/80 backdrop-blur-sm transition active:scale-95 active:border-[#e7c98f] active:text-[#f0ddb4]"
          >
            <ArrowUp className="size-5" strokeWidth={1.6} />
            <span className="label-cinema text-[6px]">Jump</span>
          </button>
          <button
            type="button"
            aria-label="Interact"
            disabled={!promptActive}
            onPointerDown={(event) => {
              event.preventDefault();
              event.stopPropagation();
              engine?.interact();
            }}
            onContextMenu={(event) => event.preventDefault()}
            className={`flex size-[clamp(62px,14vh,72px)] touch-none flex-col items-center justify-center gap-0.5 rounded-full border backdrop-blur-sm transition active:scale-95 ${
              promptActive
                ? "border-[#e7c98f]/80 bg-[#d9b877]/25 text-[#f6e6c4] shadow-[0_0_32px_rgba(217,184,119,0.35)]"
                : "border-[#e7d3a8]/20 bg-black/30 text-foreground/45"
            }`}
          >
            <Hand className="size-5" strokeWidth={1.6} />
            <span className="label-cinema text-[6px]">Interact</span>
          </button>
        </div>
      </div>

      {showHelp && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Campus controls"
            className="w-full max-w-sm rounded-sm border border-[#e7d3a8]/25 bg-[#100e0b]/95 p-6 text-foreground shadow-[0_30px_80px_rgba(0,0,0,0.6)]"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="label-cinema text-primary/80">Campus controls</p>
                <h3 className="mt-2 font-display text-2xl tracking-wide">How to move</h3>
              </div>
              <button
                type="button"
                aria-label="Close help"
                onClick={() => setShowHelp(false)}
                className="rounded-full border border-foreground/15 p-2 text-foreground/70 transition hover:border-primary/60 hover:text-primary"
              >
                <X className="size-4" />
              </button>
            </div>
            <dl className="mt-5 space-y-3 font-ui text-xs leading-relaxed text-foreground/80">
              <div><dt className="text-primary">Move</dt><dd>Drag the left joystick. Push farther to walk faster.</dd></div>
              <div><dt className="text-primary">Look</dt><dd>Drag anywhere on the right side to orbit the camera.</dd></div>
              <div><dt className="text-primary">Run / Jump</dt><dd>Hold Run while moving. Tap Jump to clear steps.</dd></div>
              <div><dt className="text-primary">Interact</dt><dd>Walk up to a glowing prompt, then tap Interact.</dd></div>
              <div><dt className="text-primary">Crouch</dt><dd>Toggle Crouch to sneak during night missions.</dd></div>
              <div><dt className="text-primary">Pause</dt><dd>Pause saves your progress and opens the campus menu.</dd></div>
            </dl>
            <button
              type="button"
              onClick={() => setShowHelp(false)}
              className="mt-6 w-full rounded-sm border border-primary/60 bg-primary/12 px-5 py-3 font-ui text-xs uppercase tracking-[0.28em] text-primary transition hover:bg-primary/20"
            >
              Back to campus
            </button>
          </div>
        </div>
      )}
    </>
  );
}
