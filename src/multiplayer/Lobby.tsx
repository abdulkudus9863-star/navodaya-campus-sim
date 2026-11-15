import { motion } from "framer-motion";
import {
  ArrowLeft,
  Check,
  Copy,
  Crown,
  Loader2,
  LogIn,
  LogOut,
  Moon,
  Plus,
  Share2,
  ShieldCheck,
  Signal,
  SignalZero,
  Swords,
  Users,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router";
import { HouseEmblem } from "@/game/ui/HouseVisuals";
import { getHouse, type HouseId } from "@/game/data/houses";
import { ChatPanel } from "./ChatPanel";
import {
  MP_MAX_PLAYERS,
  MP_MISSION_DURATION_MS,
  MP_VEGETABLE_COUNT,
  multiplayerClock,
} from "@/game/data/multiplayer";
import type {
  ConnectionState,
  MultiplayerMemberView,
  MultiplayerMessageView,
  MultiplayerProgressView,
  MultiplayerRoomView,
} from "./types";

export interface LobbyIdentity {
  name: string;
  houseId: string;
  characterId: string;
}

interface LobbyProps {
  identity: LobbyIdentity;
  room: MultiplayerRoomView | null;
  roomLoading: boolean;
  busy: boolean;
  error: string | null;
  messages: MultiplayerMessageView[];
  progress: NonNullable<MultiplayerProgressView>;
  connection: ConnectionState;
  initialCode: string;
  muted: string[];
  onToggleMute: (name: string) => void;
  onCreate: () => void;
  onJoin: (code: string) => void;
  onLeave: () => void;
  onReady: (ready: boolean) => void;
  onStart: () => void;
  onSend: (text: string) => Promise<boolean>;
  onReport: (messageId: string) => void;
  chatError: string | null;
}

const CONNECTION_LABEL: Record<ConnectionState, string> = {
  live: "Connected",
  reconnecting: "Reconnecting",
  offline: "Offline",
  idle: "Away",
};

function MemberRow({ member, room }: { member: MultiplayerMemberView; room: MultiplayerRoomView }) {
  const house = getHouse(member.houseId);
  const houseId = (house?.id ?? "aravali") as HouseId;
  const status = !member.online
    ? room.status === "in_mission"
      ? "Reconnecting"
      : "Offline"
    : room.status === "in_mission" || room.status === "completed"
      ? member.status === "completed"
        ? "Completed"
        : "In mission"
      : member.ready
        ? "Ready"
        : "Not ready";

  return (
    <div
      className={`relative flex items-center gap-3 border px-3.5 py-3 ${
        member.online
          ? "border-[#9fb9c9]/18 bg-[#0a1018]/85"
          : "border-[#9fb9c9]/10 bg-[#080d13]/70"
      }`}
    >
      <span
        className="pointer-events-none absolute inset-y-0 left-0 w-[2px]"
        style={{ backgroundColor: house?.color ?? "#6b7280", opacity: member.online ? 0.9 : 0.35 }}
      />
      <HouseEmblem houseId={houseId} size={28} />
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2 font-display text-[15px] leading-tight text-[#f2e7d2]">
          <span className="truncate">{member.name}</span>
          {member.isSelf && (
            <span className="shrink-0 font-ui text-[7px] uppercase tracking-[0.16em] text-[#b9cee2]/35">
              you
            </span>
          )}
          {member.isHost && <Crown className="size-3 shrink-0 text-[#d9b56d]" aria-label="Room host" />}
        </p>
        <p className="mt-0.5 font-ui text-[8px] uppercase tracking-[0.16em] text-[#e9ddc8]/35">
          {house?.shortName ?? "House"} · {status}
          {room.status !== "waiting" ? ` · ${member.contributions} crates` : ""}
        </p>
      </div>
      <span
        className={`size-2 shrink-0 rounded-full ${
          member.online ? "bg-[#8fbf95]" : "bg-[#7c7a74]"
        }`}
        aria-hidden="true"
      />
    </div>
  );
}

export function Lobby({
  identity,
  room,
  roomLoading,
  busy,
  error,
  messages,
  progress,
  connection,
  initialCode,
  muted,
  onToggleMute,
  onCreate,
  onJoin,
  onLeave,
  onReady,
  onStart,
  onSend,
  onReport,
  chatError,
}: LobbyProps) {
  const house = getHouse(identity.houseId);
  const [code, setCode] = useState(initialCode.toUpperCase());
  const [copied, setCopied] = useState<"code" | "link" | null>(null);

  useEffect(() => {
    if (initialCode) setCode(initialCode.toUpperCase());
  }, [initialCode]);

  const copy = async (value: string, kind: "code" | "link") => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(kind);
      window.setTimeout(() => setCopied(null), 2200);
    } catch {
      setCopied(null);
    }
  };

  const share = async (roomCode: string) => {
    const url = `${window.location.origin}/multiplayer?code=${roomCode}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Operation Midnight Mischief — co-op",
          text: `Join my room with code ${roomCode}.`,
          url,
        });
        return;
      } catch {
        /* fall through to copy */
      }
    }
    await copy(url, "link");
  };

  const timeLeft = room?.missionEndsAt ? Math.max(0, room.missionEndsAt - Date.now()) : MP_MISSION_DURATION_MS;

  return (
    <div className="film-grain absolute inset-0 z-40 overflow-y-auto bg-[#060b12]/94 text-[#f1e7d2]">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(75%_60%_at_18%_0%,#1b2b3d70,transparent_62%),radial-gradient(65%_50%_at_92%_100%,#2a231666,transparent_68%)]" />
      <div className="pointer-events-none fixed inset-0 vignette opacity-80" />

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="relative mx-auto flex min-h-full w-full max-w-5xl flex-col px-4 py-6 sm:px-8 sm:py-9"
      >
        <header className="flex flex-wrap items-start justify-between gap-4 border-b border-[#9fb9c9]/15 pb-4">
          <div>
            <p className="label-cinema text-[#9fb9c9]/65">Operation Midnight Mischief · Cooperative</p>
            <h1 className="mt-1.5 font-display text-[clamp(1.9rem,4.6vw,3.1rem)] leading-none text-[#f4ead6]">
              The garden crew.
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 border px-2.5 py-1.5 font-ui text-[8px] uppercase tracking-[0.16em] ${
                connection === "live"
                  ? "border-[#8fbf95]/35 text-[#b7d6ba]"
                  : "border-[#d9b56d]/30 text-[#dcc79a]"
              }`}
            >
              {connection === "live" ? <Signal className="size-2.5" /> : <SignalZero className="size-2.5" />}
              {CONNECTION_LABEL[connection]}
            </span>
            <Link
              to="/play"
              className="inline-flex items-center gap-1.5 border border-[#e9ddc8]/15 px-2.5 py-1.5 font-ui text-[8px] uppercase tracking-[0.16em] text-[#e9ddc8]/50 transition hover:border-[#e9ddc8]/35 hover:text-[#e9ddc8]/80"
            >
              <ArrowLeft className="size-2.5" /> Campus
            </Link>
          </div>
        </header>

        {roomLoading && !room ? (
          <div className="flex flex-1 items-center justify-center py-20">
            <Loader2 className="size-6 animate-spin text-[#9fb9c9]/60" />
          </div>
        ) : !room ? (
          <div className="grid flex-1 gap-4 py-6 lg:grid-cols-[1.15fr_0.85fr]">
            <section className="flex flex-col gap-4">
              <div className="border border-[#9fb9c9]/18 bg-[#0a1018]/85 p-4 sm:p-5">
                <div className="flex items-center gap-2">
                  <Plus className="size-4 text-[#c7d8e4]" />
                  <h2 className="font-display text-2xl leading-none text-[#f2e7d2]">Create a room</h2>
                </div>
                <p className="mt-2 font-ui text-[11px] leading-relaxed text-[#e9ddc8]/45">
                  You become the host. Share the six-character code with up to three friends,
                  then start the shared mission when everyone is ready.
                </p>
                <button
                  type="button"
                  disabled={busy}
                  onClick={onCreate}
                  className="mt-4 inline-flex w-full items-center justify-center gap-2 border border-[#9fb9c9]/55 bg-[#9fb9c9]/10 px-4 py-3 font-ui text-[10px] uppercase tracking-[0.22em] text-[#dbe7f0] transition hover:border-[#b9cee2]/80 hover:bg-[#9fb9c9]/16 disabled:opacity-40"
                >
                  {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Moon className="size-3.5" />}
                  Create room
                </button>
              </div>

              <div className="border border-[#9fb9c9]/18 bg-[#0a1018]/85 p-4 sm:p-5">
                <div className="flex items-center gap-2">
                  <LogIn className="size-4 text-[#c7d8e4]" />
                  <h2 className="font-display text-2xl leading-none text-[#f2e7d2]">Join a room</h2>
                </div>
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    if (code.length === 6) onJoin(code);
                  }}
                  className="mt-4"
                >
                  <label
                    htmlFor="room-code"
                    className="font-ui text-[8px] uppercase tracking-[0.18em] text-[#e9ddc8]/35"
                  >
                    Room code
                  </label>
                  <div className="mt-1.5 flex gap-2">
                    <input
                      id="room-code"
                      value={code}
                      onChange={(event) =>
                        setCode(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6))
                      }
                      autoComplete="off"
                      spellCheck={false}
                      placeholder="ABC123"
                      className="min-w-0 flex-1 border border-[#9fb9c9]/20 bg-black/40 px-3 py-2.5 font-display text-lg tracking-[0.42em] text-[#f4ead6] outline-none transition placeholder:tracking-[0.3em] placeholder:text-[#e9ddc8]/15 focus:border-[#9fb9c9]/50"
                    />
                    <button
                      type="submit"
                      disabled={busy || code.length !== 6}
                      className="shrink-0 border border-[#9fb9c9]/45 px-4 font-ui text-[9px] uppercase tracking-[0.18em] text-[#c7d8e4] transition hover:bg-[#9fb9c9]/12 disabled:opacity-35"
                    >
                      Join
                    </button>
                  </div>
                </form>
                <p className="mt-2 font-ui text-[9px] leading-relaxed text-[#e9ddc8]/30">
                  A mission already in progress cannot be joined. Ask the host to finish and
                  open a new room.
                </p>
              </div>

              {error && (
                <p
                  role="alert"
                  className="border border-[#d98f7d]/35 bg-[#d98f7d]/8 px-4 py-3 font-ui text-[11px] leading-relaxed text-[#e8b3a4]"
                >
                  {error}
                </p>
              )}

              <div className="grid gap-px border border-[#9fb9c9]/12 bg-[#9fb9c9]/12 sm:grid-cols-3">
                {[
                  { icon: Users, title: "2–4 players", body: "One room, one shared garden." },
                  { icon: Moon, title: `${MP_VEGETABLE_COUNT} crates`, body: "Collect together, no double claims." },
                  { icon: ShieldCheck, title: "No house points", body: "Personal XP only. Solo save untouched." },
                ].map((item) => (
                  <div key={item.title} className="bg-[#080e15]/90 px-3.5 py-3">
                    <item.icon className="size-3.5 text-[#9fb9c9]/65" />
                    <p className="mt-2 font-display text-base leading-none text-[#f2e7d2]">{item.title}</p>
                    <p className="mt-1 font-ui text-[9px] leading-relaxed text-[#e9ddc8]/35">{item.body}</p>
                  </div>
                ))}
              </div>
            </section>

            <aside className="flex flex-col gap-4">
              <div className="border border-[#9fb9c9]/18 bg-[#0a1018]/85 p-4 sm:p-5">
                <p className="label-cinema text-[8px] text-[#9fb9c9]/55">Signed in as</p>
                <div className="mt-3 flex items-center gap-3">
                  <HouseEmblem houseId={(house?.id ?? "aravali") as HouseId} size={38} />
                  <div className="min-w-0">
                    <p className="truncate font-display text-xl leading-tight text-[#f4ead6]">
                      {identity.name}
                    </p>
                    <p className="mt-0.5 font-ui text-[8px] uppercase tracking-[0.18em]" style={{ color: house?.color }}>
                      {house?.name ?? "House"} · {identity.characterId}
                    </p>
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-px border border-[#9fb9c9]/12 bg-[#9fb9c9]/12">
                  {[
                    ["Co-op XP", progress.xp],
                    ["Crates", progress.vegetables],
                    ["Missions", progress.missions],
                  ].map(([label, value]) => (
                    <div key={label} className="bg-[#080e15]/90 px-2.5 py-2">
                      <p className="font-ui text-[7px] uppercase tracking-[0.14em] text-[#e9ddc8]/30">{label}</p>
                      <p className="mt-1 font-display text-lg leading-none text-[#f2e7d2]">{value}</p>
                    </div>
                  ))}
                </div>
                <p className="mt-3 font-ui text-[9px] leading-relaxed text-[#e9ddc8]/28">
                  Multiplayer XP is stored on this account and kept separate from your house
                  points and local single-player save.
                </p>
              </div>

              <div className="border border-[#9fb9c9]/12 bg-[#080e15]/70 p-4 sm:p-5">
                <p className="label-cinema text-[8px] text-[#b9cee2]/45">How the caper runs</p>
                <ol className="mt-3 space-y-2.5 font-ui text-[10.5px] leading-relaxed text-[#e9ddc8]/50">
                  <li>01 · Create or join. The host starts when the room is ready.</li>
                  <li>02 · Move together through the night garden; jump and crouch are shared.</li>
                  <li>03 · Collect ten painted vegetable crates. A crate vanishes for everyone.</li>
                  <li>04 · Get any player back to the garden gate within six minutes.</li>
                </ol>
                <p className="mt-3 border-t border-[#9fb9c9]/10 pt-3 font-ui text-[9px] leading-relaxed text-[#e9ddc8]/28">
                  A fictional campus game. No real-world trespassing, produce or theft is involved.
                </p>
              </div>
            </aside>
          </div>
        ) : (
          <div className="grid flex-1 gap-4 py-5 lg:grid-cols-[1.1fr_0.9fr]">
            <section className="flex flex-col gap-4">
              <div className="border border-[#9fb9c9]/22 bg-[#0a1018]/90 p-4 sm:p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="label-cinema text-[8px] text-[#9fb9c9]/55">
                      {room.status === "waiting"
                        ? "Waiting room"
                        : room.status === "in_mission"
                          ? "Mission in progress"
                          : room.status === "completed"
                            ? "Mission finished"
                            : "Room closed"}
                    </p>
                    <div className="mt-2 flex items-center gap-3">
                      <span className="font-display text-[30px] leading-none tracking-[0.3em] text-[#f4ead6]">
                        {room.code}
                      </span>
                      <button
                        type="button"
                        onClick={() => void copy(room.code, "code")}
                        aria-label="Copy room code"
                        className="flex size-8 items-center justify-center border border-[#9fb9c9]/25 text-[#b9cee2]/65 transition hover:border-[#9fb9c9]/55 hover:text-[#e3eef4]"
                      >
                        {copied === "code" ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                      </button>
                    </div>
                    <p className="mt-1 font-ui text-[9px] uppercase tracking-[0.16em] text-[#e9ddc8]/30">
                      {room.members.length}/{MP_MAX_PLAYERS} players · code works for this room only
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => void share(room.code)}
                      className="inline-flex items-center gap-1.5 border border-[#9fb9c9]/30 px-3 py-2 font-ui text-[8px] uppercase tracking-[0.16em] text-[#c7d8e4] transition hover:border-[#b9cee2]/60 hover:bg-[#9fb9c9]/10"
                    >
                      {copied === "link" ? <Check className="size-3" /> : <Share2 className="size-3" />}
                      {copied === "link" ? "Link copied" : "Invite"}
                    </button>
                    <button
                      type="button"
                      onClick={onLeave}
                      disabled={busy}
                      className="inline-flex items-center gap-1.5 border border-[#e9ddc8]/15 px-3 py-2 font-ui text-[8px] uppercase tracking-[0.16em] text-[#e9ddc8]/45 transition hover:border-[#d98f7d]/40 hover:text-[#e8b3a4] disabled:opacity-40"
                    >
                      <LogOut className="size-3" /> Leave
                    </button>
                  </div>
                </div>

                {room.status === "in_mission" && (
                  <div className="mt-4 flex items-center justify-between gap-3 border border-[#9fb9c9]/15 bg-black/25 px-3 py-2 font-ui text-[9px] uppercase tracking-[0.16em] text-[#b9cee2]/60">
                    <span className="inline-flex items-center gap-1.5">
                      <Moon className="size-3" /> Shared crates {room.collected.length}/{MP_VEGETABLE_COUNT}
                    </span>
                    <span className="tabular-nums">{multiplayerClock(timeLeft)} left</span>
                  </div>
                )}
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <p className="label-cinema text-[8px] text-[#9fb9c9]/55">Player list</p>
                  <p className="font-ui text-[8px] uppercase tracking-[0.16em] text-[#e9ddc8]/30">
                    {room.members.filter((member) => member.online).length} online
                  </p>
                </div>
                <div className="space-y-2">
                  {room.members.map((member) => (
                    <MemberRow key={member.memberId} member={member} room={room} />
                  ))}
                  {Array.from({ length: Math.max(0, MP_MAX_PLAYERS - room.members.length) }).map((_, index) => (
                    <div
                      key={`slot-${index}`}
                      className="flex items-center gap-3 border border-dashed border-[#9fb9c9]/10 px-3.5 py-3"
                    >
                      <span className="flex size-7 items-center justify-center border border-[#9fb9c9]/15 font-ui text-[10px] text-[#9fb9c9]/25">
                        <Plus className="size-3" />
                      </span>
                      <p className="font-ui text-[10px] uppercase tracking-[0.16em] text-[#e9ddc8]/20">
                        Open slot
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {error && (
                <p
                  role="alert"
                  className="border border-[#d98f7d]/35 bg-[#d98f7d]/8 px-4 py-3 font-ui text-[11px] leading-relaxed text-[#e8b3a4]"
                >
                  {error}
                </p>
              )}

              {room.status === "waiting" && (
                <div className="flex flex-wrap gap-2">
                  {room.isHost ? (
                    <>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={onStart}
                        className="inline-flex flex-1 items-center justify-center gap-2 border border-[#8fbf95]/50 bg-[#8fbf95]/10 px-4 py-3 font-ui text-[10px] uppercase tracking-[0.22em] text-[#c8e3ca] transition hover:border-[#a8d6ad]/80 hover:bg-[#8fbf95]/16 disabled:opacity-40"
                      >
                        {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Swords className="size-3.5" />}
                        Start mission
                      </button>
                      <p className="w-full font-ui text-[9px] leading-relaxed text-[#e9ddc8]/30">
                        {room.members.length < 2
                          ? "Waiting for at least one more player. You can still start a solo practice run."
                          : "Host control: only you can start. Everyone in the room enters the same mission."}
                      </p>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => onReady(!room.self.ready)}
                        className={`inline-flex flex-1 items-center justify-center gap-2 border px-4 py-3 font-ui text-[10px] uppercase tracking-[0.22em] transition disabled:opacity-40 ${
                          room.self.ready
                            ? "border-[#8fbf95]/45 bg-[#8fbf95]/10 text-[#c8e3ca]"
                            : "border-[#9fb9c9]/35 text-[#c7d8e4] hover:bg-[#9fb9c9]/10"
                        }`}
                      >
                        <Check className="size-3.5" />
                        {room.self.ready ? "Ready" : "Mark ready"}
                      </button>
                      <p className="w-full font-ui text-[9px] leading-relaxed text-[#e9ddc8]/30">
                        Only the host can start. Your ready state is visible to the whole room.
                      </p>
                    </>
                  )}
                </div>
              )}

              {room.status === "completed" && (
                <div className="border border-[#8fbf95]/25 bg-[#8fbf95]/6 px-4 py-3">
                  <p className="font-display text-lg text-[#e6f0e2]">
                    {room.missionSuccess ? "Mission complete." : "The torchlight found you."}
                  </p>
                  <p className="mt-1 font-ui text-[10px] leading-relaxed text-[#e9ddc8]/45">
                    {room.missionSuccess
                      ? "The team brought every crate back to the garden gate. Rewards were validated and granted by the server."
                      : "The six-minute window closed before all ten crates were home. No completion reward was granted."}
                  </p>
                </div>
              )}
            </section>

            <aside className="flex min-h-[320px] flex-col gap-4">
              <div className="border border-[#9fb9c9]/18 bg-[#0a1018]/85 p-4 sm:p-5">
                <p className="label-cinema text-[8px] text-[#9fb9c9]/55">Team objective</p>
                <div className="mt-2 flex items-end justify-between gap-3">
                  <p className="font-display text-[34px] leading-none text-[#f4ead6]">
                    {room.collected.length}
                    <span className="text-lg text-[#e9ddc8]/30">/{MP_VEGETABLE_COUNT}</span>
                  </p>
                  <span className="font-ui text-[9px] uppercase tracking-[0.16em] text-[#b9cee2]/45">
                    Shared crates
                  </span>
                </div>
                <div className="mt-3 flex gap-1">
                  {Array.from({ length: MP_VEGETABLE_COUNT }).map((_, index) => (
                    <span
                      key={index}
                      className={`h-[3px] flex-1 ${
                        index < room.collected.length ? "bg-[#8fbf95]" : "bg-[#e9ddc8]/12"
                      }`}
                    />
                  ))}
                </div>
                <p className="mt-3 font-ui text-[9px] leading-relaxed text-[#e9ddc8]/30">
                  Each crate can only be claimed once. The server checks membership, distance and
                  mission state before it disappears for everyone.
                </p>
              </div>

              <ChatPanel
                messages={messages}
                onSend={onSend}
                onReport={onReport}
                muted={muted}
                onToggleMute={onToggleMute}
                busy={busy}
                error={chatError}
                className="min-h-[240px] flex-1"
              />
            </aside>
          </div>
        )}

        <footer className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-[#9fb9c9]/10 pt-3 font-ui text-[8px] uppercase tracking-[0.16em] text-[#e9ddc8]/22">
          <span>Authenticated rooms · member-only chat · server-validated rewards</span>
          <span>No house points · Single-player save untouched</span>
        </footer>
      </motion.div>
    </div>
  );
}
