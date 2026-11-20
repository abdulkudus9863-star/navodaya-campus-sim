import { motion } from "framer-motion";
import { Calendar, Check, Lock, MapPin, Shield, Sparkles, Trophy, X } from "lucide-react";
import type { GameEngine } from "../core/GameEngine";
import type { GameUIState } from "../core/types";
import { ACHIEVEMENTS, getAchievement, xpProgress } from "../data/achievements";
import { buildStandings } from "../data/competitions";
import {
  ESCAPE_DIFFICULTY_LABELS,
  escapeLevelNumber,
  escapeRecordViews,
  formatEscapeTime,
  totalEscapeXp,
} from "../data/escape";
import { getHouse } from "../data/houses";
import { getHouseCaptain, getHousePrefect, getHouseRoster, getStudent } from "../data/students";
import { HouseEmblem, StudentAvatar } from "./HouseVisuals";

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

export function ProfilePanel({
  state,
  engine,
}: {
  state: GameUIState;
  engine: GameEngine | null;
}) {
  const profile = state.profile;
  if (!profile) return null;
  const student = getStudent(profile.characterId);
  const house = getHouse(profile.houseId);
  if (!student || !house) return null;
  const captain = getHouseCaptain(profile.houseId);
  const prefect = getHousePrefect(profile.houseId);
  const roster = getHouseRoster(profile.houseId);
  const standings = buildStandings();
  const xp = xpProgress(profile.xp);
  const houseChampionships = standings.championships.filter(
    (record) => record.winner === profile.houseId,
  );
  const escape = state.escapeSave;
  const escapeRecords = escape ? escapeRecordViews(escape) : [];
  const escapeXp = escape ? totalEscapeXp(escape) : 0;
  const escapeCompleted = new Set(escape?.records.map((record) => record.levelId) ?? []).size;
  const escapeBest = escapeRecords.reduce((best, record) => Math.max(best, record.bestScore), 0);

  return (
    <div
      className="film-grain absolute inset-0 z-50 overflow-y-auto bg-[#090806]/88 text-foreground backdrop-blur-[5px]"
      role="dialog"
      aria-modal="true"
      aria-label="Player profile"
      data-testid="profile-panel"
    >
      <div
        className="pointer-events-none fixed inset-0 opacity-45"
        style={{
          background: `radial-gradient(80% 60% at 12% 0%, ${house.color}33, transparent 62%), radial-gradient(60% 50% at 92% 20%, ${house.color}18, transparent 60%)`,
        }}
      />
      <div className="pointer-events-none fixed inset-0 vignette opacity-80" />
      <div className="relative mx-auto w-full max-w-6xl px-5 py-7 sm:px-9 sm:py-10">
        <header className="flex items-start justify-between gap-5 border-b border-foreground/12 pb-5">
          <div>
            <p className="label-cinema text-primary/80">Player profile · House file</p>
            <h2 className="mt-2 font-display text-4xl leading-none text-[#f5ead5] sm:text-5xl">
              {profile.characterName}
            </h2>
            <p className="mt-2 font-ui text-[10px] uppercase tracking-[0.24em] text-foreground/40">
              Class {profile.className} · {house.name} · {house.hostelName}
            </p>
          </div>
          <button
            type="button"
            onClick={() => engine?.closeProfile()}
            aria-label="Close profile"
            className="mt-1 flex size-10 shrink-0 items-center justify-center rounded-full border border-foreground/20 text-foreground/70 transition hover:border-primary/60 hover:text-primary"
          >
            <X className="size-4" />
          </button>
        </header>

        <div className="mt-7 grid gap-6 lg:grid-cols-[0.78fr_1.22fr]">
          <div className="space-y-4">
            <div className="border border-foreground/12 bg-[#0f0d0a]/85 p-4">
              <StudentAvatar student={student} className="aspect-[4/3] w-full" showPhotoNote />
              <div className="mt-4 flex items-start gap-3">
                <HouseEmblem houseId={house.id} size={42} />
                <div className="min-w-0">
                  <p className="font-display text-xl leading-tight text-[#f4ead6]">
                    {student.displayName}
                  </p>
                  <p className="mt-1 font-ui text-[9px] uppercase tracking-[0.2em] text-foreground/40">
                    {student.id} · Class {student.className}
                  </p>
                  <p className="mt-1 font-ui text-[9px] uppercase tracking-[0.2em]" style={{ color: house.color }}>
                    {house.name}
                  </p>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2 border-t border-foreground/10 pt-3 font-ui text-[9px] uppercase tracking-[0.14em] text-foreground/35">
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="size-3" /> {house.hostelName}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Calendar className="size-3" /> Joined {formatDate(profile.assignedAt)}
                </span>
              </div>
              <p className="mt-3 break-all font-ui text-[8px] uppercase tracking-[0.12em] text-foreground/20">
                Player ID · {profile.playerId}
              </p>
            </div>

            <div className="border border-foreground/12 bg-[#0f0d0a]/85 p-5">
              <div className="flex items-baseline justify-between gap-3">
                <p className="label-cinema text-primary/80">Progress</p>
                <p className="font-display text-2xl text-[#f4ead6]">Level {xp.level}</p>
              </div>
              <div className="mt-3 h-[4px] overflow-hidden rounded-full bg-foreground/12">
                <div
                  className="h-full rounded-full transition-[width] duration-500"
                  style={{ width: `${xp.percent}%`, backgroundColor: house.color }}
                />
              </div>
              <div className="mt-2 flex items-center justify-between font-ui text-[9px] uppercase tracking-[0.18em] text-foreground/35">
                <span>{profile.xp} XP total</span>
                <span>{xp.toNext} to next level</span>
              </div>
              <div className="mt-5 grid grid-cols-3 gap-px overflow-hidden border border-foreground/10 bg-foreground/10">
                <div className="bg-[#12100c] p-3">
                  <p className="label-cinema text-[8px] text-foreground/35">Achievements</p>
                  <p className="mt-1 font-display text-xl text-foreground/85">
                    {profile.achievements.length} / {ACHIEVEMENTS.length}
                  </p>
                </div>
                <div className="bg-[#12100c] p-3">
                  <p className="label-cinema text-[8px] text-foreground/35">Campus stops</p>
                  <p className="mt-1 font-display text-xl text-foreground/85">
                    {state.exploration?.discovered ?? 0} / {state.exploration?.total ?? 10}
                  </p>
                </div>
                <div className="bg-[#12100c] p-3">
                  <p className="label-cinema text-[8px] text-foreground/35">House points</p>
                  <p className="mt-1 font-display text-xl text-foreground/85">
                    {standings.standings.find((entry) => entry.house.id === house.id)?.points ?? 0}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <section className="border border-foreground/12 bg-[#0f0d0a]/85 p-5 sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <Shield className="size-4" style={{ color: house.color }} />
                  <div>
                    <p className="label-cinema text-primary/80">House identity</p>
                    <p className="font-display text-2xl text-[#f4ead6]">{house.name}</p>
                  </div>
                </div>
                <span className="border px-2.5 py-1 font-ui text-[8px] uppercase tracking-[0.2em]" style={{ borderColor: `${house.color}80`, color: "#f0e4cd" }}>
                  {house.motto}
                </span>
              </div>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="label-cinema text-[8px] text-foreground/30">Captain</p>
                  <p className="mt-1 font-display text-base text-foreground/80">
                    {captain?.displayName ?? "Not recorded"}
                  </p>
                  {captain && (
                    <p className="font-ui text-[9px] uppercase tracking-[0.16em] text-foreground/30">
                      {captain.id} · Class {captain.className}
                    </p>
                  )}
                </div>
                <div>
                  <p className="label-cinema text-[8px] text-foreground/30">Prefect</p>
                  <p className="mt-1 font-display text-base text-foreground/80">
                    {prefect?.displayName ?? "Not recorded"}
                  </p>
                  {prefect && (
                    <p className="font-ui text-[9px] uppercase tracking-[0.16em] text-foreground/30">
                      {prefect.id} · Class {prefect.className}
                    </p>
                  )}
                </div>
              </div>
              <div className="mt-4 border-t border-foreground/10 pt-3">
                <p className="label-cinema text-[8px] text-foreground/30">Members</p>
                <p className="mt-2 font-ui text-[11px] leading-relaxed text-foreground/55">
                  {roster.map((member) => member.displayName).join(" · ")}
                </p>
              </div>
            </section>

            <section>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="label-cinema text-primary/80">Term I standings</p>
                  <h3 className="mt-1 font-display text-2xl text-[#f4ead6]">House Cup</h3>
                </div>
                <span className="font-ui text-[9px] uppercase tracking-[0.18em] text-foreground/30">
                  Verified archive
                </span>
              </div>
              <div className="mt-4 overflow-hidden border border-foreground/12">
                <table className="w-full border-collapse text-left">
                  <thead>
                    <tr className="border-b border-foreground/12 bg-[#15120e] font-ui text-[8px] uppercase tracking-[0.18em] text-foreground/35">
                      <th className="px-3 py-2.5">Rank</th>
                      <th className="px-3 py-2.5">House</th>
                      <th className="px-3 py-2.5 text-right">Points</th>
                      <th className="hidden px-3 py-2.5 text-right sm:table-cell">Wins</th>
                    </tr>
                  </thead>
                  <tbody>
                    {standings.standings.map((entry) => {
                      const isPlayerHouse = entry.house.id === house.id;
                      return (
                        <tr
                          key={entry.house.id}
                          className={`border-b border-foreground/8 last:border-0 ${
                            isPlayerHouse ? "bg-white/[0.035]" : ""
                          }`}
                        >
                          <td className="px-3 py-2.5 font-display text-sm text-foreground/55">
                            #{entry.rank}
                          </td>
                          <td className="px-3 py-2.5">
                            <span className="flex items-center gap-2.5">
                              <span className="size-2 rounded-full" style={{ backgroundColor: entry.house.color }} />
                              <span className={`font-display text-sm ${isPlayerHouse ? "text-[#f4ead6]" : "text-foreground/65"}`}>
                                {entry.house.name}
                              </span>
                              {isPlayerHouse && (
                                <span className="font-ui text-[8px] uppercase tracking-[0.16em] text-primary/70">
                                  You
                                </span>
                              )}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-right font-display text-sm text-foreground/80">
                            {entry.points}
                          </td>
                          <td className="hidden px-3 py-2.5 text-right font-display text-sm text-foreground/50 sm:table-cell">
                            {entry.firstPlaces}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <p className="mt-2 font-ui text-[9px] leading-relaxed text-foreground/25">
                Points come from approved competition results only. Exploring and the fictional
                midnight caper never award house points, and standings are not stored in the
                editable local save.
              </p>
            </section>

            <section className="border border-foreground/12 bg-[#0f0d0a]/85 p-5 sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="label-cinema text-primary/80">Campus Escape</p>
                  <h3 className="mt-1 font-display text-2xl text-[#f4ead6]">
                    Level {escape ? escapeLevelNumber(escape) : 1} · {escapeCompleted}/3 challenges
                  </h3>
                </div>
                <span className="border border-[#d9b56d]/30 px-2.5 py-1 font-ui text-[8px] uppercase tracking-[0.18em] text-[#e8d4a8]/75">
                  {escapeXp} mini-game XP
                </span>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-px overflow-hidden border border-foreground/10 bg-foreground/10">
                <div className="bg-[#12100c] p-3">
                  <p className="label-cinema text-[8px] text-foreground/35">Best score</p>
                  <p className="mt-1 font-display text-xl text-foreground/85">{escapeBest || "—"}</p>
                </div>
                <div className="bg-[#12100c] p-3">
                  <p className="label-cinema text-[8px] text-foreground/35">Completed</p>
                  <p className="mt-1 font-display text-xl text-foreground/85">{escapeCompleted} / 3</p>
                </div>
                <div className="bg-[#12100c] p-3">
                  <p className="label-cinema text-[8px] text-foreground/35">Achievements</p>
                  <p className="mt-1 font-display text-xl text-foreground/85">
                    {escape?.achievements.length ?? 0} / 5
                  </p>
                </div>
              </div>
              {escapeRecords.length > 0 ? (
                <div className="mt-3 space-y-1.5">
                  {escapeRecords.slice(0, 5).map((record) => (
                    <div key={`${record.levelId}:${record.difficulty}`} className="flex flex-wrap items-baseline justify-between gap-2 border-b border-foreground/8 py-1.5 last:border-0">
                      <span className="font-display text-sm text-foreground/75">{record.levelName}</span>
                      <span className="font-ui text-[8px] uppercase tracking-[0.14em] text-foreground/35">
                        {ESCAPE_DIFFICULTY_LABELS[record.difficulty]} · best {record.bestScore} · {formatEscapeTime(record.bestTime)}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-3 border border-foreground/10 bg-black/20 p-3 font-ui text-[10px] text-foreground/35">
                  No Campus Escape records yet. Playground Dash is open from the Adventure menu.
                </p>
              )}
              <p className="mt-3 font-ui text-[9px] leading-relaxed text-foreground/25">
                Personal obstacle-course XP only. These records are stored with your player ID and never add official house points.
              </p>
            </section>

            <section className="grid gap-5 sm:grid-cols-2">
              <div>
                <p className="label-cinema text-primary/80">Achievements</p>
                <div className="mt-3 space-y-2">
                  {ACHIEVEMENTS.map((achievement) => {
                    const unlocked = profile.achievements.includes(achievement.id);
                    return (
                      <div
                        key={achievement.id}
                        className={`border p-3 ${
                          unlocked
                            ? "border-primary/25 bg-primary/[0.055]"
                            : "border-foreground/10 bg-black/20 opacity-55"
                        }`}
                      >
                        <p className="flex items-center gap-2 font-display text-sm text-foreground/80">
                          {unlocked ? (
                            <Check className="size-3.5 text-primary/80" />
                          ) : (
                            <Lock className="size-3 text-foreground/30" />
                          )}
                          {getAchievement(achievement.id)?.name}
                        </p>
                        <p className="mt-1 pl-5 font-ui text-[10px] leading-relaxed text-foreground/40">
                          {achievement.description}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div>
                <p className="label-cinema text-primary/80">Trophies</p>
                <div className="mt-3 space-y-2">
                  {houseChampionships.length === 0 && (
                    <p className="border border-foreground/10 bg-black/20 p-3 font-ui text-[10px] text-foreground/35">
                      No Term I championship yet. The house table is still being written.
                    </p>
                  )}
                  {houseChampionships.map((record) => (
                    <div key={record.eventName} className="flex items-start gap-2.5 border border-foreground/10 bg-black/20 p-3">
                      <Trophy className="mt-0.5 size-3.5 shrink-0" style={{ color: house.color }} />
                      <div>
                        <p className="font-display text-sm leading-snug text-foreground/80">
                          {record.eventName}
                        </p>
                        <p className="font-ui text-[9px] uppercase tracking-[0.16em] text-foreground/30">
                          {record.season} · Champion
                        </p>
                      </div>
                    </div>
                  ))}
                  {houseChampionships.length > 0 && (
                    <p className="flex items-start gap-2 font-ui text-[9px] leading-relaxed text-foreground/25">
                      <Sparkles className="mt-0.5 size-3 shrink-0" />
                      Championship history is aggregated from approved event results.
                    </p>
                  )}
                </div>
              </div>
            </section>

            <p className="flex items-start gap-2 border-t border-foreground/10 pt-3 font-ui text-[9px] leading-relaxed text-foreground/25">
              <Shield className="mt-0.5 size-3 shrink-0" />
              In-game roster representation. No photographs, biographies or personal details have
              been supplied or invented. Gameplay progress stays in the existing local save;
              appearance and verified achievements also sync to your signed-in player identity.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
