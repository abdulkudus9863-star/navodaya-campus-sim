import { AlertTriangle, Flag, Maximize2, Navigation, X } from "lucide-react";
import type { GameEngine } from "../core/GameEngine";
import type { GameUIState } from "../core/types";
import { getHouse } from "../data/houses";
import { CLASS_BUNK_RETURN } from "../data/classBunk";
import {
  formatMapDistance,
  mapWorldDistance,
  missionTargetFor,
  worldToMap,
  type MapWaypoint,
} from "../data/liveMap";
import { CampusMapPlan } from "./CampusMapPlan";
import { useLiveMap } from "./useLiveMap";

export function MiniMap({
  engine,
  state,
  multiplayer = false,
  waypoint,
  onClearWaypoint,
}: {
  engine: GameEngine | null;
  state: GameUIState;
  multiplayer?: boolean;
  waypoint: MapWaypoint | null;
  onClearWaypoint: () => void;
}) {
  const snapshot = useLiveMap(engine, 100);
  const canExpand = !multiplayer && !state.night?.active;
  const referral = state.principalReferral?.active ? state.principalReferral : null;
  const mission = state.profile && !referral
    ? multiplayer || (!state.night?.active && !state.mission.done)
      ? missionTargetFor(state.mission.step, state.profile.houseId, multiplayer)
      : null
    : null;
  const player = snapshot ? worldToMap(snapshot.playerX, snapshot.playerZ) : null;
  const missionPoint = mission ? worldToMap(mission.x, mission.z) : null;
  const referralTarget = referral ? worldToMap(referral.destination.x, referral.destination.z) : null;
  const referralRoute = referral
    ? referral.route.map((point) => worldToMap(point.x, point.z))
    : [];
  const routePoints = referralRoute.map((point) => `${point.x},${point.y}`).join(" ");
  const bunk = state.classBunk?.active ? state.classBunk : null;
  const bunkNext = bunk
    ? bunk.objectives.find((objective) => !objective.complete) ?? null
    : null;
  const bunkTarget = bunk
    ? bunk.status === "return"
      ? { x: CLASS_BUNK_RETURN.x, z: CLASS_BUNK_RETURN.z, label: "Room 101" }
      : bunkNext
    : null;
  const bunkTargetPoint = bunkTarget ? worldToMap(bunkTarget.x, bunkTarget.z) : null;
  const bunkLine = bunkTarget && player && !referral
    ? { x1: player.x, y1: player.y, x2: bunkTargetPoint!.x, y2: bunkTargetPoint!.y }
    : null;
  const routeAhead = referralRoute[0] && player
    ? Math.atan2(referralRoute[0].x - player.x, -(referralRoute[0].y - player.y))
    : 0;
  const waypointPoint = waypoint ? worldToMap(waypoint.x, waypoint.z) : null;
  const distance =
    snapshot && waypoint
      ? mapWorldDistance(snapshot.playerX, snapshot.playerZ, waypoint.x, waypoint.z)
      : null;
  const playerRotation = snapshot ? Math.PI - snapshot.rotationY : 0;

  return (
    <div className="pointer-events-none flex flex-col items-end gap-1.5">
      <button
        type="button"
        onClick={() => {
          if (canExpand) engine?.openCampusMap();
        }}
        disabled={!canExpand}
        aria-label={canExpand ? "Open live campus map" : "Live campus map"}
        title={
          canExpand
            ? "Open live campus map"
            : multiplayer
              ? "Expanded map is unavailable in co-op"
              : "Expanded map is closed during the night caper"
        }
        data-testid="live-minimap"
        className={`group pointer-events-auto relative size-[104px] shrink-0 overflow-hidden rounded-[14px] border border-[#d5c29b]/40 bg-[#0b130d] shadow-[0_10px_30px_rgba(0,0,0,0.48)] outline-none transition sm:size-[148px] sm:rounded-[16px] ${
          canExpand
            ? "hover:border-[#ead8b0]/80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#e8d2a2]"
            : "cursor-default"
        }`}
      >
        <CampusMapPlan className="absolute inset-0 size-full" />
        <span className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_45%,transparent_40%,rgba(6,10,7,0.5)_100%)]" />

        {bunkLine && (
          <svg
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            className="pointer-events-none absolute inset-0 z-10 size-full"
            aria-hidden
          >
            <line
              x1={bunkLine.x1}
              y1={bunkLine.y1}
              x2={bunkLine.x2}
              y2={bunkLine.y2}
              stroke="#0c110b"
              strokeWidth="3.2"
              strokeLinecap="round"
              opacity="0.55"
            />
            <line
              x1={bunkLine.x1}
              y1={bunkLine.y1}
              x2={bunkLine.x2}
              y2={bunkLine.y2}
              stroke="#f0cf86"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeDasharray="3.5 2.5"
            />
          </svg>
        )}

        {referral && !referral.insideChamber && referralRoute.length > 1 && (
          <svg
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            className="pointer-events-none absolute inset-0 z-10 size-full"
            aria-hidden
          >
            <polyline
              points={routePoints}
              fill="none"
              stroke="#0c110b"
              strokeWidth="4.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity="0.55"
            />
            <polyline
              points={routePoints}
              fill="none"
              stroke="#f0cf86"
              strokeWidth="2.1"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray="4 3"
            />
          </svg>
        )}

        {referral && referralTarget && (
          <span
            data-testid="principal-minimap-marker"
            className="pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${referralTarget.x}%`, top: `${referralTarget.y}%` }}
            title="Principal's Chamber · Principal Moinm Rahman"
          >
            <span className="absolute left-1/2 top-1/2 size-5 -translate-x-1/2 -translate-y-1/2 animate-ping rounded-full bg-[#dfb765]/25" />
            <span className="relative flex size-4 items-center justify-center rounded-full border border-[#f4dfb0] bg-[#7d2f25] shadow-[0_0_0_3px_rgba(240,207,134,0.2)]">
              <AlertTriangle className="size-2.5 text-[#fff1d2]" strokeWidth={2.6} />
            </span>
          </span>
        )}

        {bunkTargetPoint && (
          <span
            data-testid="bunk-minimap-target"
            className="pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${bunkTargetPoint.x}%`, top: `${bunkTargetPoint.y}%` }}
            title={bunkTarget?.label ?? "Next stop"}
          >
            <span className="flex size-3.5 items-center justify-center rounded-full border border-[#efd79f]/85 bg-[#c9a45d]/25 shadow-[0_0_0_3px_rgba(201,164,93,0.16)]">
              <span className="size-1.5 rotate-45 bg-[#f6e4bb]" />
            </span>
          </span>
        )}

        {mission && missionPoint && (
          <span
            className="pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${missionPoint.x}%`, top: `${missionPoint.y}%` }}
            title={mission.label}
          >
            <span className="flex size-3.5 items-center justify-center rounded-full border border-[#e7c98f]/80 bg-[#e7c98f]/15 shadow-[0_0_0_3px_rgba(231,201,143,0.12)]">
              <span className="size-1 rotate-45 bg-[#f5e4bf]" />
            </span>
          </span>
        )}

        {waypoint && waypointPoint && (
          <span
            className="pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${waypointPoint.x}%`, top: `${waypointPoint.y}%` }}
            title={waypoint.name}
            data-testid="minimap-waypoint"
          >
            <span className="flex size-3.5 items-center justify-center rounded-full border border-[#f3ead7]/80 bg-[#0b130d]/85">
              <Flag className="size-2 text-[#f3ead7]" strokeWidth={2.4} />
            </span>
          </span>
        )}

        {bunk && snapshot?.teachers.map((teacher) => {
          const point = worldToMap(teacher.x, teacher.z);
          return (
            <span
              key={teacher.id}
              data-testid="bunk-teacher-marker"
              className="pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-1/2"
              style={{ left: `${point.x}%`, top: `${point.y}%` }}
              title={`${teacher.name} · on patrol`}
            >
              <span className="block size-2 rounded-full border border-[#f5d6c6] bg-[#9b3f2f] shadow-[0_0_0_2px_rgba(8,13,9,0.7)]" />
            </span>
          );
        })}

        {snapshot?.remotes.map((remote) => {
          const point = worldToMap(remote.x, remote.z);
          const house = getHouse(remote.houseId);
          return (
            <span
              key={remote.memberId}
              className="pointer-events-none absolute z-20 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#f8f0df] shadow-[0_0_0_2px_rgba(8,13,9,0.75)]"
              style={{
                left: `${point.x}%`,
                top: `${point.y}%`,
                backgroundColor: house?.color ?? "#d9ceb8",
              }}
              title={`${remote.name} · ${house?.shortName ?? "Student"}`}
            />
          );
        })}

        {player && (
          <span
            className="pointer-events-none absolute z-30 -translate-x-1/2 -translate-y-1/2 transition-[left,top] duration-100 ease-linear"
            style={{ left: `${player.x}%`, top: `${player.y}%` }}
            title="Your position"
            data-testid="minimap-player"
          >
            <span
              className="block transition-transform duration-100 ease-linear"
              style={{ transform: `rotate(${playerRotation}rad)` }}
            >
              <svg viewBox="0 0 12 12" className="size-3.5 drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)] sm:size-4">
                <path
                  d="M6 0.8 10.7 10.5 6 8.2 1.3 10.5Z"
                  fill="#f7edd8"
                  stroke="#10170f"
                  strokeWidth="0.7"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
          </span>
        )}

        <span className="pointer-events-none absolute left-1/2 top-1 z-20 -translate-x-1/2 font-ui text-[7px] font-semibold uppercase tracking-[0.18em] text-[#f3ead8]/70 sm:top-1.5 sm:text-[8px]">
          N
        </span>
        <span className="pointer-events-none absolute bottom-1.5 right-1.5 z-20 flex size-4 items-center justify-center rounded-[3px] border border-[#f1e4c7]/20 bg-[#0a110b]/65 text-[#f1e4c7]/60 transition group-hover:border-[#f1e4c7]/45 group-hover:text-[#f1e4c7] sm:bottom-2 sm:right-2 sm:size-5">
          <Maximize2 className="size-2.5" strokeWidth={1.8} />
        </span>
        <span className="sr-only">
          Live campus map. {waypoint ? `Destination ${waypoint.name}.` : ""}
          {referral ? ` Walkable route to the Principal's Chamber.` : ""}
        </span>
      </button>

      {referral && (
        <div
          data-testid="principal-route-distance"
          className="pointer-events-auto flex max-w-[11rem] items-center gap-1 border border-[#d5b477]/40 bg-[#0a110b]/90 px-2 py-1 font-ui text-[8px] uppercase tracking-[0.12em] text-[#f0dfba]/85 shadow-[0_6px_18px_rgba(0,0,0,0.35)] backdrop-blur-sm sm:max-w-[14rem] sm:text-[9px]"
        >
          <Navigation className="size-2.5 shrink-0 text-[#e7c98f]" style={{ transform: `rotate(${routeAhead}rad)` }} />
          <span className="truncate">Principal's Chamber</span>
          <span className="shrink-0 text-[#e7c98f]/85">
            · {referral.insideChamber ? "Report in" : formatMapDistance(referral.distance)}
          </span>
        </div>
      )}

      {waypoint && distance !== null && (
        <div
          data-testid="minimap-distance"
          className="pointer-events-auto flex max-w-[10rem] items-center gap-1 border border-[#d5c29b]/30 bg-[#0a110b]/90 px-2 py-1 font-ui text-[8px] uppercase tracking-[0.12em] text-[#e9ddc8]/75 shadow-[0_6px_18px_rgba(0,0,0,0.35)] backdrop-blur-sm sm:max-w-[14rem] sm:text-[9px]"
        >
          <Flag className="size-2.5 shrink-0 text-[#e7c98f]" />
          <span className="truncate">{waypoint.name}</span>
          <span className="shrink-0 text-[#e7c98f]/85">· {formatMapDistance(distance)}</span>
          <button
            type="button"
            onClick={onClearWaypoint}
            aria-label="Clear destination"
            className="-mr-0.5 ml-0.5 flex size-4 shrink-0 items-center justify-center rounded-[2px] text-[#e9ddc8]/45 transition hover:bg-[#f1e4c7]/10 hover:text-[#f1e4c7]"
          >
            <X className="size-2.5" />
          </button>
        </div>
      )}
    </div>
  );
}
