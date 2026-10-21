import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArcReactor } from "@/components/ArcReactor";
import { HoloBackground } from "@/components/HoloBackground";
import { ApiError, apiGet, apiPut } from "@/lib/api";
import { KEYS, storage } from "@/lib/storage";
import { themeFilter, type InterfaceTheme } from "@/lib/theme";
import { stopSpeaking } from "@/lib/voice";
import type { Profile, ProfileUpsert } from "@/lib/types";
import { ChatScreen } from "@/screens/ChatScreen";
import { IntroScreen } from "@/screens/IntroScreen";
import { NameScreen } from "@/screens/NameScreen";
import { ThemeScreen } from "@/screens/ThemeScreen";
import { VoiceTextScreen } from "@/screens/VoiceTextScreen";

type Stage = "name" | "intro" | "voicetext" | "theme" | "chat";

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
  const [profile, setProfile] = useState<Profile | null>(localProfile);
  const onboarded = Boolean(storage.get(KEYS.onboardingDone));
  const [stage, setStage] = useState<Stage>(() => (localProfile() ? (onboarded ? "chat" : "voicetext") : "name"));
  const [theme, setTheme] = useState<InterfaceTheme>(() => (storage.get(KEYS.interfaceTheme) as InterfaceTheme | null) ?? "agni");

  // Returning users: refresh the profile (name/memory/prefs) from Mongo without blocking the UI on it.
  const remote = useQuery({
    queryKey: ["profile", profile?.profile_id],
    queryFn: () => apiGet<Profile>(`/pandi/profile/${profile?.profile_id}`),
    enabled: Boolean(profile?.profile_id),
    retry: (count, err) => !(err instanceof ApiError && err.status === 404) && count < 2,
  });

  useEffect(() => {
    if (remote.data) {
      setProfile(remote.data);
      storage.set(KEYS.name, remote.data.name);
      setTheme(remote.data.theme);
      storage.set(KEYS.interfaceTheme, remote.data.theme);
    } else if (remote.error instanceof ApiError && remote.error.status === 404) {
      // Profile vanished server-side: start over cleanly.
      storage.remove(KEYS.profileId);
      storage.remove(KEYS.name);
      setProfile(null);
      setStage("name");
    }
  }, [remote.data, remote.error]);

  const resetProfile = () => {
    stopSpeaking();
    storage.remove(KEYS.profileId);
    storage.remove(KEYS.name);
    storage.remove(KEYS.sessionId);
    storage.remove(KEYS.permissionDone);
    storage.remove(KEYS.onboardingDone);
    storage.remove(KEYS.interfaceTheme);
    storage.session.remove(KEYS.introSeen);
    qc.clear();
    setProfile(null);
    setTheme("agni");
    setStage("name");
    toast("Profile reset. Welcome, new operator.");
  };

  return (
    <div style={{ filter: themeFilter(theme) }} data-testid="theme-root" data-theme={theme}>
      {stage === "name" && (
        <NameScreen
          onDone={(p) => {
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
      {stage === "voicetext" && (
        <VoiceTextScreen
          onDone={() => {
            setStage("theme");
          }}
        />
      )}
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
          onReplayIntro={() => {
            stopSpeaking();
            setStage("intro");
          }}
          onResetProfile={resetProfile}
        />
      )}
      {stage === "chat" && !profile && (
        <div className="relative flex min-h-screen items-center justify-center">
          <HoloBackground />
          <ArcReactor size={96} mode="thinking" testId="boot-reactor" />
        </div>
      )}
    </div>
  );
}
