import { useCallback, useEffect, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { Globe, ImagePlus, Mic, MicOff, Paperclip, SendHorizonal, Square, X } from "lucide-react";
import { toast } from "sonner";
import { ApiError, apiGet, apiUpload } from "@/lib/api";
import { useSettings } from "@/lib/settings";
import { useSpeechRecognition } from "@/lib/speech";
import { KEYS, storage } from "@/lib/storage";
import { stopSpeaking, useVoice } from "@/lib/voice";
import { useVoiceLoop, voiceLoopSupported } from "@/lib/voiceLoop";
import type { CreditStatus, FileUploadResponse, ModelInfo } from "@/lib/types";

export interface SendOptions {
  forceSearch?: boolean;
  forceImage?: boolean;
}

interface Props {
  disabled: boolean;
  credits: CreditStatus | undefined;
  onSend: (text: string, files: FileUploadResponse[], opts?: SendOptions) => void;
  onListeningChange?: (listening: boolean) => void;
}

const IMAGE_LIMIT_MESSAGE = "You have used all your images for today. Your image limit resets at 00:00 IST.";
const FALLBACK_MODELS: ModelInfo[] = [{ id: "gpt-5.1", provider: "openai", label: "OpenAI · GPT-5.1" }];
const chip = "inline-flex h-8 items-center gap-1.5 rounded border px-2.5 text-xs disabled:cursor-not-allowed disabled:opacity-45";

export function InputBar({ disabled, credits, onSend, onListeningChange }: Props) {
  const [text, setText] = useState("");
  const [files, setFiles] = useState<FileUploadResponse[]>([]);
  const [uploading, setUploading] = useState(false);
  const [searchOn, setSearchOn] = useState(() => storage.get(KEYS.searchToggle) === "on");
  const [model, setModel] = useState(() => storage.get(KEYS.model) ?? "gpt-5.1");
  const fileInput = useRef<HTMLInputElement>(null);
  const voice = useVoice();
  const settings = useSettings();
  const models = useQuery({ queryKey: ["models"], queryFn: () => apiGet<ModelInfo[]>("/pandi/models"), staleTime: Infinity });
  const modelList = models.data ?? FALLBACK_MODELS;
  const stateRef = useRef({ searchOn, disabled, onSend });
  stateRef.current = { searchOn, disabled, onSend };

  // Hands-free loop (native speech recognition): silence sends the message, then the mic waits for the start word.
  const nativeLoop = voiceLoopSupported();
  const loop = useVoiceLoop(
    useCallback((spoken: string) => {
      setText("");
      if (stateRef.current.disabled) {
        toast.info("Pandi is still answering — your words were kept in the box.");
        setText(spoken);
        return;
      }
      stateRef.current.onSend(spoken, [], { forceSearch: stateRef.current.searchOn });
    }, []),
    useCallback((heard: string) => setText(heard), []),
  );
  // Fallback for browsers without native recognition: tap to record, tap again to transcribe into the box.
  const onFinal = useCallback((spoken: string) => setText((t) => (t ? `${t} ${spoken}` : spoken)), []);
  const speech = useSpeechRecognition(onFinal);

  const micActive = nativeLoop ? loop.mode !== "off" : speech.listening;
  const micError = nativeLoop ? loop.error : speech.error;
  useEffect(() => onListeningChange?.(nativeLoop ? loop.mode === "listening" : speech.listening), [nativeLoop, loop.mode, speech.listening, onListeningChange]);

  const imagesLeft = credits?.images_left ?? 0;
  const imageCost = credits?.image_cost ?? 5;
  const noSlots = credits !== undefined && imagesLeft === 0;
  const noCredits = credits !== undefined && credits.credits_left < imageCost;
  const imageBlocked = !credits || noSlots || noCredits;
  const imageLabel = noSlots ? "Create image, 0 left today" : `Create image, ${imagesLeft} left today`;

  const send = (opts?: SendOptions) => {
    const value = text.trim() || (files.length ? "Please analyze the attached file(s) and summarize the key findings." : "");
    if (!value || disabled) return;
    onSend(value, files, { forceSearch: searchOn, ...opts });
    setText("");
    setFiles([]);
  };

  const createImage = () => {
    if (imageBlocked || disabled) return;
    if (!text.trim()) {
      toast.info("Describe the picture first, for example: a cat on a beach.");
      return;
    }
    send({ forceImage: true, forceSearch: false });
  };

  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const upload = async (list: FileList | null) => {
    if (!list?.length) return;
    setUploading(true);
    for (const file of Array.from(list).slice(0, 4)) {
      try {
        const saved = await apiUpload<FileUploadResponse>("/pandi/files", file);
        setFiles((f) => [...f, saved]);
        toast.success(`${saved.filename} ready for analysis`);
      } catch (err) {
        const detail = err instanceof ApiError && err.body && typeof err.body === "object" && "detail" in err.body ? String((err.body as { detail: unknown }).detail) : "Upload failed";
        toast.error(`${file.name}: ${detail}`);
      }
    }
    setUploading(false);
    if (fileInput.current) fileInput.current.value = "";
  };

  const toggleMic = () => {
    if (micActive) {
      if (nativeLoop) loop.stop();
      else speech.stop();
      return;
    }
    if (!nativeLoop && !speech.supported) {
      toast.error("Speech recognition is not supported in this browser. Text mode is available.");
      return;
    }
    stopSpeaking();
    if (nativeLoop) loop.start();
    else speech.start();
  };

  const micHint =
    loop.mode === "listening"
      ? `Listening… I'll send after ${(settings.silence_ms / 1000).toFixed(settings.silence_ms % 1000 ? 1 : 0)} s of silence.`
      : loop.mode === "waiting"
        ? `Mic is waiting — say "${settings.start_word}" to speak again.`
        : null;

  return (
    <div className="hud-panel hud-corners lt-zoom rounded-md p-2" data-testid="input-bar">
      <span className="hud-c" />
      <div className="mb-2 flex flex-wrap items-center gap-1.5 px-0.5" data-testid="chat-toolbar">
        <label className="sr-only" htmlFor="chat-model-select">
          AI model
        </label>
        <select
          id="chat-model-select"
          value={modelList.some((m) => m.id === model) ? model : modelList[0].id}
          onChange={(e) => {
            setModel(e.target.value);
            storage.set(KEYS.model, e.target.value);
          }}
          data-testid="chat-model-select"
          className="h-8 max-w-[11.5rem] rounded border border-[#ff8a1f]/35 bg-[#050302] px-2 text-xs text-white focus:border-[#ff8a1f] focus:outline-none"
        >
          {modelList.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          aria-pressed={searchOn}
          onClick={() => {
            const next = !searchOn;
            setSearchOn(next);
            storage.set(KEYS.searchToggle, next ? "on" : "off");
          }}
          title="Search the live web for every message"
          data-testid="chat-search-toggle"
          className={`${chip} ${searchOn ? "border-[#52ffa8] bg-[#52ffa8]/15 text-[#52ffa8]" : "border-[#ff8a1f]/35 bg-black/40 text-[#ffd27a] hover:border-[#ff8a1f] hover:text-white"}`}
        >
          <Globe size={13} /> Search {searchOn ? "on" : "off"}
        </button>
        <button type="button" onClick={createImage} disabled={imageBlocked || disabled} aria-label={imageLabel} aria-describedby={noSlots || noCredits ? "image-limit-message" : undefined} data-testid="create-image-button" className={`${chip} border-[#ff8a1f]/35 bg-black/40 text-[#ffd27a] hover:border-[#ff8a1f] hover:text-white`}>
          <ImagePlus size={13} /> {imageLabel}
        </button>
        {(noSlots || noCredits) && (
          <span id="image-limit-message" role="status" aria-live="polite" className="text-xs text-[#ffb347]" data-testid="image-limit-message">
            {noSlots ? IMAGE_LIMIT_MESSAGE : `An image needs ${imageCost} credits. Your credits reset at 00:00 IST.`}
          </span>
        )}
      </div>
      {(files.length > 0 || speech.interim || micError || micHint) && (
        <div className="mb-2 flex flex-wrap items-center gap-1.5 px-1">
          {files.map((f) => (
            <span key={f.file_id} className="inline-flex items-center gap-1 rounded-sm border border-[#ff8a1f]/40 bg-[#ff8a1f]/10 px-2 py-0.5 text-[11px] text-[#ffe3b8]" data-testid="attached-file-chip">
              📎 {f.filename}
              <button type="button" onClick={() => setFiles((list) => list.filter((x) => x.file_id !== f.file_id))} aria-label={`Remove ${f.filename}`} data-testid="remove-attached-file">
                <X size={11} />
              </button>
            </span>
          ))}
          {micHint && (
            <span className="text-xs text-[#ffd27a]" role="status" data-testid="mic-hint" data-mode={loop.mode}>
              {micHint}
            </span>
          )}
          {speech.interim && (
            <span className="text-[11px] italic text-[#ffd27a] animate-pulse" data-testid="speech-interim">
              {speech.interim}…
            </span>
          )}
          {micError && (
            <span className="text-[11px] text-[#ff9d9d]" data-testid="speech-error">
              {micError}
            </span>
          )}
        </div>
      )}
      <div className="flex items-end gap-1.5">
        <input ref={fileInput} type="file" multiple hidden onChange={(e) => void upload(e.target.files)} data-testid="file-input" accept=".pdf,.doc,.docx,.txt,.csv,.xls,.xlsx,.md,image/*,audio/*,video/*" />
        <button
          type="button"
          onClick={() => fileInput.current?.click()}
          disabled={uploading || disabled}
          title="Attach file"
          aria-label="Attach file"
          data-testid="attach-file-button"
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded border border-[#ff8a1f]/30 bg-black/40 text-[#ffd27a] hover:border-[#ff8a1f] hover:text-white disabled:opacity-50"
        >
          <Paperclip size={16} className={uploading ? "animate-pulse" : ""} />
        </button>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKey}
          rows={1}
          placeholder={loop.mode === "listening" || speech.listening ? "Listening…" : "Ask anything, or describe a picture to draw…"}
          aria-label="Message"
          data-testid="chat-input"
          className="max-h-40 min-h-10 flex-1 resize-none rounded border border-[#ff8a1f]/30 bg-black/50 px-3 py-2.5 text-[15px] text-white placeholder:text-[#7a4a22] focus:border-[#ff8a1f] focus:outline-none focus:shadow-[0_0_14px_rgba(255,138,31,0.3)]"
          style={{ fieldSizing: "content" } as React.CSSProperties}
        />
        <button
          type="button"
          onClick={toggleMic}
          title={micActive ? "Turn the microphone off" : "Speak"}
          aria-label={micActive ? "Turn the microphone off" : "Speak"}
          data-testid="mic-button"
          data-listening={micActive}
          className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded border ${loop.mode === "waiting" ? "border-[#ffd27a] bg-[#ffd27a]/15 text-[#ffd27a]" : micActive ? "border-[#ff3b3b] bg-[#ff3b3b]/20 text-white animate-reactor-pulse" : "border-[#ff8a1f]/30 bg-black/40 text-[#ffd27a] hover:border-[#ff8a1f] hover:text-white"}`}
        >
          {micActive ? <MicOff size={16} /> : <Mic size={16} />}
        </button>
        {voice.status !== "idle" ? (
          <button type="button" onClick={stopSpeaking} title="Stop speaking" aria-label="Stop speaking" data-testid="stop-speaking-button" className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded border border-[#ff3b3b]/60 bg-[#ff3b3b]/15 text-[#ff9d9d] hover:bg-[#ff3b3b]/30">
            <Square size={14} />
          </button>
        ) : (
          <button
            type="button"
            onClick={() => send()}
            disabled={disabled || (!text.trim() && files.length === 0)}
            title="Send"
            aria-label="Send"
            data-testid="send-button"
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded border border-[#ff8a1f] bg-[#ff8a1f]/20 text-white hover:bg-[#ff8a1f]/40 hover:shadow-[0_0_16px_rgba(255,138,31,0.5)] disabled:cursor-not-allowed disabled:opacity-40"
          >
            <SendHorizonal size={16} />
          </button>
        )}
      </div>
    </div>
  );
}
