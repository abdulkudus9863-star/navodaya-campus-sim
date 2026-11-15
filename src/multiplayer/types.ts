import type { FunctionReturnType } from "convex/server";
import { api } from "@/convex/_generated/api";

export type MultiplayerRoomView = NonNullable<
  FunctionReturnType<typeof api.multiplayer.room>
>;
export type MultiplayerMemberView = MultiplayerRoomView["members"][number];
export type MultiplayerSelfView = MultiplayerRoomView["self"];
export type MultiplayerMessageView = FunctionReturnType<
  typeof api.multiplayer.messages
>[number];
export type MultiplayerPresenceView = FunctionReturnType<
  typeof api.multiplayer.presence
>[number];
export type MultiplayerProgressView = FunctionReturnType<
  typeof api.multiplayer.myProgress
>;

export type ConnectionState = "live" | "reconnecting" | "offline" | "idle";

export const MP_STORAGE_ROOM = "navodaya.multiplayer.room.v1";
export const MP_STORAGE_MUTED = "navodaya.multiplayer.muted.v1";
