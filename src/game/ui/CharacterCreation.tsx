import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Check, LogOut, Shield } from "lucide-react";
import { useMemo, useState } from "react";
import {
  DEFAULT_CHARACTER_ID,
  DEFAULT_HOUSE_ID,
  HOUSES,
  getHouse,
  type HouseId,
} from "../data/houses";
import { getStudentsForHouse, getStudent } from "../data/students";
import { standingsForHouse } from "../data/competitions";
import type { GameEngine } from "../core/GameEngine";
import { HouseEmblem, HouseFlag, StudentAvatar } from "./HouseVisuals";

type Stage = "house" | "house-confirm" | "students" | "character" | "final";

const STAGE_LABEL: Record<Stage, string> = {
  house: "Select house",
  "house-confirm": "Confirm house",
  students: "Select student",
  character: "Preview & confirm",
  final: "Enter campus",
};

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

export function CharacterCreation({
  engine,
}: {
  engine: GameEngine | null;
}) {
  const [stage, setStage] = useState<Stage>("house");
  const [selectedHouseId, setSelectedHouseId] = useState<HouseId>(DEFAULT_HOUSE_ID);
  const [selectedStudentId, setSelectedStudentId] = useState<string>(DEFAULT_CHARACTER_ID);
  const [error, setError] = useState<string | null>(null);

  const house = getHouse(selectedHouseId) ?? getHouse(DEFAULT_HOUSE_ID)!;
  const students = useMemo(() => getStudentsForHouse(selectedHouseId), [selectedHouseId]);
  const selectedStudent =
    getStudent(selectedStudentId)?.houseId === selectedHouseId
      ? getStudent(selectedStudentId)!
      : students[0];
  const standing = standingsForHouse(selectedHouseId);

  const chooseHouse = (houseId: HouseId) => {
    setSelectedHouseId(houseId);
    setSelectedStudentId(getStudentsForHouse(houseId)[0]?.id ?? "");
    setError(null);
  };

  const enterCampus = () => {
    if (!engine || !selectedStudent) return;
    const result = engine.startNewGameWith(selectedHouseId, selectedStudent.id);
    if (!result.ok) setError(result.error ?? "That selection could not be confirmed.");
  };

  return (
    <div className="film-grain absolute inset-0 z-40 overflow-y-auto bg-[#0a0907]/94 text-foreground backdrop-blur-[2px]">
      <div
        className="pointer-events-none fixed inset-0 opacity-40"
        style={{
          background: `radial-gradient(80% 60% at 18% 0%, ${house.color}30, transparent 60%), radial-gradient(60% 50% at 90% 20%, ${house.color}18, transparent 60%)`,
        }}
      />
      <div className="pointer-events-none fixed inset-0 vignette opacity-80" />
      <div className="relative mx-auto flex min-h-full w-full max-w-[1320px] flex-col px-5 py-6 sm:px-9 sm:py-8">
        <header className="flex flex-wrap items-start justify-between gap-5 border-b border-foreground/12 pb-5">
          <div>
            <p className="label-cinema text-primary/75">New game · Character creation</p>
            <h1 className="mt-2 font-display text-[clamp(2rem,5vw,3.4rem)] leading-none tracking-wide text-[#f5ead5]">
              Choose where you belong.
            </h1>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden items-center gap-2 sm:flex" aria-label="Creation progress">
              {(["house", "house-confirm", "students", "character", "final"] as Stage[]).map(
                (item, index) => {
                  const order = ["house", "house-confirm", "students", "character", "final"];
                  const active = order.indexOf(stage) >= index;
                  return (
                    <span
                      key={item}
                      className={`h-[3px] w-7 ${active ? "bg-primary" : "bg-foreground/15"}`}
                    />
                  );
                },
              )}
            </div>
            <button
              type="button"
              onClick={() => engine?.cancelCreation()}
              className="inline-flex items-center gap-2 border border-foreground/15 px-3 py-2 font-ui text-[9px] uppercase tracking-[0.2em] text-foreground/50 transition hover:border-foreground/35 hover:text-foreground/80"
            >
              <LogOut className="size-3" /> Title
            </button>
          </div>
        </header>

        <div className="flex items-center justify-between gap-4 py-3 font-ui text-[9px] uppercase tracking-[0.24em] text-foreground/30">
          <span data-testid="creation-stage">{STAGE_LABEL[stage]}</span>
          <span>
            {house.shortName} House · {standing?.points ?? 0} pts · Rank {standing?.rank ?? "—"}
          </span>
        </div>

        <AnimatePresence mode="wait">
          <motion.main
            key={stage}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.38, ease: EASE }}
            className="flex-1 py-5"
          >
            {stage === "house" && (
              <section>
                <div className="max-w-2xl">
                  <p className="label-cinema" style={{ color: house.color }}>
                    01 · Four houses
                  </p>
                  <p className="mt-3 font-display text-xl leading-relaxed text-foreground/80 sm:text-2xl">
                    Every student belongs to exactly one house. Your house sets your hostel,
                    your colours and the House Cup table you wake up to.
                  </p>
                  <p className="mt-2 font-ui text-[11px] leading-relaxed text-foreground/40">
                    Aravali is preselected for the initial character. You can choose any house
                    before confirming.
                  </p>
                </div>

                <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  {HOUSES.map((candidate) => {
                    const selected = candidate.id === selectedHouseId;
                    const points = standingsForHouse(candidate.id);
                    return (
                      <button
                        key={candidate.id}
                        type="button"
                        data-testid={`house-card-${candidate.id}`}
                        aria-pressed={selected}
                        onClick={() => chooseHouse(candidate.id)}
                        className={`group relative overflow-hidden border p-5 text-left transition duration-300 ${
                          selected
                            ? "border-[#f8eed6]/55 bg-[#15130f] shadow-[0_30px_80px_-50px_rgba(0,0,0,1)]"
                            : "border-foreground/12 bg-[#100e0b]/75 hover:border-foreground/30 hover:bg-[#15120e]"
                        }`}
                        style={selected ? { boxShadow: `inset 0 0 0 1px ${candidate.color}55, 0 30px 70px -50px #000` } : undefined}
                      >
                        <span
                          className="pointer-events-none absolute inset-x-0 top-0 h-1"
                          style={{ backgroundColor: candidate.color }}
                        />
                        <div className="flex items-start justify-between gap-3">
                          <HouseEmblem houseId={candidate.id} size={46} />
                          {selected && (
                            <span
                              className="inline-flex items-center gap-1.5 border px-2 py-1 font-ui text-[8px] uppercase tracking-[0.2em]"
                              style={{ borderColor: `${candidate.color}99`, color: "#f8eed6" }}
                            >
                              <Check className="size-2.5" /> Selected
                            </span>
                          )}
                        </div>
                        <h2 className="mt-5 font-display text-2xl leading-tight text-[#f4ead6]">
                          {candidate.name}
                        </h2>
                        <p className="mt-1 font-display text-[12px] italic" style={{ color: candidate.color }}>
                          {candidate.motto}
                        </p>
                        <p className="mt-3 font-ui text-[11px] leading-relaxed text-foreground/50">
                          {candidate.description}
                        </p>
                        <div className="mt-5 flex items-end justify-between gap-3 border-t border-foreground/10 pt-3">
                          <div>
                            <p className="label-cinema text-[8px] text-foreground/30">Hostel</p>
                            <p className="mt-1 font-display text-sm text-foreground/75">
                              {candidate.hostelName}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="label-cinema text-[8px] text-foreground/30">Term I</p>
                            <p className="mt-1 font-display text-sm text-foreground/75">
                              {points?.points ?? 0} pts · #{points?.rank ?? "—"}
                            </p>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>

                <div className="mt-8 flex flex-wrap items-center justify-between gap-4 border-t border-foreground/10 pt-5">
                  <p className="max-w-xl font-ui text-[10px] leading-relaxed text-foreground/35">
                    House membership is stored as a single assignment. The save loader rejects
                    invalid house IDs and student/house mismatches.
                  </p>
                  <button
                    type="button"
                    onClick={() => setStage("house-confirm")}
                    className="inline-flex items-center gap-3 border border-primary/65 bg-primary/12 px-6 py-3.5 font-ui text-[10px] uppercase tracking-[0.26em] text-primary transition hover:bg-primary/20"
                  >
                    Continue with {house.shortName}
                    <ArrowRight className="size-3.5" />
                  </button>
                </div>
              </section>
            )}

            {stage === "house-confirm" && (
              <section className="grid gap-8 lg:grid-cols-[0.8fr_1.1fr] lg:items-center">
                <motion.div
                  initial={{ opacity: 0, rotateY: -10, scale: 0.97 }}
                  animate={{ opacity: 1, rotateY: 0, scale: 1 }}
                  transition={{ duration: 0.6, ease: EASE }}
                  className="mx-auto w-full max-w-sm"
                >
                  <HouseFlag houseId={house.id} className="aspect-[4/3] shadow-[0_50px_120px_-50px_rgba(0,0,0,0.95)]" />
                </motion.div>
                <div>
                  <p className="label-cinema" style={{ color: house.color }}>
                    02 · Confirm your house
                  </p>
                  <h2 className="mt-3 font-display text-4xl leading-tight text-[#f4ead6] sm:text-5xl">
                    {house.name}
                  </h2>
                  <p className="mt-3 font-display text-lg italic text-foreground/55">{house.motto}</p>
                  <p className="mt-5 max-w-xl font-ui text-[13px] leading-relaxed text-foreground/60">
                    {house.description}
                  </p>
                  <div className="mt-6 grid max-w-lg grid-cols-2 gap-px overflow-hidden border border-foreground/12 bg-foreground/10">
                    <div className="bg-[#12100c] p-4">
                      <p className="label-cinema text-[8px] text-foreground/35">Your hostel</p>
                      <p className="mt-1.5 font-display text-base text-foreground/85">{house.hostelName}</p>
                    </div>
                    <div className="bg-[#12100c] p-4">
                      <p className="label-cinema text-[8px] text-foreground/35">House points</p>
                      <p className="mt-1.5 font-display text-base text-foreground/85">
                        {standing?.points ?? 0} · Rank {standing?.rank ?? "—"}
                      </p>
                    </div>
                  </div>
                  <p className="mt-5 max-w-lg border-l border-primary/40 pl-3 font-ui text-[10px] leading-relaxed text-foreground/35">
                    Confirming locks this house to this save. To choose another house later, start a
                    new game — existing progress is not silently rewritten.
                  </p>
                  <div className="mt-7 flex flex-wrap gap-3">
                    <button
                      type="button"
                      data-testid="confirm-house"
                      onClick={() => setStage("students")}
                      className="inline-flex items-center gap-2.5 border border-primary/65 bg-primary/14 px-5 py-3 font-ui text-[10px] uppercase tracking-[0.24em] text-primary transition hover:bg-primary/22"
                    >
                      <Shield className="size-3.5" /> Confirm {house.shortName}
                    </button>
                    <button
                      type="button"
                      onClick={() => setStage("house")}
                      className="inline-flex items-center gap-2 border border-foreground/15 px-4 py-3 font-ui text-[10px] uppercase tracking-[0.2em] text-foreground/55 transition hover:border-foreground/35"
                    >
                      <ArrowLeft className="size-3" /> Change house
                    </button>
                  </div>
                </div>
              </section>
            )}

            {stage === "students" && (
              <section>
                <div className="flex flex-wrap items-end justify-between gap-4">
                  <div>
                    <p className="label-cinema" style={{ color: house.color }}>
                      03 · {house.name} students
                    </p>
                    <h2 className="mt-2 font-display text-3xl text-[#f4ead6] sm:text-4xl">
                      Who are you this term?
                    </h2>
                    <p className="mt-2 max-w-2xl font-ui text-[11px] leading-relaxed text-foreground/45">
                      Only published {house.shortName} House records are shown. The supplied roster
                      has no photographs or biographies, so the gallery uses initials rather than
                      invented likenesses.
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <HouseEmblem houseId={house.id} size={34} />
                    <span className="font-ui text-[10px] uppercase tracking-[0.2em] text-foreground/40">
                      {students.length} published
                    </span>
                  </div>
                </div>

                <div className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                  {students.map((student) => {
                    const active = student.id === selectedStudent?.id;
                    return (
                      <button
                        key={student.id}
                        type="button"
                        data-testid={`student-card-${student.id}`}
                        aria-pressed={active}
                        onClick={() => {
                          setSelectedStudentId(student.id);
                          setStage("character");
                        }}
                        className={`group overflow-hidden border text-left transition duration-300 ${
                          active
                            ? "border-[#f8eed6]/60 bg-[#17130f]"
                            : "border-foreground/12 bg-[#100e0b]/80 hover:border-foreground/30"
                        }`}
                        style={active ? { boxShadow: `inset 0 0 0 1px ${house.color}66` } : undefined}
                      >
                        <StudentAvatar
                          student={student}
                          className="aspect-[4/3] w-full"
                          showPhotoNote
                        />
                        <div className="p-3.5">
                          <p className="font-display text-lg leading-tight text-[#f2e7d2]">
                            {student.displayName}
                          </p>
                          <div className="mt-1.5 flex items-center justify-between gap-2">
                            <span className="font-ui text-[9px] uppercase tracking-[0.18em] text-foreground/35">
                              {student.id}
                            </span>
                            <span
                              className="size-2 rounded-full"
                              style={{ backgroundColor: house.color }}
                            />
                          </div>
                          <p className="mt-1 font-ui text-[9px] uppercase tracking-[0.16em] text-foreground/30">
                            Class {student.className}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>

                <div className="mt-7 flex flex-wrap items-center justify-between gap-3 border-t border-foreground/10 pt-5">
                  <button
                    type="button"
                    onClick={() => setStage("house-confirm")}
                    className="inline-flex items-center gap-2 border border-foreground/15 px-4 py-2.5 font-ui text-[10px] uppercase tracking-[0.2em] text-foreground/55 transition hover:border-foreground/35"
                  >
                    <ArrowLeft className="size-3" /> House confirmation
                  </button>
                  <p className="font-ui text-[9px] uppercase tracking-[0.18em] text-foreground/25">
                    Select a card to preview the character
                  </p>
                </div>
              </section>
            )}

            {stage === "character" && selectedStudent && (
              <section className="grid gap-8 lg:grid-cols-[0.75fr_1.1fr] lg:items-start">
                <div className="mx-auto w-full max-w-sm">
                  <StudentAvatar
                    student={selectedStudent}
                    className="aspect-[4/5] w-full shadow-[0_50px_120px_-55px_rgba(0,0,0,1)]"
                    showPhotoNote
                  />
                  <div className="mt-3 flex items-center justify-between gap-3 border border-foreground/12 bg-[#100e0b]/80 px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <HouseEmblem houseId={house.id} size={25} />
                      <div>
                        <p className="font-ui text-[9px] uppercase tracking-[0.2em] text-foreground/35">
                          {house.name}
                        </p>
                        <p className="font-display text-sm text-foreground/80">{house.hostelName}</p>
                      </div>
                    </div>
                    <span className="font-ui text-[8px] uppercase tracking-[0.18em] text-foreground/30">
                      No photo supplied
                    </span>
                  </div>
                </div>
                <div>
                  <p className="label-cinema" style={{ color: house.color }}>
                    04 · Preview & confirm
                  </p>
                  <h2 className="mt-2 font-display text-4xl leading-tight text-[#f4ead6] sm:text-5xl">
                    {selectedStudent.displayName}
                  </h2>
                  <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 font-ui text-[10px] uppercase tracking-[0.2em] text-foreground/45">
                    <span>{selectedStudent.id}</span>
                    <span className="size-1 rounded-full bg-foreground/25" />
                    <span>Class {selectedStudent.className}</span>
                    <span className="size-1 rounded-full bg-foreground/25" />
                    <span style={{ color: house.color }}>{house.name}</span>
                  </div>

                  <div className="mt-6 grid gap-px border border-foreground/12 bg-foreground/10 sm:grid-cols-2">
                    <div className="bg-[#12100c] p-4">
                      <p className="label-cinema text-[8px] text-foreground/35">3D character</p>
                      <p className="mt-1.5 font-display text-base text-foreground/85">
                        Procedural in-game model
                      </p>
                      <p className="mt-1 font-ui text-[10px] leading-relaxed text-foreground/40">
                        The same rig, house-coloured uniform and animations are loaded on campus.
                        No external student model has been supplied.
                      </p>
                    </div>
                    <div className="bg-[#12100c] p-4">
                      <p className="label-cinema text-[8px] text-foreground/35">Publication</p>
                      <p className="mt-1.5 font-display text-base capitalize text-foreground/85">
                        {selectedStudent.publicationStatus}
                      </p>
                      <p className="mt-1 font-ui text-[10px] leading-relaxed text-foreground/40">
                        {selectedStudent.photoStatus === "not-supplied"
                          ? "No reference photograph or biography has been supplied, so none is shown."
                          : "Reference photograph approved for this character."}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 border border-foreground/10 bg-black/25 p-4">
                    <p className="font-ui text-[11px] leading-relaxed text-foreground/55">
                      House records are permanent. The two students named Suraj are distinct
                      records ({`ARV-002`} and {`NIL-005`}); selection never merges students by name.
                    </p>
                  </div>

                  {error && (
                    <p role="alert" className="mt-4 border border-[#d94343]/40 bg-[#d94343]/10 px-4 py-3 font-ui text-[11px] text-[#f0b6a8]">
                      {error}
                    </p>
                  )}

                  <div className="mt-7 flex flex-wrap gap-3">
                    <button
                      type="button"
                      data-testid="confirm-character"
                      onClick={() => setStage("final")}
                      className="inline-flex items-center gap-2.5 border border-primary/65 bg-primary/14 px-5 py-3 font-ui text-[10px] uppercase tracking-[0.24em] text-primary transition hover:bg-primary/22"
                    >
                      <Check className="size-3.5" /> Confirm student
                    </button>
                    <button
                      type="button"
                      onClick={() => setStage("students")}
                      className="inline-flex items-center gap-2 border border-foreground/15 px-4 py-3 font-ui text-[10px] uppercase tracking-[0.2em] text-foreground/55 transition hover:border-foreground/35"
                    >
                      <ArrowLeft className="size-3" /> Gallery
                    </button>
                  </div>
                </div>
              </section>
            )}

            {stage === "final" && selectedStudent && (
              <section className="mx-auto grid max-w-4xl gap-8 py-6 sm:py-10 lg:grid-cols-[0.8fr_1fr] lg:items-center">
                <div className="mx-auto w-full max-w-xs">
                  <HouseFlag houseId={house.id} className="aspect-[4/3]" />
                </div>
                <div>
                  <p className="label-cinema text-primary/80">05 · Confirmation</p>
                  <h2 className="mt-2 font-display text-4xl leading-tight text-[#f4ead6] sm:text-5xl">
                    Ready for the gate.
                  </h2>
                  <div className="mt-6 border border-foreground/12 bg-[#100e0b]/80 p-5">
                    <div className="flex items-center gap-4">
                      <StudentAvatar student={selectedStudent} className="size-20 shrink-0" />
                      <div>
                        <p className="font-display text-2xl leading-tight text-[#f4ead6]">
                          {selectedStudent.displayName}
                        </p>
                        <p className="mt-1 font-ui text-[10px] uppercase tracking-[0.2em] text-foreground/45">
                          {selectedStudent.id} · Class {selectedStudent.className}
                        </p>
                        <p className="mt-1 font-ui text-[10px] uppercase tracking-[0.2em]" style={{ color: house.color }}>
                          {house.name} · {house.hostelName}
                        </p>
                      </div>
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-3 border-t border-foreground/10 pt-4 font-ui text-[10px] uppercase tracking-[0.16em] text-foreground/40">
                      <span>Badge: {house.shortName} emblem</span>
                      <span>Uniform: house colour</span>
                      <span>Hostel: {house.hostelName}</span>
                      <span>Roster: published</span>
                    </div>
                  </div>
                  <p className="mt-4 font-ui text-[10px] leading-relaxed text-foreground/35">
                    Clicking enter writes the house and student to this save. You will start at the
                    main gate with the selected uniform and the correct hostel marked as your own.
                  </p>
                  {error && (
                    <p role="alert" className="mt-4 border border-[#d94343]/40 bg-[#d94343]/10 px-4 py-3 font-ui text-[11px] text-[#f0b6a8]">
                      {error}
                    </p>
                  )}
                  <div className="mt-6 flex flex-wrap gap-3">
                    <button
                      type="button"
                      data-testid="enter-campus"
                      onClick={enterCampus}
                      className="inline-flex items-center gap-2.5 border border-primary/65 bg-primary/14 px-6 py-3.5 font-ui text-[10px] uppercase tracking-[0.24em] text-primary transition hover:bg-primary/22"
                    >
                      Enter campus <ArrowRight className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setStage("character")}
                      className="inline-flex items-center gap-2 border border-foreground/15 px-4 py-3.5 font-ui text-[10px] uppercase tracking-[0.2em] text-foreground/55 transition hover:border-foreground/35"
                    >
                      <ArrowLeft className="size-3" /> Preview
                    </button>
                  </div>
                </div>
              </section>
            )}
          </motion.main>
        </AnimatePresence>
      </div>
    </div>
  );
}
