import { getHouse, houseInkColor, type HouseEmblemId, type HouseId } from "../data/houses";
import type { StudentCharacter } from "../data/students";

const EMBLEM_LABEL: Record<HouseEmblemId, string> = {
  mountain: "Mountain ridge",
  wave: "River wave",
  pine: "Pine tree",
  sun: "Rising sun",
};

function EmblemMark({
  emblem,
  color,
  mark,
}: {
  emblem: HouseEmblemId;
  color: string;
  mark: string;
}) {
  if (emblem === "mountain") {
    return (
      <>
        <path d="M15 43 L28 21 L36 33 L42 25 L52 43 Z" fill={mark} />
        <path d="M28 21 L33 30 L28 27 L24 31 Z" fill={color} opacity="0.55" />
      </>
    );
  }
  if (emblem === "wave") {
    return (
      <>
        <path d="M13 34c6-6 11-6 17 0s11 6 17 0" fill="none" stroke={mark} strokeWidth="4" strokeLinecap="round" />
        <path d="M14 43c6-6 11-6 16 0s10 6 16 0" fill="none" stroke={mark} strokeOpacity="0.62" strokeWidth="3" strokeLinecap="round" />
      </>
    );
  }
  if (emblem === "pine") {
    return (
      <>
        <path d="M32 15 L42 34 L36 34 L45 46 L19 46 L28 34 L22 34 Z" fill={mark} />
        <rect x="30" y="45" width="4" height="6" fill={mark} opacity="0.75" />
      </>
    );
  }
  return (
    <>
      <circle cx="32" cy="34" r="9" fill={mark} />
      {[0, 45, 90, 135, 180, 225, 270, 315].map((angle) => (
        <line
          key={angle}
          x1={32 + Math.cos((angle * Math.PI) / 180) * 13}
          y1={34 + Math.sin((angle * Math.PI) / 180) * 13}
          x2={32 + Math.cos((angle * Math.PI) / 180) * 18}
          y2={34 + Math.sin((angle * Math.PI) / 180) * 18}
          stroke={mark}
          strokeOpacity="0.75"
          strokeWidth="2.4"
          strokeLinecap="round"
        />
      ))}
    </>
  );
}

export function HouseEmblem({
  houseId,
  className = "",
  size = 40,
}: {
  houseId: HouseId;
  className?: string;
  size?: number;
}) {
  const house = getHouse(houseId);
  if (!house) return null;
  const mark = houseInkColor(house.color);
  return (
    <svg
      viewBox="0 0 64 72"
      width={size}
      height={size * 1.1}
      className={className}
      role="img"
      aria-label={`${house.name} badge, ${EMBLEM_LABEL[house.emblem]}`}
    >
      <path
        d="M32 2 L59 12 V35 C59 52 47 63 32 70 C17 63 5 52 5 35 V12 Z"
        fill={house.color}
        stroke={mark}
        strokeOpacity="0.75"
        strokeWidth="2.2"
      />
      <path
        d="M32 7 L54 15 V35 C54 49 44 58 32 64 C20 58 10 49 10 35 V15 Z"
        fill="rgba(0,0,0,0.12)"
        stroke="rgba(248,238,214,0.22)"
        strokeWidth="1"
      />
      <EmblemMark emblem={house.emblem} color={house.color} mark={mark} />
    </svg>
  );
}

export function HouseFlag({
  houseId,
  className = "",
}: {
  houseId: HouseId;
  className?: string;
}) {
  const house = getHouse(houseId);
  if (!house) return null;
  const ink = houseInkColor(house.color);
  return (
    <div
      className={`relative overflow-hidden border ${className}`}
      style={{
        borderColor: `${ink}55`,
        background: `linear-gradient(145deg, ${house.color}, color-mix(in srgb, ${house.color} 62%, #0b0a08))`,
      }}
    >
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(115deg,rgba(255,255,255,0.2),transparent_42%,rgba(0,0,0,0.22))]" />
      <div className="pointer-events-none absolute inset-2 border" style={{ borderColor: `${ink}44` }} />
      <div className="relative flex h-full flex-col items-center justify-center px-4 py-5 text-center">
        <HouseEmblem houseId={houseId} size={48} className="drop-shadow-[0_8px_18px_rgba(0,0,0,0.4)]" />
        <p className="mt-3 font-display text-2xl leading-none tracking-wide" style={{ color: ink }}>
          {house.shortName}
        </p>
        <p className="mt-1 font-ui text-[8px] uppercase tracking-[0.3em]" style={{ color: ink, opacity: 0.7 }}>
          House flag
        </p>
        <p className="mt-3 font-display text-[11px] italic leading-snug" style={{ color: ink, opacity: 0.85 }}>
          {house.motto}
        </p>
      </div>
    </div>
  );
}

export function StudentAvatar({
  student,
  className = "",
  showPhotoNote = false,
}: {
  student: StudentCharacter;
  className?: string;
  showPhotoNote?: boolean;
}) {
  const initials = student.displayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
  return (
    <div
      className={`relative overflow-hidden border border-[#f8eed6]/20 bg-[#0d0c0a] ${className}`}
    >
      <div
        className="absolute inset-0"
        style={{
          background: `radial-gradient(120% 90% at 70% 12%, ${student.houseColor}55, transparent 60%), linear-gradient(160deg, #211d16, #0b0a08)`,
        }}
      />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,transparent_45%,rgba(8,7,5,0.7))]" />
      <div className="relative flex h-full flex-col items-center justify-center">
        <span
          className="flex size-[4.4rem] items-center justify-center rounded-full border font-display text-[2rem] tracking-wide sm:size-24 sm:text-[2.6rem]"
          style={{
            borderColor: `${student.houseColor}99`,
            color: "#f7ecd8",
            backgroundColor: `${student.houseColor}26`,
            boxShadow: `0 0 45px -18px ${student.houseColor}`,
          }}
        >
          {initials || "?"}
        </span>
        <HouseEmblem
          houseId={student.houseId}
          size={24}
          className="absolute right-2.5 top-2.5 drop-shadow-[0_4px_10px_rgba(0,0,0,0.5)]"
        />
      </div>
      {showPhotoNote && (
        <div className="absolute inset-x-0 bottom-0 border-t border-[#f8eed6]/12 bg-black/45 px-2 py-1.5 text-center font-ui text-[8px] uppercase tracking-[0.16em] text-[#f8eed6]/55">
          No photograph supplied
        </div>
      )}
    </div>
  );
}
