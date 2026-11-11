// Per-user voice + accessibility settings. Stored on this device; mirrored to the account when signed in.
import { useSyncExternalStore } from "react";
import { apiPut } from "@/lib/api";
import { KEYS, storage } from "@/lib/storage";
import type { AuthUser, UserSettings } from "@/lib/types";

export const DEFAULT_SETTINGS: UserSettings = { voice_speed: 1, silence_ms: 2000, start_word: "Hey Pandi", wake_enabled: true, large_text: false };

function load(): UserSettings {
  try {
    return { ...DEFAULT_SETTINGS, ...(JSON.parse(storage.get(KEYS.settings) ?? "{}") as Partial<UserSettings>) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

let current: UserSettings = load();
const listeners = new Set<() => void>();
let syncTimer: number | undefined;

function commit(next: UserSettings) {
  current = next;
  storage.set(KEYS.settings, JSON.stringify(next));
  listeners.forEach((fn) => fn());
}

export function getSettings(): UserSettings {
  return current;
}

export function useSettings(): UserSettings {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    () => current,
  );
}

/** Replace local settings with the account's saved copy (after sign-in). */
export function hydrateSettings(settings: UserSettings) {
  commit({ ...DEFAULT_SETTINGS, ...settings });
}

export function updateSettings(patch: Partial<UserSettings>) {
  commit({ ...current, ...patch });
  if (storage.get(KEYS.authMode) !== "user") return;
  window.clearTimeout(syncTimer);
  syncTimer = window.setTimeout(() => {
    const body: UserSettings = { ...current, start_word: current.start_word.trim().length >= 2 ? current.start_word.trim() : DEFAULT_SETTINGS.start_word };
    apiPut<AuthUser>("/auth/settings", body).catch(() => undefined); // local copy still applies
  }, 600);
}
