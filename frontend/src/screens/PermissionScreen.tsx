import { useState } from "react";
import { Keyboard, Mic } from "lucide-react";
import { ArcReactor } from "@/components/ArcReactor";
import { HoloBackground } from "@/components/HoloBackground";
import { KEYS, storage } from "@/lib/storage";
import { setVoiceEnabled } from "@/lib/voice";

/** Microphone / audio access step. Allowed → voice sync on; denied or unsupported → text-only, never blocks. */
export function PermissionScreen({ onDone }: { onDone: (voice: boolean) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const finish = (voice: boolean) => {
    storage.set(KEYS.voiceSync, voice ? "on" : "off");
    setVoiceEnabled(voice);
    onDone(voice);
  };

  const allow = async () => {
    setBusy(true);
    setError(null);
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error("This browser does not expose a microphone API.");
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop());
      finish(true);
    } catch (err) {
      const name = (err as DOMException)?.name;
      setError(name === "NotAllowedError" ? "Microphone access was denied. You can continue in text mode or allow it from the browser's site settings later." : `Microphone unavailable (${(err as Error).message}). Continuing is still possible in text mode.`);
      setBusy(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4" data-testid="permission-screen">
      <HoloBackground />
      <div className="screen-enter hud-panel hud-corners relative z-10 w-full max-w-md rounded-md p-7 text-center">
        <span className="hud-c" />
        <ArcReactor size={96} mode="listening" testId="permission-reactor" className="mx-auto mb-6" beam />
        <h2 className="font-heading text-sm tracking-[0.3em] text-white glow-text">AUDIO LINK</h2>
        <p className="mt-3 text-[15px] text-[#ffd9de]">PANDI can listen and talk back. Allow microphone access to enable voice conversation — speech-to-text input and spoken replies.</p>
        {error && (
          <p className="mt-3 rounded border border-[#ff7a00]/40 bg-[#ff7a00]/10 px-3 py-2 text-xs text-[#ffb070]" data-testid="permission-error">
            {error}
          </p>
        )}
        <div className="mt-6 flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={() => void allow()}
            disabled={busy}
            data-testid="permission-allow-button"
            className="inline-flex flex-1 items-center justify-center gap-2 rounded border border-[#ff2a4a] bg-[#ff2a4a]/20 px-4 py-3 font-heading text-[11px] tracking-[0.25em] text-white hover:bg-[#ff2a4a]/35 hover:shadow-[0_0_18px_rgba(255,42,74,0.5)] disabled:opacity-50"
          >
            <Mic size={14} /> {busy ? "REQUESTING…" : "ALLOW MICROPHONE"}
          </button>
          <button
            type="button"
            onClick={() => finish(false)}
            data-testid="permission-text-only-button"
            className="inline-flex flex-1 items-center justify-center gap-2 rounded border border-[#ff2a4a]/30 bg-black/40 px-4 py-3 font-heading text-[11px] tracking-[0.25em] text-[#ffb0bc] hover:border-[#ff2a4a] hover:text-white"
          >
            <Keyboard size={14} /> TEXT ONLY
          </button>
        </div>
        <p className="mt-4 text-[10px] tracking-[0.25em] text-[#7d4f58]">YOU CAN CHANGE THIS ANY TIME IN SETTINGS</p>
      </div>
    </div>
  );
}
