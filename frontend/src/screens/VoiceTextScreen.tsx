import { useState } from "react";
import { Keyboard, Mic } from "lucide-react";
import { ArcReactor } from "@/components/ArcReactor";
import { HoloBackground } from "@/components/HoloBackground";
import { KEYS, storage } from "@/lib/storage";
import { setVoiceEnabled } from "@/lib/voice";

/** "Voice or Text?" — Voice mode requests the microphone right away; denied/unsupported falls back to text, never blocks. */
export function VoiceTextScreen({ onDone }: { onDone: (voiceMode: boolean) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const finish = (voice: boolean) => {
    storage.set(KEYS.voiceSync, voice ? "on" : "off");
    storage.set(KEYS.permissionDone, voice ? "voice" : "text");
    setVoiceEnabled(voice);
    onDone(voice);
  };

  const chooseVoice = async () => {
    setBusy(true);
    setError(null);
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error("This browser does not expose a microphone API.");
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop());
      finish(true);
    } catch (err) {
      const name = (err as DOMException)?.name;
      setError(name === "NotAllowedError" ? "Microphone access was denied. Continuing in text mode — you can allow it later from Settings." : `Microphone unavailable (${(err as Error).message}). Continuing in text mode.`);
      setBusy(false);
      window.setTimeout(() => finish(false), 1800);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4" data-testid="voicetext-screen">
      <HoloBackground />
      <div className="screen-enter hud-panel hud-corners relative z-10 w-full max-w-md rounded-md p-7 text-center">
        <span className="hud-c" />
        <ArcReactor size={96} mode="listening" testId="voicetext-reactor" className="mx-auto mb-6" beam />
        <h2 className="font-heading text-sm tracking-[0.3em] text-white glow-text">VOICE OR TEXT?</h2>
        <p className="mt-3 text-[15px] text-[#ffe3b8]">Choose how PANDI should reply. Voice mode speaks every answer out loud in a calm, Jarvis-style tone and keeps the microphone ready. Text mode stays silent.</p>
        {error && (
          <p className="mt-3 rounded border border-[#ff3b3b]/40 bg-[#ff3b3b]/10 px-3 py-2 text-xs text-[#ff9d9d]" data-testid="voicetext-error">
            {error}
          </p>
        )}
        <div className="mt-6 flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={() => void chooseVoice()}
            disabled={busy}
            data-testid="voicetext-voice-button"
            className="inline-flex flex-1 items-center justify-center gap-2 rounded border border-[#ff8a1f] bg-[#ff8a1f]/20 px-4 py-3 font-heading text-[11px] tracking-[0.25em] text-white hover:bg-[#ff8a1f]/35 hover:shadow-[0_0_18px_rgba(255, 138, 31,0.5)] disabled:opacity-50"
          >
            <Mic size={14} /> {busy ? "REQUESTING…" : "VOICE"}
          </button>
          <button
            type="button"
            onClick={() => finish(false)}
            data-testid="voicetext-text-button"
            className="inline-flex flex-1 items-center justify-center gap-2 rounded border border-[#ff8a1f]/30 bg-black/40 px-4 py-3 font-heading text-[11px] tracking-[0.25em] text-[#ffd27a] hover:border-[#ff8a1f] hover:text-white"
          >
            <Keyboard size={14} /> TEXT
          </button>
        </div>
        <p className="mt-4 text-[10px] tracking-[0.25em] text-[#7a4a22]">YOU CAN CHANGE THIS ANY TIME IN SETTINGS</p>
      </div>
    </div>
  );
}
