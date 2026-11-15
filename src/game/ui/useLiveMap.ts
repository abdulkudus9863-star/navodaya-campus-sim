import { useEffect, useState } from "react";
import type { GameEngine } from "../core/GameEngine";
import type { LiveMapSnapshot } from "../data/liveMap";

/**
 * Reads the engine's authoritative position at a low, fixed UI rate. This is a
 * read-only presentation feed; movement remains owned by the game loop.
 */
export function useLiveMap(
  engine: GameEngine | null,
  intervalMs = 100,
): LiveMapSnapshot | null {
  const [snapshot, setSnapshot] = useState<LiveMapSnapshot | null>(() =>
    engine ? engine.getMapSnapshot() : null,
  );

  useEffect(() => {
    if (!engine) {
      setSnapshot(null);
      return;
    }
    const update = () => setSnapshot(engine.getMapSnapshot());
    update();
    const timer = window.setInterval(update, intervalMs);
    return () => window.clearInterval(timer);
  }, [engine, intervalMs]);

  return snapshot;
}
