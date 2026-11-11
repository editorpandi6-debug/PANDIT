import { useEffect, useState } from "react";
import { toast } from "sonner";
import { BrandLogo } from "@/components/BrandLogo";
import { CreditsFooter } from "@/components/CreditsFooter";
import { HoloBackground } from "@/components/HoloBackground";
import { apiPut } from "@/lib/api";
import { KEYS, newId, storage } from "@/lib/storage";
import type { Profile, ProfileUpsert } from "@/lib/types";

export function NameScreen({ onDone }: { onDone: (profile: Profile) => void }) {
  const [name, setName] = useState("");
  const [typed, setTyped] = useState("");
  const [error, setError] = useState<string | null>(null);
  const line = "Welcome to PANDI AI Mark II. What should I call you?";

  useEffect(() => {
    let i = 0;
    const id = window.setInterval(() => {
      i += 1;
      setTyped(line.slice(0, i));
      if (i >= line.length) window.clearInterval(id);
    }, 28);
    return () => window.clearInterval(id);
  }, []);

  // Instant continue: persist locally and move on immediately; the server write happens in the background.
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const value = name.trim();
    if (value.length < 2 || value.length > 20) {
      setError("Please enter 2–20 characters.");
      return;
    }
    setError(null);
    const profileId = storage.get(KEYS.profileId) ?? newId();
    const now = new Date().toISOString();
    const local: Profile = { profile_id: profileId, name: value, avatar_data_url: null, memory: [], voice_mode: "text", theme: "agni", created_at: now, updated_at: now };
    storage.set(KEYS.profileId, profileId);
    storage.set(KEYS.name, value);
    const body: ProfileUpsert = { name: value };
    apiPut<Profile>(`/pandi/profile/${profileId}`, body).catch(() => toast.warning("Name saved locally — the server could not be reached."));
    onDone(local);
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4" data-testid="name-screen">
      <HoloBackground />
      <div className="screen-enter relative z-10 flex w-full max-w-md flex-col items-center text-center">
        <BrandLogo testId="name-screen-logo" className="mb-6 w-52 sm:w-64" />
        <h1 className="font-heading text-2xl font-bold tracking-[0.22em] text-white glow-text sm:text-3xl" data-testid="name-screen-title">
          PANDI AI MARK II
        </h1>
        <p className="mt-2 font-heading text-[11px] tracking-[0.42em] text-[#ff8a1f]" data-testid="name-screen-subtitle">
          THE HOLOGRAM INTELLIGENCE
        </p>
        <p className="mt-8 min-h-[1.6em] text-[15px] text-[#ffe3b8]" data-testid="name-screen-prompt">
          {typed}
          <span className="ml-0.5 inline-block w-[2px] bg-[#ff8a1f] align-middle animate-blink" style={{ height: "1em" }} />
        </p>
        <form onSubmit={submit} className="hud-panel hud-corners mt-6 flex w-full flex-col gap-3 rounded-md p-4 sm:flex-row">
          <span className="hud-c" />
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            minLength={2}
            maxLength={20}
            placeholder="Enter your name (2-20 characters)"
            aria-label="Your name"
            data-testid="name-input"
            className="h-11 flex-1 rounded border border-[#ff8a1f]/35 bg-black/50 px-3 font-sans text-white placeholder:text-[#7a4a22] focus:border-[#ff8a1f] focus:outline-none focus:shadow-[0_0_14px_rgba(255, 138, 31,0.35)]"
          />
          <button
            type="submit"
            disabled={name.trim().length < 2}
            data-testid="name-continue-button"
            className="h-11 rounded border border-[#ff8a1f] bg-[#ff8a1f]/15 px-6 font-heading text-xs tracking-[0.25em] text-white hover:bg-[#ff8a1f]/30 hover:shadow-[0_0_18px_rgba(255, 138, 31,0.5)] disabled:cursor-not-allowed disabled:opacity-40"
          >
            CONTINUE
          </button>
        </form>
        {error && (
          <p className="mt-3 text-xs text-[#ff9d9d]" data-testid="name-error">
            {error}
          </p>
        )}
        <p className="mt-6 text-[10px] tracking-[0.3em] text-[#7a4a22]">PERSONALIZED ADVANCED NEURAL DIGITAL INTELLIGENCE</p>
        <CreditsFooter testId="welcome-footer-credits" className="mt-6" />
      </div>
    </div>
  );
}
