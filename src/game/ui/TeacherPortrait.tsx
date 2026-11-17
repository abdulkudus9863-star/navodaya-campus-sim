import type { TeacherDialogueMeta } from "../core/types";

/**
 * A compact painted portrait that uses the same palette and facial details as
 * the 3D teacher rig. It is decorative, so the name and subject remain visible
 * as text for screen readers and at small sizes.
 */
export function TeacherPortrait({
  teacher,
  size = 64,
}: {
  teacher: TeacherDialogueMeta;
  size?: number;
}) {
  const p = teacher.portrait;
  return (
    <span
      aria-hidden="true"
      className="relative inline-flex shrink-0 overflow-hidden rounded-full border-2 shadow-[0_8px_24px_rgba(0,0,0,0.5)]"
      style={{
        width: size,
        height: size,
        borderColor: `${p.accents}aa`,
        background: `radial-gradient(circle at 50% 28%, #3a4439 0%, #17211b 58%, #0a100d 100%)`,
      }}
    >
      <svg viewBox="0 0 64 64" className="h-full w-full">
        <path d="M9 64c1-13 10-19 23-19s22 6 23 19z" fill={p.shirt} />
        <path d="M23 46l9 11 9-11 5 4-5 14H23l-5-14z" fill={p.shirt} opacity="0.82" />
        <path d="M30 43h4l2 14-4 4-4-4z" fill={p.accents} opacity="0.85" />
        <ellipse cx="32" cy="31" rx="14" ry="17" fill={p.skin} />
        <path
          d="M18 28c-1-11 5-18 14-18 10 0 16 7 14 19-4-3-7-6-9-10-3 5-8 8-19 9z"
          fill={p.hair}
        />
        <path d="M18 27c-2 2-2 7 0 10 1-3 1-7 0-10zm28 0c2 2 2 7 0 10-1-3-1-7 0-10z" fill={p.hair} opacity="0.9" />
        <ellipse cx="26" cy="31" rx="2.2" ry="2.4" fill="#201915" />
        <ellipse cx="38" cy="31" rx="2.2" ry="2.4" fill="#201915" />
        {p.glasses && (
          <>
            <circle cx="26" cy="31" r="5.7" fill="none" stroke="#2b2823" strokeWidth="1.5" />
            <circle cx="38" cy="31" r="5.7" fill="none" stroke="#2b2823" strokeWidth="1.5" />
            <path d="M31.7 31h.6M20.4 30l-3-1M43.6 30l3-1" stroke="#2b2823" strokeWidth="1.3" />
          </>
        )}
        <path d="M27 36c1.5 3 3.5 4.5 5 4.5s3.5-1.5 5-4.5" fill="none" stroke="#5b3227" strokeWidth="1.5" strokeLinecap="round" />
        {p.moustache && (
          <path d="M26 41c3-2 5-2 6-1 1-1 3-1 6 1-3 1-5 1-6 2-1-1-3-1-6-2z" fill={p.hair} />
        )}
        {p.beard && (
          <path
            d="M21 33c0 10 4 16 11 16s11-6 11-16c-2 5-5 7-11 7s-9-2-11-7z"
            fill={p.hair}
            opacity="0.92"
          />
        )}
        <path d="M24 28c2-1 4-1 6 0M34 28c2-1 4-1 6 0" fill="none" stroke={p.hair} strokeWidth="1.7" strokeLinecap="round" />
      </svg>
      <span
        className="absolute inset-x-0 bottom-0 h-1"
        style={{ background: p.accents }}
      />
    </span>
  );
}
