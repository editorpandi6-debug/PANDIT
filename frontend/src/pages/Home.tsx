import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArcReactor } from "@/components/ArcReactor";
import { HoloBackground } from "@/components/HoloBackground";
import { ApiError, apiGet, apiPost, apiPut } from "@/lib/api";
import { adoptUser, authMode, clearIdentity, restoreGuest, type AuthMode } from "@/lib/identity";
import { hydrateSettings, useSettings } from "@/lib/settings";
import { KEYS, storage } from "@/lib/storage";
import { themeFilter, type InterfaceTheme } from "@/lib/theme";
import { stopSpeaking } from "@/lib/voice";
import type { AuthUser, Profile, ProfileUpsert } from "@/lib/types";
import { AgeScreen } from "@/screens/AgeScreen";
import { AuthScreen } from "@/screens/AuthScreen";
import { ChatScreen } from "@/screens/ChatScreen";
import { IntroScreen } from "@/screens/IntroScreen";
import { NameScreen } from "@/screens/NameScreen";
import { ThemeScreen } from "@/screens/ThemeScreen";
import { VoiceTextScreen } from "@/screens/VoiceTextScreen";

type Stage = "auth" | "name" | "intro" | "voicetext" | "theme" | "chat";

// Apply saved theme intensity before first paint.
document.documentElement.style.setProperty("--glow", String(Number(storage.get(KEYS.glow) ?? "100") / 100));

function localProfile(): Profile | null {
  const id = storage.get(KEYS.profileId);
  const name = storage.get(KEYS.name);
  if (!id || !name) return null;
  const now = new Date().toISOString();
  const theme = (storage.get(KEYS.interfaceTheme) as InterfaceTheme | null) ?? "agni";
  const voiceMode = storage.get(KEYS.voiceSync) === "on" ? "voice" : "text";
  return { profile_id: id, name, avatar_data_url: null, memory: [], voice_mode: voiceMode, theme, created_at: now, updated_at: now };
}

export default function Home() {
  const qc = useQueryClient();
  const settings = useSettings();
  const [mode, setMode] = useState<AuthMode | null>(authMode);
  const [profile, setProfile] = useState<Profile | null>(localProfile);
  const onboarded = Boolean(storage.get(KEYS.onboardingDone));
  const [stage, setStage] = useState<Stage>(() => {
    if (!localProfile()) return "auth";
    if (storage.session.get(KEYS.introPending)) {
      storage.session.remove(KEYS.introPending); // just returned from Google sign-in
      return "intro";
    }
    return onboarded ? "chat" : "voicetext";
  });
  const [theme, setTheme] = useState<InterfaceTheme>(() => (storage.get(KEYS.interfaceTheme) as InterfaceTheme | null) ?? "agni");
  const hydratedFor = useRef<string | null>(null);

  // Signed-in accounts: the server session is the source of truth (age, guardian consent, saved settings).
  const me = useQuery({
    queryKey: ["me"],
    queryFn: () => apiGet<AuthUser>("/auth/me"),
    enabled: mode === "user",
    staleTime: 5 * 60_000,
    retry: (count, err) => !(err instanceof ApiError && err.status === 401) && count < 2,
  });
  const account = mode === "user" ? (me.data ?? null) : null;
  const accountReady = mode !== "user" || Boolean(account && !account.needs_age && !account.needs_consent);

  // Refresh the profile (name/memory/prefs) from Mongo without blocking the UI on it.
  const remote = useQuery({
    queryKey: ["profile", profile?.profile_id],
    queryFn: () => apiGet<Profile>(`/pandi/profile/${profile?.profile_id}`),
    enabled: Boolean(profile?.profile_id) && accountReady,
    retry: (count, err) => !(err instanceof ApiError && [401, 403, 404].includes(err.status)) && count < 2,
  });

  /** Drop the active profile and return to the sign-in page. */
  const leave = useCallback(() => {
    stopSpeaking();
    clearIdentity();
    qc.clear();
    setProfile(null);
    setMode(null);
    setStage("auth");
  }, [qc]);

  const signOut = useCallback(() => {
    void apiPost<void>("/auth/logout")
      .catch(() => undefined)
      .finally(leave);
  }, [leave]);

  useEffect(() => {
    if (mode === "user" && me.error instanceof ApiError && me.error.status === 401) {
      toast("Your session ended. Please sign in again.");
      leave();
    }
  }, [mode, me.error, leave]);

  useEffect(() => {
    if (account && hydratedFor.current !== account.user_id) {
      hydratedFor.current = account.user_id;
      hydrateSettings(account.settings);
    }
  }, [account]);

  useEffect(() => {
    if (remote.data) {
      setProfile(remote.data);
      storage.set(KEYS.name, remote.data.name);
      setTheme(remote.data.theme);
      storage.set(KEYS.interfaceTheme, remote.data.theme);
    } else if (remote.error instanceof ApiError && [401, 403, 404].includes(remote.error.status)) {
      leave(); // profile vanished or the session no longer matches: start over cleanly
    }
  }, [remote.data, remote.error, leave]);

  const resetProfile = () => {
    stopSpeaking();
    storage.remove(KEYS.guestId);
    storage.remove(KEYS.guestName);
    storage.remove(KEYS.permissionDone);
    storage.remove(KEYS.onboardingDone);
    storage.remove(KEYS.interfaceTheme);
    storage.session.remove(KEYS.introSeen);
    storage.remove(KEYS.profileId); // before leave() so the old guest id is not remembered
    setTheme("agni");
    leave();
    toast("Profile reset. Welcome, new operator.");
  };

  // The intro video plays after every sign-in (email, Google or guest); the user can skip it.
  const afterEntry = () => setStage("intro");

  const boot = (label: string) => (
    <div className="relative flex min-h-screen flex-col items-center justify-center gap-4" data-testid="boot-screen">
      <HoloBackground />
      <ArcReactor size={96} mode="thinking" testId="boot-reactor" />
      <p className="relative z-10 font-heading text-[10px] tracking-[0.3em] text-[#ffd27a]">{label}</p>
    </div>
  );

  let content;
  if (mode === "user" && !account) {
    content = me.isError ? (
      <div className="relative flex min-h-screen flex-col items-center justify-center gap-3 px-4 text-center" data-testid="session-error">
        <HoloBackground />
        <p className="relative z-10 text-sm text-[#ffe3b8]">Your account could not be loaded. Check your connection and try again.</p>
        <button type="button" onClick={() => void me.refetch()} data-testid="session-retry" className="relative z-10 rounded border border-[#ff8a1f] bg-[#ff8a1f]/20 px-4 py-2 text-sm text-white hover:bg-[#ff8a1f]/35">
          Retry
        </button>
      </div>
    ) : (
      boot("CHECKING YOUR SESSION…")
    );
  } else if (account && !accountReady) {
    content = <AgeScreen user={account} onDone={(u) => qc.setQueryData(["me"], u)} onSignOut={signOut} />;
  } else {
    content = (
      <>
        {stage === "auth" && (
          <AuthScreen
            onAuthed={(user) => {
              qc.clear();
              adoptUser(user);
              qc.setQueryData(["me"], user);
              setMode("user");
              setProfile(localProfile());
              afterEntry();
            }}
            onGuest={() => {
              if (restoreGuest()) {
                setMode("guest");
                setProfile(localProfile());
                afterEntry();
              } else {
                setStage("name");
              }
            }}
          />
        )}
        {stage === "name" && (
          <NameScreen
            onDone={(p) => {
              setMode("guest");
              setProfile(p);
              setStage("intro");
            }}
          />
        )}
        {stage === "intro" && (
          <IntroScreen
            onDone={() => {
              storage.session.set(KEYS.introSeen, "1");
              setStage(onboarded ? "chat" : "voicetext");
            }}
          />
        )}
        {stage === "voicetext" && <VoiceTextScreen onDone={() => setStage("theme")} />}
        {stage === "theme" && (
          <ThemeScreen
            onDone={(chosen) => {
              setTheme(chosen);
              setStage("chat");
              if (profile) {
                const body: ProfileUpsert = { name: profile.name, theme: chosen, voice_mode: storage.get(KEYS.voiceSync) === "on" ? "voice" : "text" };
                apiPut<Profile>(`/pandi/profile/${profile.profile_id}`, body)
                  .then((updated) => setProfile(updated))
                  .catch(() => toast.warning("Preferences saved locally — the server could not be reached."));
              }
            }}
          />
        )}
        {stage === "chat" && profile && (
          <ChatScreen
            profile={profile}
            account={account}
            onReplayIntro={() => {
              stopSpeaking();
              setStage("intro");
            }}
            onResetProfile={resetProfile}
            onSignOut={signOut}
            onSignIn={leave}
          />
        )}
        {stage === "chat" && !profile && boot("STARTING…")}
      </>
    );
  }

  return (
    <div style={{ filter: themeFilter(theme) }} className={settings.large_text ? "pandi-large-text" : undefined} data-testid="theme-root" data-theme={theme}>
      {content}
    </div>
  );
}
