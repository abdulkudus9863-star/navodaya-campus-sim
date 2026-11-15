import { motion } from "framer-motion";
import { Crown, MessageSquare, Moon, Users, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { getHouse, type HouseId } from "@/game/data/houses";
import { HouseEmblem } from "@/game/ui/HouseVisuals";
import {
  MP_VEGETABLE_COUNT,
  multiplayerClock,
} from "@/game/data/multiplayer";
import { ChatPanel } from "./ChatPanel";
import type {
  ConnectionState,
  MultiplayerMessageView,
  MultiplayerRoomView,
} from "./types";

function useNow(active: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [active]);
  return now;
}

const CONNECTION_TEXT: Record<ConnectionState, string> = {
  live: "Live",
  reconnecting: "Reconnecting",
  offline: "Connection lost",
  idle: "Away",
};

export function MultiplayerHud({
  room,
  messages,
  connection,
  busy,
  chatError,
  actionError,
  muted,
  onToggleMute,
  onSend,
  onReport,
  onChatOpenChange,
  onLeave,
}: {
  room: MultiplayerRoomView;
  messages: MultiplayerMessageView[];
  connection: ConnectionState;
  busy: boolean;
  chatError: string | null;
  actionError: string | null;
  muted: string[];
  onToggleMute: (name: string) => void;
  onSend: (text: string) => Promise<boolean>;
  onReport: (messageId: string) => void;
  onChatOpenChange: (open: boolean) => void;
  onLeave: () => void;
}) {
  const [chatOpen, setChatOpen] = useState(false);
  const [playersOpen, setPlayersOpen] = useState(false);
  const [lastRead, setLastRead] = useState(0);
  const now = useNow(room.status === "in_mission");
  const timeLeft = room.missionEndsAt ? Math.max(0, room.missionEndsAt - now) : 0;
  const complete = room.collected.length >= MP_VEGETABLE_COUNT;

  const unread = useMemo(() => {
    if (chatOpen) return 0;
    return messages.slice(lastRead).filter((message) => !message.isSelf).length;
  }, [chatOpen, lastRead, messages]);

  useEffect(() => {
    onChatOpenChange(chatOpen);
    if (chatOpen) setLastRead(messages.length);
  }, [chatOpen, messages.length, onChatOpenChange]);

  const openChat = () => {
    setPlayersOpen(false);
    setChatOpen((value) => !value);
  };

  return (
    <>
      <div className="pointer-events-none absolute inset-0 z-20 font-ui">
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute left-4 top-4 w-[calc(100%-9rem)] max-w-[15rem] border-l border-[#9fb9c9]/55 pl-3.5 sm:left-6 sm:top-6 sm:max-w-[18rem]"
        >
          <p className="label-cinema text-[8px] text-[#b9cee2]/75">
            Co-op · {room.members.length}/{room.maxPlayers} players
          </p>
          <p className="mt-1 font-display text-[15px] leading-snug text-[#eaf0f7] drop-shadow-[0_2px_8px_rgba(0,0,0,0.95)]">
            {complete ? "Return to the garden gate" : "Collect ten vegetable crates"}
          </p>
          <div className="mt-2 flex items-end gap-2">
            <p className="font-display text-2xl leading-none text-[#f4ead6]">
              {room.collected.length}
              <span className="text-sm text-[#e9ddc8]/35">/{MP_VEGETABLE_COUNT}</span>
            </p>
            <p
              className={`ml-auto font-ui text-[11px] tabular-nums tracking-[0.08em] ${
                timeLeft < 60_000 ? "text-[#e3a28d]" : "text-[#b9cee2]/70"
              }`}
            >
              {multiplayerClock(timeLeft)}
            </p>
          </div>
          <div className="mt-2 flex gap-1">
            {Array.from({ length: MP_VEGETABLE_COUNT }).map((_, index) => (
              <span
                key={index}
                className={`h-[3px] flex-1 ${
                  index < room.collected.length ? "bg-[#8fbf95]" : "bg-[#e9ddc8]/15"
                }`}
              />
            ))}
          </div>
          <p className="mt-2 hidden font-ui text-[9px] leading-relaxed text-[#e9ddc8]/35 sm:block">
            {complete
              ? "Everyone can see the same crate count. Reach the marked gate to finish for the team."
              : "Crates vanish for every player as soon as one teammate collects them."}
          </p>
        </motion.div>

        <div className="pointer-events-auto absolute right-16 top-4 flex items-center gap-2 sm:right-[4.75rem] sm:top-6">
          <button
            type="button"
            onClick={openChat}
            aria-label="Toggle room chat"
            aria-expanded={chatOpen}
            className="relative flex size-10 items-center justify-center rounded-full border border-foreground/20 bg-black/40 text-foreground/80 backdrop-blur-sm transition hover:border-[#9fb9c9]/60 hover:text-[#dbe7f0]"
          >
            <MessageSquare className="size-4" />
            {unread > 0 && (
              <span className="absolute -right-1 -top-1 flex min-w-4 items-center justify-center rounded-full bg-[#8fbf95] px-1 font-ui text-[8px] font-semibold text-[#0a1510]">
                {unread > 9 ? "9+" : unread}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => {
              setChatOpen(false);
              setPlayersOpen((value) => !value);
            }}
            aria-label="Toggle player list"
            aria-expanded={playersOpen}
            className="flex size-10 items-center justify-center rounded-full border border-foreground/20 bg-black/40 text-foreground/80 backdrop-blur-sm transition hover:border-[#9fb9c9]/60 hover:text-[#dbe7f0]"
          >
            <Users className="size-4" />
          </button>
        </div>

        <div className="absolute left-4 top-[7.6rem] flex items-center gap-1.5 font-ui text-[8px] uppercase tracking-[0.16em] sm:left-6 sm:top-[9.4rem]">
          <span
            className={`size-1.5 rounded-full ${
              connection === "live"
                ? "bg-[#8fbf95]"
                : connection === "reconnecting"
                  ? "animate-pulse bg-[#d9b56d]"
                  : "bg-[#c2705a]"
            }`}
          />
          <span
            className={
              connection === "live" ? "text-[#b7d6ba]/70" : "text-[#dcc79a]/75"
            }
          >
            {CONNECTION_TEXT[connection]}
          </span>
        </div>

        {actionError && (
          <div className="absolute left-1/2 top-24 w-[min(92vw,28rem)] -translate-x-1/2 border border-[#d98f7d]/35 bg-[#140b09]/92 px-3.5 py-2.5">
            <p className="font-ui text-[10.5px] leading-relaxed text-[#e8b3a4]">{actionError}</p>
          </div>
        )}

        {complete && room.status === "in_mission" && (
          <div className="absolute left-1/2 top-16 -translate-x-1/2 border border-[#8fbf95]/35 bg-[#071410]/82 px-4 py-2 text-center backdrop-blur-sm">
            <p className="font-ui text-[9px] uppercase tracking-[0.18em] text-[#b7d6ba]">
              All crates collected · reach the garden gate
            </p>
          </div>
        )}
      </div>

      {playersOpen && (
        <div className="absolute inset-x-4 top-20 z-40 border border-[#9fb9c9]/22 bg-[#070c13]/96 p-3.5 shadow-[0_40px_100px_-40px_rgba(0,0,0,1)] sm:inset-x-auto sm:right-6 sm:w-80">
          <div className="mb-2 flex items-center justify-between">
            <p className="label-cinema text-[8px] text-[#9fb9c9]/55">Room players</p>
            <button
              type="button"
              onClick={() => setPlayersOpen(false)}
              aria-label="Close player list"
              className="flex size-6 items-center justify-center text-[#e9ddc8]/35 hover:text-[#e9ddc8]/80"
            >
              <X className="size-3.5" />
            </button>
          </div>
          <div className="space-y-1.5">
            {room.members.map((member) => {
              const house = getHouse(member.houseId);
              const houseId = (house?.id ?? "aravali") as HouseId;
              return (
                <div
                  key={member.memberId}
                  className="flex items-center gap-2.5 border border-[#9fb9c9]/12 bg-black/25 px-2.5 py-2"
                >
                  <HouseEmblem houseId={houseId} size={22} />
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1.5 truncate font-display text-[13px] leading-tight text-[#f2e7d2]">
                      {member.name}
                      {member.isHost && <Crown className="size-2.5 text-[#d9b56d]" />}
                    </p>
                    <p className="mt-0.5 font-ui text-[7px] uppercase tracking-[0.14em] text-[#e9ddc8]/30">
                      {house?.shortName ?? "House"} · {member.contributions} crates
                      {!member.online ? " · reconnecting" : ""}
                    </p>
                  </div>
                  <span
                    className={`size-1.5 rounded-full ${
                      member.online ? "bg-[#8fbf95]" : "bg-[#7c7a74]"
                    }`}
                  />
                </div>
              );
            })}
          </div>
          <p className="mt-2 font-ui text-[8px] leading-relaxed text-[#e9ddc8]/25">
            Room {room.code} · personal contributions, shared objective.
          </p>
        </div>
      )}

      {chatOpen && (
        <div className="absolute inset-x-3 bottom-36 z-40 sm:inset-x-auto sm:bottom-8 sm:right-6 sm:w-[340px]">
          <ChatPanel
            messages={messages}
            onSend={onSend}
            onReport={onReport}
            muted={muted}
            onToggleMute={onToggleMute}
            busy={busy}
            error={chatError}
            className="max-h-[46dvh] shadow-[0_40px_100px_-40px_rgba(0,0,0,1)] sm:max-h-[420px]"
          />
          <button
            type="button"
            onClick={() => setChatOpen(false)}
            className="mt-2 inline-flex items-center gap-1.5 border border-[#9fb9c9]/20 px-3 py-1.5 font-ui text-[8px] uppercase tracking-[0.16em] text-[#e9ddc8]/45 transition hover:border-[#9fb9c9]/45"
          >
            <X className="size-3" /> Close chat
          </button>
        </div>
      )}

      {room.status === "completed" && (
        <MultiplayerResult room={room} onLeave={onLeave} />
      )}
    </>
  );
}

function MultiplayerResult({
  room,
  onLeave,
}: {
  room: MultiplayerRoomView;
  onLeave: () => void;
}) {
  const success = room.missionSuccess === true;
  const topContributor = [...room.members].sort((a, b) => b.contributions - a.contributions)[0];

  return (
    <div className="film-grain absolute inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/78 px-4 py-8 backdrop-blur-[2px]">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        className="relative w-full max-w-lg border border-[#9fb9c9]/25 bg-[#080d13]/96 p-6 shadow-[0_60px_140px_-50px_rgba(0,0,0,1)] sm:p-8"
      >
        <p className={`label-cinema ${success ? "text-[#b7d6ba]" : "text-[#e3a28d]"}`}>
          Operation Midnight Mischief · {success ? "Mission complete" : "Mission closed"}
        </p>
        <h2 className="mt-3 font-display text-4xl leading-none text-[#f4ead6]">
          {success ? "Ten crates home." : "The window closed."}
        </h2>
        <p className="mt-3 font-ui text-[12px] leading-relaxed text-[#e9ddc8]/55">
          {success
            ? "The whole team gets credit. Each verified crate gave its collector personal XP, and every member of the room received the server-validated completion reward."
            : room.collected.length >= MP_VEGETABLE_COUNT
              ? "Every crate was collected, but the team did not reach the garden gate in time."
              : `${room.collected.length} of ${MP_VEGETABLE_COUNT} crates were collected before the six-minute window closed.`}
        </p>

        <div className="mt-5 grid grid-cols-2 gap-px border border-[#9fb9c9]/15 bg-[#9fb9c9]/15">
          <div className="bg-[#0a1018] px-3.5 py-3">
            <p className="font-ui text-[8px] uppercase tracking-[0.16em] text-[#e9ddc8]/30">Crates</p>
            <p className="mt-1 font-display text-xl text-[#f2e7d2]">
              {room.collected.length}/{MP_VEGETABLE_COUNT}
            </p>
          </div>
          <div className="bg-[#0a1018] px-3.5 py-3">
            <p className="font-ui text-[8px] uppercase tracking-[0.16em] text-[#e9ddc8]/30">
              Team reward
            </p>
            <p className="mt-1 font-display text-xl text-[#f2e7d2]">{success ? "+60 XP each" : "No reward"}</p>
          </div>
        </div>

        <div className="mt-4">
          <p className="label-cinema text-[8px] text-[#9fb9c9]/45">Contributions</p>
          <div className="mt-2 space-y-1.5">
            {room.members.map((member) => (
              <div
                key={member.memberId}
                className="flex items-center gap-2.5 border border-[#9fb9c9]/10 px-2.5 py-1.5"
              >
                <HouseEmblem houseId={(getHouse(member.houseId)?.id ?? "aravali") as HouseId} size={20} />
                <span className="min-w-0 flex-1 truncate font-ui text-[11px] text-[#e9ddc8]/70">
                  {member.name}
                </span>
                <span className="font-ui text-[9px] uppercase tracking-[0.14em] text-[#b9cee2]/45">
                  {member.contributions} crate{member.contributions === 1 ? "" : "s"}
                  {topContributor?.memberId === member.memberId && member.contributions > 0
                    ? " · lead"
                    : ""}
                </span>
              </div>
            ))}
          </div>
        </div>

        <p className="mt-4 border-t border-[#9fb9c9]/10 pt-3 font-ui text-[9px] leading-relaxed text-[#e9ddc8]/28">
          Multiplayer rewards are stored on your account and never change your house assignment,
          official house points or local single-player save.
        </p>

        <div className="mt-5 flex flex-col gap-2">
          <button
            type="button"
            onClick={onLeave}
            className="inline-flex items-center justify-center gap-2 border border-[#9fb9c9]/55 bg-[#9fb9c9]/10 px-4 py-3 font-ui text-[10px] uppercase tracking-[0.22em] text-[#dbe7f0] transition hover:border-[#b9cee2]/80 hover:bg-[#9fb9c9]/16"
          >
            <Moon className="size-3.5" /> Back to multiplayer lobby
          </button>
          <p className="text-center font-ui text-[8px] uppercase tracking-[0.16em] text-[#e9ddc8]/20">
            Single-player progress is untouched · reload is safe
          </p>
        </div>
      </motion.div>
    </div>
  );
}
