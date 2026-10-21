export const KEYS = {
  profileId: "pandi-profile-id",
  name: "pandi-name",
  sessionId: "pandi-session-id",
  introSeen: "pandi-intro-seen", // sessionStorage: once per browser session
  liveSearch: "pandi-live-search",
  voiceSync: "pandi-voice-sync",
  permissionDone: "pandi-permission-done",
  glow: "pandi-theme-glow",
  model: "pandi-model",
  interfaceTheme: "pandi-interface-theme", // "agni" | "vajra"
  onboardingDone: "pandi-onboarding-done", // voice/text + theme steps finished
} as const;

export const storage = {
  get(key: string): string | null {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key: string, value: string) {
    try {
      localStorage.setItem(key, value);
    } catch {
      /* private mode: ignore */
    }
  },
  remove(key: string) {
    try {
      localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  },
  session: {
    get(key: string): string | null {
      try {
        return sessionStorage.getItem(key);
      } catch {
        return null;
      }
    },
    set(key: string, value: string) {
      try {
        sessionStorage.setItem(key, value);
      } catch {
        /* ignore */
      }
    },
    remove(key: string) {
      try {
        sessionStorage.removeItem(key);
      } catch {
        /* ignore */
      }
    },
  },
};

export function newId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
