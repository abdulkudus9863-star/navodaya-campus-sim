import { Loader2, LockKeyhole, Moon, Users } from "lucide-react";
import { useConvex, useMutation, useQuery } from "convex/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router";
import type { Id } from "@/convex/_generated/dataModel";
import { api } from "@/convex/_generated/api";
import { RequireAuth } from "@/components/RequireAuth";
import { SaveSystem } from "@/game/core/SaveSystem";
import type { GameEngine } from "@/game/core/GameEngine";
import { toProfileView } from "@/game/data/profile";
import {
  MP_VEGETABLE_COUNT,
  type MultiplayerAdapter,
  type MultiplayerRemotePlayer,
} from "@/game/data/multiplayer";
import { GameShell } from "@/game/ui/GameShell";
import { HouseEmblem } from "@/game/ui/HouseVisuals";
import { Lobby, type LobbyIdentity } from "@/multiplayer/Lobby";
import { MultiplayerHud } from "@/multiplayer/MultiplayerHud";
import {
  MP_STORAGE_MUTED,
  MP_STORAGE_ROOM,
  type ConnectionState,
} from "@/multiplayer/types";

function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message.replace(/^ConvexError:\s*/i, "");
  }
  return "Something went wrong. Try again.";
}

function readStoredRoom(): Id<"multiplayerRooms"> | null {
  try {
    const value = window.localStorage.getItem(MP_STORAGE_ROOM);
    return value ? (value as Id<"multiplayerRooms">) : null;
  } catch {
    return null;
  }
}

function readMuted(): string[] {
  try {
    const raw = window.localStorage.getItem(MP_STORAGE_MUTED);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((name): name is string => typeof name === "string").slice(0, 40)
      : [];
  } catch {
    return [];
  }
}

export default function MultiplayerPage() {
  return (
    <RequireAuth
      title="Sign in for multiplayer"
      description="Co-op rooms are tied to an authenticated player so membership, chat and rewards stay private and server-validated."
    >
      <MultiplayerExperience />
    </RequireAuth>
  );
}

function MultiplayerExperience() {
  const [engine, setEngine] = useState<GameEngine | null>(null);
  const [roomId, setRoomId] = useState<Id<"multiplayerRooms"> | null>(readStoredRoom);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chatError, setChatError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [connection, setConnection] = useState<ConnectionState>("live");
  const [muted, setMuted] = useState<string[]>(readMuted);
  const [searchParams] = useSearchParams();
  const initialCode = searchParams.get("code")?.toUpperCase() ?? "";
  const client = useConvex();

  const identity = useMemo<LobbyIdentity | null>(() => {
    try {
      const saved = new SaveSystem().load();
      if (!saved.ok) return null;
      const profile = toProfileView(saved.data.profile);
      if (!profile) return null;
      return {
        name: profile.characterName,
        houseId: profile.houseId,
        characterId: profile.characterId,
      };
    } catch {
      return null;
    }
  }, []);

  const myRoom = useQuery(api.multiplayer.myRoom);
  const room = useQuery(api.multiplayer.room, roomId ? { roomId } : "skip");
  const messages = useQuery(api.multiplayer.messages, roomId ? { roomId } : "skip") ?? [];
  const progress = useQuery(api.multiplayer.myProgress);

  const createRoom = useMutation(api.multiplayer.createRoom);
  const joinRoom = useMutation(api.multiplayer.joinRoom);
  const leaveRoom = useMutation(api.multiplayer.leaveRoom);
  const setReady = useMutation(api.multiplayer.setReady);
  const startMission = useMutation(api.multiplayer.startMission);
  const heartbeat = useMutation(api.multiplayer.heartbeat);
  const syncPlayer = useMutation(api.multiplayer.syncPlayer);
  const collectVegetable = useMutation(api.multiplayer.collectVegetable);
  const returnToSafeArea = useMutation(api.multiplayer.returnToSafeArea);
  const sendMessage = useMutation(api.multiplayer.sendMessage);
  const reportMessage = useMutation(api.multiplayer.reportMessage);

  const flashActionError = useCallback((message: string) => {
    setActionError(message);
    window.setTimeout(() => setActionError((current) => (current === message ? null : current)), 4200);
  }, []);

  const rememberRoom = useCallback((next: Id<"multiplayerRooms"> | null) => {
    setRoomId(next);
    try {
      if (next) window.localStorage.setItem(MP_STORAGE_ROOM, next);
      else window.localStorage.removeItem(MP_STORAGE_ROOM);
    } catch {
      /* private mode: room still works for this session */
    }
  }, []);

  // Recover an existing membership once after a refresh or navigation.
  const recoveredRef = useRef(false);
  useEffect(() => {
    if (recoveredRef.current || myRoom === undefined) return;
    recoveredRef.current = true;
    if (!roomId && myRoom) rememberRoom(myRoom.roomId);
  }, [myRoom, roomId, rememberRoom]);

  // A stored room that no longer has this player as a member is cleared.
  useEffect(() => {
    if (roomId && room === null) {
      rememberRoom(null);
      setError("That room closed or removed you while you were away.");
    }
  }, [room, roomId, rememberRoom]);

  const adapter = useMemo<MultiplayerAdapter | null>(() => {
    if (!roomId) return null;
    return {
      onLocalMove: (state) => {
        void syncPlayer({ roomId, ...state }).catch(() => {
          /* heartbeat surfaces a dropped membership */
        });
      },
      onCollect: (itemId, x, z) => {
        void collectVegetable({ roomId, itemId, x, z }).catch((mutationError) => {
          flashActionError(errorMessage(mutationError));
        });
      },
      onReturnToSafe: (x, z) => {
        void returnToSafeArea({ roomId, x, z }).catch((mutationError) => {
          flashActionError(errorMessage(mutationError));
        });
      },
    };
  }, [roomId, syncPlayer, collectVegetable, returnToSafeArea, flashActionError]);

  // Live remote positions are pushed straight into the engine (no React
  // re-render per movement tick, which keeps mid-range phones smooth).
  useEffect(() => {
    if (!roomId || !engine) return;
    const watch = client.watchQuery(api.multiplayer.presence, { roomId });
    const seed = watch.localQueryResult();
    if (seed) engine.applyMultiplayerPlayers(seed as unknown as MultiplayerRemotePlayer[]);
    const stop = watch.onUpdate(() => {
      const players = watch.localQueryResult();
      if (!players) return;
      engine.applyMultiplayerPlayers(players as unknown as MultiplayerRemotePlayer[]);
    });
    return () => stop();
  }, [client, roomId, engine, room?.status]);

  const collectedKey = room?.collected.map((entry) => entry.itemId).join(",") ?? "";

  useEffect(() => {
    if (!engine || !room) return;
    if (room.status === "completed") engine.freezeMultiplayer();
    if (room.status === "waiting") return;
    if (!engine.isMultiplayerActive()) {
      if (!adapter) return;
      const started = engine.startMultiplayerMission(adapter);
      if (!started) return;
    }
    engine.applyMultiplayerProgress(room.collected.map((entry) => entry.itemId), room.collected.length);
  }, [engine, room?.status, roomId, adapter, collectedKey]);

  // Presence heartbeat. Pauses when the tab is hidden, so "online" is real.
  useEffect(() => {
    if (!roomId) {
      setConnection("live");
      return;
    }
    let cancelled = false;
    let failures = 0;
    const beat = async () => {
      if (document.visibilityState !== "visible") {
        if (!cancelled) setConnection("idle");
        return;
      }
      try {
        await heartbeat({ roomId });
        if (cancelled) return;
        failures = 0;
        setConnection("live");
      } catch (heartbeatError) {
        if (cancelled) return;
        failures += 1;
        setConnection(failures > 2 ? "offline" : "reconnecting");
        if (failures === 4) setError(errorMessage(heartbeatError));
      }
    };
    void beat();
    const timer = window.setInterval(() => void beat(), 5000);
    const onVisibility = () => {
      if (document.visibilityState === "visible") void beat();
      else setConnection("idle");
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [roomId, heartbeat]);

  const handleCreate = async () => {
    if (!identity) return;
    setBusy(true);
    setError(null);
    try {
      const result = await createRoom(identity);
      rememberRoom(result.roomId);
    } catch (createError) {
      setError(errorMessage(createError));
    } finally {
      setBusy(false);
    }
  };

  const handleJoin = async (code: string) => {
    if (!identity) return;
    setBusy(true);
    setError(null);
    try {
      const result = await joinRoom({ code, ...identity });
      rememberRoom(result.roomId);
    } catch (joinError) {
      setError(errorMessage(joinError));
    } finally {
      setBusy(false);
    }
  };

  const handleLeave = async () => {
    engine?.setMultiplayerUiOpen(false);
    engine?.stopMultiplayerMission(false);
    const target = roomId;
    rememberRoom(null);
    setConnection("live");
    setActionError(null);
    if (target) {
      try {
        await leaveRoom({ roomId: target });
      } catch {
        /* leaving a closed room is already complete */
      }
    }
  };

  const handleSend = useCallback(
    async (text: string): Promise<boolean> => {
      if (!roomId) return false;
      try {
        await sendMessage({ roomId, text });
        setChatError(null);
        return true;
      } catch (sendError) {
        setChatError(errorMessage(sendError));
        return false;
      }
    },
    [roomId, sendMessage],
  );

  const handleReport = useCallback(
    (messageId: string) => {
      if (!roomId) return;
      void reportMessage({
        roomId,
        messageId: messageId as Id<"multiplayerMessages">,
        reason: "Flagged by a room member",
      }).catch((reportError) => setChatError(errorMessage(reportError)));
    },
    [roomId, reportMessage],
  );

  const toggleMute = useCallback((name: string) => {
    setMuted((current) => {
      const next = current.includes(name)
        ? current.filter((entry) => entry !== name)
        : [...current, name];
      try {
        window.localStorage.setItem(MP_STORAGE_MUTED, JSON.stringify(next));
      } catch {
        /* preference stays in memory */
      }
      return next;
    });
  }, []);

  const onChatOpenChange = useCallback(
    (open: boolean) => engine?.setMultiplayerUiOpen(open),
    [engine],
  );

  if (!identity) {
    return (
      <main className="flex min-h-[100dvh] items-center justify-center bg-[#060b12] px-5 py-10 text-[#f1e7d2]">
        <div className="w-full max-w-md border border-[#9fb9c9]/20 bg-[#0a1018]/90 p-7 text-center">
          <HouseEmblem houseId="aravali" size={44} className="mx-auto opacity-80" />
          <p className="label-cinema mt-5 text-[#9fb9c9]/60">Co-op needs a student</p>
          <h1 className="mt-3 font-display text-3xl leading-tight text-[#f4ead6]">
            Enter campus first.
          </h1>
          <p className="mt-3 font-ui text-[11.5px] leading-relaxed text-[#e9ddc8]/50">
            Multiplayer uses the house, name and student already saved in this browser. No second
            account or duplicate house record is created. Start or continue your single-player
            campus first, then come back here.
          </p>
          <div className="mt-6 flex flex-col gap-2.5">
            <Link
              to="/play"
              className="inline-flex items-center justify-center gap-2 border border-[#d6ba7e] bg-[#d6ba7e] px-5 py-3 font-ui text-[10px] font-semibold uppercase tracking-[0.22em] text-[#0b1711] transition hover:bg-[#e7cd94]"
            >
              <LockKeyhole className="size-3.5" /> Enter the campus
            </Link>
            <Link
              to="/"
              className="inline-flex items-center justify-center gap-2 border border-[#e9ddc8]/15 px-5 py-2.5 font-ui text-[9px] uppercase tracking-[0.2em] text-[#e9ddc8]/45 transition hover:border-[#e9ddc8]/35 hover:text-[#e9ddc8]/75"
            >
              Back to home
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const inMission = room?.status === "in_mission" || room?.status === "completed";

  // The lobby is deliberately independent of the 3D bundle so it opens fast on
  // a phone and stays usable even if WebGL is unavailable. The engine mounts
  // only when the host actually starts the shared mission.
  if (!inMission || !room) {
    return (
      <>
        <Lobby
          identity={identity}
          room={room ?? null}
          roomLoading={Boolean(roomId) && !room}
          busy={busy}
          error={error}
          messages={messages}
          progress={progress ?? { xp: 0, vegetables: 0, missions: 0 }}
          connection={connection}
          initialCode={initialCode}
          muted={muted}
          onToggleMute={toggleMute}
          onCreate={() => void handleCreate()}
          onJoin={(code) => void handleJoin(code)}
          onLeave={() => void handleLeave()}
          onReady={(ready) => {
            if (!roomId) return;
            void setReady({ roomId, ready }).catch((readyError) =>
              setError(errorMessage(readyError)),
            );
          }}
          onStart={() => {
            if (!roomId) return;
            setBusy(true);
            setError(null);
            void startMission({ roomId })
              .catch((startError) => setError(errorMessage(startError)))
              .finally(() => setBusy(false));
          }}
          onSend={handleSend}
          onReport={handleReport}
          chatError={chatError}
        />
        {roomId && !room && (
          <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-3 bg-[#060b12]/92 text-[#f1e7d2]">
            <Loader2 className="size-6 animate-spin text-[#9fb9c9]/60" />
            <p className="font-ui text-[9px] uppercase tracking-[0.24em] text-[#e9ddc8]/35">
              Reconnecting to the room
            </p>
          </div>
        )}
      </>
    );
  }

  return (
    <GameShell multiplayer onEngineReady={setEngine}>
      <MultiplayerHud
        room={room}
        messages={messages}
        connection={connection}
        busy={false}
        chatError={chatError}
        actionError={actionError}
        muted={muted}
        onToggleMute={toggleMute}
        onSend={handleSend}
        onReport={handleReport}
        onChatOpenChange={onChatOpenChange}
        onLeave={handleLeave}
      />
    </GameShell>
  );
}
