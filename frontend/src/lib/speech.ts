import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError } from "@/lib/api";
import type { TranscribeResponse } from "@/lib/types";

interface RecognitionLike {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start(): void;
  stop(): void;
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

async function uploadAndTranscribe(blob: Blob): Promise<string> {
  const form = new FormData();
  form.append("file", blob, "recording.webm");
  const res = await fetch("/api/voice/transcribe", { method: "POST", body: form });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new ApiError(res.status, body);
  }
  const data = (await res.json()) as TranscribeResponse;
  return data.text;
}

/**
 * Voice input: native SpeechRecognition where available (live interim text), otherwise tap-to-record
 * with MediaRecorder → upload → Whisper transcription (server-side, via the Emergent universal key).
 * Either way the transcript lands in the caller's text box before anything is sent — never auto-replied.
 */
export function useSpeechRecognition(onFinal: (text: string) => void) {
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<string | null>(null);
  const recRef = useRef<RecognitionLike | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const nativeSupported = getCtor() !== null;
  const recorderSupported = typeof MediaRecorder !== "undefined" && Boolean(navigator.mediaDevices?.getUserMedia);
  const supported = nativeSupported || recorderSupported;

  const stopRecorder = useCallback(() => {
    const rec = recorderRef.current;
    if (!rec) return;
    if (rec.state !== "inactive") rec.stop();
    streamRef.current?.getTracks().forEach((t) => t.stop());
  }, []);

  const stop = useCallback(() => {
    if (nativeSupported) {
      recRef.current?.stop();
    } else {
      stopRecorder();
    }
    setListening(false);
  }, [nativeSupported, stopRecorder]);

  const startNative = useCallback(() => {
    const Ctor = getCtor();
    if (!Ctor) return;
    const rec = new Ctor();
    rec.lang = navigator.language || "en-US";
    rec.interimResults = true;
    rec.continuous = false;
    rec.onresult = (e) => {
      let finalText = "";
      let interimText = "";
      for (let i = e.resultIndex; i < e.results.length; i += 1) {
        const r = e.results[i];
        if (r.isFinal) finalText += r[0].transcript;
        else interimText += r[0].transcript;
      }
      setInterim(interimText);
      if (finalText.trim()) onFinal(finalText.trim());
    };
    rec.onend = () => {
      setListening(false);
      setInterim("");
    };
    rec.onerror = (e) => {
      setError(e.error === "not-allowed" ? "Microphone permission denied. Text mode is available." : `Speech error: ${e.error}`);
      setListening(false);
    };
    recRef.current = rec;
    setError(null);
    try {
      rec.start();
      setListening(true);
    } catch {
      setError("Could not start the microphone.");
    }
  }, [onFinal]);

  const startRecorder = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];
      const rec = new MediaRecorder(stream);
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      rec.onstop = async () => {
        setListening(false);
        setInterim("Transcribing…");
        try {
          const blob = new Blob(chunksRef.current, { type: "audio/webm" });
          const text = await uploadAndTranscribe(blob);
          setInterim("");
          if (text.trim()) onFinal(text.trim());
          else setError("Could not hear any speech. Please try again or type instead.");
        } catch {
          setInterim("");
          setError("Transcription failed. Please type your message instead.");
        }
      };
      recorderRef.current = rec;
      rec.start();
      setListening(true);
    } catch {
      setError("Microphone access was denied or is unavailable. Text mode is available.");
      setListening(false);
    }
  }, [onFinal]);

  const start = useCallback(() => {
    if (nativeSupported) startNative();
    else if (recorderSupported) void startRecorder();
    else setError("Voice input is not supported in this browser. Text mode is available.");
  }, [nativeSupported, recorderSupported, startNative, startRecorder]);

  useEffect(
    () => () => {
      recRef.current?.abort();
      stopRecorder();
    },
    [stopRecorder],
  );

  return { supported, listening, interim, error, start, stop };
}
