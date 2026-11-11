import { ArrowUp, Hand } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import type { GameEngine } from "../core/GameEngine";

export function MobileControls({
  engine,
  promptActive,
}: {
  engine: GameEngine | null;
  promptActive: boolean;
}) {
  const baseRef = useRef<HTMLDivElement>(null);
  const joystickPointer = useRef<number | null>(null);
  const [stick, setStick] = useState({ x: 0, y: 0, active: false });
  const lookPointers = useRef(new Map<number, { x: number; y: number }>());

  useEffect(() => {
    return () => {
      engine?.setJoystick(0, 0);
    };
  }, [engine]);

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

  const handleLookDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    lookPointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
  };

  const handleLookMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const previous = lookPointers.current.get(event.pointerId);
    if (!previous) return;
    const dx = event.clientX - previous.x;
    const dy = event.clientY - previous.y;
    lookPointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    engine?.addLook(dx * 1.9, dy * 1.9);
  };

  const handleLookEnd = (event: ReactPointerEvent<HTMLDivElement>) => {
    lookPointers.current.delete(event.pointerId);
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

      <div className="absolute inset-x-0 bottom-0 z-30 flex items-end justify-between px-5 pb-6 sm:px-8 pointer-events-none">
        <div
          ref={baseRef}
          role="group"
          aria-label="Movement joystick"
          className="pointer-events-auto relative flex size-[118px] touch-none items-center justify-center rounded-full border border-[#e7d3a8]/25 bg-black/35 backdrop-blur-sm sm:size-[136px]"
          style={{ touchAction: "none" }}
          onPointerDown={handleStickDown}
          onPointerMove={handleStickMove}
          onPointerUp={endStick}
          onPointerCancel={endStick}
          onLostPointerCapture={endStick}
        >
          <div className="absolute inset-3 rounded-full border border-dashed border-[#e7d3a8]/15" />
          <div
            className={`relative flex size-[46px] items-center justify-center rounded-full border transition-colors ${
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
          <span className="absolute -top-6 left-0 label-cinema text-[9px] text-foreground/45">Move</span>
        </div>

        <div className="pointer-events-auto flex items-end gap-3 sm:gap-4">
          <button
            type="button"
            aria-label="Jump"
            onPointerDown={(event) => {
              event.preventDefault();
              event.stopPropagation();
              engine?.jump();
            }}
            className="flex size-[62px] flex-col items-center justify-center gap-1 rounded-full border border-[#e7d3a8]/30 bg-black/40 text-foreground/80 backdrop-blur-sm transition active:scale-95 active:border-[#e7c98f] active:text-[#f0ddb4]"
          >
            <ArrowUp className="size-5" strokeWidth={1.6} />
            <span className="label-cinema text-[8px]">Jump</span>
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
            className={`flex size-[76px] flex-col items-center justify-center gap-1 rounded-full border backdrop-blur-sm transition active:scale-95 ${
              promptActive
                ? "border-[#e7c98f]/80 bg-[#d9b877]/25 text-[#f6e6c4] shadow-[0_0_32px_rgba(217,184,119,0.35)]"
                : "border-[#e7d3a8]/20 bg-black/30 text-foreground/35"
            }`}
          >
            <Hand className="size-5" strokeWidth={1.6} />
            <span className="label-cinema text-[8px]">Interact</span>
          </button>
        </div>
      </div>
    </>
  );
}
