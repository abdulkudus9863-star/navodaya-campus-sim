import {
  ArrowRight,
  ArrowUpRight,
  Check,
  Clock3,
  Compass,
  MapPin,
  Menu,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router";
import { HouseEmblem } from "@/game/ui/HouseVisuals";
import { ACHIEVEMENTS, xpProgress } from "@/game/data/achievements";
import { CAMPUS_LOCATIONS } from "@/game/data/campus";
import { HOUSES } from "@/game/data/houses";
import { toProfileView } from "@/game/data/profile";
import { SaveSystem } from "@/game/core/SaveSystem";
import { useAuth } from "@/hooks/use-auth";

const NAV_ITEMS = [
  { label: "Home", href: "#home" },
  { label: "Adventures", href: "#adventures" },
  { label: "Four Houses", href: "#houses" },
  { label: "Campus", href: "#campus" },
] as const;

const CAMPUS_SPACES = [
  {
    name: "Main entrance",
    note: "The gateboard, guard cabin and the long drive where every term begins.",
  },
  {
    name: "Academic blocks",
    note: "Verandas, noticeboards and the familiar route between periods.",
  },
  {
    name: "Classrooms",
    note: "Roll calls, ceiling fans and the window seats everyone negotiates for.",
  },
  {
    name: "Science laboratories",
    note: "Experiment benches and the quiet focus of a practical lesson.",
  },
  {
    name: "Library",
    note: "Reading tables, borrowed pencils and the best excuse to stay late.",
  },
  {
    name: "Assembly ground",
    note: "The flag pole, morning lines and the whole campus in one place.",
  },
  {
    name: "Sports grounds",
    note: "Football, cricket and house practices that run until the light goes.",
  },
  {
    name: "Four house hostels",
    note: "Aravali, Nilgiri, Shivalik and Udaygiri — four houses under one campus.",
  },
  {
    name: "Dining hall",
    note: "The bell you can hear from every corner of the grounds.",
  },
  {
    name: "Gardens & campus paths",
    note: "Quiet corners, shortcut lanes and the long way back to the hostel.",
  },
] as const;

const MINI_GAMES = [
  {
    name: "Night Sneak",
    description: "Cross the garden after lights-out, collect the markers and stay out of the watchman's torchlight.",
    available: true,
  },
  {
    name: "Treasure Hunt",
    description: "A campus-wide clue trail is being written. No playable build yet.",
    available: false,
  },
  {
    name: "Campus Escape",
    description: "Run three campus obstacle courses, collect energy tokens and finish before the timer.",
    available: true,
  },
  {
    name: "Mystery Room",
    description: "A closed-door puzzle for small teams. Not yet playable.",
    available: false,
  },
  {
    name: "Sports Challenge",
    description: "A field challenge between houses. Planned for a future term.",
    available: false,
  },
  {
    name: "Brain Battle",
    description: "A quick-fire academic face-off. On the roadmap.",
    available: false,
  },
] as const;

const FEATURES = [
  {
    name: "Campus exploration",
    description: "Walk the grounds, discover named places and open the campus plan.",
    status: "Available now",
    active: true,
  },
  {
    name: "House competitions",
    description: "The approved Term I house table lives inside your in-game profile.",
    status: "Term I archive",
    active: true,
  },
  {
    name: "Adventure missions",
    description: "Day-one orientation and the Operation Midnight Mischief caper.",
    status: "Available now",
    active: true,
  },
  {
    name: "Player achievements",
    description: "Eight campus achievements, each tied to a real milestone.",
    status: "Available now",
    active: true,
  },
  {
    name: "Campus friendships",
    description: "A deeper relationship system for classmates and house mates.",
    status: "Coming soon",
    active: false,
  },
  {
    name: "Personal progression",
    description: "Level, XP and discoveries saved to your browser profile.",
    status: "Available now",
    active: true,
  },
] as const;

type SavedPreview = {
  name: string;
  className: string;
  houseName: string;
  houseColor: string;
  level: number;
  xp: number;
  inLevel: number;
  toNext: number;
  percent: number;
  achievements: number;
  places: number;
  totalPlaces: number;
  orientationSteps: number;
  orientationTotal: number;
  nightComplete: boolean;
  nightAttempts: number;
};

function FocusLink({
  href,
  children,
  variant = "primary",
  className = "",
}: {
  href: string;
  children: React.ReactNode;
  variant?: "primary" | "secondary" | "light";
  className?: string;
}) {
  const styles = {
    primary:
      "border-[#d6ba7e] bg-[#d6ba7e] text-[#0b1711] hover:border-[#e7cd94] hover:bg-[#e7cd94]",
    secondary:
      "border-[#f2eadb]/35 bg-transparent text-[#f2eadb] hover:border-[#f2eadb]/65 hover:bg-[#f2eadb]/8",
    light:
      "border-[#11251a] bg-[#11251a] text-[#f2eadb] hover:border-[#21452f] hover:bg-[#21452f]",
  }[variant];

  return (
    <Link
      to={href}
      className={`group inline-flex min-h-11 items-center justify-center gap-3 border px-6 py-3.5 font-ui text-[10px] font-semibold uppercase tracking-[0.26em] transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#d6ba7e] motion-reduce:transition-none ${styles} ${className}`}
    >
      {children}
      <TrailingArrow />
    </Link>
  );
}

function TrailingArrow() {
  return (
    <ArrowUpRight
      aria-hidden="true"
      className="h-3.5 w-3.5 transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 motion-reduce:transition-none"
    />
  );
}

function SectionEyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="font-ui text-[10px] font-medium uppercase tracking-[0.32em] text-[#b9a171]">
      {children}
    </p>
  );
}

function Landing() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [saved, setSaved] = useState<SavedPreview | null>(null);
  const [saveChecked, setSaveChecked] = useState(false);
  const { isAuthenticated, isLoading: authLoading } = useAuth();

  useEffect(() => {
    try {
      const result = new SaveSystem().load();
      if (result.ok) {
        const profile = toProfileView(result.data.profile);
        if (profile) {
          const xp = xpProgress(profile.xp);
          setSaved({
            name: profile.characterName,
            className: profile.className,
            houseName: profile.houseName,
            houseColor: profile.houseColor,
            level: profile.level,
            xp: profile.xp,
            inLevel: xp.inLevel,
            toNext: xp.toNext,
            percent: xp.percent,
            achievements: profile.achievements.length,
            places: result.data.exploration.discovered.length,
            totalPlaces: CAMPUS_LOCATIONS.length,
            orientationSteps: result.data.mission.completed.length,
            orientationTotal: 4,
            nightComplete: result.data.night.success,
            nightAttempts: result.data.night.attempts,
          });
        }
      }
    } catch {
      // A blocked or malformed local save should never break the landing page.
    } finally {
      setSaveChecked(true);
    }
  }, []);

  useEffect(() => {
    document.title = "NAVODAYA: THE CAMPUS LIFE";

    const origin = window.location.origin;
    const canonical =
      document.querySelector<HTMLLinkElement>('link[rel="canonical"]') ??
      document.head.appendChild(
        Object.assign(document.createElement("link"), { rel: "canonical" }),
      );
    canonical.href = `${origin}/`;

    const setMeta = (selector: string, attribute: "property" | "name", key: string, value: string) => {
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

  const closeMenu = () => setMenuOpen(false);

  return (
    <div className="min-h-screen overflow-x-clip bg-[#0b1711] text-[#f2eadb] selection:bg-[#d6ba7e]/35">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:border focus:border-[#d6ba7e] focus:bg-[#0b1711] focus:px-4 focus:py-3 focus:font-ui focus:text-xs focus:uppercase focus:tracking-[0.2em] focus:text-[#f2eadb]"
      >
        Skip to content
      </a>

      <header className="sticky top-0 z-50 border-b border-[#f2eadb]/12 bg-[#08150f]">
        <div className="mx-auto flex h-[68px] max-w-[1320px] items-center justify-between gap-4 px-5 sm:px-8 lg:h-[76px]">
          <Link
            to="/"
            className="group flex min-w-0 items-center gap-3 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#d6ba7e]"
            aria-label="NAVODAYA: THE CAMPUS LIFE — home"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center border border-[#d6ba7e]/55 font-display text-[22px] leading-none text-[#e3cb98] transition-colors group-hover:border-[#d6ba7e]">
              N
            </span>
            <span className="min-w-0 leading-none">
              <span className="block truncate font-display text-[17px] tracking-[0.09em] text-[#f4eddf] sm:text-[19px]">
                NAVODAYA
              </span>
              <span className="mt-1.5 block font-ui text-[8px] uppercase tracking-[0.28em] text-[#b9b19d]">
                The Campus Life
              </span>
            </span>
          </Link>

          <nav className="hidden items-center gap-8 lg:flex" aria-label="Primary navigation">
            {NAV_ITEMS.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="font-ui text-[11px] uppercase tracking-[0.18em] text-[#d7d1c2] transition-colors hover:text-[#f2eadb] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#d6ba7e]"
              >
                {item.label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <Link
              to="/play"
              className="hidden min-h-10 items-center justify-center border border-[#d6ba7e] bg-[#d6ba7e] px-5 font-ui text-[10px] font-semibold uppercase tracking-[0.2em] text-[#0b1711] transition-colors hover:bg-[#e7cd94] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#d6ba7e] sm:inline-flex"
            >
              Play Now
            </Link>
            <button
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
              aria-expanded={menuOpen}
              aria-controls="mobile-menu"
              aria-label={menuOpen ? "Close navigation menu" : "Open navigation menu"}
              className="flex h-11 w-11 items-center justify-center border border-[#f2eadb]/20 text-[#f2eadb] transition-colors hover:border-[#d6ba7e]/60 hover:text-[#e3cb98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#d6ba7e] lg:hidden"
            >
              {menuOpen ? <X aria-hidden="true" className="h-5 w-5" /> : <Menu aria-hidden="true" className="h-5 w-5" />}
            </button>
          </div>
        </div>

        <div
          id="mobile-menu"
          className={`overflow-hidden border-[#f2eadb]/10 bg-[#08150f] transition-[max-height,opacity] duration-300 ease-out motion-reduce:transition-none lg:hidden ${
            menuOpen ? "max-h-[460px] border-t opacity-100" : "max-h-0 opacity-0"
          }`}
        >
          <nav className="mx-auto max-w-[1320px] px-5 py-5 sm:px-8" aria-label="Mobile navigation">
            <div className="flex flex-col">
              {NAV_ITEMS.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  onClick={closeMenu}
                  className="flex min-h-12 items-center justify-between border-b border-[#f2eadb]/10 font-ui text-xs uppercase tracking-[0.2em] text-[#e6dfd1] transition-colors hover:text-[#e3cb98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#d6ba7e]"
                >
                  {item.label}
                  <ArrowUpRight aria-hidden="true" className="h-4 w-4 text-[#b9a171]" />
                </a>
              ))}
            </div>
            <Link
              to="/play"
              onClick={closeMenu}
              className="mt-5 flex min-h-12 items-center justify-center border border-[#d6ba7e] bg-[#d6ba7e] px-5 font-ui text-[10px] font-semibold uppercase tracking-[0.22em] text-[#0b1711] transition-colors hover:bg-[#e7cd94] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f2eadb]"
            >
              Play Now
            </Link>
          </nav>
        </div>
      </header>

      <main id="main">
        <section id="home" className="relative isolate min-h-[88svh] overflow-hidden bg-[#0b1711] sm:min-h-[92svh] lg:min-h-[760px]">
          <img
            src="/campus/gate.jpg"
            alt="Illustrative in-game view of the Navodaya campus main gate and drive at golden hour."
            className="absolute inset-0 h-full w-full object-cover object-center"
            width={1280}
            height={720}
            fetchPriority="high"
            decoding="async"
          />
          <div className="absolute inset-0 bg-[#06120c]/55" aria-hidden="true" />
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(5,16,10,0.94)_0%,rgba(5,16,10,0.74)_46%,rgba(5,16,10,0.22)_78%,rgba(5,16,10,0.58)_100%)]" aria-hidden="true" />
          <div className="absolute inset-x-0 bottom-0 h-40 bg-[linear-gradient(180deg,transparent,rgba(11,23,17,0.94))]" aria-hidden="true" />

          <div className="relative mx-auto flex min-h-[88svh] max-w-[1320px] flex-col justify-end px-5 pb-12 pt-28 sm:min-h-[92svh] sm:px-8 sm:pb-16 lg:min-h-[760px] lg:pb-20">
            <div className="max-w-[860px]">
              <p className="flex flex-wrap items-center gap-x-3 gap-y-2 font-ui text-[9px] uppercase tracking-[0.3em] text-[#d5c6a8] sm:text-[10px]">
                <span className="h-px w-8 bg-[#c9ad73]" aria-hidden="true" />
                JNV Bishnupur · An interpretive campus story
              </p>

              <h1 className="mt-7 font-display text-[clamp(3.4rem,9.6vw,8.2rem)] font-normal leading-[0.84] tracking-[-0.035em] text-[#f6efdf]">
                YOUR CAMPUS.
                <br />
                <span className="text-[#e2c88f]">YOUR STORY.</span>
              </h1>

              <p className="mt-8 max-w-[560px] font-ui text-[15px] leading-7 text-[#ddd5c5] sm:text-[17px] sm:leading-8">
                More than just a school. A world of friendships, memories, competitions and
                adventures. Step into the Navodaya experience and create your own campus story.
              </p>

              <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
                <FocusLink href="/play">ENTER CAMPUS</FocusLink>
                <a
                  href="#adventures"
                  className="group inline-flex min-h-11 items-center justify-center gap-3 border border-[#f2eadb]/35 px-6 py-3.5 font-ui text-[10px] font-semibold uppercase tracking-[0.26em] text-[#f2eadb] transition-colors hover:border-[#f2eadb]/70 hover:bg-[#f2eadb]/8 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#d6ba7e]"
                >
                  EXPLORE THE GAME
                  <ArrowRight
                    aria-hidden="true"
                    className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-1 motion-reduce:transition-none"
                  />
                </a>
              </div>

              <div className="mt-12 flex flex-wrap gap-x-6 gap-y-2 border-t border-[#f2eadb]/18 pt-5 font-ui text-[9px] uppercase tracking-[0.22em] text-[#bdb5a5] sm:text-[10px]">
                <span className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 bg-[#78a982]" aria-hidden="true" />
                  Playable in browser
                </span>
                <span>Campus Tour</span>
                <span>Operation Midnight Mischief</span>
                <span>Four Houses</span>
              </div>
            </div>
          </div>
        </section>

        <section id="adventures" className="scroll-mt-20 bg-[#0b1711] py-20 sm:py-24 lg:py-32">
          <div className="mx-auto max-w-[1320px] px-5 sm:px-8">
            <div className="grid gap-6 border-b border-[#f2eadb]/14 pb-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-end">
              <div>
                <SectionEyebrow>Adventures · Term II</SectionEyebrow>
                <h2 className="mt-5 max-w-[700px] font-display text-[clamp(2.6rem,5.8vw,5rem)] leading-[0.93] tracking-[-0.025em] text-[#f4eddf]">
                  EVERY DAY HAS A STORY.
                </h2>
              </div>
              <p className="max-w-[440px] font-ui text-sm leading-7 text-[#b9b19f] lg:justify-self-end">
                Two ways into the campus today: take the long route through its named places, or
                wait for the lights to go out and try not to get caught.
              </p>
            </div>

            <div className="mt-10 grid gap-5 lg:grid-cols-12">
              <article className="group relative isolate min-h-[430px] overflow-hidden border border-[#f2eadb]/16 lg:col-span-7 lg:min-h-[540px]">
                <img
                  src="/campus/drive.jpg"
                  alt="Illustrative in-game view along the campus drive, with buildings and trees in the distance."
                  className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.015] motion-reduce:transition-none"
                  width={1280}
                  height={720}
                  loading="lazy"
                  decoding="async"
                />
                <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(6,18,11,0.12)_0%,rgba(6,18,11,0.35)_42%,rgba(6,18,11,0.96)_100%)]" aria-hidden="true" />
                <div className="relative flex min-h-[430px] flex-col justify-end p-6 sm:p-9 lg:min-h-[540px]">
                  <div className="mb-4 flex items-center justify-between gap-4">
                    <span className="border border-[#d6ba7e]/55 bg-[#0b1711]/75 px-3 py-1.5 font-ui text-[9px] uppercase tracking-[0.2em] text-[#e3cb98]">
                      Campus Tour
                    </span>
                    <span className="flex items-center gap-2 font-ui text-[9px] uppercase tracking-[0.2em] text-[#d5dbc9]">
                      <span className="h-1.5 w-1.5 bg-[#78a982]" aria-hidden="true" />
                      Playable
                    </span>
                  </div>
                  <h3 className="max-w-[540px] font-display text-[clamp(2.2rem,4.4vw,3.7rem)] leading-[0.95] text-[#f6efdf]">
                    CAMPUS TOUR
                  </h3>
                  <p className="mt-4 max-w-[480px] font-ui text-sm leading-6 text-[#d6cfbf]">
                    Explore campus buildings, playgrounds, hostels, library and other locations.
                  </p>
                  <div className="mt-7">
                    <FocusLink href="/play">START EXPLORING</FocusLink>
                  </div>
                </div>
              </article>

              <article className="group relative isolate min-h-[430px] overflow-hidden border border-[#f2eadb]/16 lg:col-span-5 lg:min-h-[540px]">
                <img
                  src="/campus/midnight.jpg"
                  alt="Illustrative in-game view of the campus gardens under the night sky during Operation Midnight Mischief."
                  className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.015] motion-reduce:transition-none"
                  width={1280}
                  height={720}
                  loading="lazy"
                  decoding="async"
                />
                <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(4,12,18,0.15)_0%,rgba(4,12,18,0.48)_40%,rgba(4,12,18,0.97)_100%)]" aria-hidden="true" />
                <div className="relative flex min-h-[430px] flex-col justify-end p-6 sm:p-9 lg:min-h-[540px]">
                  <div className="mb-4 flex items-center justify-between gap-4">
                    <span className="border border-[#9cb9c4]/45 bg-[#081520]/80 px-3 py-1.5 font-ui text-[9px] uppercase tracking-[0.2em] text-[#c4d9df]">
                      Night mission
                    </span>
                    <span className="font-ui text-[9px] uppercase tracking-[0.2em] text-[#c4d9df]">
                      Playable
                    </span>
                  </div>
                  <h3 className="font-display text-[clamp(2.2rem,4.4vw,3.5rem)] leading-[0.92] text-[#f4f0e4]">
                    OPERATION{" "}
                    <br />
                    MIDNIGHT MISCHIEF
                  </h3>
                  <p className="mt-4 max-w-[420px] font-ui text-sm leading-6 text-[#d5d7cd]">
                    Enter the fictional adventure zone and discover exciting challenges.
                  </p>
                  <div className="mt-7">
                    <FocusLink href="/play">ENTER ADVENTURE</FocusLink>
                  </div>
                </div>
              </article>
            </div>

            <div className="mt-12 border border-[#f2eadb]/14 bg-[#0e1d15]">
              <div className="flex flex-col gap-3 border-b border-[#f2eadb]/12 px-5 py-5 sm:flex-row sm:items-end sm:justify-between sm:px-7">
                <div>
                  <SectionEyebrow>Inside Operation Midnight Mischief</SectionEyebrow>
                  <h3 className="mt-2 font-display text-2xl text-[#f2eadb] sm:text-3xl">
                    THE ADVENTURE MENU
                  </h3>
                </div>
                <p className="max-w-[430px] font-ui text-[11px] leading-5 text-[#a9ad9f]">
                  Night Sneak and Campus Escape are playable inside the adventure menu today.
                  Everything else is clearly marked as upcoming work.
                </p>
              </div>

              <div className="grid sm:grid-cols-2 xl:grid-cols-3">
                {MINI_GAMES.map((game) => (
                  <div
                    key={game.name}
                    className={`flex min-h-[230px] flex-col justify-between gap-6 border-b border-[#f2eadb]/10 p-5 sm:p-6 xl:border-r ${
                      game.available ? "bg-[#152a1e]" : "bg-transparent"
                    }`}
                  >
                    <div>
                      <div className="flex items-start justify-between gap-4">
                        <h4 className="font-display text-[23px] leading-none text-[#f2eadb]">
                          {game.name}
                        </h4>
                        {game.available ? (
                          <span className="flex shrink-0 items-center gap-1.5 border border-[#78a982]/45 px-2 py-1 font-ui text-[8px] uppercase tracking-[0.16em] text-[#a8c6ad]">
                            <Check aria-hidden="true" className="h-3 w-3" />
                            Playable
                          </span>
                        ) : (
                          <span className="flex shrink-0 items-center gap-1.5 border border-[#f2eadb]/15 px-2 py-1 font-ui text-[8px] uppercase tracking-[0.16em] text-[#a39d8f]">
                            <Clock3 aria-hidden="true" className="h-3 w-3" />
                            Coming soon
                          </span>
                        )}
                      </div>
                      <p className="mt-4 font-ui text-[12px] leading-6 text-[#b9b3a4]">
                        {game.description}
                      </p>
                    </div>

                    {game.available ? (
                      <Link
                        to="/play"
                        className="inline-flex w-fit items-center gap-2 border-b border-[#d6ba7e]/60 pb-1 font-ui text-[9px] font-semibold uppercase tracking-[0.2em] text-[#e3cb98] transition-colors hover:border-[#e3cb98] hover:text-[#f2eadb] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#d6ba7e]"
                      >
                        Play in game
                        <ArrowUpRight aria-hidden="true" className="h-3 w-3" />
                      </Link>
                    ) : (
                      <p className="font-ui text-[9px] uppercase tracking-[0.2em] text-[#777f72]">
                        Not playable yet
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section id="houses" className="scroll-mt-20 border-y border-[#f2eadb]/10 bg-[#10231a] py-20 sm:py-24 lg:py-32">
          <div className="mx-auto max-w-[1320px] px-5 sm:px-8">
            <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr] lg:items-end">
              <div>
                <SectionEyebrow>Four houses · One campus</SectionEyebrow>
                <h2 className="mt-5 max-w-[780px] font-display text-[clamp(2.6rem,5.8vw,5rem)] leading-[0.93] tracking-[-0.025em] text-[#f4eddf]">
                  FOUR HOUSES.{" "}
                  <br />
                  ONE FAMILY.
                </h2>
              </div>
              <p className="max-w-[430px] font-ui text-sm leading-7 text-[#b9b3a4] lg:justify-self-end">
                Green, blue, yellow and red. Four identities, one campus, and a year of house
                competitions still being written.
              </p>
            </div>

            <div className="mt-12 grid gap-px border border-[#f2eadb]/14 bg-[#f2eadb]/14 sm:grid-cols-2 xl:grid-cols-4">
              {HOUSES.map((house) => (
                <article key={house.id} className="relative flex min-h-[370px] flex-col bg-[#0d1d15] p-6">
                  <div className="flex items-start justify-between gap-4">
                    <HouseEmblem houseId={house.id} size={54} />
                    <span
                      className="h-2.5 w-2.5"
                      style={{ backgroundColor: house.color }}
                      aria-hidden="true"
                    />
                  </div>
                  <div className="mt-7">
                    <p
                      className="font-ui text-[9px] uppercase tracking-[0.24em]"
                      style={{ color: house.color }}
                    >
                      {house.shortName} House
                    </p>
                    <h3 className="mt-2 font-display text-[30px] leading-none text-[#f4eddf]">
                      {house.shortName.toUpperCase()}
                    </h3>
                    <p className="mt-2 font-display text-sm italic text-[#b9b3a4]">
                      {house.motto}
                    </p>
                  </div>
                  <p className="mt-5 font-ui text-[12px] leading-6 text-[#b0aea0]">
                    {house.description}
                  </p>
                  <div className="mt-auto space-y-2 border-t border-[#f2eadb]/10 pt-4 font-ui text-[10px] leading-5 text-[#8f9587]">
                    <p>
                      <span className="text-[#c9c3b5]">Colour</span> · {house.color}
                    </p>
                    <p>
                      <span className="text-[#c9c3b5]">Hostel</span> · {house.hostelName}
                    </p>
                  </div>
                </article>
              ))}
            </div>

            <div className="mt-6 flex flex-col gap-4 border border-[#f2eadb]/12 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <p className="flex items-start gap-3 font-ui text-[11px] leading-5 text-[#a9ad9f]">
                <Compass aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-[#c8aa6d]" />
                House assignment happens inside the game and is kept in your existing player
                profile. This page does not re-assign anyone.
              </p>
              <Link
                to="/play"
                className="inline-flex shrink-0 items-center gap-2 font-ui text-[9px] font-semibold uppercase tracking-[0.2em] text-[#e3cb98] underline-offset-4 transition-colors hover:text-[#f2eadb] hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#d6ba7e]"
              >
                Find your house in game
                <ArrowUpRight aria-hidden="true" className="h-3 w-3" />
              </Link>
            </div>
          </div>
        </section>

        <section id="campus" className="scroll-mt-20 bg-[#e8e1d0] py-20 text-[#11251a] sm:py-24 lg:py-32">
          <div className="mx-auto max-w-[1320px] px-5 sm:px-8">
            <div className="grid gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:gap-16">
              <div className="lg:sticky lg:top-28 lg:self-start">
                <p className="font-ui text-[10px] font-medium uppercase tracking-[0.32em] text-[#5c765f]">
                  The campus · A place to belong
                </p>
                <h2 className="mt-5 max-w-[520px] font-display text-[clamp(2.6rem,5.4vw,4.8rem)] leading-[0.92] tracking-[-0.03em] text-[#11251a]">
                  WELCOME TO YOUR SECOND HOME.
                </h2>
                <p className="mt-6 max-w-[430px] font-ui text-sm leading-7 text-[#42574a]">
                  The gate, the assembly ground, the classroom verandas, the dining-hall bell and
                  four hostels that never quite go quiet. The campus is the heart of the story.
                </p>
                <div className="mt-8">
                  <FocusLink href="/play" variant="light">
                    EXPLORE CAMPUS
                  </FocusLink>
                </div>
                <p className="mt-4 flex items-center gap-2 font-ui text-[10px] uppercase tracking-[0.18em] text-[#68796a]">
                  <Compass aria-hidden="true" className="h-3.5 w-3.5" />
                  Opens the campus plan in game
                </p>
              </div>

              <div>
                <figure className="relative overflow-hidden bg-[#c9c4b2]">
                  <img
                    src="/campus/academic.jpg"
                    alt="Illustrative in-game view of the academic block and its classroom verandas."
                    className="h-[260px] w-full object-cover sm:h-[360px] lg:h-[420px]"
                    width={1280}
                    height={720}
                    loading="lazy"
                    decoding="async"
                  />
                  <figcaption className="absolute bottom-0 left-0 flex items-center gap-2 bg-[#11251a] px-4 py-3 font-ui text-[9px] uppercase tracking-[0.2em] text-[#f2eadb]">
                    <MapPin aria-hidden="true" className="h-3.5 w-3.5 text-[#d6ba7e]" />
                    Academic block · In-game view
                  </figcaption>
                </figure>

                <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {[
                    ["/campus/gate.jpg", "Main gate", "Illustrative in-game view of the campus main gate."],
                    ["/campus/library.jpg", "Library", "Illustrative in-game view of the library reading room."],
                    ["/campus/dining.jpg", "Dining hall", "Illustrative in-game view of the dining hall."],
                    ["/campus/houses.jpg", "House hostels", "Illustrative in-game view of the four house hostels."],
                    ["/campus/sports.jpg", "Sports grounds", "Illustrative in-game view of the campus sports grounds."],
                    ["/campus/garden.jpg", "Gardens & paths", "Illustrative in-game view of the campus gardens and paths."],
                  ].map(([src, label, alt]) => (
                    <figure key={src} className="group relative overflow-hidden bg-[#c9c4b2]">
                      <img
                        src={src}
                        alt={alt}
                        className="h-[150px] w-full object-cover transition-transform duration-500 group-hover:scale-[1.03] motion-reduce:transition-none sm:h-[180px]"
                        width={1280}
                        height={720}
                        loading="lazy"
                        decoding="async"
                      />
                      <figcaption className="absolute inset-x-0 bottom-0 bg-[linear-gradient(180deg,transparent,rgba(9,24,15,0.86))] px-3 pb-2.5 pt-8 font-ui text-[9px] uppercase tracking-[0.16em] text-[#f2eadb]">
                        {label}
                      </figcaption>
                    </figure>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-16 grid gap-x-10 gap-y-0 border-t border-[#11251a]/20 sm:grid-cols-2">
              {CAMPUS_SPACES.map((space, index) => (
                <div
                  key={space.name}
                  className="grid grid-cols-[38px_1fr] gap-3 border-b border-[#11251a]/15 py-5"
                >
                  <span className="font-ui text-[10px] tracking-[0.16em] text-[#788776]">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <div>
                    <h3 className="font-display text-[21px] leading-tight text-[#11251a]">
                      {space.name}
                    </h3>
                    <p className="mt-1 font-ui text-[11px] leading-5 text-[#506355]">{space.note}</p>
                  </div>
                </div>
              ))}
            </div>

            <p className="mt-8 max-w-[850px] font-ui text-[10px] leading-5 text-[#758174]">
              Campus imagery is an interpretive in-game recreation inspired by the JNV
              residential-school experience. It is not a surveyed plan, exact building location or
              official representation of JNV Bishnupur, Manipur.
            </p>
          </div>
        </section>

        <section className="bg-[#0b1711] py-20 sm:py-24 lg:py-32">
          <div className="mx-auto max-w-[1320px] px-5 sm:px-8">
            <div className="grid gap-6 border-b border-[#f2eadb]/14 pb-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-end">
              <div>
                <SectionEyebrow>Game features · What is inside</SectionEyebrow>
                <h2 className="mt-5 max-w-[720px] font-display text-[clamp(2.4rem,5.2vw,4.6rem)] leading-[0.94] tracking-[-0.025em] text-[#f4eddf]">
                  BUILT FOR THE LIFE BETWEEN CLASSES.
                </h2>
              </div>
              <p className="max-w-[420px] font-ui text-sm leading-7 text-[#b9b3a4] lg:justify-self-end">
                A small, hand-built campus game. Everything marked available can be reached in the
                current build; the rest is honestly labelled.
              </p>
            </div>

            <div className="mt-2 grid sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map((feature) => (
                <article
                  key={feature.name}
                  className={`flex min-h-[210px] flex-col justify-between gap-8 border-b border-[#f2eadb]/12 py-7 sm:px-6 lg:border-r ${
                    feature.active ? "" : "opacity-75"
                  }`}
                >
                  <div>
                    <div className="flex items-center gap-2">
                      {feature.active ? (
                        <Check aria-hidden="true" className="h-3.5 w-3.5 text-[#78a982]" />
                      ) : (
                        <Clock3 aria-hidden="true" className="h-3.5 w-3.5 text-[#a39d8f]" />
                      )}
                      <span
                        className={`font-ui text-[9px] uppercase tracking-[0.2em] ${
                          feature.active ? "text-[#a8c6ad]" : "text-[#a39d8f]"
                        }`}
                      >
                        {feature.status}
                      </span>
                    </div>
                    <h3 className="mt-4 font-display text-[27px] leading-tight text-[#f2eadb]">
                      {feature.name}
                    </h3>
                    <p className="mt-3 max-w-[340px] font-ui text-[12px] leading-6 text-[#a9ad9f]">
                      {feature.description}
                    </p>
                  </div>
                  {feature.active ? (
                    <p className="font-ui text-[9px] uppercase tracking-[0.18em] text-[#7f8f7f]">
                      Reachable in game
                    </p>
                  ) : (
                    <p className="font-ui text-[9px] uppercase tracking-[0.18em] text-[#777f72]">
                      Not playable yet
                    </p>
                  )}
                </article>
              ))}
            </div>

            <div className="mt-8 flex flex-col gap-4 border border-[#f2eadb]/12 bg-[#0e1d15] px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <p className="font-ui text-[11px] leading-5 text-[#a9ad9f]">
                House points come only from approved competition results. The midnight caper never
                awards house points, so there is no invented live ranking on this page.
              </p>
              <Link
                to="/play"
                className="inline-flex shrink-0 items-center gap-2 font-ui text-[9px] font-semibold uppercase tracking-[0.2em] text-[#e3cb98] transition-colors hover:text-[#f2eadb] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#d6ba7e]"
              >
                Enter the campus
                <ArrowUpRight aria-hidden="true" className="h-3 w-3" />
              </Link>
            </div>
          </div>
        </section>

        <section className="border-y border-[#f2eadb]/10 bg-[#0e1d15] py-20 sm:py-24">
          <div className="mx-auto max-w-[1320px] px-5 sm:px-8">
            <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16">
              <div>
                <SectionEyebrow>Your progress · Local to this device</SectionEyebrow>
                <h2 className="mt-5 max-w-[430px] font-display text-[clamp(2.3rem,4.6vw,4rem)] leading-[0.95] tracking-[-0.02em] text-[#f4eddf]">
                  THE STORY YOU HAVE ALREADY STARTED.
                </h2>
                <p className="mt-5 max-w-[380px] font-ui text-sm leading-7 text-[#a9ad9f]">
                  {saveChecked && saved
                    ? "This is read directly from the existing NAVODAYA save in this browser. Nothing here is a ranking or another player's information."
                    : "Start with a student, a house and a first day. Your progress stays on this device in the existing game save."}
                </p>
              </div>

              <div className="border border-[#f2eadb]/14 bg-[#0b1711] p-6 sm:p-8">
                {!saveChecked ? (
                  <div className="flex min-h-[260px] items-center justify-center">
                    <p className="font-ui text-[10px] uppercase tracking-[0.22em] text-[#8f9587]">
                      Reading local save…
                    </p>
                  </div>
                ) : saved ? (
                  <div>
                    <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#f2eadb]/12 pb-6">
                      <div>
                        <p className="font-ui text-[9px] uppercase tracking-[0.22em] text-[#8f9587]">
                          Player profile
                        </p>
                        <h3 className="mt-2 font-display text-[34px] leading-none text-[#f4eddf]">
                          {saved.name}
                        </h3>
                        <p className="mt-2 font-ui text-[11px] uppercase tracking-[0.14em]" style={{ color: saved.houseColor }}>
                          {saved.className} · {saved.houseName}
                        </p>
                      </div>
                      <span className="border border-[#78a982]/45 px-3 py-1.5 font-ui text-[8px] uppercase tracking-[0.18em] text-[#a8c6ad]">
                        Local save found
                      </span>
                    </div>

                    <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
                      {[
                        ["Level", String(saved.level)],
                        ["Total XP", String(saved.xp)],
                        ["Places", `${saved.places}/${saved.totalPlaces}`],
                        ["Achievements", `${saved.achievements}/${ACHIEVEMENTS.length}`],
                      ].map(([label, value]) => (
                        <div key={label}>
                          <p className="font-ui text-[8px] uppercase tracking-[0.18em] text-[#8f9587]">
                            {label}
                          </p>
                          <p className="mt-1 font-display text-[27px] leading-none text-[#f4eddf]">
                            {value}
                          </p>
                        </div>
                      ))}
                    </div>

                    <div className="mt-7">
                      <div className="flex items-center justify-between font-ui text-[9px] uppercase tracking-[0.16em] text-[#8f9587]">
                        <span>Level {saved.level}</span>
                        <span>{saved.toNext} XP to level {saved.level + 1}</span>
                      </div>
                      <div
                        className="mt-2 h-1.5 bg-[#f2eadb]/12"
                        role="progressbar"
                        aria-label={`${saved.name}'s progress to level ${saved.level + 1}`}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={saved.percent}
                      >
                        <div className="h-full bg-[#c8aa6d]" style={{ width: `${saved.percent}%` }} />
                      </div>
                      <p className="mt-2 font-ui text-[10px] text-[#777f72]">
                        {saved.inLevel} XP earned this level
                      </p>
                    </div>

                    <div className="mt-6 grid gap-2 border-t border-[#f2eadb]/12 pt-5 font-ui text-[11px] leading-5 text-[#a9ad9f] sm:grid-cols-2">
                      <p>
                        Orientation · {saved.orientationSteps}/{saved.orientationTotal} steps
                      </p>
                      <p>
                        Midnight caper ·{" "}
                        {saved.nightComplete
                          ? "complete"
                          : saved.nightAttempts > 0
                            ? `${saved.nightAttempts} attempt${saved.nightAttempts === 1 ? "" : "s"}`
                            : "not started"}
                      </p>
                    </div>

                    <div className="mt-7 flex flex-wrap items-center gap-4">
                      <FocusLink href="/play">CONTINUE YOUR STORY</FocusLink>
                      <span className="font-ui text-[9px] uppercase tracking-[0.16em] text-[#777f72]">
                        Saved on this device
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="flex min-h-[280px] flex-col justify-between gap-8">
                    <div>
                      <p className="font-ui text-[9px] uppercase tracking-[0.22em] text-[#8f9587]">
                        No local save yet
                      </p>
                      <h3 className="mt-3 max-w-[440px] font-display text-[34px] leading-[1.02] text-[#f4eddf]">
                        Your first day is waiting at the gate.
                      </h3>
                      <p className="mt-4 max-w-[470px] font-ui text-[13px] leading-7 text-[#a9ad9f]">
                        Choose a student, meet your house and find your way around campus. The
                        browser game needs no account to start; your progress is stored locally.
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-4">
                      <FocusLink href="/play">BEGIN DAY ONE</FocusLink>
                      <span className="font-ui text-[9px] uppercase tracking-[0.16em] text-[#777f72]">
                        No invented stats here
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        <section className="relative isolate overflow-hidden bg-[#06120c] py-24 sm:py-28 lg:py-36">
          <img
            src="/campus/midnight.jpg"
            alt=""
            aria-hidden="true"
            className="absolute inset-0 h-full w-full object-cover"
            width={1280}
            height={720}
            loading="lazy"
            decoding="async"
          />
          <div className="absolute inset-0 bg-[#06120c]/78" aria-hidden="true" />
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(6,18,12,0.95),rgba(6,18,12,0.6)_55%,rgba(6,18,12,0.9))]" aria-hidden="true" />

          <div className="relative mx-auto max-w-[960px] px-5 text-center sm:px-8">
            <p className="font-ui text-[9px] uppercase tracking-[0.32em] text-[#c8aa6d] sm:text-[10px]">
              The gate is open
            </p>
            <h2 className="mx-auto mt-5 max-w-[800px] font-display text-[clamp(2.8rem,6.6vw,5.8rem)] leading-[0.9] tracking-[-0.03em] text-[#f6efdf]">
              READY FOR NAVODAYA LIFE?
            </h2>
            <p className="mx-auto mt-6 max-w-[520px] font-ui text-sm leading-7 text-[#cfc8b8] sm:text-base">
              Choose your path. Find your house. Create your memories.
            </p>
            <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <FocusLink href="/play">ENTER THE CAMPUS</FocusLink>
              {!authLoading && !isAuthenticated ? (
                <Link
                  to="/auth"
                  className="inline-flex min-h-11 items-center justify-center border border-[#f2eadb]/35 px-6 py-3.5 font-ui text-[10px] font-semibold uppercase tracking-[0.24em] text-[#f2eadb] transition-colors hover:border-[#f2eadb]/70 hover:bg-[#f2eadb]/8 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#d6ba7e]"
                >
                  Sign in
                </Link>
              ) : isAuthenticated ? (
                <span className="inline-flex min-h-11 items-center justify-center border border-[#78a982]/40 px-5 font-ui text-[9px] uppercase tracking-[0.2em] text-[#a8c6ad]">
                  Signed in · ready to play
                </span>
              ) : null}
            </div>
            <p className="mt-5 font-ui text-[9px] uppercase tracking-[0.18em] text-[#858d80]">
              No account required · Progress stored on this device
            </p>
          </div>
        </section>
      </main>

      <footer className="border-t border-[#f2eadb]/12 bg-[#06110b]">
        <div className="mx-auto max-w-[1320px] px-5 py-12 sm:px-8 sm:py-14">
          <div className="grid gap-10 lg:grid-cols-[1.4fr_0.8fr_0.8fr]">
            <div>
              <Link
                to="/"
                className="inline-flex items-center gap-3 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#d6ba7e]"
                aria-label="NAVODAYA: THE CAMPUS LIFE — home"
              >
                <span className="flex h-10 w-10 items-center justify-center border border-[#d6ba7e]/50 font-display text-[22px] leading-none text-[#e3cb98]">
                  N
                </span>
                <span className="leading-none">
                  <span className="block font-display text-[18px] tracking-[0.08em] text-[#f4eddf]">
                    NAVODAYA
                  </span>
                  <span className="mt-1.5 block font-ui text-[8px] uppercase tracking-[0.28em] text-[#a9ad9f]">
                    The Campus Life
                  </span>
                </span>
              </Link>
              <p className="mt-5 max-w-[360px] font-ui text-[12px] leading-6 text-[#8f9587]">
                An original fictional campus story inspired by the JNV residential-school
                experience. Not an official school website or a survey of JNV Bishnupur.
              </p>
            </div>

            <nav aria-label="Footer navigation">
              <p className="font-ui text-[9px] uppercase tracking-[0.22em] text-[#777f72]">Explore</p>
              <ul className="mt-4 space-y-3">
                {NAV_ITEMS.map((item) => (
                  <li key={item.href}>
                    <a
                      href={item.href}
                      className="font-ui text-[11px] uppercase tracking-[0.14em] text-[#b9b3a4] transition-colors hover:text-[#f2eadb] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#d6ba7e]"
                    >
                      {item.label}
                    </a>
                  </li>
                ))}
                <li>
                  <Link
                    to="/play"
                    className="font-ui text-[11px] uppercase tracking-[0.14em] text-[#e3cb98] transition-colors hover:text-[#f2eadb] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#d6ba7e]"
                  >
                    Play Now
                  </Link>
                </li>
              </ul>
            </nav>

            <div>
              <p className="font-ui text-[9px] uppercase tracking-[0.22em] text-[#777f72]">The campus</p>
              <p className="mt-4 font-ui text-[12px] leading-6 text-[#8f9587]">
                Four houses. A campus tour. One midnight caper. Built as a small, walkable story
                you can finish in a browser.
              </p>
              <p className="mt-5 flex items-center gap-2 font-ui text-[9px] uppercase tracking-[0.16em] text-[#777f72]">
                <span className="h-1.5 w-1.5 bg-[#78a982]" aria-hidden="true" />
                Local save · No fake rankings
              </p>
            </div>
          </div>

          <div className="mt-10 flex flex-col gap-3 border-t border-[#f2eadb]/10 pt-6 sm:flex-row sm:items-center sm:justify-between">
            <p className="font-ui text-[10px] tracking-[0.08em] text-[#777f72]">
              © {new Date().getFullYear()} NAVODAYA: THE CAMPUS LIFE
            </p>
            <p className="font-ui text-[9px] uppercase tracking-[0.16em] text-[#666f64]">
              Interpretive campus fiction · Made for the browser
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default Landing;
