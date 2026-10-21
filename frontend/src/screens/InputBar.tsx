import { useCallback, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { Mic, MicOff, Paperclip, SendHorizonal, Square, X } from "lucide-react";
import { toast } from "sonner";
import { ApiError, apiUpload } from "@/lib/api";
import { useSpeechRecognition } from "@/lib/speech";
import { stopSpeaking, useVoice } from "@/lib/voice";
import type { FileUploadResponse } from "@/lib/types";

interface Props {
  disabled: boolean;
  onSend: (text: string, files: FileUploadResponse[]) => void;
  onListeningChange?: (listening: boolean) => void;
}

export function InputBar({ disabled, onSend, onListeningChange }: Props) {
  const [text, setText] = useState("");
  const [files, setFiles] = useState<FileUploadResponse[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const voice = useVoice();

  const onFinal = useCallback((spoken: string) => {
    setText((t) => (t ? `${t} ${spoken}` : spoken));
  }, []);
  const speech = useSpeechRecognition(onFinal);

  const send = () => {
    const value = text.trim() || (files.length ? "Please analyze the attached file(s) and summarize the key findings." : "");
    if (!value || disabled) return;
    onSend(value, files);
    setText("");
    setFiles([]);
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
    if (speech.listening) {
      speech.stop();
      onListeningChange?.(false);
      return;
    }
    if (!speech.supported) {
      toast.error("Speech recognition is not supported in this browser. Text mode is available.");
      return;
    }
    stopSpeaking();
    speech.start();
    onListeningChange?.(true);
  };

  return (
    <div className="hud-panel hud-corners rounded-md p-2" data-testid="input-bar">
      <span className="hud-c" />
      {(files.length > 0 || speech.interim || speech.error) && (
        <div className="mb-2 flex flex-wrap items-center gap-1.5 px-1">
          {files.map((f) => (
            <span key={f.file_id} className="inline-flex items-center gap-1 rounded-sm border border-[#ff8a1f]/40 bg-[#ff8a1f]/10 px-2 py-0.5 text-[11px] text-[#ffe3b8]" data-testid="attached-file-chip">
              📎 {f.filename}
              <button type="button" onClick={() => setFiles((list) => list.filter((x) => x.file_id !== f.file_id))} aria-label={`Remove ${f.filename}`} data-testid="remove-attached-file">
                <X size={11} />
              </button>
            </span>
          ))}
          {speech.interim && (
            <span className="text-[11px] italic text-[#ffd27a] animate-pulse" data-testid="speech-interim">
              {speech.interim}…
            </span>
          )}
          {speech.error && (
            <span className="text-[11px] text-[#ff9d9d]" data-testid="speech-error">
              {speech.error}
            </span>
          )}
        </div>
      )}
      <div className="flex items-end gap-1.5">
        <input ref={fileInput} type="file" multiple hidden onChange={(e) => void upload(e.target.files)} data-testid="file-input" accept=".pdf,.doc,.docx,.txt,.csv,.xls,.xlsx,.md,image/*,audio/*,video/*" />
        <button
          type="button"
          onClick={() => fileInput.current?.click()}
          disabled={uploading}
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
          placeholder={speech.listening ? "Listening…" : "Ask PANDI anything — science, maths, files, today's news…"}
          aria-label="Message"
          data-testid="chat-input"
          className="max-h-40 min-h-10 flex-1 resize-none rounded border border-[#ff8a1f]/30 bg-black/50 px-3 py-2.5 text-[15px] text-white placeholder:text-[#7a4a22] focus:border-[#ff8a1f] focus:outline-none focus:shadow-[0_0_14px_rgba(255, 138, 31,0.3)]"
          style={{ fieldSizing: "content" } as React.CSSProperties}
        />
        <button
          type="button"
          onClick={toggleMic}
          title={speech.listening ? "Stop listening" : "Speak"}
          aria-label={speech.listening ? "Stop listening" : "Speak"}
          data-testid="mic-button"
          data-listening={speech.listening}
          className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded border ${speech.listening ? "border-[#ff3b3b] bg-[#ff3b3b]/20 text-white animate-reactor-pulse" : "border-[#ff8a1f]/30 bg-black/40 text-[#ffd27a] hover:border-[#ff8a1f] hover:text-white"}`}
        >
          {speech.listening ? <MicOff size={16} /> : <Mic size={16} />}
        </button>
        {voice.status !== "idle" ? (
          <button type="button" onClick={stopSpeaking} title="Stop speaking" aria-label="Stop speaking" data-testid="stop-speaking-button" className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded border border-[#ff3b3b]/60 bg-[#ff3b3b]/15 text-[#ff9d9d] hover:bg-[#ff3b3b]/30">
            <Square size={14} />
          </button>
        ) : (
          <button
            type="button"
            onClick={send}
            disabled={disabled || (!text.trim() && files.length === 0)}
            title="Send"
            aria-label="Send"
            data-testid="send-button"
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded border border-[#ff8a1f] bg-[#ff8a1f]/20 text-white hover:bg-[#ff8a1f]/40 hover:shadow-[0_0_16px_rgba(255, 138, 31,0.5)] disabled:cursor-not-allowed disabled:opacity-40"
          >
            <SendHorizonal size={16} />
          </button>
        )}
      </div>
    </div>
  );
}
