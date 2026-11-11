// Hands-free mic loop: listen → 2 s of silence sends the message → wait for the start word → listen again.
// Uses the browser's native SpeechRecognition; browsers without it fall back to tap-to-record (lib/speech.ts).
import { useCallback, useEffect, useRef, useState } from "react";
import { getSettings } from "@/lib/settings";

type Mode = "off" | "listening" | "waiting";

interface RecognitionLike {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start(): void;
  abort(): void;
  onresult: ((e: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
}
type RecognitionCtor = new () => RecognitionLike;

function getCtor(): RecognitionCtor | null {
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export const voiceLoopSupported = (): boolean => getCtor() !== null;

const normalize = (text: string) => text.toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();

export function useVoiceLoop(onSend: (text: string) => void, onDraft: (text: string) => void) {
  const [mode, setModeState] = useState<Mode>("off");
  const [error, setError] = useState<string | null>(null);
  const modeRef = useRef<Mode>("off");
  const recRef = useRef<RecognitionLike | null>(null);
  const bufferRef = useRef("");
  const heardRef = useRef("");
  const timerRef = useRef<number | undefined>(undefined);
  const callbacks = useRef({ onSend, onDraft });
  callbacks.current = { onSend, onDraft };

  const setMode = useCallback((next: Mode) => {
    modeRef.current = next;
    setModeState(next);
  }, []);

  const begin = useCallback(() => {
    const Ctor = getCtor();
    if (!Ctor || modeRef.current === "off") return;
    const rec = new Ctor();
    rec.lang = navigator.language || "en-US";
    rec.interimResults = true;
    rec.continuous = true;
    rec.onresult = (e) => {
      let finalText = "";
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i += 1) {
        const r = e.results[i];
        if (r.isFinal) finalText += `${r[0].transcript} `;
        else interim += r[0].transcript;
      }
      if (modeRef.current === "waiting") {
        // Only the start word wakes the mic; everything else is ignored.
        if (normalize(`${finalText} ${interim}`).includes(normalize(getSettings().start_word))) {
          bufferRef.current = "";
          setMode("listening");
          rec.abort(); // onend restarts a clean recognition for the actual message
        }
        return;
      }
      bufferRef.current += finalText;
      heardRef.current = `${bufferRef.current}${interim}`.trim();
      callbacks.current.onDraft(heardRef.current);
      window.clearTimeout(timerRef.current);
      if (!heardRef.current) return;
      timerRef.current = window.setTimeout(() => {
        const text = heardRef.current;
        bufferRef.current = "";
        heardRef.current = "";
        if (!text || modeRef.current !== "listening") return;
        callbacks.current.onSend(text);
        // After sending, the mic stops taking dictation and waits for the start word.
        setMode(getSettings().wake_enabled ? "waiting" : "off");
        rec.abort();
      }, getSettings().silence_ms);
    };
    rec.onerror = (e) => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        setError("Microphone permission denied. Text mode is available.");
        setMode("off");
      }
    };
    rec.onend = () => {
      if (modeRef.current !== "off") window.setTimeout(begin, 250);
    };
    recRef.current = rec;
    try {
      rec.start();
    } catch {
      setError("Could not start the microphone. Text mode is available.");
      setMode("off");
    }
  }, [setMode]);

  const start = useCallback(() => {
    setError(null);
    bufferRef.current = "";
    heardRef.current = "";
    const wasOff = modeRef.current === "off";
    setMode("listening");
    if (wasOff) begin();
    else recRef.current?.abort();
  }, [begin, setMode]);

  const stop = useCallback(() => {
    window.clearTimeout(timerRef.current);
    setMode("off");
    recRef.current?.abort();
  }, [setMode]);

  useEffect(
    () => () => {
      modeRef.current = "off";
      window.clearTimeout(timerRef.current);
      recRef.current?.abort();
    },
    [],
  );

  return { mode, error, start, stop };
}
