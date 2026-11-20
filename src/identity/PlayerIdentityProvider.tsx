import { api } from "@/convex/_generated/api";
import { SaveSystem, sanitizeCharacter } from "@/game/core/SaveSystem";
import type { CharacterSettings, SaveData } from "@/game/core/types";
import { toProfileView } from "@/game/data/profile";
import type { PlayerProfileView } from "@/game/core/types";
import { useAuth } from "@/hooks/use-auth";
import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { toast } from "sonner";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

export type AccountIdentity = NonNullable<
  FunctionReturnType<typeof api.playerIdentity.myIdentity>
>;

export interface LocalPlayerSnapshot {
  data: SaveData;
  profile: PlayerProfileView;
  character: CharacterSettings;
}

interface PlayerIdentityValue {
  identity: AccountIdentity | null | undefined;
  local: LocalPlayerSnapshot | null;
  identityLoading: boolean;
  localChecked: boolean;
  claiming: boolean;
  claimError: string | null;
  localConflict: boolean;
  retryClaim: () => void;
  refreshLocal: () => void;
  saveAppearance: (
    appearance: CharacterSettings,
  ) => Promise<{ ok: true } | { ok: false; error: string }>;
  recordAchievement: (achievementId: string) => void;
}

const PlayerIdentityContext = createContext<PlayerIdentityValue | null>(null);

function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message.replace(/^ConvexError:\s*/i, "");
  }
  return "The player identity could not be updated.";
}

function readLocalSnapshot(): LocalPlayerSnapshot | null {
  try {
    const result = new SaveSystem().load();
    if (!result.ok) return null;
    const profile = toProfileView(result.data.profile);
    if (!profile) return null;
    return {
      data: result.data,
      profile,
      character: result.data.character,
    };
  } catch {
    return null;
  }
}

function sameAppearance(a: CharacterSettings, b: CharacterSettings): boolean {
  return (
    a.uniform === b.uniform &&
    a.skin === b.skin &&
    a.face === b.face &&
    a.hairStyle === b.hairStyle &&
    a.hairColor === b.hairColor &&
    a.eyeColor === b.eyeColor &&
    a.brows === b.brows &&
    a.build === b.build &&
    a.glasses === b.glasses &&
    a.watch === b.watch &&
    a.backpack === b.backpack
  );
}

export function PlayerIdentityProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const identity = useQuery(
    api.playerIdentity.myIdentity,
    isAuthenticated ? {} : "skip",
  );
  const claimIdentity = useMutation(api.playerIdentity.claim);
  const saveAppearanceMutation = useMutation(api.playerIdentity.saveAppearance);
  const recordAchievementMutation = useMutation(api.playerIdentity.recordAchievement);

  const [local, setLocal] = useState<LocalPlayerSnapshot | null>(null);
  const [localChecked, setLocalChecked] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [claimError, setClaimError] = useState<string | null>(null);
  const [claimNonce, setClaimNonce] = useState(0);
  const attemptedClaims = useRef(new Set<string>());
  const syncedAchievementKeys = useRef(new Set<string>());

  const refreshLocal = useCallback(() => {
    setLocal(readLocalSnapshot());
    setLocalChecked(true);
  }, []);

  useEffect(() => {
    refreshLocal();
    const onSaveChanged = () => refreshLocal();
    const onStorage = (event: StorageEvent) => {
      if (!event.key || event.key.includes("navodaya.campus.save")) refreshLocal();
    };
    window.addEventListener("navodaya:save-changed", onSaveChanged);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("navodaya:save-changed", onSaveChanged);
      window.removeEventListener("storage", onStorage);
    };
  }, [refreshLocal]);

  // Seed the account identity from the existing save exactly once.
  useEffect(() => {
    if (!isAuthenticated || authLoading || identity !== null || !local) return;
    const key = [
      local.profile.playerId,
      local.profile.characterId,
      local.profile.houseId,
      local.data.savedAt,
      claimNonce,
    ].join(":");
    if (attemptedClaims.current.has(key)) return;
    attemptedClaims.current.add(key);

    setClaiming(true);
    setClaimError(null);
    void claimIdentity({
      playerId: local.profile.playerId,
      characterId: local.profile.characterId,
      houseId: local.profile.houseId,
      appearance: local.character,
      achievements: local.profile.achievements,
      xp: local.profile.xp,
    })
      .catch((error) => setClaimError(errorMessage(error)))
      .finally(() => setClaiming(false));
  }, [authLoading, claimIdentity, claimNonce, identity, isAuthenticated, local]);

  // If the account already exists, its saved appearance wins. This is what
  // restores customization after signing in on another browser.
  useEffect(() => {
    if (!identity || !local) return;
    if (
      identity.houseId !== local.profile.houseId ||
      identity.characterId !== local.profile.characterId
    ) {
      return;
    }
    if (sameAppearance(identity.appearance, local.character)) return;

    const result = new SaveSystem().load();
    if (!result.ok) return;
    const next = sanitizeCharacter(identity.appearance);
    if (sameAppearance(next, result.data.character)) return;
    result.data.character = next;
    new SaveSystem().save(result.data);
    refreshLocal();
  }, [identity, local, refreshLocal]);

  // Preserve achievements earned in existing signed-out local play by sending
  // their canonical IDs through the validated server event endpoint.
  useEffect(() => {
    if (!identity || !local) return;
    if (
      identity.houseId !== local.profile.houseId ||
      identity.characterId !== local.profile.characterId
    ) {
      return;
    }
    const key = `${identity._id}:${local.data.savedAt}:${local.profile.achievements.join(",")}`;
    if (syncedAchievementKeys.current.has(key)) return;
    syncedAchievementKeys.current.add(key);

    const known = new Set(identity.achievements.map((entry) => entry.id));
    for (const achievementId of local.profile.achievements) {
      if (known.has(achievementId)) continue;
      void recordAchievementMutation({ achievementId })
        .then((result) => {
          if (result?.leveledUp) {
            toast.success(`Level ${result.identity.level} reached`, {
              description: "Your account player identity has grown.",
            });
          }
        })
        .catch(() => {
          // The local save remains intact if the sync is temporarily unavailable.
        });
    }
  }, [identity, local, recordAchievementMutation]);

  const saveAppearance = useCallback(
    async (appearance: CharacterSettings) => {
      const sanitized = sanitizeCharacter(appearance);
      try {
        await saveAppearanceMutation({ appearance: sanitized });
        const result = new SaveSystem().load();
        if (result.ok) {
          result.data.character = sanitized;
          new SaveSystem().save(result.data);
          refreshLocal();
        }
        return { ok: true as const };
      } catch (error) {
        return { ok: false as const, error: errorMessage(error) };
      }
    },
    [refreshLocal, saveAppearanceMutation],
  );

  const recordAchievement = useCallback(
    (achievementId: string) => {
      if (!isAuthenticated) return;
      void recordAchievementMutation({ achievementId })
        .then((result) => {
          if (result?.leveledUp) {
            toast.success(`Level ${result.identity.level} reached`, {
              description: "Your account player identity has grown.",
            });
          }
        })
        .catch(() => {
          // Existing gameplay must never be blocked by an identity sync failure.
        });
    },
    [isAuthenticated, recordAchievementMutation],
  );

  const retryClaim = useCallback(() => {
    attemptedClaims.current.clear();
    setClaimError(null);
    setClaimNonce((value) => value + 1);
  }, []);

  const identityLoading =
    authLoading || (isAuthenticated && identity === undefined);
  const localConflict = Boolean(
    identity &&
      local &&
      (identity.houseId !== local.profile.houseId ||
        identity.characterId !== local.profile.characterId),
  );

  const value = useMemo<PlayerIdentityValue>(
    () => ({
      identity,
      local,
      identityLoading,
      localChecked,
      claiming,
      claimError,
      localConflict,
      retryClaim,
      refreshLocal,
      saveAppearance,
      recordAchievement,
    }),
    [
      identity,
      local,
      identityLoading,
      localChecked,
      claiming,
      claimError,
      localConflict,
      retryClaim,
      refreshLocal,
      saveAppearance,
      recordAchievement,
    ],
  );

  return (
    <PlayerIdentityContext.Provider value={value}>
      {children}
    </PlayerIdentityContext.Provider>
  );
}

export function usePlayerIdentity(): PlayerIdentityValue {
  const context = useContext(PlayerIdentityContext);
  if (!context) {
    throw new Error("usePlayerIdentity must be used inside PlayerIdentityProvider.");
  }
  return context;
}
