import { motion } from "framer-motion";
import {
  ArrowRight,
  ArrowUpRight,
  Compass,
  Keyboard,
  MapPin,
  MonitorPlay,
  Mouse,
  Smartphone,
  Volume2,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router";
import { SaveSystem } from "@/game/core/SaveSystem";

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

function Reveal({
  children,
  delay = 0,
  className = "",
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 22 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-70px" }}
      transition={{ duration: 0.75, ease: EASE, delay }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/** Original key-art: a wide establishing shot of the fictional campus at dusk. */
function CampusPoster({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 1600 900"
      preserveAspectRatio="xMidYMid slice"
      className={className}
      role="img"
      aria-label="Illustration of the fictional Navodaya campus at golden hour, with the main gate, academic block and hostel silhouetted against a dusk sky."
    >
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1a2634" />
          <stop offset="32%" stopColor="#44515a" />
          <stop offset="58%" stopColor="#8f8272" />
          <stop offset="76%" stopColor="#d9a974" />
          <stop offset="100%" stopColor="#a76e45" />
        </linearGradient>
        <radialGradient id="sunGlow" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0%" stopColor="#ffe7bd" stopOpacity="0.95" />
          <stop offset="40%" stopColor="#f6c88a" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#e3a568" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="ground" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#4a4733" />
          <stop offset="45%" stopColor="#2b2b22" />
          <stop offset="100%" stopColor="#141510" />
        </linearGradient>
        <linearGradient id="hall" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3b3d34" />
          <stop offset="100%" stopColor="#191b16" />
        </linearGradient>
        <linearGradient id="hallFar" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#4c4e44" />
          <stop offset="100%" stopColor="#2a2c26" />
        </linearGradient>
        <linearGradient id="path" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#a58b64" stopOpacity="0.42" />
          <stop offset="100%" stopColor="#d3b47f" stopOpacity="0.06" />
        </linearGradient>
        <radialGradient id="haze" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0%" stopColor="#f4cf9c" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#f4cf9c" stopOpacity="0" />
        </radialGradient>
        <filter id="blurBig" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="38" />
        </filter>
        <filter id="blurSoft" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="6" />
        </filter>
        <linearGradient id="window" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffd9a0" />
          <stop offset="100%" stopColor="#e8a95f" />
        </linearGradient>
      </defs>

      <rect width="1600" height="900" fill="url(#sky)" />
      <ellipse cx="1130" cy="455" rx="430" ry="300" fill="url(#sunGlow)" />
      <ellipse cx="1130" cy="455" rx="340" ry="220" fill="url(#haze)" filter="url(#blurBig)" />
      <circle cx="1130" cy="452" r="58" fill="#ffe9c2" opacity="0.9" />
      <circle cx="1130" cy="452" r="74" fill="#ffd7a0" opacity="0.25" filter="url(#blurSoft)" />

      {/* High cloud streaks */}
      <g opacity="0.32" fill="#e7c7a1">
        <ellipse cx="380" cy="220" rx="270" ry="9" />
        <ellipse cx="700" cy="282" rx="190" ry="6" />
        <ellipse cx="1290" cy="196" rx="230" ry="8" />
        <ellipse cx="1030" cy="320" rx="320" ry="5" />
        <ellipse cx="240" cy="360" rx="200" ry="5" />
      </g>

      {/* Distant hills and treeline */}
      <path
        d="M0 612 C 180 560, 330 596, 470 570 C 620 542, 760 592, 930 566 C 1110 538, 1270 584, 1420 556 C 1500 542, 1560 556, 1600 548 L1600 700 L0 700 Z"
        fill="#4b4d41"
        opacity="0.55"
      />
      <g fill="#333a2f" opacity="0.85">
        <path d="M0 648 C 90 620, 150 648, 220 630 C 300 610, 360 640, 430 630 L430 690 L0 690 Z" />
        <path d="M1180 646 C 1240 618, 1320 640, 1390 620 C 1460 602, 1520 628, 1600 616 L1600 690 L1180 690 Z" />
      </g>

      {/* Campus blocks, far to near */}
      <g>
        <rect x="468" y="452" width="560" height="196" fill="url(#hallFar)" />
        <rect x="450" y="440" width="596" height="20" fill="#5b5c4f" />
        <rect x="700" y="398" width="96" height="54" fill="url(#hallFar)" />
        <path d="M700 398 L748 372 L796 398 Z" fill="#5f604f" />
        <g fill="url(#window)" opacity="0.6">
          {Array.from({ length: 11 }).map((_, index) => (
            <rect key={`far-a-${index}`} x={486 + index * 48} y={480} width="22" height="30" />
          ))}
          {Array.from({ length: 11 }).map((_, index) => (
            <rect key={`far-b-${index}`} x={486 + index * 48} y={538} width="22" height="30" />
          ))}
        </g>
        <g fill="url(#window)" opacity="0.22" filter="url(#blurSoft)">
          {Array.from({ length: 11 }).map((_, index) => (
            <rect key={`far-glow-${index}`} x={482 + index * 48} y={476} width="30" height="96" />
          ))}
        </g>

        {/* Academic block, left */}
        <rect x="118" y="468" width="322" height="188" fill="url(#hall)" />
        <rect x="102" y="456" width="354" height="16" fill="#4a4c41" />
        <rect x="146" y="430" width="52" height="30" fill="url(#hall)" />
        <rect x="356" y="424" width="58" height="36" fill="url(#hall)" />
        <g fill="url(#window)" opacity="0.55">
          {Array.from({ length: 6 }).map((_, index) => (
            <rect key={`acad-a-${index}`} x={146 + index * 46} y={498} width="20" height="26" />
          ))}
          {Array.from({ length: 6 }).map((_, index) => (
            <rect key={`acad-b-${index}`} x={146 + index * 46} y={556} width="20" height="26" />
          ))}
        </g>
        <g fill="#1a1c17">
          <rect x="118" y="612" width="322" height="44" />
        </g>
        <g stroke="#3f4137" strokeWidth="7" opacity="0.9">
          <line x1="176" y1="612" x2="176" y2="656" />
          <line x1="256" y1="612" x2="256" y2="656" />
          <line x1="336" y1="612" x2="336" y2="656" />
          <line x1="410" y1="612" x2="410" y2="656" />
        </g>

        {/* Hostel, right */}
        <rect x="1128" y="404" width="360" height="256" fill="url(#hall)" />
        <rect x="1112" y="392" width="392" height="16" fill="#45473d" />
        <g fill="url(#window)" opacity="0.52">
          {Array.from({ length: 3 }).map((_, row) =>
            Array.from({ length: 7 }).map((_, col) => (
              <rect
                key={`hostel-${row}-${col}`}
                x={1156 + col * 46}
                y={438 + row * 62}
                width="20"
                height="26"
              />
            )),
          )}
        </g>
        <g stroke="#3a3c33" strokeWidth="5" opacity="0.8">
          <line x1="1128" y1="492" x2="1488" y2="492" />
          <line x1="1128" y1="554" x2="1488" y2="554" />
          <line x1="1128" y1="616" x2="1488" y2="616" />
        </g>
        <rect x="1128" y="660" width="360" height="4" fill="#5c5a48" opacity="0.5" />
      </g>

      {/* Ground */}
      <rect y="652" width="1600" height="248" fill="url(#ground)" />

      {/* Central drive to the gate */}
      <path d="M760 900 L843 900 L840 700 L763 700 Z" fill="url(#path)" />
      <path d="M778 900 L808 900 L806 700 L780 700 Z" fill="#d7b886" opacity="0.14" />

      {/* Gate */}
      <g>
        <rect x="678" y="664" width="30" height="160" fill="#171914" />
        <rect x="890" y="664" width="30" height="160" fill="#171914" />
        <rect x="670" y="704" width="46" height="12" fill="#2c2e26" />
        <rect x="882" y="704" width="46" height="12" fill="#2c2e26" />
        <rect x="672" y="628" width="254" height="42" fill="#1c1e18" />
        <rect x="664" y="620" width="270" height="10" fill="#3d3f34" />
        <text
          x="799"
          y="658"
          textAnchor="middle"
          fill="#e8cfa0"
          fontSize="23"
          letterSpacing="7"
          fontFamily="Georgia, 'Times New Roman', serif"
        >
          NAVODAYA
        </text>
        <g stroke="#191b16" strokeWidth="4" opacity="0.9">
          <line x1="700" y1="690" x2="650" y2="770" />
          <line x1="714" y1="690" x2="664" y2="780" />
          <line x1="898" y1="690" x2="948" y2="770" />
          <line x1="884" y1="690" x2="934" y2="780" />
        </g>
        <g fill="#f2c987" opacity="0.65">
          <circle cx="664" cy="676" r="5" />
          <circle cx="934" cy="676" r="5" />
        </g>
      </g>

      {/* Foreground trees framing the shot */}
      <g fill="#151a14">
        <path d="M-20 900 L-20 520 C 20 500, 60 530, 62 574 C 108 556, 144 592, 132 632 C 186 626, 210 676, 176 708 C 214 726, 214 772, 184 792 L 206 900 Z" />
        <path d="M1620 900 L1620 470 C 1562 458, 1524 500, 1532 546 C 1476 550, 1454 606, 1482 640 C 1424 656, 1414 716, 1458 736 C 1420 764, 1428 812, 1470 826 L1452 900 Z" />
      </g>
      <g fill="#1d221a">
        <path d="M-10 900 L-10 760 C 46 742, 88 776, 84 812 C 122 808, 138 848, 118 872 L124 900 Z" />
        <path d="M1600 900 L1600 742 C 1540 730, 1504 770, 1516 806 C 1470 808, 1458 850, 1484 874 L1478 900 Z" />
      </g>
      <g fill="#2b3226" opacity="0.85">
        <ellipse cx="300" cy="700" rx="46" ry="20" />
        <ellipse cx="1210" cy="686" rx="52" ry="18" />
        <ellipse cx="1040" cy="702" rx="34" ry="12" />
      </g>

      {/* Path lamps and a walking figure, for scale */}
      <g>
        <g stroke="#23251e" strokeWidth="5">
          <line x1="716" y1="740" x2="716" y2="794" />
          <line x1="884" y1="740" x2="884" y2="794" />
        </g>
        <g fill="#ffdba6" opacity="0.8">
          <circle cx="716" cy="738" r="6" />
          <circle cx="884" cy="738" r="6" />
        </g>
        <g fill="#121410">
          <circle cx="886" cy="760" r="6" />
          <path d="M880 768 L892 768 L894 800 L887 800 L886 786 L884 800 L878 800 Z" />
        </g>
      </g>

      {/* Birds */}
      <g stroke="#2b2c26" strokeWidth="2.4" fill="none" opacity="0.65">
        <path d="M388 300 q 9 -8 18 0" />
        <path d="M412 290 q 8 -7 16 0" />
        <path d="M436 306 q 7 -6 14 0" />
        <path d="M912 252 q 9 -8 18 0" />
        <path d="M936 242 q 8 -7 16 0" />
      </g>

      {/* Warm horizon wash */}
      <rect y="540" width="1600" height="120" fill="#f3c68f" opacity="0.05" />
    </svg>
  );
}

const CAMPUS_FEATURES = [
  {
    name: "Vidya Bhavan",
    kind: "Academic block",
    copy: "A shaded veranda of classrooms facing the plaza. Room 12 has a blackboard, desks and a door that actually opens.",
  },
  {
    name: "Nilayam",
    kind: "Hostel",
    copy: "Ground-floor room with a bed, a study table and a window. The first place on campus that is yours.",
  },
  {
    name: "Annapoorna",
    kind: "Dining hall",
    copy: "Long tables under a high roof, a bell that runs the day, and a veranda made for the walk back at dusk.",
  },
  {
    name: "Gyan Mandir",
    kind: "Library",
    copy: "Tall windows, long reading tables and a portico on the quiet side of the campus. Open late.",
  },
  {
    name: "Khel Maidan",
    kind: "Sports ground",
    copy: "A dirt oval, two goalposts and the best light of the afternoon. Cross the east path to reach it.",
  },
  {
    name: "The Gate",
    kind: "Main entrance",
    copy: "Stone pillars, an open iron gate and Meera waiting just inside. Every walk begins and ends here.",
  },
];

const FIRST_DAY = [
  {
    title: "Meet your guide",
    detail: "Meera is standing just inside the main gate. She knows exactly who you are.",
  },
  {
    title: "Read the notice board",
    detail: "East of the assembly ground. Assembly timings, your classroom, library hours.",
  },
  {
    title: "Step into your classroom",
    detail: "Cross the veranda of the academic block and push the door to Room 12.",
  },
  {
    title: "Report to your room",
    detail: "The hostel is east of the plaza. Ground floor, door facing the assembly ground.",
  },
];

function Key({ children, wide = false }: { children: React.ReactNode; wide?: boolean }) {
  return (
    <kbd
      className={`flex h-9 items-center justify-center rounded-[3px] border border-foreground/25 bg-foreground/5 px-2 font-ui text-[11px] text-foreground/75 shadow-[0_2px_0_rgba(0,0,0,0.5)] ${
        wide ? "min-w-24" : "min-w-9"
      }`}
    >
      {children}
    </kbd>
  );
}

export default function Landing() {
  const [hasSave, setHasSave] = useState(false);

  useEffect(() => {
    setHasSave(new SaveSystem().load().ok);
  }, []);

  return (
    <div className="min-h-screen scroll-smooth bg-[#0b0a08] font-ui text-foreground">
      {/* ---------------------------------------------------------------- hero */}
      <section className="film-grain relative min-h-[100svh] overflow-hidden">
        <div className="absolute inset-0">
          <CampusPoster className="h-full w-full animate-slow-zoom object-cover" />
        </div>
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(100deg,rgba(8,7,5,0.93)_0%,rgba(8,7,5,0.7)_34%,rgba(8,7,5,0.22)_62%,rgba(8,7,5,0.55)_100%)]" />
        <div className="pointer-events-none absolute inset-0 vignette" />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-black/80" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1 bg-black/80" />

        <div className="relative z-10 mx-auto flex min-h-[100svh] w-full max-w-[1400px] flex-col px-6 sm:px-10 lg:px-14">
          <header className="flex items-center justify-between gap-6 border-b border-foreground/10 py-5">
            <Link to="/" className="flex items-center gap-3" aria-label="Navodaya home">
              <span className="block h-9 w-px bg-primary/70" />
              <span>
                <span className="block font-display text-base tracking-[0.34em] text-[#f2e7d2]">
                  NAVODAYA
                </span>
                <span className="mt-0.5 block font-ui text-[8px] uppercase tracking-[0.36em] text-foreground/45">
                  The Campus Life
                </span>
              </span>
            </Link>

            <nav className="hidden items-center gap-8 md:flex" aria-label="Sections">
              {[
                { href: "#campus", label: "The campus" },
                { href: "#first-day", label: "First day" },
                { href: "#controls", label: "How it plays" },
              ].map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  className="font-ui text-[10px] uppercase tracking-[0.24em] text-foreground/55 transition-colors hover:text-primary"
                >
                  {item.label}
                </a>
              ))}
            </nav>

            <Link
              to="/play"
              className="group inline-flex items-center gap-2.5 border border-primary/45 bg-black/25 px-4 py-2.5 font-ui text-[10px] uppercase tracking-[0.24em] text-primary transition-colors hover:border-primary hover:bg-primary/10"
            >
              Enter campus
              <ArrowUpRight className="size-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </Link>
          </header>

          <div className="flex flex-1 items-end pb-12 pt-20 sm:items-center sm:pb-16">
            <motion.div
              initial={{ opacity: 0, y: 26 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1, ease: EASE }}
              className="w-full max-w-3xl"
            >
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                <span className="label-cinema text-primary/85">Phase One · Playable prototype</span>
                <span className="hidden h-px w-12 bg-primary/30 sm:block" />
                <span className="font-ui text-[10px] uppercase tracking-[0.24em] text-foreground/45">
                  Single player · 3D
                </span>
              </div>

              <h1 className="mt-5 font-display text-[clamp(3.6rem,10.5vw,8.4rem)] leading-[0.86] tracking-[0.035em] text-[#f5ecdb] drop-shadow-[0_18px_50px_rgba(0,0,0,0.65)]">
                NAVODAYA
              </h1>
              <p className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
                <span className="font-ui text-[clamp(0.7rem,2.1vw,0.95rem)] uppercase tracking-[0.55em] text-[#e0c18d]">
                  The Campus Life
                </span>
                <span className="h-px w-16 bg-[#e0c18d]/35" />
                <span className="font-ui text-[10px] uppercase tracking-[0.22em] text-foreground/40">
                  Term II · Golden hour
                </span>
              </p>

              <p className="mt-7 max-w-xl font-display text-xl leading-relaxed text-[#efe3cb]/90 sm:text-[1.4rem]">
                Some places teach you before the first bell.
              </p>
              <p className="mt-3 max-w-xl font-ui text-[13px] leading-relaxed text-foreground/60">
                An original residential campus you can walk end to end. Read the board, find your
                classroom, unpack your room — and meet the senior who will point you the right way.
              </p>

              <div className="mt-9 flex flex-wrap items-center gap-3">
                <Link
                  to="/play"
                  className="group inline-flex items-center gap-3 border border-primary/70 bg-primary/15 px-6 py-4 font-ui text-[11px] uppercase tracking-[0.28em] text-primary transition hover:bg-primary/25 hover:shadow-[0_0_40px_-10px_rgba(217,184,119,0.5)]"
                >
                  Enter the campus
                  <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
                </Link>
                <a
                  href="#campus"
                  className="inline-flex items-center gap-2 border border-foreground/20 px-5 py-4 font-ui text-[11px] uppercase tracking-[0.24em] text-foreground/60 transition hover:border-foreground/40 hover:text-foreground"
                >
                  <Compass className="size-4" />
                  View the campus
                </a>
              </div>

              <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 font-ui text-[9px] uppercase tracking-[0.22em] text-foreground/35">
                <span className="inline-flex items-center gap-2">
                  <Mouse className="size-3" /> Keyboard & touch
                </span>
                <span className="inline-flex items-center gap-2">
                  <MapPin className="size-3" /> No account needed
                </span>
                <span className="inline-flex items-center gap-2">
                  <Volume2 className="size-3" /> Procedural ambience
                </span>
                {hasSave && <span className="text-primary/60">Local save found</span>}
              </div>
            </motion.div>
          </div>

          <div className="flex items-center justify-between gap-4 border-t border-foreground/10 py-4">
            <p className="font-ui text-[9px] uppercase tracking-[0.26em] text-foreground/30">
              An original fictional campus
            </p>
            <p className="hidden font-ui text-[9px] uppercase tracking-[0.26em] text-foreground/30 sm:block">
              Walk · Look · Interact · Save
            </p>
            <p className="font-ui text-[9px] uppercase tracking-[0.26em] text-foreground/30">
              Phase 1 / 1
            </p>
          </div>
        </div>
      </section>

      {/* -------------------------------------------------------------- campus */}
      <section id="campus" className="relative border-t border-foreground/10 bg-[#0d0c09]">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(70%_50%_at_15%_0%,rgba(183,140,82,0.08),transparent_70%)]" />
        <div className="relative mx-auto w-full max-w-[1400px] px-6 py-20 sm:px-10 sm:py-28 lg:px-14">
          <Reveal className="grid gap-10 lg:grid-cols-[1fr_1.1fr] lg:items-end">
            <div>
              <p className="label-cinema text-primary/70">01 — The campus</p>
              <h2 className="mt-5 max-w-md font-display text-[clamp(2.4rem,5vw,4rem)] leading-[1.02] text-[#f2e8d5]">
                Small on purpose. <span className="text-foreground/45">Walkable in a minute.</span>
              </h2>
            </div>
            <div className="max-w-xl">
              <p className="font-ui text-sm leading-relaxed text-foreground/60">
                Navodaya is not a city. It is a gate, a plaza, a handful of buildings and the paths
                between them — every one of them built from scratch for this game, with no real
                school map underneath.
              </p>
              <p className="mt-3 font-ui text-sm leading-relaxed text-foreground/40">
                Two of these buildings can be entered. The rest you will learn by looking.
              </p>
            </div>
          </Reveal>

          <div className="mt-14 grid grid-cols-1 border-l border-t border-foreground/12 sm:grid-cols-2 lg:grid-cols-3">
            {CAMPUS_FEATURES.map((feature, index) => (
              <Reveal
                key={feature.name}
                delay={index * 0.05}
                className="group border-b border-r border-foreground/12 transition-colors hover:bg-white/[0.025]"
              >
                <div className="flex h-full flex-col p-6 sm:p-7">
                  <div className="flex items-baseline justify-between gap-4">
                    <p className="font-ui text-[10px] tracking-[0.28em] text-primary/55">
                      {String(index + 1).padStart(2, "0")}
                    </p>
                    <p className="font-ui text-[9px] uppercase tracking-[0.22em] text-foreground/30">
                      {feature.kind}
                    </p>
                  </div>
                  <h3 className="mt-6 font-display text-2xl tracking-wide text-[#f0e5d0]">
                    {feature.name}
                  </h3>
                  <p className="mt-3 max-w-xs font-ui text-[12px] leading-relaxed text-foreground/50">
                    {feature.copy}
                  </p>
                  <div className="mt-auto pt-6">
                    <span className="block h-px w-8 bg-primary/30 transition-all duration-500 group-hover:w-16 group-hover:bg-primary/70" />
                  </div>
                </div>
              </Reveal>
            ))}
          </div>

          <Reveal className="mt-8 flex flex-wrap items-center gap-3 font-ui text-[10px] uppercase tracking-[0.22em] text-foreground/30">
            <MonitorPlay className="size-3.5 text-primary/50" />
            Real-time 3D · Third-person camera · Collision on every wall
          </Reveal>
        </div>
      </section>

      {/* ------------------------------------------------------------ first day */}
      <section id="first-day" className="relative overflow-hidden border-t border-foreground/10">
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,#121009_0%,#0b0a08_60%)]" />
        <div className="relative mx-auto grid w-full max-w-[1400px] gap-16 px-6 py-20 sm:px-10 sm:py-28 lg:grid-cols-[0.9fr_1.1fr] lg:px-14">
          <div className="lg:sticky lg:top-16 lg:self-start">
            <Reveal>
              <p className="label-cinema text-primary/70">02 — Your first day</p>
              <h2 className="mt-5 max-w-sm font-display text-[clamp(2.4rem,5vw,4rem)] leading-[1.02] text-[#f2e8d5]">
                One objective at a time.
              </h2>
              <p className="mt-5 max-w-sm font-ui text-sm leading-relaxed text-foreground/55">
                The first mission is a short walk through the places that matter. Meera gives you the
                order; the campus gives you the reason to slow down.
              </p>
              <Link
                to="/play"
                className="group mt-8 inline-flex items-center gap-3 font-ui text-[10px] uppercase tracking-[0.26em] text-primary transition hover:text-[#f0d9a7]"
              >
                Start the walk
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
              </Link>
            </Reveal>

            <Reveal delay={0.1} className="mt-12 hidden lg:block">
              <div className="paper-sheet relative w-full max-w-sm -rotate-[1.2deg] px-7 py-6">
                <span className="absolute -top-2 left-1/2 h-4 w-16 -translate-x-1/2 bg-[#8a6f42]/25" />
                <p className="font-ui text-[9px] uppercase tracking-[0.28em] text-[#8a6f42]">
                  From the game
                </p>
                <p className="mt-4 font-display text-[1.35rem] leading-snug text-[#372d1e]">
                  “Navodaya isn't only a school. Classrooms, hostel, dining hall, library — all of it
                  sits inside these walls.”
                </p>
                <p className="mt-5 font-ui text-[10px] uppercase tracking-[0.22em] text-[#7a6442]">
                  Meera · Third year · Ravi House
                </p>
              </div>
            </Reveal>
          </div>

          <div>
            <div className="border-t border-foreground/12">
              {FIRST_DAY.map((step, index) => (
                <Reveal key={step.title} delay={index * 0.06}>
                  <div className="group grid grid-cols-[auto_1fr] gap-5 border-b border-foreground/12 py-6 transition-colors hover:bg-white/[0.02] sm:gap-8 sm:py-8">
                    <div className="flex flex-col items-center">
                      <span className="flex size-9 items-center justify-center rounded-full border border-primary/35 font-display text-sm text-primary/80 transition group-hover:border-primary/80">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      {index < FIRST_DAY.length - 1 && (
                        <span className="mt-3 w-px flex-1 bg-gradient-to-b from-primary/25 to-transparent" />
                      )}
                    </div>
                    <div className="pb-1">
                      <h3 className="font-display text-2xl text-[#f0e5d0]">{step.title}</h3>
                      <p className="mt-2 max-w-md font-ui text-[12px] leading-relaxed text-foreground/50">
                        {step.detail}
                      </p>
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
            <Reveal delay={0.2}>
              <p className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-2 font-ui text-[9px] uppercase tracking-[0.22em] text-foreground/30">
                <span>~10 minutes</span>
                <span className="size-1 rounded-full bg-foreground/25" />
                <span>4 objectives</span>
                <span className="size-1 rounded-full bg-foreground/25" />
                <span>Saves after each step</span>
              </p>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------- controls */}
      <section id="controls" className="relative border-t border-foreground/10 bg-[#0d0c09]">
        <div className="mx-auto w-full max-w-[1400px] px-6 py-20 sm:px-10 sm:py-28 lg:px-14">
          <Reveal className="max-w-2xl">
            <p className="label-cinema text-primary/70">03 — How it plays</p>
            <h2 className="mt-5 font-display text-[clamp(2.4rem,5vw,4rem)] leading-[1.02] text-[#f2e8d5]">
              Two thumbs, or a keyboard. Both work.
            </h2>
            <p className="mt-5 font-ui text-sm leading-relaxed text-foreground/55">
              A third-person camera that follows you through doorways. Collision on every building,
              wall and tree. No pointer gimmicks on phones.
            </p>
          </Reveal>

          <div className="mt-14 grid gap-8 lg:grid-cols-2">
            <Reveal className="border border-foreground/12 bg-[#11100d] p-7 sm:p-9">
              <div className="flex items-center justify-between">
                <p className="label-cinema flex items-center gap-2 text-primary/70">
                  <Keyboard className="size-3.5" /> Keyboard & mouse
                </p>
                <span className="font-ui text-[9px] uppercase tracking-[0.2em] text-foreground/30">
                  Desktop
                </span>
              </div>

              <div className="mt-10 grid gap-10 sm:grid-cols-[auto_1fr] sm:items-center">
                <div>
                  <div className="grid w-max grid-cols-3 gap-1.5">
                    <span />
                    <Key>W</Key>
                    <span />
                    <Key>A</Key>
                    <Key>S</Key>
                    <Key>D</Key>
                  </div>
                  <p className="mt-3 font-ui text-[10px] uppercase tracking-[0.2em] text-foreground/35">
                    Walk
                  </p>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-4 border-b border-foreground/10 pb-3">
                    <span className="font-ui text-xs text-foreground/60">Look around</span>
                    <span className="flex items-center gap-1.5 font-ui text-[10px] uppercase tracking-[0.18em] text-foreground/40">
                      <Mouse className="size-3" /> Drag
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-4 border-b border-foreground/10 pb-3">
                    <span className="font-ui text-xs text-foreground/60">Jump</span>
                    <Key>Space</Key>
                  </div>
                  <div className="flex items-center justify-between gap-4 border-b border-foreground/10 pb-3">
                    <span className="font-ui text-xs text-foreground/60">Interact</span>
                    <Key>E</Key>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <span className="font-ui text-xs text-foreground/60">Pause</span>
                    <Key>Esc</Key>
                  </div>
                </div>
              </div>

              <div className="mt-8 flex items-center gap-2 border-t border-foreground/10 pt-4">
                <Key wide>Shift</Key>
                <span className="font-ui text-[10px] uppercase tracking-[0.18em] text-foreground/35">
                  Run
                </span>
              </div>
            </Reveal>

            <Reveal delay={0.08} className="border border-foreground/12 bg-[#11100d] p-7 sm:p-9">
              <div className="flex items-center justify-between">
                <p className="label-cinema flex items-center gap-2 text-primary/70">
                  <Smartphone className="size-3.5" /> Touch
                </p>
                <span className="font-ui text-[9px] uppercase tracking-[0.2em] text-foreground/30">
                  Android & mobile web
                </span>
              </div>

              <div className="mt-9 flex items-center justify-between gap-6 rounded-sm border border-foreground/10 bg-[#0b0a08]/60 p-6">
                <div className="flex flex-col items-center gap-3">
                  <div className="relative flex size-24 items-center justify-center rounded-full border border-primary/25">
                    <div className="absolute inset-3 rounded-full border border-dashed border-primary/15" />
                    <div className="flex size-10 items-center justify-center rounded-full border border-primary/45 bg-primary/15">
                      <div className="size-1.5 rounded-full bg-primary/80" />
                    </div>
                  </div>
                  <span className="font-ui text-[9px] uppercase tracking-[0.22em] text-foreground/35">
                    Move
                  </span>
                </div>
                <div className="flex flex-col items-center gap-3">
                  <span className="flex size-12 items-center justify-center rounded-full border border-foreground/20 font-ui text-[9px] uppercase text-foreground/40">
                    Jump
                  </span>
                  <span className="flex size-16 items-center justify-center rounded-full border border-primary/45 bg-primary/10 font-ui text-[9px] uppercase tracking-[0.1em] text-primary/80">
                    Interact
                  </span>
                </div>
              </div>

              <div className="mt-7 space-y-3">
                <div className="flex items-center justify-between gap-4 border-b border-foreground/10 pb-3">
                  <span className="font-ui text-xs text-foreground/60">Look around</span>
                  <span className="font-ui text-[10px] uppercase tracking-[0.18em] text-foreground/40">
                    Drag right side
                  </span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="font-ui text-xs text-foreground/60">Performance</span>
                  <span className="font-ui text-[10px] uppercase tracking-[0.18em] text-foreground/40">
                    Adaptive quality
                  </span>
                </div>
              </div>
            </Reveal>
          </div>

          <div className="mt-10 grid gap-px border border-foreground/12 bg-foreground/10 sm:grid-cols-3">
            {[
              {
                title: "Instant start",
                copy: "No sign-up gate. Press play and you are at the main gate.",
              },
              {
                title: "Local saves",
                copy: "Position, character, mission and settings — restored safely, even after a corrupt file.",
              },
              {
                title: "Built to hold up",
                copy: "Merged geometry, procedural textures, capped shadows and an adaptive quality fallback.",
              },
            ].map((item) => (
              <div key={item.title} className="bg-[#0f0e0b] p-6">
                <h3 className="font-display text-lg text-[#ece1cb]">{item.title}</h3>
                <p className="mt-2 font-ui text-[11px] leading-relaxed text-foreground/45">
                  {item.copy}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* -------------------------------------------------------------- closing */}
      <section className="film-grain relative overflow-hidden border-t border-foreground/10">
        <div className="absolute inset-0">
          <CampusPoster className="h-full w-full object-cover opacity-45" />
        </div>
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(11,10,8,0.85),rgba(11,10,8,0.65)_45%,rgba(11,10,8,0.95))]" />
        <div className="pointer-events-none absolute inset-0 vignette opacity-70" />
        <div className="relative mx-auto flex w-full max-w-[1400px] flex-col items-center px-6 py-24 text-center sm:px-10 sm:py-32">
          <p className="label-cinema text-primary/75">Term begins</p>
          <h2 className="mt-6 font-display text-[clamp(2.8rem,7vw,5.2rem)] leading-none text-[#f6eddc]">
            The gate is open.
          </h2>
          <p className="mt-5 max-w-lg font-ui text-sm leading-relaxed text-foreground/55">
            Walk in, look around, and take your time. Meera is waiting just past the pillars.
          </p>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <Link
              to="/play"
              className="group inline-flex items-center gap-3 border border-primary/70 bg-primary/15 px-7 py-4 font-ui text-[11px] uppercase tracking-[0.28em] text-primary transition hover:bg-primary/25"
            >
              Enter the campus
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
            </Link>
            {hasSave && (
              <span className="font-ui text-[10px] uppercase tracking-[0.2em] text-foreground/35">
                Continue from the main menu
              </span>
            )}
          </div>
        </div>
      </section>

      {/* --------------------------------------------------------------- footer */}
      <footer className="border-t border-foreground/10 bg-[#080706]">
        <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-8 px-6 py-10 sm:px-10 lg:px-14">
          <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-start">
            <div>
              <p className="font-display text-sm tracking-[0.34em] text-[#e9dcc4]">NAVODAYA</p>
              <p className="mt-1 font-ui text-[9px] uppercase tracking-[0.3em] text-foreground/30">
                The Campus Life · Phase One
              </p>
            </div>
            <nav className="flex flex-wrap gap-x-8 gap-y-2" aria-label="Footer">
              <a
                href="#campus"
                className="font-ui text-[9px] uppercase tracking-[0.22em] text-foreground/35 transition hover:text-primary"
              >
                The campus
              </a>
              <a
                href="#first-day"
                className="font-ui text-[9px] uppercase tracking-[0.22em] text-foreground/35 transition hover:text-primary"
              >
                First day
              </a>
              <a
                href="#controls"
                className="font-ui text-[9px] uppercase tracking-[0.22em] text-foreground/35 transition hover:text-primary"
              >
                Controls
              </a>
              <Link
                to="/play"
                className="font-ui text-[9px] uppercase tracking-[0.22em] text-primary/70 transition hover:text-primary"
              >
                Play
              </Link>
            </nav>
          </div>

          <div className="flex flex-col justify-between gap-4 border-t border-foreground/10 pt-6 font-ui text-[9px] uppercase tracking-[0.1em] leading-relaxed text-foreground/25 sm:flex-row sm:items-end">
            <p className="max-w-2xl normal-case tracking-normal">
              Navodaya: The Campus Life is a work of fiction. The campus, staff and residents are
              original and are not based on any real school, map or floor plan. Progress is stored in
              this browser only.
            </p>
            <p className="shrink-0 uppercase tracking-[0.2em]">
              Three.js · React · Local save
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
