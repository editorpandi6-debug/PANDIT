// Which chat profile this browser is using: a signed-in account (profile_id === user_id) or a guest profile.
import { hydrateSettings } from "@/lib/settings";
import { KEYS, storage } from "@/lib/storage";
import type { AuthUser } from "@/lib/types";

export type AuthMode = "user" | "guest";

export function authMode(): AuthMode | null {
  const mode = storage.get(KEYS.authMode);
  if (mode === "user" || mode === "guest") return mode;
  return storage.get(KEYS.profileId) ? "guest" : null; // profiles created before sign-in existed are guests
}

function rememberGuest() {
  if (authMode() !== "guest") return;
  const id = storage.get(KEYS.profileId);
  const name = storage.get(KEYS.name);
  if (id && name) {
    storage.set(KEYS.guestId, id);
    storage.set(KEYS.guestName, name);
  }
}

/** Switch this browser to the signed-in account. */
export function adoptUser(user: AuthUser) {
  rememberGuest();
  storage.set(KEYS.profileId, user.user_id);
  storage.set(KEYS.name, user.name);
  storage.set(KEYS.authMode, "user");
  storage.remove(KEYS.sessionId);
  hydrateSettings(user.settings);
}

/** Forget the active profile (sign-out, or a guest heading to the sign-in page). */
export function clearIdentity() {
  rememberGuest();
  storage.remove(KEYS.profileId);
  storage.remove(KEYS.name);
  storage.remove(KEYS.sessionId);
  storage.remove(KEYS.authMode);
}

/** Bring back the guest profile used earlier on this device (keeps its chats and daily usage). */
export function restoreGuest(): boolean {
  const id = storage.get(KEYS.guestId);
  const name = storage.get(KEYS.guestName);
  if (!id || !name) return false;
  storage.set(KEYS.profileId, id);
  storage.set(KEYS.name, name);
  storage.set(KEYS.authMode, "guest");
  storage.remove(KEYS.sessionId);
  return true;
}
