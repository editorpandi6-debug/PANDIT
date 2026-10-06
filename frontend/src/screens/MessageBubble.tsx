import { useMemo } from "react";
import { Copy, Globe, RotateCcw, Square, Volume2 } from "lucide-react";
import { toast } from "sonner";
import { ArcReactor } from "@/components/ArcReactor";
import { Markdown } from "@/components/Markdown";
import { VirtualLab } from "@/components/VirtualLab";
import { speak, stopSpeaking, useVoice } from "@/lib/voice";
import type { ChatMessage } from "@/lib/types";

interface Props {
  message: ChatMessage;
  streaming?: boolean;
  operatorInitial: string;
}

export function MessageBubble({ message, streaming = false, operatorInitial }: Props) {
  const voice = useVoice();
  const isUser = message.role === "user";
  const speakingThis = voice.messageId === message.id && voice.status !== "idle";
  const hostnames = useMemo(
    () =>
      message.sources.map((s) => {
        try {
          return { url: s.url, host: new URL(s.url).hostname.replace(/^www\./, "") };
        } catch {
          return { url: s.url, host: s.url };
        }
      }),
    [message.sources],
  );

  if (isUser) {
    return (
      <div className="flex justify-end gap-3 animate-fade-up" data-testid="user-message">
        <div className="max-w-[85%] sm:max-w-[70%]">
          <div className="rounded-md rounded-tr-none border border-[#ff2a4a]/35 bg-[#ff2a4a]/12 px-4 py-2.5 text-[15px] text-white shadow-[0_0_18px_rgba(255, 42, 74,0.12)]">
            <p className="whitespace-pre-wrap break-words" data-testid="user-message-text">
              {message.content}
            </p>
            {message.attachments.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {message.attachments.map((a) => (
                  <span key={a} className="rounded-sm border border-[#ff2a4a]/30 bg-black/40 px-1.5 py-0.5 text-[10px] text-[#ffb0bc]" data-testid="user-attachment-chip">
                    📎 {a}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#ff2a4a]/40 bg-black/60 font-heading text-xs text-[#ffb0bc]" data-testid="user-avatar">
          {operatorInitial}
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-3 animate-fade-up" data-testid="assistant-message">
      <ArcReactor size={34} mode={speakingThis ? "speaking" : streaming ? "thinking" : "idle"} className="mt-1" testId="assistant-avatar" />
      <div className="min-w-0 flex-1 sm:max-w-[88%]">
        <div className="mb-1 flex items-center gap-2">
          <span className="font-heading text-[10px] tracking-[0.25em] text-[#ff2a4a]">PANDI AI</span>
          {message.live_search && (
            <span className="inline-flex items-center gap-1 rounded-sm border border-[#52ffa8]/40 bg-[#52ffa8]/10 px-1.5 py-0.5 text-[9px] tracking-wider text-[#52ffa8]" data-testid="live-search-indicator">
              <Globe size={10} /> LIVE SEARCH
            </span>
          )}
          {streaming && <span className="text-[10px] text-[#a67a84] animate-pulse">streaming…</span>}
        </div>
        <div className="hud-panel rounded-md rounded-tl-none px-4 py-3 text-[#fff0f2]">
          {message.scene && <VirtualLab spec={message.scene} messageId={message.id} />}
          {message.content ? (
            <Markdown content={message.content} />
          ) : streaming ? (
            <p className="font-heading text-[11px] tracking-[0.25em] text-[#ffb0bc] animate-pulse" data-testid="assistant-thinking">
              {message.scene ? "PREPARING YOUR VIRTUAL EXPLANATION…" : "PROCESSING…"}
            </p>
          ) : null}
          {streaming && message.content && <span className="ml-0.5 inline-block h-4 w-[2px] translate-y-0.5 bg-[#ff2a4a] animate-blink" />}
          {hostnames.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5 border-t border-[#ff2a4a]/15 pt-2" data-testid="source-list">
              {hostnames.map((s) => (
                <a key={s.url} href={s.url} target="_blank" rel="noreferrer noopener" className="rounded-sm border border-[#ff2a4a]/30 bg-black/40 px-1.5 py-0.5 text-[10px] text-[#ffb0bc] hover:border-[#ff2a4a]" data-testid="source-link">
                  {s.host}
                </a>
              ))}
            </div>
          )}
        </div>
        {!streaming && message.content && (
          <div className="mt-1 flex items-center gap-1">
            {speakingThis ? (
              <button type="button" onClick={stopSpeaking} className="inline-flex items-center gap-1 rounded px-2 py-1 text-[10px] text-[#ffb070] hover:bg-[#ff7a00]/15" data-testid="message-stop-voice">
                <Square size={11} /> STOP
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  if (!voice.enabled) toast.info("Voice is OFF — turn it on in the sidebar to hear PANDI.");
                  void speak(message.id, message.content);
                }}
                className="inline-flex items-center gap-1 rounded px-2 py-1 text-[10px] text-[#a67a84] hover:bg-[#ff2a4a]/15 hover:text-[#ffb0bc]"
                data-testid="message-replay-voice"
              >
                <Volume2 size={11} /> REPLAY
              </button>
            )}
            <button
              type="button"
              onClick={() => navigator.clipboard?.writeText(message.content).then(() => toast.success("Copied")).catch(() => toast.error("Copy failed"))}
              className="inline-flex items-center gap-1 rounded px-2 py-1 text-[10px] text-[#a67a84] hover:bg-[#ff2a4a]/15 hover:text-[#ffb0bc]"
              data-testid="message-copy"
            >
              <Copy size={11} /> COPY
            </button>
            {speakingThis && (
              <span className="ml-1 flex h-4 items-end gap-[2px]" aria-hidden data-testid="speaking-waveform">
                {Array.from({ length: 7 }, (_v, i) => (
                  <span key={i} className="w-[3px] rounded-sm bg-[#ff2a4a] animate-wave" style={{ height: "100%", animationDelay: `${i * 0.09}s` }} />
                ))}
              </span>
            )}
            {voice.status === "loading" && voice.messageId === message.id && (
              <span className="ml-1 inline-flex items-center gap-1 text-[10px] text-[#a67a84]">
                <RotateCcw size={10} className="animate-spin" /> preparing voice
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
