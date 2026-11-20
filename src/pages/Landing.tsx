import {
  ArrowRight,
  Check,
  Compass,
  Loader2,
  LogOut,
  Menu,
  ShieldCheck,
  Users,
  X,
  BookOpen,
} from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, useLocation } from "react-router";
import { xpProgress } from "@/game/data/achievements";
import { getHouse, HOUSES, isHouseId, type HouseId } from "@/game/data/houses";
import { HouseEmblem } from "@/game/ui/HouseVisuals";
import { useAuth } from "@/hooks/use-auth";
import { usePlayerIdentity } from "@/identity/PlayerIdentityProvider";

const NAV_ITEMS = [
  { label: "Houses", href: "#houses" },
  { label: "Experience", href: "#experience" },
  { label: "About", href: "#about" },
] as const;

const HOUSE_COLOUR_NAMES: Record<HouseId, string> = {
  aravali: "Blue",
  nilgiri: "Green",
  shivalik: "Red",
  udaygiri: "Yellow",
};

const EXPERIENCE_ITEMS = [
  {
    number: "01",
    title: "Explore Campus",
    description: "Move through classrooms, hostels, grounds and campus spaces.",
    icon: Compass,
  },
  {
    number: "02",
    title: "Meet People",
    description: "Interact with students, teachers and NPCs.",
    icon: Users,
  },
  {
    number: "03",
    title: "Write Your Story",
    description: "Complete missions, represent your house and create memories.",
    icon: BookOpen,
  },
] as const;

type PlayerSnapshot = {
  name: string;
  initials: string;
  className: string;
  houseId: HouseId;
  houseName: string;
  houseColor: string;
  level: number;
  xp: number;
  percent: number;
};

const SIGN_IN_HREF = `/auth?returnTo=${encodeURIComponent("/?welcome=1")}`;

function CampusCrest({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 48 56"
      className={className}
      role="img"
      aria-label="Navodaya campus crest"
    >
      <path
        d="M24 2.5 43.5 9.8v14.3c0 13.1-8.1 21.7-19.5 27.1C12.6 45.8 4.5 37.2 4.5 24.1V9.8Z"
        fill="#101B16"
        stroke="#D5B46A"
        strokeWidth="1.4"
      />
      <path
        d="M24 6.2 40 12.3v11.8c0 11.2-6.7 18.7-16 23.4-9.3-4.7-16-12.2-16-23.4V12.3Z"
        fill="none"
        stroke="#D5B46A"
        strokeOpacity="0.35"
        strokeWidth="0.8"
      />
      <path d="M12.8 34.5 20.6 20l4.8 7.3 4-4.6 6.4 11.8Z" fill="#D5B46A" fillOpacity="0.9" />
      <path d="M20.6 20 24.5 26.3 20.6 24.7 17.6 27.4Z" fill="#0B1511" fillOpacity="0.55" />
      <circle cx="24" cy="12.2" r="1.8" fill="#F1EAD8" />
      <path d="M24 15v4M22 17h4" stroke="#D5B46A" strokeWidth="0.9" strokeLinecap="round" />
    </svg>
  );
}

function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <p className="font-ui text-[10px] font-medium uppercase tracking-[0.32em] text-[#D5B46A]">
      {children}
    </p>
  );
}

function GoldButton({
  to,
  children,
  className = "",
}: {
  to: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Link
      to={to}
      className={`group inline-flex min-h-12 items-center justify-center gap-3 border border-[#D5B46A] bg-[#D5B46A] px-6 py-3.5 font-ui text-[10px] font-semibold uppercase tracking-[0.24em] text-[#0B1511] transition-colors duration-200 hover:border-[#E7CD94] hover:bg-[#E7CD94] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#F1EAD8] motion-reduce:transition-none ${className}`}
    >
      {children}
      <ArrowRight
        aria-hidden="true"
        className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-1 motion-reduce:transition-none"
      />
    </Link>
  );
}

function GhostButton({
  to,
  children,
  className = "",
}: {
  to: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Link
      to={to}
      className={`group inline-flex min-h-12 items-center justify-center gap-3 border border-[#F1EAD8]/25 px-6 py-3.5 font-ui text-[10px] font-semibold uppercase tracking-[0.24em] text-[#F1EAD8] transition-colors duration-200 hover:border-[#D5B46A]/70 hover:bg-[#D5B46A]/8 hover:text-[#F1EAD8] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#D5B46A] motion-reduce:transition-none ${className}`}
    >
      {children}
      <ArrowRight
        aria-hidden="true"
        className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-1 motion-reduce:transition-none"
      />
    </Link>
  );
}

function Landing() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [saved, setSaved] = useState<PlayerSnapshot | null>(null);
  const [saveChecked, setSaveChecked] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);
  const playerRef = useRef<HTMLDivElement>(null);
  const { isAuthenticated, isLoading: authLoading, user, signOut } = useAuth();
  const { identity, local, localChecked, identityLoading } = usePlayerIdentity();
  const location = useLocation();
  const welcomeIntent = new URLSearchParams(location.search).get("welcome") === "1";

  const enterHref = saved ? "/play?intent=continue" : "/play";
  const exploreHref = saved ? "/play?intent=tour" : "/play";

  useEffect(() => {
    const houseId =
      identity && isHouseId(identity.houseId)
        ? identity.houseId
        : local?.profile.houseId ?? null;
    const house = houseId ? getHouse(houseId) : undefined;
    const name = identity?.displayName ?? local?.profile.characterName ?? "";
    if (!house || !name) {
      setSaved(null);
      setSaveChecked(localChecked && !identityLoading);
      return;
    }
    const initials =
      name
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase() ?? "")
        .join("") || "N";
    const xp = identity?.xp ?? local?.profile.xp ?? 0;
    const progress = xpProgress(xp);
    setSaved({
      name,
      initials,
      className: identity?.className ?? local?.profile.className ?? "",
      houseId: house.id,
      houseName: house.name,
      houseColor: house.color,
      level: identity?.level ?? progress.level,
      xp,
      percent: progress.percent,
    });
    setSaveChecked(localChecked && !identityLoading);
  }, [identity, local, localChecked, identityLoading]);

  useEffect(() => {
    document.title = "NAVODAYA: THE CAMPUS LIFE";
    const origin = window.location.origin;

    const setMeta = (
      selector: string,
      attribute: "property" | "name",
      key: string,
      value: string,
    ) => {
      let element = document.head.querySelector<HTMLMetaElement>(selector);
      if (!element) {
        element = document.createElement("meta");
        element.setAttribute(attribute, key);
        document.head.appendChild(element);
      }
      element.content = value;
    };

    setMeta('meta[property="og:url"]', "property", "og:url", `${origin}/`);
    setMeta('meta[property="og:image"]', "property", "og:image", `${origin}/campus/og-cover.jpg`);
    setMeta(
      'meta[property="og:image:secure_url"]',
      "property",
      "og:image:secure_url",
      `${origin}/campus/og-cover.jpg`,
    );
    setMeta('meta[name="twitter:image"]', "name", "twitter:image", `${origin}/campus/og-cover.jpg`);
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [menuOpen]);

  useEffect(() => {
    if (!welcomeIntent || authLoading || !isAuthenticated || !saveChecked) return;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const timer = window.setTimeout(() => {
      playerRef.current?.scrollIntoView({
        behavior: reduceMotion ? "auto" : "smooth",
        block: "center",
      });
    }, 140);
    return () => window.clearTimeout(timer);
  }, [welcomeIntent, authLoading, isAuthenticated, saveChecked]);

  const closeMenu = () => setMenuOpen(false);

  const handleSignOut = async () => {
    setSigningOut(true);
    setSignOutError(null);
    try {
      await signOut();
    } catch {
      setSignOutError("Could not end the session. Please try again.");
    } finally {
      setSigningOut(false);
    }
  };

  return (
    <div className="min-h-screen overflow-x-clip bg-[#0B1511] font-ui text-[#F1EAD8] selection:bg-[#D5B46A]/30">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:border focus:border-[#D5B46A] focus:bg-[#0B1511] focus:px-4 focus:py-3 focus:font-ui focus:text-xs focus:uppercase focus:tracking-[0.2em] focus:text-[#F1EAD8]"
      >
        Skip to content
      </a>

      <header className="sticky top-0 z-50 border-b border-[#F1EAD8]/10 bg-[#0B1511]/92 backdrop-blur-xl">
        <div className="mx-auto flex h-[72px] max-w-[1280px] items-center justify-between gap-3 px-4 sm:px-7 lg:h-[80px]">
          <Link
            to="/"
            className="group flex min-w-0 items-center gap-3 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#D5B46A]"
            aria-label="NAVODAYA: THE CAMPUS LIFE — home"
          >
            <CampusCrest className="h-10 w-9 shrink-0 transition-transform duration-300 group-hover:-translate-y-0.5 motion-reduce:transition-none" />
            <span className="min-w-0 leading-none">
              <span className="block truncate font-display text-[18px] tracking-[0.12em] text-[#F1EAD8] sm:text-[20px]">
                NAVODAYA
              </span>
              <span className="mt-1.5 block font-ui text-[7.5px] uppercase tracking-[0.3em] text-[#B4BBA9] sm:text-[8px]">
                The Campus Life
              </span>
            </span>
          </Link>

          <nav className="hidden items-center gap-9 lg:flex" aria-label="Primary navigation">
            {NAV_ITEMS.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="font-ui text-[10px] uppercase tracking-[0.22em] text-[#B4BBA9] transition-colors hover:text-[#F1EAD8] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#D5B46A]"
              >
                {item.label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-2 sm:gap-4">
            <span
              className="flex items-center gap-2"
              aria-label="Campus system online"
              title="Campus system online"
            >
              <span className="relative flex h-2 w-2" aria-hidden="true">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#7FAE84] opacity-50 motion-reduce:animate-none" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-[#7FAE84]" />
              </span>
              <span className="hidden font-ui text-[8px] uppercase tracking-[0.22em] text-[#B4BBA9] md:inline">
                Campus System Online
              </span>
            </span>

            {isAuthenticated ? (
              <Link
                to="/profile"
                className="inline-flex min-h-10 items-center justify-center border border-[#D5B46A]/60 px-3.5 font-ui text-[9px] font-semibold uppercase tracking-[0.2em] text-[#D5B46A] transition-colors hover:border-[#D5B46A] hover:bg-[#D5B46A]/10 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#D5B46A] sm:px-4"
              >
                Profile
              </Link>
            ) : (
              <Link
                to={SIGN_IN_HREF}
                className="inline-flex min-h-10 items-center justify-center border border-[#D5B46A] bg-[#D5B46A] px-3.5 font-ui text-[9px] font-semibold uppercase tracking-[0.2em] text-[#0B1511] transition-colors hover:border-[#E7CD94] hover:bg-[#E7CD94] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#F1EAD8] sm:px-5"
              >
                Sign In
              </Link>
            )}

            <button
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
              aria-expanded={menuOpen}
              aria-controls="mobile-menu"
              aria-label={menuOpen ? "Close navigation menu" : "Open navigation menu"}
              className="flex h-10 w-10 items-center justify-center border border-[#F1EAD8]/18 text-[#F1EAD8] transition-colors hover:border-[#D5B46A]/60 hover:text-[#D5B46A] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D5B46A] lg:hidden"
            >
              {menuOpen ? <X aria-hidden="true" className="h-4 w-4" /> : <Menu aria-hidden="true" className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <div
          id="mobile-menu"
          className={`overflow-hidden border-[#F1EAD8]/10 bg-[#0B1511] transition-[max-height,opacity] duration-300 ease-out motion-reduce:transition-none lg:hidden ${
            menuOpen ? "max-h-[420px] border-t opacity-100" : "max-h-0 opacity-0"
          }`}
        >
          <nav className="mx-auto max-w-[1280px] px-4 py-4 sm:px-7" aria-label="Mobile navigation">
            {NAV_ITEMS.map((item) => (
              <a
                key={item.href}
                href={item.href}
                onClick={closeMenu}
                className="flex min-h-12 items-center justify-between border-b border-[#F1EAD8]/8 font-ui text-[11px] uppercase tracking-[0.2em] text-[#F1EAD8] transition-colors hover:text-[#D5B46A] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D5B46A]"
              >
                {item.label}
                <ArrowRight aria-hidden="true" className="h-3.5 w-3.5 text-[#D5B46A]" />
              </a>
            ))}
            <Link
              to={isAuthenticated ? "/profile" : SIGN_IN_HREF}
              onClick={closeMenu}
              className="mt-4 flex min-h-12 items-center justify-center border border-[#D5B46A] bg-[#D5B46A] px-5 font-ui text-[9px] font-semibold uppercase tracking-[0.24em] text-[#0B1511]"
            >
              {isAuthenticated ? "View Player Profile" : "Sign In To Get Your House"}
            </Link>
          </nav>
        </div>
      </header>

      <main id="main">
        <section
          id="top"
          className="relative isolate flex min-h-[calc(100svh-72px)] flex-col justify-end overflow-hidden border-b border-[#F1EAD8]/8 bg-[#0B1511]"
        >
          <img
            src="/campus/gate.jpg"
            alt="Illustrative in-game view of the Navodaya campus gate at golden hour."
            className="absolute inset-0 h-full w-full object-cover object-center"
            width={1280}
            height={720}
            fetchPriority="high"
            decoding="async"
          />
          <div className="absolute inset-0 bg-[#06120C]/48" aria-hidden="true" />
          <div
            className="absolute inset-0 bg-[linear-gradient(90deg,rgba(11,21,17,0.96)_0%,rgba(11,21,17,0.82)_42%,rgba(11,21,17,0.28)_76%,rgba(11,21,17,0.52)_100%)]"
            aria-hidden="true"
          />
          <div
            className="absolute inset-0 bg-[radial-gradient(85%_65%_at_20%_45%,rgba(16,27,22,0.15),rgba(11,21,17,0.72)_100%)]"
            aria-hidden="true"
          />
          <div
            className="absolute inset-x-0 top-0 h-40 bg-[linear-gradient(180deg,rgba(11,21,17,0.62),transparent)]"
            aria-hidden="true"
          />
          <div
            className="absolute inset-x-0 bottom-0 h-36 bg-[linear-gradient(180deg,transparent,#0B1511)]"
            aria-hidden="true"
          />

          <div className="relative mx-auto w-full max-w-[1280px] px-5 pb-14 pt-28 sm:px-7 sm:pb-20 lg:pb-24">
            <div className="max-w-[840px]">
              <p className="flex items-center gap-3 font-ui text-[9px] uppercase tracking-[0.34em] text-[#D5B46A]">
                <span className="h-px w-9 bg-[#D5B46A]/70" aria-hidden="true" />
                The Campus Life · Term II
              </p>

              <h1 className="mt-7 font-display text-[clamp(3.5rem,9.4vw,8rem)] font-normal leading-[0.84] tracking-[-0.035em] text-[#F1EAD8]">
                LIFE AT
                <br />
                <span className="text-[#D5B46A]">NAVODAYA.</span>
              </h1>

              <p className="mt-8 max-w-[570px] font-ui text-[14px] leading-7 text-[#E7E4D8] sm:text-[16px] sm:leading-8">
                Every corridor has a story. Every house has a legacy. Step into campus life, build
                your journey, make friends and create memories that stay with you.
              </p>

              <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
                <GoldButton to={enterHref}>ENTER CAMPUS</GoldButton>
                <GhostButton to={exploreHref}>EXPLORE CAMPUS</GhostButton>
              </div>

              <div className="mt-11 flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-[#F1EAD8]/16 pt-5 font-ui text-[8.5px] uppercase tracking-[0.24em] text-[#B4BBA9] sm:text-[9px]">
                <span>Four Houses</span>
                <span className="h-0.5 w-0.5 rounded-full bg-[#D5B46A]" aria-hidden="true" />
                <span>One Campus</span>
                <span className="h-0.5 w-0.5 rounded-full bg-[#D5B46A]" aria-hidden="true" />
                <span>Open In Browser</span>
              </div>
            </div>
          </div>
        </section>

        <section
          id="houses"
          className="scroll-mt-24 border-b border-[#F1EAD8]/8 bg-[#101B16] py-20 sm:py-24 lg:py-28"
        >
          <div className="mx-auto max-w-[1280px] px-5 sm:px-7">
            <div className="grid gap-5 border-b border-[#F1EAD8]/12 pb-9 lg:grid-cols-[1.15fr_0.85fr] lg:items-end">
              <div>
                <Eyebrow>Four houses · One legacy</Eyebrow>
                <h2 className="mt-4 max-w-[760px] font-display text-[clamp(2.5rem,5.5vw,4.6rem)] leading-[0.94] tracking-[-0.025em] text-[#F1EAD8]">
                  SIGN IN. FIND YOUR HOUSE.
                </h2>
              </div>
              <p className="max-w-[420px] font-ui text-[13px] leading-7 text-[#B4BBA9] lg:justify-self-end">
                Sign in with your game account to discover your house assignment and join its
                legacy.
              </p>
            </div>

            <ul className="mt-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {HOUSES.map((house) => {
                const isSavedHouse = saved?.houseId === house.id;
                return (
                  <li key={house.id}>
                    <article
                      data-house={house.id}
                      data-selected={isSavedHouse ? "true" : "false"}
                      className={`group relative flex min-h-[340px] flex-col overflow-hidden border p-6 transition-[transform,border-color,background-color,box-shadow] duration-300 hover:-translate-y-1 motion-reduce:transition-none motion-reduce:hover:translate-y-0 ${
                        isSavedHouse
                          ? "bg-[#17281F]"
                          : "border-[#F1EAD8]/10 bg-[#14231B] hover:border-[#F1EAD8]/22 hover:bg-[#17281F]"
                      }`}
                      style={
                        isSavedHouse
                          ? {
                              borderColor: `${house.color}AA`,
                              boxShadow: `inset 0 1px 0 ${house.color}33, 0 28px 70px -50px ${house.color}`,
                            }
                          : undefined
                      }
                    >
                      {isSavedHouse && (
                        <span
                          className="absolute inset-x-0 top-0 h-[2px]"
                          style={{ backgroundColor: house.color }}
                          aria-hidden="true"
                        />
                      )}

                      <div className="flex items-start justify-between gap-4">
                        <HouseEmblem
                          houseId={house.id}
                          size={52}
                          className="drop-shadow-[0_10px_20px_rgba(0,0,0,0.35)] transition-transform duration-300 group-hover:scale-[1.04] motion-reduce:transition-none"
                        />
                        <div className="text-right">
                          <span className="flex items-center justify-end gap-2 font-ui text-[8px] uppercase tracking-[0.2em] text-[#B4BBA9]">
                            <span
                              className="h-2 w-2 rounded-full"
                              style={{ backgroundColor: house.color }}
                              aria-hidden="true"
                            />
                            {HOUSE_COLOUR_NAMES[house.id]}
                          </span>
                          {isSavedHouse && (
                            <span className="mt-2 inline-flex items-center gap-1 border border-[#D5B46A]/35 bg-[#D5B46A]/8 px-2 py-1 font-ui text-[7px] uppercase tracking-[0.18em] text-[#D5B46A]">
                              <Check aria-hidden="true" className="h-2.5 w-2.5" />
                              {isAuthenticated ? "Your house" : "Saved house"}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="mt-7">
                        <h3 className="font-display text-[32px] leading-none tracking-[0.03em] text-[#F1EAD8]">
                          {house.shortName.toUpperCase()}
                        </h3>
                        <p className="mt-2 font-display text-[13px] italic text-[#B4BBA9]">
                          {house.motto}
                        </p>
                      </div>

                      <p className="mt-5 font-ui text-[11.5px] leading-6 text-[#B4BBA9]">
                        {house.description}
                      </p>

                      <div className="mt-auto pt-6">
                        <div
                          className="h-px w-full"
                          style={{
                            background: `linear-gradient(90deg, ${house.color}CC, transparent)`,
                          }}
                          aria-hidden="true"
                        />
                        <p className="mt-3 flex items-center justify-between gap-3 font-ui text-[8px] uppercase tracking-[0.18em] text-[#B4BBA9]/70">
                          <span>{house.hostelName}</span>
                          <ShieldCheck
                            aria-hidden="true"
                            className="h-3 w-3"
                            style={{ color: house.color }}
                          />
                        </p>
                      </div>
                    </article>
                  </li>
                );
              })}
            </ul>

            <div
              ref={playerRef}
              className="relative mt-5 overflow-hidden border border-[#F1EAD8]/12 bg-[#14231B]"
            >
              <div
                className="pointer-events-none absolute inset-0"
                style={{
                  background: saved
                    ? `radial-gradient(80% 150% at 88% 50%, ${saved.houseColor}1F, transparent 65%), linear-gradient(120deg, rgba(213,180,106,0.05), transparent 50%)`
                    : "radial-gradient(80% 150% at 88% 50%, rgba(213,180,106,0.12), transparent 65%)",
                }}
                aria-hidden="true"
              />
              <div className="relative min-h-[210px] p-6 sm:p-8">
                {authLoading ? (
                  <div className="flex min-h-[160px] items-center gap-4">
                    <Loader2 aria-hidden="true" className="h-5 w-5 animate-spin text-[#D5B46A]" />
                    <div>
                      <p className="font-ui text-[9px] uppercase tracking-[0.26em] text-[#D5B46A]">
                        Restoring session
                      </p>
                      <p className="mt-2 font-display text-2xl text-[#F1EAD8]">
                        Checking your campus identity…
                      </p>
                    </div>
                  </div>
                ) : isAuthenticated && saved ? (
                  <div className="grid gap-7 lg:grid-cols-[1fr_auto] lg:items-center">
                    <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
                      <div className="relative flex size-[76px] shrink-0 items-center justify-center rounded-full border bg-[#0B1511]/70">
                        <div
                          className="absolute inset-0 rounded-full border"
                          style={{ borderColor: `${saved.houseColor}88` }}
                          aria-hidden="true"
                        />
                        <span className="font-display text-[30px] tracking-[0.04em] text-[#F1EAD8]">
                          {saved.initials}
                        </span>
                        <HouseEmblem
                          houseId={saved.houseId}
                          size={28}
                          className="absolute -bottom-1 -right-1 drop-shadow-[0_6px_12px_rgba(0,0,0,0.45)]"
                        />
                      </div>

                      <div>
                        <p className="font-ui text-[9px] uppercase tracking-[0.24em] text-[#D5B46A]">
                          Signed in · Player profile restored
                        </p>
                        <h3 className="mt-2 font-display text-[clamp(1.8rem,4vw,2.9rem)] leading-[1.02] text-[#F1EAD8]">
                          WELCOME BACK, {saved.name.toUpperCase()}
                        </h3>
                        <p className="mt-2 font-ui text-[11px] uppercase tracking-[0.16em] text-[#B4BBA9]">
                          Your House:{" "}
                          <span style={{ color: saved.houseColor }}>{saved.houseName}</span>
                          <span className="mx-2 text-[#B4BBA9]/40">·</span>
                          Class {saved.className}
                          <span className="mx-2 text-[#B4BBA9]/40">·</span>
                          Level {saved.level}
                        </p>
                        <div className="mt-3 flex items-center gap-2">
                          <span
                            className="h-1 w-24 overflow-hidden rounded-full bg-[#F1EAD8]/12"
                            role="progressbar"
                            aria-label={`${saved.name}'s level progress`}
                            aria-valuemin={0}
                            aria-valuemax={100}
                            aria-valuenow={saved.percent}
                          >
                            <span
                              className="block h-full rounded-full"
                              style={{
                                width: `${saved.percent}%`,
                                backgroundColor: saved.houseColor,
                              }}
                            />
                          </span>
                          <span className="font-ui text-[8px] uppercase tracking-[0.16em] text-[#B4BBA9]/70">
                            {saved.xp} XP
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col gap-2 sm:flex-row lg:flex-col lg:items-stretch">
                      <GoldButton to="/play?intent=continue">CONTINUE JOURNEY</GoldButton>
                      <Link
                        to="/profile"
                        className="inline-flex min-h-12 items-center justify-center gap-2 border border-[#D5B46A]/40 px-5 font-ui text-[9px] uppercase tracking-[0.22em] text-[#D5B46A] transition-colors hover:border-[#D5B46A] hover:bg-[#D5B46A]/8 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#D5B46A]"
                      >
                        Player profile
                        <ArrowRight aria-hidden="true" className="h-3.5 w-3.5" />
                      </Link>
                      <button
                        type="button"
                        onClick={() => void handleSignOut()}
                        disabled={signingOut}
                        className="inline-flex min-h-12 items-center justify-center gap-2 border border-[#F1EAD8]/18 px-5 font-ui text-[9px] uppercase tracking-[0.22em] text-[#B4BBA9] transition-colors hover:border-[#F1EAD8]/35 hover:text-[#F1EAD8] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#D5B46A] disabled:opacity-50"
                      >
                        {signingOut ? (
                          <Loader2 aria-hidden="true" className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <LogOut aria-hidden="true" className="h-3.5 w-3.5" />
                        )}
                        {signingOut ? "Signing out" : "Sign out"}
                      </button>
                    </div>

                    <p className="font-ui text-[9px] leading-5 text-[#B4BBA9]/65 lg:col-span-2">
                      Your house and progress are read from the existing NAVODAYA player save on
                      this device. This page never reassigns a house.
                    </p>
                    {signOutError && (
                      <p role="alert" className="font-ui text-[10px] text-[#E1A18F] lg:col-span-2">
                        {signOutError}
                      </p>
                    )}
                  </div>
                ) : isAuthenticated ? (
                  <div className="grid gap-7 lg:grid-cols-[1fr_auto] lg:items-center">
                    <div>
                      <p className="font-ui text-[9px] uppercase tracking-[0.24em] text-[#D5B46A]">
                        Signed in · House not assigned
                      </p>
                      <h3 className="mt-2 font-display text-[clamp(1.9rem,4vw,3rem)] leading-[1.02] text-[#F1EAD8]">
                        {user?.name ? `WELCOME, ${user.name.toUpperCase()}` : "SIGN IN COMPLETE"}
                      </h3>
                      <p className="mt-3 max-w-[600px] font-ui text-[12px] leading-6 text-[#B4BBA9]">
                        No house is saved yet. Continue into the existing campus onboarding to
                        choose one of the four official houses and begin your story.
                      </p>
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row lg:flex-col">
                      <GoldButton to="/play">CHOOSE YOUR HOUSE</GoldButton>
                      <button
                        type="button"
                        onClick={() => void handleSignOut()}
                        disabled={signingOut}
                        className="inline-flex min-h-12 items-center justify-center gap-2 border border-[#F1EAD8]/18 px-5 font-ui text-[9px] uppercase tracking-[0.22em] text-[#B4BBA9] transition-colors hover:border-[#F1EAD8]/35 hover:text-[#F1EAD8] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#D5B46A] disabled:opacity-50"
                      >
                        {signingOut ? (
                          <Loader2 aria-hidden="true" className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <LogOut aria-hidden="true" className="h-3.5 w-3.5" />
                        )}
                        {signingOut ? "Signing out" : "Sign out"}
                      </button>
                    </div>
                    {signOutError && (
                      <p role="alert" className="font-ui text-[10px] text-[#E1A18F] lg:col-span-2">
                        {signOutError}
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="grid gap-7 lg:grid-cols-[1fr_auto] lg:items-center">
                    <div>
                      <p className="font-ui text-[9px] uppercase tracking-[0.24em] text-[#D5B46A]">
                        Member access
                      </p>
                      <h3 className="mt-2 font-display text-[clamp(1.9rem,4vw,3rem)] leading-[1.02] text-[#F1EAD8]">
                        SIGN IN TO GET YOUR HOUSE.
                      </h3>
                      <p className="mt-3 max-w-[620px] font-ui text-[12px] leading-6 text-[#B4BBA9]">
                        Use your existing NAVODAYA account. Signing in restores your session and
                        opens the house and progress already saved in your player profile — never a
                        random assignment.
                      </p>
                      {saved && (
                        <p className="mt-3 inline-flex items-center gap-2 border border-[#D5B46A]/25 bg-[#D5B46A]/6 px-3 py-2 font-ui text-[8px] uppercase tracking-[0.18em] text-[#D5B46A]">
                          <Check aria-hidden="true" className="h-3 w-3" />
                          Saved house found · {saved.houseName}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row lg:flex-col">
                      <Link
                        to={SIGN_IN_HREF}
                        className="group inline-flex min-h-12 items-center justify-center gap-3 border border-[#D5B46A] bg-[#D5B46A] px-6 py-3.5 font-ui text-[10px] font-semibold uppercase tracking-[0.24em] text-[#0B1511] transition-colors hover:border-[#E7CD94] hover:bg-[#E7CD94] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#F1EAD8]"
                      >
                        SIGN IN TO GET YOUR HOUSE
                        <ArrowRight
                          aria-hidden="true"
                          className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1 motion-reduce:transition-none"
                        />
                      </Link>
                      <Link
                        to={enterHref}
                        className="inline-flex min-h-12 items-center justify-center gap-2 border border-[#F1EAD8]/18 px-5 font-ui text-[9px] uppercase tracking-[0.22em] text-[#B4BBA9] transition-colors hover:border-[#F1EAD8]/35 hover:text-[#F1EAD8] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#D5B46A]"
                      >
                        Enter campus without signing in
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        <section
          id="experience"
          className="scroll-mt-24 border-b border-[#F1EAD8]/8 bg-[#0B1511] py-20 sm:py-24 lg:py-28"
        >
          <div className="mx-auto max-w-[1280px] px-5 sm:px-7">
            <div className="grid gap-5 lg:grid-cols-[1.05fr_0.95fr] lg:items-end">
              <div>
                <Eyebrow>The everyday · What you make of it</Eyebrow>
                <h2 className="mt-4 max-w-[640px] font-display text-[clamp(2.5rem,5.5vw,4.7rem)] leading-[0.94] tracking-[-0.025em] text-[#F1EAD8]">
                  MAKE EVERY DAY COUNT.
                </h2>
              </div>
              <p className="max-w-[430px] font-ui text-[13px] leading-7 text-[#B4BBA9] lg:justify-self-end">
                The campus is more than a map. It is the places you pass, the people you meet and
                the moments you decide to remember.
              </p>
            </div>

            <div className="mt-10 grid border-t border-[#F1EAD8]/14 md:grid-cols-3">
              {EXPERIENCE_ITEMS.map((item) => {
                const Icon = item.icon;
                return (
                  <article
                    key={item.number}
                    className="group relative flex min-h-[250px] flex-col border-b border-[#F1EAD8]/12 py-7 md:border-b-0 md:border-r md:px-7 md:last:border-r-0 md:first:pl-0 md:last:pr-0"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <span className="font-ui text-[9px] tracking-[0.28em] text-[#D5B46A]/70">
                        {item.number}
                      </span>
                      <Icon
                        aria-hidden="true"
                        className="h-4 w-4 text-[#D5B46A]/55 transition-colors group-hover:text-[#D5B46A]"
                      />
                    </div>
                    <h3 className="mt-8 max-w-[250px] font-display text-[clamp(1.8rem,3vw,2.4rem)] leading-[1.05] text-[#F1EAD8]">
                      {item.title}
                    </h3>
                    <p className="mt-3 max-w-[290px] font-ui text-[12px] leading-6 text-[#B4BBA9]">
                      {item.description}
                    </p>
                    <div
                      className="mt-auto h-px w-0 bg-[#D5B46A]/60 transition-[width] duration-500 group-hover:w-full motion-reduce:transition-none"
                      aria-hidden="true"
                    />
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section
          id="about"
          className="scroll-mt-24 border-b border-[#F1EAD8]/8 bg-[#101B16] py-16 sm:py-20"
        >
          <div className="mx-auto grid max-w-[1280px] gap-8 px-5 sm:px-7 lg:grid-cols-[0.9fr_1.1fr] lg:items-start lg:gap-16">
            <div>
              <Eyebrow>About the campus</Eyebrow>
              <h2 className="mt-4 max-w-[420px] font-display text-[clamp(2.2rem,4.4vw,3.7rem)] leading-[0.96] text-[#F1EAD8]">
                A SMALL WORLD, CLOSE TO HOME.
              </h2>
            </div>
            <div className="grid gap-6 sm:grid-cols-2">
              <div>
                <p className="font-ui text-[12px] leading-6 text-[#B4BBA9]">
                  NAVODAYA: THE CAMPUS LIFE is an original, browser-based story inspired by the
                  residential-school experience. Walk the grounds, find your people, represent your
                  house and leave your own mark.
                </p>
                <p className="mt-4 font-ui text-[12px] leading-6 text-[#B4BBA9]">
                  Existing saves, houses and progress remain exactly where they are. The landing
                  page only reads that profile to welcome you back.
                </p>
              </div>
              <div className="border-l border-[#F1EAD8]/10 pl-5">
                <p className="flex items-start gap-3 font-ui text-[11px] leading-5 text-[#B4BBA9]">
                  <ShieldCheck
                    aria-hidden="true"
                    className="mt-0.5 h-4 w-4 shrink-0 text-[#D5B46A]"
                  />
                  Four official houses. One assignment. No random house changes on this page.
                </p>
                <p className="mt-4 flex items-start gap-3 font-ui text-[11px] leading-5 text-[#B4BBA9]">
                  <Compass
                    aria-hidden="true"
                    className="mt-0.5 h-4 w-4 shrink-0 text-[#D5B46A]"
                  />
                  Single-player progress is saved on this device; the existing game and
                  multiplayer routes are unchanged.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="relative isolate overflow-hidden bg-[#0B1511] py-24 sm:py-28 lg:py-32">
          <div
            className="absolute inset-0 bg-[radial-gradient(75%_90%_at_50%_110%,rgba(213,180,106,0.16),transparent_65%)]"
            aria-hidden="true"
          />
          <div
            className="absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,#D5B46A55,transparent)]"
            aria-hidden="true"
          />
          <div className="relative mx-auto max-w-[860px] px-5 text-center sm:px-7">
            <CampusCrest className="mx-auto h-12 w-11 opacity-80" />
            <p className="mt-7 font-ui text-[9px] uppercase tracking-[0.34em] text-[#D5B46A]">
              The gate is open
            </p>
            <h2 className="mt-4 font-display text-[clamp(2.8rem,7vw,6rem)] leading-[0.88] tracking-[-0.03em] text-[#F1EAD8]">
              SEE YOU ON CAMPUS.
            </h2>
            <p className="mx-auto mt-6 max-w-[460px] font-ui text-[13px] leading-7 text-[#B4BBA9]">
              Choose your path. Find your house. Create the memories that stay.
            </p>
            <div className="mt-8 flex justify-center">
              <GoldButton to={enterHref} className="min-w-[220px]">
                ENTER THE WORLD
              </GoldButton>
            </div>
            <p className="mt-5 font-ui text-[9px] uppercase tracking-[0.2em] text-[#B4BBA9]/55">
              Existing progress preserved · No account required to play
            </p>
          </div>
        </section>
      </main>

      <footer className="border-t border-[#F1EAD8]/10 bg-[#101B16]">
        <div className="mx-auto max-w-[1280px] px-5 py-10 sm:px-7 sm:py-12">
          <div className="flex flex-col gap-8 md:flex-row md:items-start md:justify-between">
            <div>
              <Link
                to="/"
                className="inline-flex items-center gap-3 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#D5B46A]"
                aria-label="NAVODAYA: THE CAMPUS LIFE — home"
              >
                <CampusCrest className="h-9 w-8" />
                <span className="leading-none">
                  <span className="block font-display text-[17px] tracking-[0.12em] text-[#F1EAD8]">
                    NAVODAYA
                  </span>
                  <span className="mt-1.5 block font-ui text-[7.5px] uppercase tracking-[0.3em] text-[#B4BBA9]">
                    The Campus Life
                  </span>
                </span>
              </Link>
              <p className="mt-4 max-w-[360px] font-ui text-[10px] leading-5 text-[#B4BBA9]/70">
                An original fictional campus story inspired by the JNV residential-school
                experience. Not an official school website or a surveyed campus plan.
              </p>
            </div>

            <nav aria-label="Footer navigation" className="flex flex-wrap gap-x-7 gap-y-3">
              {NAV_ITEMS.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  className="font-ui text-[9px] uppercase tracking-[0.2em] text-[#B4BBA9] transition-colors hover:text-[#F1EAD8] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#D5B46A]"
                >
                  {item.label}
                </a>
              ))}
              <Link
                to="/play"
                className="font-ui text-[9px] uppercase tracking-[0.2em] text-[#D5B46A] transition-colors hover:text-[#F1EAD8] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#D5B46A]"
              >
                Enter Campus
              </Link>
            </nav>
          </div>

          <div className="mt-8 flex flex-col gap-2 border-t border-[#F1EAD8]/8 pt-5 sm:flex-row sm:items-center sm:justify-between">
            <p className="font-ui text-[9px] tracking-[0.08em] text-[#B4BBA9]/50">
              © {new Date().getFullYear()} NAVODAYA: THE CAMPUS LIFE
            </p>
            <p className="font-ui text-[8px] uppercase tracking-[0.18em] text-[#B4BBA9]/40">
              Interpretive campus fiction · Made for the browser
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default Landing;
