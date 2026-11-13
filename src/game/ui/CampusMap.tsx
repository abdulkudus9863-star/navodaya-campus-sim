import { motion } from "framer-motion";
import {
  ArrowRight,
  BookOpen,
  Building2,
  Check,
  Compass,
  DoorOpen,
  FlaskConical,
  Footprints,
  Home,
  Landmark,
  Lock,
  MapPin,
  Moon,
  Navigation,
  Target,
  Trophy,
  Trees,
  Utensils,
  X,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import type { GameEngine } from "../core/GameEngine";
import type { GameUIState } from "../core/types";
import type { CampusLocationKind, CampusLocationView } from "../data/campus";
import { HouseEmblem } from "./HouseVisuals";

const ICONS: Record<CampusLocationKind, ReactNode> = {
  entrance: <DoorOpen className="size-3.5" />,
  assembly: <Landmark className="size-3.5" />,
  academic: <BookOpen className="size-3.5" />,
  laboratory: <FlaskConical className="size-3.5" />,
  library: <BookOpen className="size-3.5" />,
  administration: <Building2 className="size-3.5" />,
  dining: <Utensils className="size-3.5" />,
  sports: <Trophy className="size-3.5" />,
  garden: <Trees className="size-3.5" />,
  hostel: <Home className="size-3.5" />,
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function CampusMap({
  state,
  engine,
}: {
  state: GameUIState;
  engine: GameEngine | null;
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
  const assignedHostel = map.locations.find((location) => location.id === "house-hostel");
  const playerLeft = clamp(50 + map.playerX * 0.92, 4, 96);
  const playerTop = clamp(50 + map.playerZ * 0.95, 5, 95);
  const locationPins = map.locations.filter((location) => !location.dynamicHostel);
  const routePoints = [
    "main-gate",
    "assembly-ground",
    "academic-block",
    "library",
    "science-labs",
    "dining-hall",
    "sports-ground",
    "harbour-garden",
    "house-hostel",
  ]
    .map((id) => map.locations.find((location) => location.id === id))
    .filter((location): location is CampusLocationView => Boolean(location));
  const route = routePoints.map((location) => `${location.mapX},${location.mapY}`).join(" ");
  const missionStopIds = ["main-gate", "assembly-ground", "academic-block", "house-hostel"];
  const missionStop = map.locations.find(
    (location) => location.id === missionStopIds[state.mission.step],
  );
  const showMission = !state.mission.done && Boolean(missionStop);

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
              <p className="label-cinema text-[#b9c69d]/75">Campus route · interpretive map</p>
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

            <div className="relative aspect-[5/4] w-full overflow-hidden border border-[#687752]/35 bg-[#11170f] sm:aspect-[16/10]">
              <div
                className="absolute inset-0 opacity-80"
                style={{
                  backgroundColor: "#131a10",
                  backgroundImage:
                    "linear-gradient(0deg, rgba(146,163,118,0.07) 1px, transparent 1px), linear-gradient(90deg, rgba(146,163,118,0.07) 1px, transparent 1px)",
                  backgroundSize: "8% 8%",
                }}
              />
              <div className="absolute left-[8%] top-[12%] h-[34%] w-[30%] rounded-[45%] border border-[#576943]/35 bg-[#1a2415]" />
              <div className="absolute right-[7%] top-[8%] h-[26%] w-[27%] rounded-[45%] border border-[#576943]/30 bg-[#172113]" />
              <div className="absolute bottom-[10%] left-[10%] h-[23%] w-[37%] rounded-[42%] border border-[#5b6d45]/30 bg-[#192314]" />
              <div className="absolute bottom-[8%] right-[6%] h-[30%] w-[31%] rounded-[44%] border border-[#6a6042]/30 bg-[#1d2115]" />

              <div className="absolute left-[39%] top-[15%] h-[8%] w-[22%] border border-[#7d8d6b]/20" />
              <div className="absolute left-[39%] top-[32%] h-[8%] w-[22%] border border-[#7d8d6b]/20" />
              <div className="absolute left-[39%] top-[50%] h-[7%] w-[22%] border border-[#7d8d6b]/20" />
              <div className="absolute left-[39%] top-[68%] h-[8%] w-[22%] border border-[#7d8d6b]/20" />

              <svg
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
                className="pointer-events-none absolute inset-0 size-full"
                aria-hidden="true"
              >
                <polyline
                  points={route}
                  fill="none"
                  stroke="#a9bb8d"
                  strokeWidth="0.45"
                  strokeDasharray="1.2 1.6"
                  opacity="0.32"
                />
                <line x1="50" y1="96" x2="50" y2="88" stroke="#cfddba" strokeWidth="0.55" opacity="0.55" />
              </svg>

              <div className="pointer-events-none absolute left-1/2 top-[2.5%] -translate-x-1/2 font-ui text-[8px] uppercase tracking-[0.2em] text-[#b9c69d]/45">
                Assembly side
              </div>
              <div className="pointer-events-none absolute bottom-[2%] left-1/2 -translate-x-1/2 font-ui text-[8px] uppercase tracking-[0.2em] text-[#b9c69d]/35">
                South lawn · house hostels
              </div>

              {locationPins
                .filter((location) => !showOnlyUnlocked || location.unlocked)
                .map((location) => {
                  const active = location.id === selectedId;
                  const isGarden = location.id === "harbour-garden";
                  return (
                    <button
                      key={location.id}
                      type="button"
                      onClick={() => setSelectedId(location.id)}
                      className={`absolute z-10 -translate-x-1/2 -translate-y-1/2 focus:outline-none ${
                        location.unlocked ? "" : "opacity-55"
                      }`}
                      style={{ left: `${location.mapX}%`, top: `${location.mapY}%` }}
                      aria-label={`${location.name}${location.unlocked ? "" : " locked"}`}
                      aria-pressed={active}
                      title={location.name}
                    >
                      <span
                        className={`mx-auto flex size-7 items-center justify-center rounded-full border shadow-[0_4px_18px_rgba(0,0,0,0.45)] transition ${
                          active
                            ? "border-[#e4ecd1] bg-[#ccd8b5] text-[#182112]"
                            : isGarden
                              ? "border-[#cbb37e]/60 bg-[#282317] text-[#dbc494]"
                              : location.unlocked
                                ? "border-[#a8b98a]/45 bg-[#1b2616] text-[#c7d4b0] hover:border-[#d6e2bf]"
                                : "border-foreground/20 bg-[#14150f] text-foreground/35"
                        }`}
                      >
                        {location.unlocked ? ICONS[location.kind] : <Lock className="size-3" />}
                      </span>
                      <span
                        className={`mt-1 block max-w-[6.5rem] -translate-x-1/2 whitespace-nowrap border px-1.5 py-0.5 font-ui text-[7px] uppercase tracking-[0.12em] sm:text-[8px] ${
                          active
                            ? "border-[#cbd8b0]/50 bg-[#10150d]/95 text-[#e7ecd8]"
                            : "border-transparent bg-[#0b0d09]/80 text-foreground/55"
                        }`}
                        style={{ marginLeft: "50%" }}
                      >
                        {location.shortName}
                      </span>
                    </button>
                  );
                })}

              {showMission && missionStop && (
                <div
                  className="pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-full"
                  style={{ left: `${missionStop.mapX + 3.5}%`, top: `${missionStop.mapY - 3}%` }}
                >
                  <span className="flex items-center gap-1 border border-[#e0c58e]/45 bg-[#19160e]/95 px-1.5 py-0.5 font-ui text-[6px] uppercase tracking-[0.14em] text-[#e6d2a6] shadow-[0_4px_14px_rgba(0,0,0,0.5)]">
                    <Target className="size-2.5" /> Objective
                  </span>
                </div>
              )}

              {map.houseMarkers.map((marker) => (
                <button
                  key={marker.houseId}
                  type="button"
                  onClick={() => {
                    if (marker.isPlayerHouse) setSelectedId("house-hostel");
                  }}
                  className={`absolute z-20 -translate-x-1/2 -translate-y-1/2 ${
                    marker.isPlayerHouse ? "cursor-pointer" : "cursor-default"
                  }`}
                  style={{ left: `${marker.mapX}%`, top: `${marker.mapY}%` }}
                  aria-label={
                    marker.isPlayerHouse ? `Your hostel, ${marker.name}` : `${marker.name} hostel`
                  }
                  title={marker.isPlayerHouse ? `Your hostel · ${marker.name}` : marker.name}
                >
                  <span
                    className={`block size-3 rounded-full border-2 shadow-[0_0_0_3px_rgba(10,12,8,0.85)] ${
                      marker.isPlayerHouse ? "scale-125" : "opacity-70"
                    }`}
                    style={{ backgroundColor: marker.color, borderColor: marker.isPlayerHouse ? "#f3ead5" : marker.color }}
                  />
                  <span className="mt-1 block -translate-x-1/2 whitespace-nowrap font-ui text-[6px] uppercase tracking-[0.12em] text-foreground/45">
                    {marker.shortName}
                  </span>
                </button>
              ))}

              {assignedHostel && (
                <div className="pointer-events-none absolute bottom-[13%] right-[7%] z-20 flex items-center gap-1.5 border border-[#cbb37e]/25 bg-[#0b0d09]/85 px-2 py-1 font-ui text-[7px] uppercase tracking-[0.15em] text-[#d8c08f]/70">
                  <Moon className="size-2.5" /> Caper area
                </div>
              )}

              <div
                className="pointer-events-none absolute z-30 -translate-x-1/2 -translate-y-1/2"
                style={{ left: `${playerLeft}%`, top: `${playerTop}%` }}
                title="Your current position"
              >
                <span className="absolute inset-0 -m-2 animate-ping rounded-full bg-[#dce8c8]/25" />
                <span className="relative flex size-3.5 items-center justify-center rounded-full border border-[#f5efdd] bg-[#c9d8ae] shadow-[0_0_0_4px_rgba(201,216,174,0.16)]">
                  <Navigation className="size-2 text-[#1a2412]" />
                </span>
              </div>
            </div>
          </section>

          <aside className="flex min-w-0 flex-col border border-[#8d9a75]/25 bg-[#10140d]">
            <div className="border-b border-[#8d9a75]/15 px-4 py-4">
              <div className="flex items-center justify-between gap-3">
                <p className="label-cinema text-[8px] text-[#b9c69d]/60">
                  {selected?.provenance === "fictional" ? "Fictional caper area" : "Interpretive campus stop"}
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

            <button
              type="button"
              onClick={() => selected && engine?.travelToCampusLocation(selected.id)}
              disabled={!selected?.unlocked}
              data-testid="map-travel"
              className="m-4 inline-flex items-center justify-center gap-2 border border-[#a8b98a]/45 bg-[#1a2315] px-4 py-3 font-ui text-[9px] uppercase tracking-[0.22em] text-[#d6e2bf] transition hover:border-[#d6e2bf]/70 hover:bg-[#202b19] disabled:cursor-not-allowed disabled:border-foreground/10 disabled:bg-transparent disabled:text-foreground/25"
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
          </aside>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-[#8d9a75]/15 pt-3">
          <p className="max-w-3xl font-ui text-[8px] leading-relaxed text-foreground/30">
            {map.note} Route stops, map pins and travel are a game layer; physical free roam stays
            open. House points are not awarded for exploring.
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
