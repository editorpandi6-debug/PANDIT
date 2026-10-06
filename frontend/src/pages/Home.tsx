import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArcReactor } from "@/components/ArcReactor";
import { HoloBackground } from "@/components/HoloBackground";
import { ApiError, apiGet } from "@/lib/api";
import { KEYS, storage } from "@/lib/storage";
import { stopSpeaking } from "@/lib/voice";
import type { Profile } from "@/lib/types";
import { ChatScreen } from "@/screens/ChatScreen";
import { IntroScreen } from "@/screens/IntroScreen";
import { NameScreen } from "@/screens/NameScreen";
import { PermissionScreen } from "@/screens/PermissionScreen";

type Stage = "name" | "intro" | "permission" | "chat";

// Apply saved theme intensity before first paint.
document.documentElement.style.setProperty("--glow", String(Number(storage.get(KEYS.glow) ?? "100") / 100));

function localProfile(): Profile | null {
  const id = storage.get(KEYS.profileId);
  const name = storage.get(KEYS.name);
  if (!id || !name) return null;
  const now = new Date().toISOString();
  return { profile_id: id, name, avatar_data_url: null, memory: [], created_at: now, updated_at: now };
}

export default function Home() {
  const qc = useQueryClient();
  const [profile, setProfile] = useState<Profile | null>(localProfile);
  const [stage, setStage] = useState<Stage>(() => (localProfile() ? (storage.get(KEYS.permissionDone) ? "chat" : "permission") : "name"));

  // Returning users: refresh the profile (name/memory) from Mongo without blocking the UI on it.
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
    storage.session.remove(KEYS.introSeen);
    qc.clear();
    setProfile(null);
    setStage("name");
    toast("Profile reset. Welcome, new operator.");
  };

  return (
    <>
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
            setStage(storage.get(KEYS.permissionDone) ? "chat" : "permission");
          }}
        />
      )}
      {stage === "permission" && (
        <PermissionScreen
          onDone={(voice) => {
            storage.set(KEYS.permissionDone, voice ? "voice" : "text");
            setStage("chat");
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
    </>
  );
}
