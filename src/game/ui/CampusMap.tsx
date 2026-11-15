import { motion } from "framer-motion";
import {
  ArrowRight,
  Check,
  Compass,
  Flag,
  Footprints,
  Lock,
  MapPin,
  Moon,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import type { GameEngine } from "../core/GameEngine";
import type { GameUIState } from "../core/types";
import {
  formatMapDistance,
  mapAnchorForLocation,
  mapWorldDistance,
  type MapWaypoint,
} from "../data/liveMap";
import { CampusMapSurface } from "./CampusMapSurface";
import { HouseEmblem } from "./HouseVisuals";

export function CampusMap({
  state,
  engine,
  waypoint,
  onWaypointChange,
  multiplayer = false,
}: {
  state: GameUIState;
  engine: GameEngine | null;
  waypoint: MapWaypoint | null;
  onWaypointChange: (waypoint: MapWaypoint | null) => void;
  multiplayer?: boolean;
}) {
  const map = state.campusMap;
  const [selectedId, setSelectedId] = useState("main-gate");
  const [showOnlyUnlocked, setShowOnlyUnlocked] = useState(false);

  useEffect(() => {
    if (!map) return;
    if (!map.locations.some((location) => location.id === selectedId)) {
      setSelectedId(map.locations[0]?.id ?? "main-gate");
    }
  }, [map, selectedId]);

  if (!map) return null;
  const selected = map.locations.find((location) => location.id === selectedId) ?? map.locations[0];
  const selectedAnchor = selected ? mapAnchorForLocation(selected) : null;
  const distance =
    selected && selectedAnchor
      ? mapWorldDistance(map.playerX, map.playerZ, selectedAnchor.x, selectedAnchor.z)
      : null;
  const isWaypoint = Boolean(selected && waypoint?.id === selected.id);

  const toggleWaypoint = () => {
    if (!selected) return;
    if (isWaypoint) {
      onWaypointChange(null);
      return;
    }
    const anchor = mapAnchorForLocation(selected);
    onWaypointChange({
      id: selected.id,
      name: selected.name,
      x: anchor.x,
      z: anchor.z,
    });
  };

  const travel = () => {
    if (!selected) return;
    if (engine?.travelToCampusLocation(selected.id) && isWaypoint) {
      onWaypointChange(null);
    }
  };

  return (
    <div
      className="film-grain absolute inset-0 z-50 overflow-x-hidden overflow-y-auto bg-[#0b0d09]/92 px-4 py-5 backdrop-blur-[2px] sm:px-7 sm:py-7"
      role="dialog"
      aria-modal="true"
      aria-label="Campus map"
      data-testid="campus-map"
    >
      <div className="pointer-events-none fixed inset-0 vignette opacity-80" />
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        className="relative mx-auto w-full max-w-6xl"
      >
        <header className="flex flex-wrap items-start justify-between gap-4 border-b border-[#8d9a75]/20 pb-4">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center border border-[#9aaa79]/35 text-[#c4d3a5]">
              <Compass className="size-5" />
            </span>
            <div>
              <p className="label-cinema text-[#b9c69d]/75">
                Live campus overview · north up
              </p>
              <h2 className="mt-1 font-display text-3xl leading-none text-[#f1e8d5] sm:text-4xl">
                Navodaya Campus
              </h2>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="font-ui text-[8px] uppercase tracking-[0.2em] text-foreground/35">
                Route discovered
              </p>
              <p className="font-display text-xl leading-tight text-[#e8ddc4]">
                {map.discovered} / {map.total}
              </p>
            </div>
            <button
              type="button"
              onClick={() => engine?.closeCampusMap()}
              aria-label="Close campus map"
              className="flex size-9 items-center justify-center border border-foreground/15 text-foreground/60 transition hover:border-[#b9c69d]/60 hover:text-[#dce7c6]"
            >
              <X className="size-4" />
            </button>
          </div>
        </header>

        <div className="mt-4 grid gap-4 lg:grid-cols-[1.45fr_0.75fr]">
          <section className="min-w-0">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-4 font-ui text-[8px] uppercase tracking-[0.18em] text-foreground/35">
                <span className="inline-flex items-center gap-1.5">
                  <span className="size-2 rounded-full bg-[#c9d8ae]" /> You
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Lock className="size-2.5" /> Locked
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Moon className="size-2.5 text-[#d8c08f]" /> Fictional caper
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowOnlyUnlocked((value) => !value)}
                className={`border px-2.5 py-1 font-ui text-[8px] uppercase tracking-[0.18em] transition ${
                  showOnlyUnlocked
                    ? "border-[#b9c69d]/50 text-[#dce7c6]"
                    : "border-foreground/15 text-foreground/40 hover:border-foreground/30"
                }`}
              >
                {showOnlyUnlocked ? "Showing route" : "Show all pins"}
              </button>
            </div>

            <div className="mx-auto w-full max-w-[min(100%,72vh)]">
              <CampusMapSurface
                map={map}
                state={state}
                engine={engine}
                selectedId={selectedId}
                onSelect={setSelectedId}
                showOnlyUnlocked={showOnlyUnlocked}
                waypoint={waypoint}
                multiplayer={multiplayer}
              />
            </div>
          </section>

          <aside className="flex min-w-0 flex-col border border-[#8d9a75]/25 bg-[#10140d]">
            <div className="border-b border-[#8d9a75]/15 px-4 py-4">
              <div className="flex items-center justify-between gap-3">
                <p className="label-cinema text-[8px] text-[#b9c69d]/60">
                  {selected?.provenance === "fictional"
                    ? "Fictional caper area"
                    : "Interpretive campus stop"}
                </p>
                <span
                  className={`inline-flex items-center gap-1 border px-2 py-0.5 font-ui text-[7px] uppercase tracking-[0.15em] ${
                    selected?.unlocked
                      ? "border-[#9aaa79]/35 text-[#c4d3a5]/75"
                      : "border-[#b5a06d]/35 text-[#d8c08f]/70"
                  }`}
                >
                  {selected?.unlocked ? <Check className="size-2.5" /> : <Lock className="size-2.5" />}
                  {selected?.unlocked ? "Open" : "Locked"}
                </span>
              </div>
              <h3 className="mt-2 font-display text-2xl leading-tight text-[#f1e8d5]">
                {selected?.name}
              </h3>
              <p className="mt-2 font-ui text-[11px] leading-relaxed text-foreground/50">
                {selected?.description}
              </p>
              {selected && distance !== null && (
                <p className="mt-3 flex items-center gap-1.5 border-t border-foreground/10 pt-2.5 font-ui text-[8px] uppercase tracking-[0.16em] text-[#c7d4b0]/60">
                  <MapPin className="size-3" />
                  {formatMapDistance(distance)} from your position
                </p>
              )}
            </div>

            <div className="flex-1 px-4 py-4">
              {selected?.discovered ? (
                <div>
                  <p className="label-cinema text-[8px] text-[#b9c69d]/55">Campus note · discovered</p>
                  <p className="mt-2 font-display text-[15px] leading-relaxed text-[#e6ddc8]/80">
                    {selected.story}
                  </p>
                </div>
              ) : selected?.unlocked ? (
                <p className="font-ui text-[11px] leading-relaxed text-foreground/40">
                  This stop is open on the route. Travel there, or walk through the campus and the
                  note will unlock when you arrive.
                </p>
              ) : (
                <p className="font-ui text-[11px] leading-relaxed text-foreground/40">
                  Locked for now. Discover {selected?.unlockAt ?? 0} campus stops to add this place
                  to the route. You can still walk the open campus freely.
                </p>
              )}

              <div className="mt-5 flex items-center gap-2 border-t border-foreground/10 pt-3 font-ui text-[8px] uppercase tracking-[0.16em] text-foreground/30">
                <MapPin className="size-3" />
                {selected?.provenance === "fictional"
                  ? "Interpretive garden · fictional caper"
                  : "Reference-inspired campus building"}
              </div>
            </div>

            <div className="m-4 mt-auto grid gap-2">
              <button
                type="button"
                onClick={toggleWaypoint}
                disabled={!selected}
                data-testid="map-waypoint"
                className={`inline-flex items-center justify-center gap-2 border px-4 py-2.5 font-ui text-[9px] uppercase tracking-[0.2em] transition disabled:cursor-not-allowed disabled:opacity-35 ${
                  isWaypoint
                    ? "border-[#e7c98f]/65 bg-[#2a2417] text-[#f0dcb7] hover:border-[#f0dcb7]/80"
                    : "border-[#b9c69d]/25 text-[#c7d4b0]/70 hover:border-[#d6e2bf]/65 hover:text-[#e6edd7]"
                }`}
              >
                <Flag className="size-3" />
                {isWaypoint ? "Remove destination" : "Mark destination"}
              </button>
              <button
                type="button"
                onClick={travel}
                disabled={!selected?.unlocked}
                data-testid="map-travel"
                className="inline-flex items-center justify-center gap-2 border border-[#a8b98a]/45 bg-[#1a2315] px-4 py-3 font-ui text-[9px] uppercase tracking-[0.22em] text-[#d6e2bf] transition hover:border-[#d6e2bf]/70 hover:bg-[#202b19] disabled:cursor-not-allowed disabled:border-foreground/10 disabled:bg-transparent disabled:text-foreground/25"
              >
                {selected?.unlocked ? (
                  <>
                    {selected.discovered ? "Travel here" : "Travel & discover"}
                    <ArrowRight className="size-3" />
                  </>
                ) : (
                  <>
                    <Lock className="size-3" /> Locked stop
                  </>
                )}
              </button>
            </div>
          </aside>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-[#8d9a75]/15 pt-3">
          <p className="max-w-3xl font-ui text-[8px] leading-relaxed text-foreground/30">
            Live map uses the actual Three.js ground coordinates. Buildings are simplified plan
            footprints, not a surveyed campus plan. Travel is optional; a destination marker stays
            on the mini-map while you walk.
          </p>
          <div className="flex items-center gap-2">
            {state.profile && <HouseEmblem houseId={state.profile.houseId} size={22} />}
            <span className="inline-flex items-center gap-1.5 font-ui text-[8px] uppercase tracking-[0.16em] text-foreground/30">
              <Footprints className="size-3" /> {map.discovered} stops noted
            </span>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
