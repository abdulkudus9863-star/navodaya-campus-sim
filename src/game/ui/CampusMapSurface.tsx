import {
  BookOpen,
  Building2,
  DoorOpen,
  FlaskConical,
  Home,
  Landmark,
  Lock,
  Minus,
  Moon,
  Plus,
  RotateCcw,
  Trees,
  Trophy,
  Utensils,
} from "lucide-react";
import { useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import type { GameEngine } from "../core/GameEngine";
import type { GameUIState } from "../core/types";
import type { CampusLocationKind, CampusMapView } from "../data/campus";
import { getHouse } from "../data/houses";
import {
  mapAnchorForLocation,
  missionTargetFor,
  worldToMap,
  type MapWaypoint,
} from "../data/liveMap";
import { CampusMapPlan } from "./CampusMapPlan";
import { useLiveMap } from "./useLiveMap";

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

export function CampusMapSurface({
  map,
  state,
  engine,
  selectedId,
  onSelect,
  showOnlyUnlocked,
  waypoint,
  multiplayer,
}: {
  map: CampusMapView;
  state: GameUIState;
  engine: GameEngine | null;
  selectedId: string;
  onSelect: (id: string) => void;
  showOnlyUnlocked: boolean;
  waypoint: MapWaypoint | null;
  multiplayer: boolean;
}) {
  const live = useLiveMap(engine, 300);
  const surfaceRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{
    id: number;
    x: number;
    y: number;
    panX: number;
    panY: number;
    moved: boolean;
  } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });

  const playerX = live?.playerX ?? map.playerX;
  const playerZ = live?.playerZ ?? map.playerZ;
  const playerPoint = worldToMap(playerX, playerZ);
  const rotation = live?.rotationY ?? 0;
  const mission = state.profile
    ? multiplayer || (!state.night?.active && !state.mission.done)
      ? missionTargetFor(state.mission.step, state.profile.houseId, multiplayer)
      : null
    : null;
  const missionPoint = mission ? worldToMap(mission.x, mission.z) : null;
  const waypointPoint = waypoint ? worldToMap(waypoint.x, waypoint.z) : null;
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
    .filter((location): location is CampusMapView["locations"][number] => Boolean(location));
  const route = routePoints
    .map((location) => {
      const point = worldToMap(location.x, location.z);
      return `${point.x},${point.y}`;
    })
    .join(" ");

  const clampPan = (next: { x: number; y: number }, zoomValue = zoom) => {
    const rect = surfaceRef.current?.getBoundingClientRect();
    if (!rect) return next;
    const maxX = Math.max(0, (rect.width * (zoomValue - 1)) / 2);
    const maxY = Math.max(0, (rect.height * (zoomValue - 1)) / 2);
    return { x: clamp(next.x, -maxX, maxX), y: clamp(next.y, -maxY, maxY) };
  };

  const changeZoom = (delta: number) => {
    const next = clamp(Number((zoom + delta).toFixed(2)), 1, 2.5);
    setZoom(next);
    setPan((currentPan) => (next === 1 ? { x: 0, y: 0 } : clampPan(currentPan, next)));
  };

  const resetView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (zoom <= 1) return;
    if ((event.target as HTMLElement).closest("button")) return;
    drag.current = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      panX: pan.x,
      panY: pan.y,
      moved: false,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const current = drag.current;
    if (!current || current.id !== event.pointerId) return;
    const dx = event.clientX - current.x;
    const dy = event.clientY - current.y;
    if (!current.moved && Math.hypot(dx, dy) < 4) return;
    current.moved = true;
    event.preventDefault();
    setPan(clampPan({ x: current.panX + dx, y: current.panY + dy }));
  };

  const handlePointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (drag.current?.id === event.pointerId) drag.current = null;
  };

  return (
    <div
      ref={surfaceRef}
      data-testid="campus-map-surface"
      className="relative aspect-square w-full touch-none overflow-hidden border border-[#687752]/35 bg-[#11170f]"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      <div
        data-testid="map-transform"
        className="absolute inset-0 z-10"
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          transformOrigin: "center",
        }}
      >
        <CampusMapPlan className="pointer-events-none absolute inset-0 size-full" showLabels />
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
        </svg>

        {locationPins
          .filter((location) => !showOnlyUnlocked || location.unlocked)
          .map((location) => {
            const anchor = mapAnchorForLocation(location);
            const point = worldToMap(anchor.x, anchor.z);
            const active = location.id === selectedId;
            const isGarden = location.id === "harbour-garden";
            return (
              <button
                key={location.id}
                type="button"
                onClick={() => onSelect(location.id)}
                className={`absolute z-10 -translate-x-1/2 -translate-y-1/2 focus:outline-none ${
                  location.unlocked ? "" : "opacity-55"
                }`}
                style={{ left: `${point.x}%`, top: `${point.y}%` }}
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

        {map.houseMarkers.map((marker) => {
          const point = worldToMap(marker.x, marker.z);
          return (
            <button
              key={marker.houseId}
              type="button"
              onClick={() => {
                if (marker.isPlayerHouse) onSelect("house-hostel");
              }}
              className={`absolute z-20 -translate-x-1/2 -translate-y-1/2 ${
                marker.isPlayerHouse ? "cursor-pointer" : "cursor-default"
              }`}
              style={{ left: `${point.x}%`, top: `${point.y}%` }}
              aria-label={
                marker.isPlayerHouse ? `Your hostel, ${marker.name}` : `${marker.name} hostel`
              }
              title={marker.isPlayerHouse ? `Your hostel · ${marker.name}` : marker.name}
            >
              <span
                className={`block size-3 rounded-full border-2 shadow-[0_0_0_3px_rgba(10,12,8,0.85)] ${
                  marker.isPlayerHouse ? "scale-125" : "opacity-70"
                }`}
                style={{
                  backgroundColor: marker.color,
                  borderColor: marker.isPlayerHouse ? "#f3ead5" : marker.color,
                }}
              />
              <span className="mt-1 block -translate-x-1/2 whitespace-nowrap font-ui text-[6px] uppercase tracking-[0.12em] text-foreground/45">
                {marker.shortName}
              </span>
            </button>
          );
        })}

        {live?.remotes.map((remote) => {
          const point = worldToMap(remote.x, remote.z);
          const house = getHouse(remote.houseId);
          return (
            <div
              key={remote.memberId}
              className="pointer-events-none absolute z-30 -translate-x-1/2 -translate-y-1/2"
              style={{ left: `${point.x}%`, top: `${point.y}%` }}
              title={`${remote.name} · ${house?.shortName ?? "Student"}`}
            >
              <span
                className="flex size-4 items-center justify-center rounded-full border border-[#f7eedc] font-ui text-[6px] font-semibold text-[#10170f] shadow-[0_0_0_2px_rgba(8,13,9,0.8)]"
                style={{ backgroundColor: house?.color ?? "#d9ceb8" }}
              >
                {remote.name.slice(0, 1).toUpperCase()}
              </span>
              <span className="mt-0.5 block max-w-[5rem] -translate-x-1/2 truncate text-center font-ui text-[6px] uppercase tracking-[0.1em] text-[#f2e7d2]/60">
                {remote.name}
              </span>
            </div>
          );
        })}

        {mission && missionPoint && (
          <div
            className="pointer-events-none absolute z-40 -translate-x-1/2 -translate-y-full"
            style={{ left: `${missionPoint.x}%`, top: `${missionPoint.y}%` }}
          >
            <span className="flex items-center gap-1 border border-[#e0c58e]/45 bg-[#19160e]/95 px-1.5 py-0.5 font-ui text-[6px] uppercase tracking-[0.14em] text-[#e6d2a6] shadow-[0_4px_14px_rgba(0,0,0,0.5)]">
              <span className="size-1.5 rotate-45 bg-[#e6d2a6]" /> {mission.label}
            </span>
          </div>
        )}

        {waypoint && waypointPoint && (
          <div
            className="pointer-events-none absolute z-40 -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${waypointPoint.x}%`, top: `${waypointPoint.y}%` }}
            title={waypoint.name}
            data-testid="map-waypoint-marker"
          >
            <span className="flex size-4 rotate-45 items-center justify-center border border-[#f1e4c7] bg-[#0b130d]/85 shadow-[0_0_0_3px_rgba(241,228,199,0.12)]">
              <span className="size-1.5 rounded-full bg-[#e7c98f]" />
            </span>
          </div>
        )}

        <div
          className="pointer-events-none absolute z-40 -translate-x-1/2 -translate-y-1/2 transition-[left,top] duration-300 ease-linear"
          style={{ left: `${playerPoint.x}%`, top: `${playerPoint.y}%` }}
          title="Your current position"
          data-testid="map-player"
        >
          <span className="absolute inset-0 -m-2 animate-ping rounded-full bg-[#dce8c8]/20" />
          <span
            className="relative block transition-transform duration-300 ease-linear"
            style={{ transform: `rotate(${Math.PI - rotation}rad)` }}
          >
            <svg viewBox="0 0 12 12" className="size-4 drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]">
              <path
                d="M6 0.8 10.7 10.5 6 8.2 1.3 10.5Z"
                fill="#f7edd8"
                stroke="#10170f"
                strokeWidth="0.7"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          <span className="absolute left-1/2 top-full mt-0.5 -translate-x-1/2 whitespace-nowrap font-ui text-[6px] uppercase tracking-[0.14em] text-[#f2e7d2]/70">
            You
          </span>
        </div>

        <div className="pointer-events-none absolute bottom-[13%] right-[7%] z-20 flex items-center gap-1.5 border border-[#cbb37e]/25 bg-[#0b0d09]/85 px-2 py-1 font-ui text-[7px] uppercase tracking-[0.15em] text-[#d8c08f]/70">
          <Moon className="size-2.5" /> Caper area
        </div>
      </div>

      <div className="pointer-events-none absolute left-3 top-3 z-30 flex items-center gap-1.5 border border-[#b9c69d]/20 bg-[#0b0d09]/80 px-2 py-1 font-ui text-[7px] uppercase tracking-[0.16em] text-[#b9c69d]/65">
        North · live
      </div>

      <div className="absolute bottom-3 right-3 z-30 flex items-center gap-1">
        <button
          type="button"
          onClick={() => changeZoom(-0.25)}
          disabled={zoom <= 1}
          aria-label="Zoom out"
          className="flex size-8 items-center justify-center border border-[#b9c69d]/25 bg-[#0b0d09]/85 text-[#dce7c6]/75 transition hover:border-[#dce7c6]/65 disabled:cursor-not-allowed disabled:opacity-35"
        >
          <Minus className="size-3.5" />
        </button>
        <button
          type="button"
          onClick={() => changeZoom(0.25)}
          disabled={zoom >= 2.5}
          aria-label="Zoom in"
          className="flex size-8 items-center justify-center border border-[#b9c69d]/25 bg-[#0b0d09]/85 text-[#dce7c6]/75 transition hover:border-[#dce7c6]/65 disabled:cursor-not-allowed disabled:opacity-35"
        >
          <Plus className="size-3.5" />
        </button>
        <button
          type="button"
          onClick={resetView}
          aria-label="Reset map view"
          className="flex size-8 items-center justify-center border border-[#b9c69d]/25 bg-[#0b0d09]/85 text-[#dce7c6]/75 transition hover:border-[#dce7c6]/65"
        >
          <RotateCcw className="size-3.5" />
        </button>
      </div>

      <p className="pointer-events-none absolute bottom-3 left-3 z-30 hidden font-ui text-[7px] uppercase tracking-[0.16em] text-[#b9c69d]/40 sm:block">
        Drag to pan · +/− to zoom
      </p>
    </div>
  );
}
