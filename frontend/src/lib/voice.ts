// Official PANDI voice engine: ElevenLabs TTS via /api/voice/tts with browser speech-synthesis fallback.
// A tiny external store so the arc reactor, waveform and 3D step highlighting can all follow playback.
import { useSyncExternalStore } from "react";
import { getSettings } from "@/lib/settings";

export type VoiceStatusKind = "idle" | "loading" | "speaking";

export interface VoiceState {
  status: VoiceStatusKind;
  /** id of the message currently being spoken (or loading) */
  messageId: string | null;
  /** 0..1 progress through the spoken text */
  progress: number;
  enabled: boolean;
  provider: "elevenlabs" | "browser" | null;
  lastError: string | null;
}

const ENABLED_KEY = "pandi-voice-enabled";
const VOICE_KEY = "pandi-voice-name";

/** "official" = ElevenLabs (when configured) else any browser voice name. */
export function getPreferredVoice(): string {
  return localStorage.getItem(VOICE_KEY) ?? "official";
}
export function setPreferredVoice(name: string) {
  localStorage.setItem(VOICE_KEY, name);
}
export function listBrowserVoices(): SpeechSynthesisVoice[] {
  return "speechSynthesis" in window ? window.speechSynthesis.getVoices() : [];
}

let state: VoiceState = {
  status: "idle",
  messageId: null,
  progress: 0,
  enabled: localStorage.getItem(ENABLED_KEY) !== "off",
  provider: null,
  lastError: null,
};
const listeners = new Set<() => void>();
let audio: HTMLAudioElement | null = null;
let objectUrl: string | null = null;
let utterance: SpeechSynthesisUtterance | null = null;
let token = 0;
let audioCtx: AudioContext | null = null;
let analyser: AnalyserNode | null = null;
let analyserData: Uint8Array<ArrayBuffer> | null = null;
let syntheticPhase = 0;

/** 0..1 live loudness of the official voice (analyser on the audio element); synthetic pulse for browser TTS. */
export function getVoiceLevel(): number {
  if (state.status !== "speaking") return 0;
  if (analyser && analyserData && state.provider === "elevenlabs") {
    analyser.getByteFrequencyData(analyserData);
    let sum = 0;
    for (let i = 0; i < analyserData.length; i += 1) sum += analyserData[i];
    return Math.min(1, (sum / analyserData.length / 255) * 2.2);
  }
  syntheticPhase += 0.21;
  return 0.35 + 0.35 * Math.abs(Math.sin(syntheticPhase)) * (0.6 + 0.4 * Math.sin(syntheticPhase * 0.37));
}

function attachAnalyser(el: HTMLAudioElement) {
  try {
    audioCtx = audioCtx ?? new AudioContext();
    const src = audioCtx.createMediaElementSource(el);
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 64;
    analyserData = new Uint8Array(analyser.frequencyBinCount);
    src.connect(analyser);
    analyser.connect(audioCtx.destination);
    void audioCtx.resume();
  } catch {
    analyser = null;
  }
}

function set(patch: Partial<VoiceState>) {
  state = { ...state, ...patch };
  listeners.forEach((fn) => fn());
}

export function useVoice(): VoiceState {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    () => state,
  );
}

export function setVoiceEnabled(enabled: boolean) {
  localStorage.setItem(ENABLED_KEY, enabled ? "on" : "off");
  if (!enabled) stopSpeaking();
  set({ enabled });
}

/** Markdown → plain speech text (no asterisks, hashes, code fences, links, LaTeX delimiters). */
export function stripMarkdown(md: string): string {
  return md
    .replace(/```[\s\S]*?```/g, " code block omitted. ")
    .replace(/<<<[\s\S]*?>>>/g, "")
    .replace(/\$\$([\s\S]*?)\$\$/g, (_m, t: string) => latexToSpeech(t))
    .replace(/\$([^$\n]+)\$/g, (_m, t: string) => latexToSpeech(t))
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/^\s*\d+\.\s+/gm, "")
    .replace(/^\s*>\s?/gm, "")
    .replace(/(\*\*|__)(.*?)\1/g, "$2")
    .replace(/(\*|_)(.*?)\1/g, "$2")
    .replace(/~~(.*?)~~/g, "$1")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/\|/g, " ")
    .replace(/^-{3,}$/gm, "")
    .replace(/[*#_~^]/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function latexToSpeech(t: string): string {
  return t
    .replace(/\\times/g, " times ")
    .replace(/\\cdot/g, " times ")
    .replace(/\\div/g, " divided by ")
    .replace(/\\pm/g, " plus or minus ")
    .replace(/\\sqrt\{([^}]*)\}/g, " square root of $1 ")
    .replace(/\\frac\{([^}]*)\}\{([^}]*)\}/g, " $1 over $2 ")
    .replace(/\\text\{([^}]*)\}/g, "$1")
    .replace(/\^\{?2\}?/g, " squared")
    .replace(/\^\{?3\}?/g, " cubed")
    .replace(/\^\{?([^}]*)\}?/g, " to the power of $1")
    .replace(/\\pi/g, " pi ")
    .replace(/\\circ/g, " degrees")
    .replace(/\\[a-zA-Z]+/g, " ")
    .replace(/[{}\\]/g, "");
}

function cleanup() {
  if (audio) {
    audio.onended = null;
    audio.ontimeupdate = null;
    audio.onerror = null;
    audio.pause();
    audio = null;
  }
  if (objectUrl) {
    URL.revokeObjectURL(objectUrl);
    objectUrl = null;
  }
  if (utterance && "speechSynthesis" in window) {
    utterance.onend = null;
    utterance.onboundary = null;
    utterance.onerror = null;
    utterance = null;
    window.speechSynthesis.cancel();
  }
}

/** Apply a new speed (0.5x-2x) to whatever is playing right now. */
export function applyVoiceSpeed(speed: number) {
  if (audio) audio.playbackRate = speed;
}

export function stopSpeaking() {
  token += 1;
  cleanup();
  set({ status: "idle", messageId: null, progress: 0 });
}

async function speakWithElevenLabs(text: string, myToken: number): Promise<boolean> {
  const res = await fetch("/api/voice/tts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) throw new Error(`voice api ${res.status}`);
  const blob = await res.blob();
  if (myToken !== token) return false;
  objectUrl = URL.createObjectURL(blob);
  audio = new Audio(objectUrl);
  audio.playbackRate = getSettings().voice_speed;
  attachAnalyser(audio);
  await new Promise<void>((resolve, reject) => {
    if (!audio) return reject(new Error("no audio"));
    audio.ontimeupdate = () => {
      if (audio && audio.duration) set({ progress: Math.min(1, audio.currentTime / audio.duration) });
    };
    audio.onended = () => resolve();
    audio.onerror = () => reject(new Error("audio playback failed"));
    audio.play().then(() => set({ status: "speaking", provider: "elevenlabs", progress: 0 })).catch(reject);
  });
  return true;
}

function speakWithBrowser(text: string, myToken: number): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!("speechSynthesis" in window)) return reject(new Error("speech synthesis unavailable"));
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    utterance = u;
    const voices = window.speechSynthesis.getVoices();
    const wanted = getPreferredVoice();
    const preferred =
      voices.find((v) => v.name === wanted) ??
      voices.find((v) => /en-(GB|IN|US)/i.test(v.lang) && /daniel|arthur|fred|george|david|male/i.test(v.name)) ??
      voices.find((v) => /^en/i.test(v.lang)) ??
      voices[0];
    if (preferred) u.voice = preferred;
    // Jarvis-style: deep, calm, confident — lower pitch, measured pace.
    u.rate = Math.min(2, Math.max(0.5, 0.94 * getSettings().voice_speed));
    u.pitch = 0.72;
    const total = Math.max(1, text.length);
    u.onboundary = (e) => {
      if (myToken === token) set({ progress: Math.min(1, e.charIndex / total) });
    };
    u.onend = () => resolve();
    u.onerror = (e) => (e.error === "interrupted" || e.error === "canceled" ? resolve() : reject(new Error(e.error)));
    set({ status: "speaking", provider: "browser", progress: 0 });
    window.speechSynthesis.speak(u);
  });
}

/** Speak a message. Resolves when finished or stopped; never throws. */
export async function speak(messageId: string, markdown: string): Promise<void> {
  if (!state.enabled) return;
  const text = stripMarkdown(markdown).slice(0, 3800);
  if (!text) return;
  stopSpeaking();
  const myToken = token;
  set({ status: "loading", messageId, progress: 0, lastError: null });
  try {
    if (getPreferredVoice() !== "official") throw new Error("browser voice selected");
    const played = await speakWithElevenLabs(text, myToken);
    if (!played) return;
  } catch (err) {
    if (myToken !== token) return;
    cleanup();
    try {
      await speakWithBrowser(text, myToken);
    } catch (fallbackErr) {
      if (myToken === token) {
        set({ lastError: `${(err as Error).message}; ${(fallbackErr as Error).message}` });
      }
    }
  } finally {
    if (myToken === token) {
      cleanup();
      set({ status: "idle", messageId: null, progress: 1 });
    }
  }
}
