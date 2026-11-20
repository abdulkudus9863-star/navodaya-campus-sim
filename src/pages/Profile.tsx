import { RequireAuth } from "@/components/RequireAuth";
import { DEFAULT_CHARACTER, MISSION_STEPS, type CharacterSettings } from "@/game/core/types";
import { ACHIEVEMENTS, xpProgress } from "@/game/data/achievements";
import { CAMPUS_LOCATIONS } from "@/game/data/campus";
import { standingsForHouse } from "@/game/data/competitions";
import { getHouse, houseInkColor, isHouseId, type HouseId } from "@/game/data/houses";
import { getStudent } from "@/game/data/students";
import { CharacterPreview3D } from "@/game/ui/CharacterPreview3D";
import { HouseEmblem } from "@/game/ui/HouseVisuals";
import { usePlayerIdentity } from "@/identity/PlayerIdentityProvider";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Home,
  Loader2,
  Lock,
  MapPin,
  Pencil,
  RotateCcw,
  Save,
  Settings,
  Shield,
  Sparkles,
  Trophy,
  UserRound,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router";

const CATEGORY_META = [
  { id: "explorer", label: "Campus Explorer" },
  { id: "missions", label: "Mission Master" },
  { id: "house", label: "House Spirit" },
  { id: "friendly", label: "Friendly Face" },
  { id: "first-day", label: "First Day" },
] as const;

const ACHIEVEMENT_CATEGORY: Record<string, (typeof CATEGORY_META)[number]["id"]> = {
  "campus-wanderer": "explorer",
  "campus-cartographer": "explorer",
  "campus-life": "explorer",
  "first-day": "first-day",
  "house-colours": "house",
  "midnight-garden": "missions",
  "garden-duty": "missions",
  "escape-first-run": "missions",
  "escape-collector": "missions",
  "escape-perfect": "missions",
  "escape-speed": "missions",
  "escape-champion": "missions",
  "caught-in-the-act": "friendly",
};

function formatDate(timestamp: number): string {
  try {
    return new Intl.DateTimeFormat("en", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(new Date(timestamp));
  } catch {
    return "—";
  }
}

function initialsFor(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || "N"
  );
}

function SummaryCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail?: string;
}) {
  return (
    <div className="border border-[#F1EAD8]/9 bg-[#0B1511]/45 p-4">
      <p className="font-ui text-[8px] uppercase tracking-[0.2em] text-[#B4BBA9]/55">{label}</p>
      <p className="mt-1 font-display text-[26px] leading-none text-[#F1EAD8]">{value}</p>
      {detail && (
        <p className="mt-1.5 font-ui text-[9px] leading-4 text-[#B4BBA9]/55">{detail}</p>
      )}
    </div>
  );
}

function OptionGroup({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <fieldset>
      <legend className="font-ui text-[9px] uppercase tracking-[0.2em] text-[#B4BBA9]/70">
        {label}
      </legend>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {options.map((option) => {
          const active = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(option.value)}
              className={`min-h-9 border px-3 font-ui text-[9px] uppercase tracking-[0.15em] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D5B46A] ${
                active
                  ? "border-[#D5B46A] bg-[#D5B46A] text-[#0B1511]"
                  : "border-[#F1EAD8]/12 bg-[#0B1511]/40 text-[#B4BBA9] hover:border-[#D5B46A]/55 hover:text-[#F1EAD8]"
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

function NoHouseProfile({
  name,
  playerId,
}: {
  name: string | null;
  playerId: string | null;
}) {
  return (
    <main className="flex min-h-[100dvh] flex-col bg-[#0B1511] text-[#F1EAD8]">
      <header className="border-b border-[#F1EAD8]/10 px-5 py-5 sm:px-8">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4">
          <Link
            to="/"
            className="inline-flex items-center gap-2 font-ui text-[9px] uppercase tracking-[0.2em] text-[#B4BBA9] transition-colors hover:text-[#F1EAD8] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#D5B46A]"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" /> Back to campus
          </Link>
          <span className="font-ui text-[8px] uppercase tracking-[0.22em] text-[#B4BBA9]/50">
            Player identity
          </span>
        </div>
      </header>
      <div className="relative flex flex-1 items-center justify-center overflow-hidden px-5 py-16">
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(70%_70%_at_50%_30%,rgba(213,180,106,0.13),transparent_65%)]"
          aria-hidden="true"
        />
        <div className="relative w-full max-w-xl text-center">
          <div className="mx-auto flex size-20 items-center justify-center rounded-full border border-[#D5B46A]/35 bg-[#14231B]">
            <Shield className="h-8 w-8 text-[#D5B46A]" aria-hidden="true" />
          </div>
          <p className="mt-7 font-ui text-[9px] uppercase tracking-[0.3em] text-[#D5B46A]">
            {name ? `Signed in as ${name}` : "Campus identity"}
          </p>
          <h1 className="mt-3 font-display text-[clamp(2.6rem,7vw,4.5rem)] leading-[0.92] text-[#F1EAD8]">
            YOUR HOUSE JOURNEY BEGINS HERE
          </h1>
          <p className="mx-auto mt-5 max-w-md font-ui text-[12px] leading-6 text-[#B4BBA9]">
            No house is saved to this account yet. Continue into the existing campus onboarding,
            choose one of the four official houses and your identity will be linked automatically.
          </p>
          {playerId && (
            <p className="mt-4 font-ui text-[8px] uppercase tracking-[0.16em] text-[#B4BBA9]/35">
              Player ID · {playerId}
            </p>
          )}
          <div className="mt-8 flex flex-col justify-center gap-2 sm:flex-row">
            <Link
              to="/play"
              className="inline-flex min-h-12 items-center justify-center gap-2 border border-[#D5B46A] bg-[#D5B46A] px-6 font-ui text-[9px] font-semibold uppercase tracking-[0.24em] text-[#0B1511] transition-colors hover:bg-[#E7CD94] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#F1EAD8]"
            >
              Choose your house <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
            <Link
              to="/"
              className="inline-flex min-h-12 items-center justify-center border border-[#F1EAD8]/16 px-6 font-ui text-[9px] uppercase tracking-[0.2em] text-[#B4BBA9] transition-colors hover:border-[#D5B46A]/55 hover:text-[#F1EAD8] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#D5B46A]"
            >
              Return to campus
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}

function PlayerIdentityProfile() {
  const {
    identity,
    local,
    identityLoading,
    localChecked,
    claiming,
    claimError,
    localConflict,
    retryClaim,
    saveAppearance,
  } = usePlayerIdentity();

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<CharacterSettings>(
    identity?.appearance ?? local?.character ?? DEFAULT_CHARACTER,
  );
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedNotice, setSavedNotice] = useState(false);
  const editorRef = useRef<HTMLDivElement>(null);

  const houseId: HouseId | null =
    identity && isHouseId(identity.houseId)
      ? identity.houseId
      : local?.profile.houseId ?? null;
  const house = houseId ? getHouse(houseId) : undefined;
  const characterId = identity?.characterId ?? local?.profile.characterId ?? null;
  const student = getStudent(characterId);
  const displayName = identity?.displayName ?? student?.displayName ?? local?.profile.characterName;
  const playerId = identity?.playerId ?? local?.profile.playerId ?? null;
  const xp = identity?.xp ?? local?.profile.xp ?? 0;
  const level = identity?.level ?? xpProgress(xp).level;
  const progress = xpProgress(xp);
  const achievements = identity?.achievements ?? [];
  const achievementIds = useMemo(
    () => new Set(achievements.map((entry) => entry.id)),
    [achievements],
  );
  const achievementDates = useMemo(
    () => new Map(achievements.map((entry) => [entry.id, entry.unlockedAt])),
    [achievements],
  );
  const standing = house ? standingsForHouse(house.id) : undefined;
  const appearance = editing ? draft : identity?.appearance ?? local?.character ?? DEFAULT_CHARACTER;

  useEffect(() => {
    setDraft(identity?.appearance ?? local?.character ?? DEFAULT_CHARACTER);
  }, [identity?.appearance, identity?.updatedAt, local?.character]);

  useEffect(() => {
    if (!savedNotice) return;
    const timer = window.setTimeout(() => setSavedNotice(false), 3200);
    return () => window.clearTimeout(timer);
  }, [savedNotice]);

  const openEditor = () => {
    setDraft(identity?.appearance ?? local?.character ?? DEFAULT_CHARACTER);
    setEditing(true);
    setSaveError(null);
    window.setTimeout(() => {
      editorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 40);
  };

  const handleSave = async () => {
    if (!identity) {
      setSaveError("Your account identity is still syncing. Try again in a moment.");
      return;
    }
    setSaving(true);
    setSaveError(null);
    const result = await saveAppearance(draft);
    setSaving(false);
    if (result.ok) {
      setEditing(false);
      setSavedNotice(true);
    } else {
      setSaveError(result.error);
    }
  };

  if (!localChecked || identityLoading) {
    return (
      <main className="flex min-h-[100dvh] items-center justify-center bg-[#0B1511] px-5 text-[#F1EAD8]">
        <div className="text-center">
          <Loader2 className="mx-auto h-6 w-6 animate-spin text-[#D5B46A]" aria-hidden="true" />
          <p className="mt-5 font-ui text-[9px] uppercase tracking-[0.26em] text-[#D5B46A]">
            Loading player identity
          </p>
          <p className="mt-2 font-display text-2xl">Opening your student file…</p>
        </div>
      </main>
    );
  }

  if (!house || !student) {
    return <NoHouseProfile name={displayName ?? null} playerId={playerId} />;
  }

  const houseColor = house.color;
  const ink = houseInkColor(house.color);
  const initials = initialsFor(displayName ?? student.displayName);
  const missionsCompleted = local?.data.mission.completed.length ?? 0;
  const campusDiscovered = local?.data.exploration.discovered.length ?? 0;
  const unlockedCount = achievements.length;
  const continueHref = local ? "/play?intent=continue" : "/play";
  const recentXp = [...(identity?.xpHistory ?? [])].reverse().slice(0, 5);
  const categoryCounts = CATEGORY_META.map((category) => {
    const items = ACHIEVEMENTS.filter(
      (achievement) => ACHIEVEMENT_CATEGORY[achievement.id] === category.id,
    );
    const unlocked = items.filter((achievement) => achievementIds.has(achievement.id)).length;
    return { ...category, unlocked, total: items.length };
  });

  return (
    <div className="min-h-[100dvh] overflow-x-clip bg-[#0B1511] text-[#F1EAD8]">
      <div
        className="pointer-events-none fixed inset-0 opacity-70"
        style={{
          background: `radial-gradient(70% 55% at 12% 0%, ${houseColor}25, transparent 62%), radial-gradient(60% 55% at 92% 20%, rgba(213,180,106,0.08), transparent 64%)`,
        }}
        aria-hidden="true"
      />

      <header className="relative border-b border-[#F1EAD8]/10 bg-[#0B1511]/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1240px] items-center justify-between gap-4 px-5 py-4 sm:px-8">
          <Link
            to="/"
            className="inline-flex items-center gap-2 font-ui text-[9px] uppercase tracking-[0.2em] text-[#B4BBA9] transition-colors hover:text-[#F1EAD8] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#D5B46A]"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" /> Back to campus
          </Link>
          <span className="flex items-center gap-2 font-ui text-[8px] uppercase tracking-[0.22em] text-[#B4BBA9]/55">
            <span className="h-1.5 w-1.5 rounded-full bg-[#7FAE84]" aria-hidden="true" />
            Player Identity System 1.0
          </span>
        </div>
      </header>

      <main className="relative mx-auto max-w-[1240px] px-5 pb-16 pt-7 sm:px-8 sm:pt-10">
        <section className="border border-[#F1EAD8]/11 bg-[#14231B]/82 p-5 shadow-[0_40px_120px_-65px_rgba(0,0,0,1)] backdrop-blur-md sm:p-7">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 items-center gap-4 sm:gap-5">
              <div className="relative flex size-[72px] shrink-0 items-center justify-center rounded-full border bg-[#0B1511]/70 sm:size-[86px]">
                <span
                  className="absolute inset-0 rounded-full border"
                  style={{ borderColor: `${houseColor}AA` }}
                  aria-hidden="true"
                />
                <span
                  className="absolute inset-1.5 rounded-full opacity-30"
                  style={{ backgroundColor: houseColor }}
                  aria-hidden="true"
                />
                <span className="relative font-display text-[30px] tracking-[0.03em] text-[#F1EAD8] sm:text-[36px]">
                  {initials}
                </span>
                <HouseEmblem
                  houseId={house.id}
                  size={30}
                  className="absolute -bottom-1 -right-1 drop-shadow-[0_6px_14px_rgba(0,0,0,0.5)]"
                />
              </div>

              <div className="min-w-0">
                <p className="font-ui text-[8.5px] uppercase tracking-[0.24em] text-[#D5B46A]">
                  {house.name} · Student identity
                </p>
                <h1 className="mt-1.5 truncate font-display text-[clamp(2rem,5vw,3.7rem)] leading-[0.96] text-[#F1EAD8]">
                  {displayName}
                </h1>
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 font-ui text-[9px] uppercase tracking-[0.15em] text-[#B4BBA9]/70">
                  <span>{student.id}</span>
                  <span className="h-0.5 w-0.5 rounded-full bg-[#B4BBA9]/40" aria-hidden="true" />
                  <span>Class {identity?.className ?? student.className}</span>
                  <span className="h-0.5 w-0.5 rounded-full bg-[#B4BBA9]/40" aria-hidden="true" />
                  <span className="break-all">ID · {playerId ?? "Syncing"}</span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span
                className="inline-flex items-center gap-2 border px-3 py-2 font-ui text-[8px] uppercase tracking-[0.2em]"
                style={{ borderColor: `${houseColor}75`, color: "#F1EAD8" }}
              >
                <span
                  className="flex size-5 items-center justify-center font-display text-[11px]"
                  style={{ backgroundColor: houseColor, color: ink }}
                  aria-hidden="true"
                >
                  {house.shortName[0]}
                </span>
                {house.shortName} House
              </span>
              <button
                type="button"
                onClick={openEditor}
                className="inline-flex min-h-10 items-center gap-2 border border-[#F1EAD8]/14 px-3 font-ui text-[8px] uppercase tracking-[0.18em] text-[#B4BBA9] transition-colors hover:border-[#D5B46A]/55 hover:text-[#F1EAD8] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D5B46A]"
              >
                <Settings className="h-3.5 w-3.5" aria-hidden="true" /> Profile settings
              </button>
            </div>
          </div>

          <div className="mt-5 flex flex-col gap-2 border-t border-[#F1EAD8]/10 pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="font-ui text-[10px] uppercase tracking-[0.2em] text-[#D5B46A]">
              {localConflict
                ? "Account identity differs from this device save"
                : `Proud member of ${house.name}`}
            </p>
            <p className="font-ui text-[8px] uppercase tracking-[0.16em] text-[#B4BBA9]/42">
              House assignment is permanent · Never randomly assigned
            </p>
          </div>
        </section>

        {claimError && (
          <div
            role="alert"
            className="mt-4 flex flex-col gap-3 border border-[#E1A18F]/30 bg-[#E1A18F]/7 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <p className="font-ui text-[10px] leading-5 text-[#E9B9AA]">
              Identity sync failed: {claimError}
            </p>
            <button
              type="button"
              onClick={retryClaim}
              className="inline-flex shrink-0 items-center gap-2 border border-[#E1A18F]/35 px-3 py-2 font-ui text-[8px] uppercase tracking-[0.18em] text-[#E9B9AA] transition-colors hover:bg-[#E1A18F]/10"
            >
              <RotateCcw className="h-3 w-3" aria-hidden="true" /> Retry
            </button>
          </div>
        )}

        {claiming && (
          <p className="mt-3 flex items-center gap-2 font-ui text-[9px] uppercase tracking-[0.18em] text-[#B4BBA9]/55">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-[#D5B46A]" aria-hidden="true" />
            Linking your existing campus save to this account
          </p>
        )}

        {savedNotice && (
          <p
            role="status"
            className="mt-4 flex items-center gap-2 border border-[#7FAE84]/30 bg-[#7FAE84]/7 px-4 py-3 font-ui text-[10px] text-[#C9E0CC]"
          >
            <Check className="h-3.5 w-3.5" aria-hidden="true" /> Appearance saved to your account
            and this device.
          </p>
        )}

        <div className="mt-5 grid gap-5 lg:grid-cols-[0.78fr_1.22fr]">
          <section className="min-w-0">
            <div className="relative overflow-hidden border border-[#F1EAD8]/11 bg-[#101B16] p-4 sm:p-5 lg:sticky lg:top-5">
              <div
                className="pointer-events-none absolute inset-x-0 top-0 h-28 opacity-40"
                style={{
                  background: `radial-gradient(60% 100% at 50% 0%, ${houseColor}55, transparent 75%)`,
                }}
                aria-hidden="true"
              />
              <div className="relative flex items-center justify-between gap-3">
                <div>
                  <p className="font-ui text-[8px] uppercase tracking-[0.22em] text-[#D5B46A]">
                    Main character
                  </p>
                  <p className="mt-1 font-display text-xl text-[#F1EAD8]">{student.displayName}</p>
                </div>
                <span className="border border-[#F1EAD8]/12 px-2 py-1 font-ui text-[7px] uppercase tracking-[0.16em] text-[#B4BBA9]/55">
                  Live 3D
                </span>
              </div>

              {editing ? (
                <div className="mt-4 flex aspect-[4/5] w-full flex-col items-center justify-center border border-[#F1EAD8]/10 bg-[radial-gradient(65%_60%_at_50%_35%,#29372b_0%,#111610_65%,#090c09_100%)] px-6 text-center">
                  <HouseEmblem houseId={house.id} size={58} />
                  <p className="mt-5 font-display text-2xl text-[#F1EAD8]">Live preview below</p>
                  <p className="mt-2 max-w-[240px] font-ui text-[9px] leading-5 text-[#B4BBA9]/55">
                    The customization studio is using a single 3D renderer to keep this smooth on
                    mobile.
                  </p>
                  <button
                    type="button"
                    onClick={() =>
                      editorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
                    }
                    className="mt-4 inline-flex min-h-9 items-center gap-2 border border-[#D5B46A]/35 px-3 font-ui text-[8px] uppercase tracking-[0.16em] text-[#D5B46A]"
                  >
                    Back to customizer <ArrowRight className="h-3 w-3" aria-hidden="true" />
                  </button>
                </div>
              ) : (
                <CharacterPreview3D
                  character={appearance}
                  houseColor={houseColor}
                  className="mt-4 aspect-[4/5] w-full border-[#F1EAD8]/10"
                />
              )}

              <div className="mt-3 flex items-center justify-between gap-3 border border-[#F1EAD8]/10 bg-[#0B1511]/40 px-3.5 py-3">
                <div className="flex items-center gap-2.5">
                  <HouseEmblem houseId={house.id} size={26} />
                  <div>
                    <p className="font-ui text-[8px] uppercase tracking-[0.18em] text-[#B4BBA9]/50">
                      House uniform
                    </p>
                    <p className="mt-0.5 font-display text-sm" style={{ color: houseColor }}>
                      {house.shortName} colours
                    </p>
                  </div>
                </div>
                <p className="max-w-[150px] text-right font-ui text-[8px] leading-4 text-[#B4BBA9]/48">
                  White shirt · navy trousers · striped tie · black shoes
                </p>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={openEditor}
                  className="inline-flex min-h-11 items-center justify-center gap-2 border border-[#D5B46A]/55 px-3 font-ui text-[8px] uppercase tracking-[0.18em] text-[#D5B46A] transition-colors hover:bg-[#D5B46A]/8 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D5B46A]"
                >
                  <Pencil className="h-3.5 w-3.5" aria-hidden="true" /> Customize
                </button>
                <Link
                  to={continueHref}
                  className="inline-flex min-h-11 items-center justify-center gap-2 border border-[#D5B46A] bg-[#D5B46A] px-3 font-ui text-[8px] font-semibold uppercase tracking-[0.18em] text-[#0B1511] transition-colors hover:bg-[#E7CD94] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F1EAD8]"
                >
                  Campus <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                </Link>
              </div>
            </div>
          </section>

          <div className="min-w-0 space-y-5">
            <section className="border border-[#F1EAD8]/11 bg-[#14231B]/80 p-5 sm:p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-ui text-[8px] uppercase tracking-[0.22em] text-[#D5B46A]">
                    Player information
                  </p>
                  <h2 className="mt-1 font-display text-3xl text-[#F1EAD8]">Student file</h2>
                </div>
                <UserRound className="h-5 w-5 text-[#D5B46A]/65" aria-hidden="true" />
              </div>

              <dl className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3">
                {[
                  { label: "Class", value: identity?.className ?? student.className },
                  { label: "Section", value: identity?.section ?? student.section ?? "—" },
                  { label: "Hostel", value: house.hostelName },
                  {
                    label: "Room",
                    value: identity?.roomNumber ?? "Not assigned",
                  },
                  { label: "Level", value: String(level) },
                  { label: "Total XP", value: String(xp) },
                ].map((item) => (
                  <div key={item.label} className="border border-[#F1EAD8]/9 bg-[#0B1511]/40 p-3">
                    <dt className="font-ui text-[7.5px] uppercase tracking-[0.18em] text-[#B4BBA9]/50">
                      {item.label}
                    </dt>
                    <dd className="mt-1 truncate font-display text-base text-[#F1EAD8]/90">
                      {item.value}
                    </dd>
                  </div>
                ))}
              </dl>

              <div className="mt-5">
                <div className="flex items-center justify-between gap-3 font-ui text-[8px] uppercase tracking-[0.18em] text-[#B4BBA9]/55">
                  <span>Level {level}</span>
                  <span>{progress.toNext} XP to level {level + 1}</span>
                </div>
                <div
                  className="mt-2 h-1.5 overflow-hidden bg-[#F1EAD8]/10"
                  role="progressbar"
                  aria-label={`${displayName}'s level progress`}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={progress.percent}
                >
                  <div
                    className="h-full transition-[width] duration-500"
                    style={{ width: `${progress.percent}%`, backgroundColor: houseColor }}
                  />
                </div>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
                <SummaryCard
                  label="Missions"
                  value={`${missionsCompleted}/${MISSION_STEPS.length}`}
                  detail="Orientation route"
                />
                <SummaryCard
                  label="Achievements"
                  value={`${unlockedCount}/${ACHIEVEMENTS.length}`}
                  detail="Verified by account"
                />
                <SummaryCard
                  label="Campus"
                  value={`${campusDiscovered}/${CAMPUS_LOCATIONS.length}`}
                  detail="Named places"
                />
                <SummaryCard
                  label="House Cup"
                  value={standing ? `#${standing.rank}` : "—"}
                  detail={standing ? `${standing.points} points` : "No verified table"}
                />
              </div>
            </section>

            <section className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              <button
                type="button"
                onClick={openEditor}
                className="group flex min-h-16 items-center gap-3 border border-[#F1EAD8]/11 bg-[#14231B]/75 px-4 text-left transition-colors hover:border-[#D5B46A]/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D5B46A]"
              >
                <Sparkles className="h-4 w-4 text-[#D5B46A]" aria-hidden="true" />
                <span>
                  <span className="block font-display text-base text-[#F1EAD8]">Edit profile</span>
                  <span className="mt-0.5 block font-ui text-[8px] uppercase tracking-[0.15em] text-[#B4BBA9]/50">
                    Appearance & identity
                  </span>
                </span>
              </button>
              <button
                type="button"
                onClick={openEditor}
                className="group flex min-h-16 items-center gap-3 border border-[#F1EAD8]/11 bg-[#14231B]/75 px-4 text-left transition-colors hover:border-[#D5B46A]/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D5B46A]"
              >
                <UserRound className="h-4 w-4 text-[#D5B46A]" aria-hidden="true" />
                <span>
                  <span className="block font-display text-base text-[#F1EAD8]">
                    Customize character
                  </span>
                  <span className="mt-0.5 block font-ui text-[8px] uppercase tracking-[0.15em] text-[#B4BBA9]/50">
                    Face · hair · accessories
                  </span>
                </span>
              </button>
              <button
                type="button"
                onClick={() =>
                  document
                    .getElementById("achievements")
                    ?.scrollIntoView({ behavior: "smooth", block: "start" })
                }
                className="group flex min-h-16 items-center gap-3 border border-[#F1EAD8]/11 bg-[#14231B]/75 px-4 text-left transition-colors hover:border-[#D5B46A]/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D5B46A]"
              >
                <Trophy className="h-4 w-4 text-[#D5B46A]" aria-hidden="true" />
                <span>
                  <span className="block font-display text-base text-[#F1EAD8]">
                    View achievements
                  </span>
                  <span className="mt-0.5 block font-ui text-[8px] uppercase tracking-[0.15em] text-[#B4BBA9]/50">
                    Verified campus record
                  </span>
                </span>
              </button>
              <Link
                to="/play"
                className="group flex min-h-16 items-center gap-3 border border-[#F1EAD8]/11 bg-[#14231B]/75 px-4 text-left transition-colors hover:border-[#D5B46A]/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D5B46A]"
              >
                <Home className="h-4 w-4 text-[#D5B46A]" aria-hidden="true" />
                <span>
                  <span className="block font-display text-base text-[#F1EAD8]">
                    Return to campus
                  </span>
                  <span className="mt-0.5 block font-ui text-[8px] uppercase tracking-[0.15em] text-[#B4BBA9]/50">
                    Existing save preserved
                  </span>
                </span>
              </Link>
            </section>

            <section id="achievements" className="scroll-mt-5 border border-[#F1EAD8]/11 bg-[#14231B]/80 p-5 sm:p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-ui text-[8px] uppercase tracking-[0.22em] text-[#D5B46A]">
                    Achievements
                  </p>
                  <h2 className="mt-1 font-display text-3xl text-[#F1EAD8]">Campus record</h2>
                </div>
                <Trophy className="h-5 w-5 text-[#D5B46A]/65" aria-hidden="true" />
              </div>

              <div className="mt-4 flex flex-wrap gap-1.5">
                {categoryCounts.map((category) => (
                  <span
                    key={category.id}
                    className="border border-[#F1EAD8]/10 bg-[#0B1511]/35 px-2.5 py-1.5 font-ui text-[7.5px] uppercase tracking-[0.14em] text-[#B4BBA9]/65"
                  >
                    {category.label} · {category.unlocked}/{category.total}
                  </span>
                ))}
              </div>

              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                {ACHIEVEMENTS.map((achievement) => {
                  const unlocked = achievementIds.has(achievement.id);
                  const unlockedAt = achievementDates.get(achievement.id);
                  return (
                    <div
                      key={achievement.id}
                      className={`flex gap-3 border p-3 ${
                        unlocked
                          ? "border-[#D5B46A]/25 bg-[#D5B46A]/[0.055]"
                          : "border-[#F1EAD8]/8 bg-[#0B1511]/30"
                      }`}
                    >
                      <span
                        className={`mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full border ${
                          unlocked
                            ? "border-[#D5B46A]/45 text-[#D5B46A]"
                            : "border-[#F1EAD8]/12 text-[#B4BBA9]/35"
                        }`}
                      >
                        {unlocked ? (
                          <Check className="h-3.5 w-3.5" aria-hidden="true" />
                        ) : (
                          <Lock className="h-3 w-3" aria-hidden="true" />
                        )}
                      </span>
                      <div className="min-w-0">
                        <p className="font-display text-sm leading-tight text-[#F1EAD8]/85">
                          {achievement.name}
                        </p>
                        <p className="mt-1 font-ui text-[9px] leading-4 text-[#B4BBA9]/50">
                          {achievement.description}
                        </p>
                        <p className="mt-1 font-ui text-[7px] uppercase tracking-[0.15em] text-[#B4BBA9]/32">
                          {unlocked && unlockedAt
                            ? `Unlocked ${formatDate(unlockedAt)}`
                            : "Not yet verified"}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
              {!identity && (
                <p className="mt-3 font-ui text-[9px] leading-5 text-[#B4BBA9]/45">
                  Achievements remain locked until the account identity finishes syncing.
                </p>
              )}
            </section>

            <section className="border border-[#F1EAD8]/11 bg-[#14231B]/80 p-5 sm:p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-ui text-[8px] uppercase tracking-[0.22em] text-[#D5B46A]">
                    XP history
                  </p>
                  <h2 className="mt-1 font-display text-3xl text-[#F1EAD8]">Verified milestones</h2>
                </div>
                <Trophy className="h-5 w-5 text-[#D5B46A]/65" aria-hidden="true" />
              </div>
              {recentXp.length ? (
                <div className="mt-4 space-y-0">
                  {recentXp.map((entry, index) => (
                    <div
                      key={`${entry.kind}:${entry.at}:${index}`}
                      className="flex items-center justify-between gap-3 border-b border-[#F1EAD8]/8 py-2.5 last:border-0"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-display text-sm text-[#F1EAD8]/80">
                          {entry.label}
                        </p>
                        <p className="font-ui text-[7px] uppercase tracking-[0.14em] text-[#B4BBA9]/35">
                          {formatDate(entry.at)}
                        </p>
                      </div>
                      <span className="shrink-0 font-display text-sm text-[#D5B46A]">
                        +{entry.xp} XP
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-4 border border-[#F1EAD8]/8 bg-[#0B1511]/30 p-3 font-ui text-[10px] text-[#B4BBA9]/45">
                  XP is recorded only when a verified achievement unlocks. Opening this page never
                  awards XP.
                </p>
              )}
            </section>

            <section className="border border-[#F1EAD8]/11 bg-[#14231B]/80 p-5 sm:p-6">
              <div className="flex items-start gap-3">
                <Shield className="mt-0.5 h-4 w-4 shrink-0 text-[#D5B46A]" aria-hidden="true" />
                <div>
                  <p className="font-display text-lg text-[#F1EAD8]">House identity is permanent</p>
                  <p className="mt-1.5 font-ui text-[10px] leading-5 text-[#B4BBA9]/55">
                    Your house, hostel, HUD badge, House Cup table and achievements all read from
                    the same account assignment. The customization screen only changes appearance;
                    it cannot move you to another house.
                  </p>
                </div>
              </div>
            </section>
          </div>
        </div>

        {editing && (
          <section
            ref={editorRef}
            id="character-customizer"
            className="mt-5 scroll-mt-5 border border-[#D5B46A]/25 bg-[#14231B] p-5 shadow-[0_40px_100px_-60px_rgba(0,0,0,1)] sm:p-7"
            aria-label="Character customization"
          >
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#F1EAD8]/10 pb-4">
              <div>
                <p className="font-ui text-[8px] uppercase tracking-[0.22em] text-[#D5B46A]">
                  Character customization
                </p>
                <h2 className="mt-1 font-display text-3xl text-[#F1EAD8]">Make the uniform yours.</h2>
                <p className="mt-2 max-w-2xl font-ui text-[10px] leading-5 text-[#B4BBA9]/55">
                  Real-time preview uses the existing NAVODAYA student rig. The uniform itself stays
                  standard; face, hair, skin, build and approved accessories are yours.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setEditing(false);
                  setSaveError(null);
                }}
                aria-label="Cancel customization"
                className="flex size-9 items-center justify-center border border-[#F1EAD8]/14 text-[#B4BBA9] transition-colors hover:border-[#F1EAD8]/35 hover:text-[#F1EAD8] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D5B46A]"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            <div className="mt-5 grid gap-6 lg:grid-cols-[0.72fr_1.28fr]">
              <div>
                <CharacterPreview3D
                  character={draft}
                  houseColor={houseColor}
                  className="aspect-[4/5] w-full border-[#F1EAD8]/10"
                />
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setDraft(DEFAULT_CHARACTER)}
                    className="inline-flex min-h-10 items-center gap-2 border border-[#F1EAD8]/14 px-3 font-ui text-[8px] uppercase tracking-[0.16em] text-[#B4BBA9] transition-colors hover:border-[#D5B46A]/50 hover:text-[#F1EAD8] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D5B46A]"
                  >
                    <RotateCcw className="h-3 w-3" aria-hidden="true" /> Reset appearance
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setDraft(identity?.appearance ?? local?.character ?? DEFAULT_CHARACTER);
                      setEditing(false);
                      setSaveError(null);
                    }}
                    className="inline-flex min-h-10 items-center gap-2 border border-[#F1EAD8]/14 px-3 font-ui text-[8px] uppercase tracking-[0.16em] text-[#B4BBA9] transition-colors hover:border-[#D5B46A]/50 hover:text-[#F1EAD8] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D5B46A]"
                  >
                    <X className="h-3 w-3" aria-hidden="true" /> Cancel
                  </button>
                </div>
              </div>

              <div className="space-y-5">
                <div>
                  <p className="font-ui text-[8px] uppercase tracking-[0.2em] text-[#D5B46A]">
                    Face
                  </p>
                  <div className="mt-2 grid gap-3 sm:grid-cols-2">
                    <OptionGroup
                      label="Face shape"
                      value={draft.face}
                      options={[
                        { value: "oval", label: "Oval" },
                        { value: "round", label: "Round" },
                        { value: "square", label: "Square" },
                      ]}
                      onChange={(value) =>
                        setDraft((current) => ({
                          ...current,
                          face: value as CharacterSettings["face"],
                        }))
                      }
                    />
                    <OptionGroup
                      label="Skin tone"
                      value={String(draft.skin)}
                      options={[
                        { value: "0", label: "Tone 1" },
                        { value: "1", label: "Tone 2" },
                        { value: "2", label: "Tone 3" },
                        { value: "3", label: "Tone 4" },
                      ]}
                      onChange={(value) =>
                        setDraft((current) => ({
                          ...current,
                          skin: Number(value) as CharacterSettings["skin"],
                        }))
                      }
                    />
                    <OptionGroup
                      label="Eyes"
                      value={draft.eyeColor}
                      options={[
                        { value: "brown", label: "Brown" },
                        { value: "dark", label: "Dark" },
                        { value: "hazel", label: "Hazel" },
                      ]}
                      onChange={(value) =>
                        setDraft((current) => ({
                          ...current,
                          eyeColor: value as CharacterSettings["eyeColor"],
                        }))
                      }
                    />
                    <OptionGroup
                      label="Eyebrows"
                      value={draft.brows}
                      options={[
                        { value: "straight", label: "Straight" },
                        { value: "soft", label: "Soft" },
                        { value: "bold", label: "Bold" },
                      ]}
                      onChange={(value) =>
                        setDraft((current) => ({
                          ...current,
                          brows: value as CharacterSettings["brows"],
                        }))
                      }
                    />
                  </div>
                </div>

                <div className="border-t border-[#F1EAD8]/9 pt-4">
                  <p className="font-ui text-[8px] uppercase tracking-[0.2em] text-[#D5B46A]">
                    Hair & body
                  </p>
                  <div className="mt-2 grid gap-3 sm:grid-cols-2">
                    <OptionGroup
                      label="Hairstyle"
                      value={draft.hairStyle}
                      options={[
                        { value: "short", label: "Short" },
                        { value: "side", label: "Side part" },
                        { value: "curly", label: "Curly" },
                        { value: "bun", label: "Bun" },
                        { value: "braid", label: "Braid" },
                      ]}
                      onChange={(value) =>
                        setDraft((current) => ({
                          ...current,
                          hairStyle: value as CharacterSettings["hairStyle"],
                        }))
                      }
                    />
                    <OptionGroup
                      label="Hair colour"
                      value={draft.hairColor}
                      options={[
                        { value: "black", label: "Black" },
                        { value: "brown", label: "Brown" },
                        { value: "soft", label: "Soft black" },
                      ]}
                      onChange={(value) =>
                        setDraft((current) => ({
                          ...current,
                          hairColor: value as CharacterSettings["hairColor"],
                        }))
                      }
                    />
                    <OptionGroup
                      label="Build"
                      value={draft.build}
                      options={[
                        { value: "slim", label: "Slim" },
                        { value: "regular", label: "Regular" },
                        { value: "broad", label: "Broad" },
                      ]}
                      onChange={(value) =>
                        setDraft((current) => ({
                          ...current,
                          build: value as CharacterSettings["build"],
                        }))
                      }
                    />
                    <div>
                      <p className="font-ui text-[9px] uppercase tracking-[0.2em] text-[#B4BBA9]/70">
                        Uniform
                      </p>
                      <div className="mt-2 flex min-h-9 items-center gap-2 border border-[#F1EAD8]/10 bg-[#0B1511]/30 px-3">
                        <span
                          className="h-3 w-3 rounded-full"
                          style={{ backgroundColor: houseColor }}
                          aria-hidden="true"
                        />
                        <span className="font-ui text-[9px] uppercase tracking-[0.15em] text-[#B4BBA9]">
                          {house.shortName} house colours
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="border-t border-[#F1EAD8]/9 pt-4">
                  <p className="font-ui text-[8px] uppercase tracking-[0.2em] text-[#D5B46A]">
                    Accessories
                  </p>
                  <div className="mt-2 grid gap-3 sm:grid-cols-3">
                    <OptionGroup
                      label="Glasses"
                      value={draft.glasses}
                      options={[
                        { value: "none", label: "None" },
                        { value: "round", label: "Round" },
                        { value: "rect", label: "Rect" },
                      ]}
                      onChange={(value) =>
                        setDraft((current) => ({
                          ...current,
                          glasses: value as CharacterSettings["glasses"],
                        }))
                      }
                    />
                    <OptionGroup
                      label="Watch"
                      value={draft.watch}
                      options={[
                        { value: "none", label: "None" },
                        { value: "steel", label: "Steel" },
                        { value: "black", label: "Black" },
                      ]}
                      onChange={(value) =>
                        setDraft((current) => ({
                          ...current,
                          watch: value as CharacterSettings["watch"],
                        }))
                      }
                    />
                    <OptionGroup
                      label="Backpack"
                      value={draft.backpack}
                      options={[
                        { value: "none", label: "None" },
                        { value: "navy", label: "Navy" },
                        { value: "olive", label: "Olive" },
                      ]}
                      onChange={(value) =>
                        setDraft((current) => ({
                          ...current,
                          backpack: value as CharacterSettings["backpack"],
                        }))
                      }
                    />
                  </div>
                </div>

                {saveError && (
                  <p role="alert" className="border border-[#E1A18F]/30 bg-[#E1A18F]/7 px-4 py-3 font-ui text-[10px] leading-5 text-[#E9B9AA]">
                    {saveError}
                  </p>
                )}

                <div className="flex flex-col gap-2 border-t border-[#F1EAD8]/9 pt-4 sm:flex-row sm:items-center sm:justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      setDraft(identity?.appearance ?? local?.character ?? DEFAULT_CHARACTER);
                      setEditing(false);
                      setSaveError(null);
                    }}
                    className="inline-flex min-h-11 items-center justify-center gap-2 border border-[#F1EAD8]/14 px-4 font-ui text-[8px] uppercase tracking-[0.18em] text-[#B4BBA9] transition-colors hover:border-[#F1EAD8]/35 hover:text-[#F1EAD8] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D5B46A]"
                  >
                    <X className="h-3.5 w-3.5" aria-hidden="true" /> Cancel changes
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleSave()}
                    disabled={saving || !identity}
                    className="inline-flex min-h-11 items-center justify-center gap-2 border border-[#D5B46A] bg-[#D5B46A] px-5 font-ui text-[8px] font-semibold uppercase tracking-[0.2em] text-[#0B1511] transition-colors hover:bg-[#E7CD94] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F1EAD8] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {saving ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                    ) : (
                      <Save className="h-3.5 w-3.5" aria-hidden="true" />
                    )}
                    {saving ? "Saving appearance" : "Save appearance"}
                  </button>
                </div>
              </div>
            </div>
          </section>
        )}

        <footer className="mt-5 flex flex-col gap-2 border-t border-[#F1EAD8]/9 pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="font-ui text-[8px] uppercase tracking-[0.16em] text-[#B4BBA9]/32">
            Existing game progress remains in the NAVODAYA save on this device
          </p>
          <p className="flex items-center gap-1.5 font-ui text-[8px] uppercase tracking-[0.16em] text-[#B4BBA9]/32">
            <MapPin className="h-3 w-3" aria-hidden="true" /> JNV campus story · Player identity
            1.0
          </p>
        </footer>
      </main>
    </div>
  );
}

export default function ProfilePage() {
  return (
    <RequireAuth
      title="Sign in to your player identity"
      description="Your house, student, appearance and verified achievements are linked to your NAVODAYA account."
    >
      <PlayerIdentityProfile />
    </RequireAuth>
  );
}
