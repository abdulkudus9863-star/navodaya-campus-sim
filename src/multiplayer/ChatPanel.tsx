import { Flag, Send, VolumeX } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { getHouse } from "@/game/data/houses";
import type { MultiplayerMessageView } from "./types";

function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

/**
 * Room chat. Messages are plain text rendered by React (never HTML), and the
 * server enforces membership, length and rate limits. Muting is a local,
 * per-device preference; reporting is recorded on the backend.
 */
export function ChatPanel({
  messages,
  onSend,
  onReport,
  muted,
  onToggleMute,
  busy,
  error,
  className = "",
}: {
  messages: MultiplayerMessageView[];
  onSend: (text: string) => Promise<boolean>;
  onReport: (messageId: string) => void;
  muted: string[];
  onToggleMute: (name: string) => void;
  busy: boolean;
  error: string | null;
  className?: string;
}) {
  const [draft, setDraft] = useState("");
  const [reported, setReported] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    list.scrollTop = list.scrollHeight;
  }, [messages.length]);

  const visible = messages.filter((message) => !muted.includes(message.name));

  const send = async () => {
    const text = draft.trim();
    if (!text || busy) return;
    setDraft("");
    const ok = await onSend(text);
    if (!ok) setDraft(text);
  };

  return (
    <div className={`flex min-h-0 flex-col border border-[#9fb9c9]/18 bg-[#070c13]/92 ${className}`}>
      <div className="flex items-center justify-between gap-3 border-b border-[#9fb9c9]/12 px-3.5 py-2.5">
        <p className="label-cinema text-[8px] text-[#b9cee2]/60">Room channel</p>
        <span className="font-ui text-[8px] uppercase tracking-[0.16em] text-[#b9cee2]/30">
          {visible.length} messages
        </span>
      </div>

      <div
        ref={listRef}
        className="no-scrollbar min-h-0 flex-1 space-y-2.5 overflow-y-auto px-3.5 py-3"
        aria-live="polite"
      >
        {visible.length === 0 ? (
          <p className="py-6 text-center font-ui text-[10px] leading-relaxed text-[#e9ddc8]/30">
            No messages yet. Say hello to your house mates.
          </p>
        ) : (
          visible.map((message) => {
            const house = getHouse(message.houseId);
            const isMuted = muted.includes(message.name);
            return (
              <div key={message.messageId} className="group">
                <div className="flex items-baseline gap-2">
                  <span
                    className="size-1.5 shrink-0 rounded-full"
                    style={{ backgroundColor: house?.color ?? "#9fb9c9" }}
                  />
                  <span className="font-ui text-[10px] font-semibold tracking-wide text-[#f2e7d2]/85">
                    {message.isSelf ? "You" : message.name}
                  </span>
                  <span className="font-ui text-[8px] uppercase tracking-[0.14em] text-[#b9cee2]/30">
                    {house?.shortName ?? "Campus"} · {formatTime(message.createdAt)}
                  </span>
                  <span className="ml-auto flex items-center gap-1 opacity-0 transition group-hover:opacity-100 focus-within:opacity-100">
                    <button
                      type="button"
                      aria-label={`Mute ${message.name}`}
                      title={isMuted ? "Unmute" : "Mute this player"}
                      onClick={() => onToggleMute(message.name)}
                      className="flex size-6 items-center justify-center border border-transparent text-[#b9cee2]/35 transition hover:border-[#b9cee2]/25 hover:text-[#dbe7f0]"
                    >
                      <VolumeX className="size-3" />
                    </button>
                    {!message.isSelf && (
                      <button
                        type="button"
                        aria-label={`Report message from ${message.name}`}
                        title="Report to the room log"
                        onClick={() => {
                          onReport(message.messageId);
                          setReported(message.messageId);
                        }}
                        className="flex size-6 items-center justify-center border border-transparent text-[#b9cee2]/35 transition hover:border-[#d9a08f]/40 hover:text-[#e3b6a5]"
                      >
                        <Flag className="size-3" />
                      </button>
                    )}
                  </span>
                </div>
                <p className="mt-1 pl-3.5 font-ui text-[11.5px] leading-relaxed text-[#e9ddc8]/70">
                  {message.text}
                </p>
                {reported === message.messageId && (
                  <p className="mt-1 pl-3.5 font-ui text-[8px] uppercase tracking-[0.16em] text-[#d9a08f]/70">
                    Reported
                  </p>
                )}
              </div>
            );
          })
        )}
      </div>

      {error && (
        <p role="alert" className="border-t border-[#d98f7d]/25 px-3.5 py-2 font-ui text-[10px] text-[#e8b3a4]">
          {error}
        </p>
      )}

      <form
        onSubmit={(event) => {
          event.preventDefault();
          void send();
        }}
        className="flex items-end gap-2 border-t border-[#9fb9c9]/12 p-2.5"
      >
        <label className="sr-only" htmlFor="multiplayer-chat-input">
          Message the room
        </label>
        <textarea
          id="multiplayer-chat-input"
          value={draft}
          onChange={(event) => setDraft(event.target.value.slice(0, 240))}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              void send();
            }
          }}
          rows={1}
          placeholder="Message the room…"
          className="max-h-24 min-h-9 flex-1 resize-none border border-[#9fb9c9]/15 bg-black/35 px-3 py-2 font-ui text-[11.5px] leading-relaxed text-[#f1e7d2] outline-none transition placeholder:text-[#e9ddc8]/25 focus:border-[#9fb9c9]/45"
        />
        <button
          type="submit"
          disabled={busy || draft.trim().length === 0}
          aria-label="Send message"
          className="flex size-9 shrink-0 items-center justify-center border border-[#9fb9c9]/35 text-[#c7d8e4] transition hover:border-[#b9cee2]/65 hover:bg-[#9fb9c9]/10 disabled:cursor-not-allowed disabled:opacity-35"
        >
          <Send className="size-3.5" />
        </button>
      </form>
      <p className="border-t border-[#9fb9c9]/8 px-3.5 py-1.5 font-ui text-[8px] uppercase tracking-[0.14em] text-[#e9ddc8]/20">
        {draft.length}/240 · room members only
      </p>
    </div>
  );
}
