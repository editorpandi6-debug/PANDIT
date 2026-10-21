import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AudioLines, Boxes, Menu, MessageSquareText, Mic, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { ArcReactor } from "@/components/ArcReactor";
import { HoloBackground } from "@/components/HoloBackground";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { ApiError, apiGet, apiStream } from "@/lib/api";
import { useSpeechRecognition } from "@/lib/speech";
import { KEYS, newId, storage } from "@/lib/storage";
import { speak, stopSpeaking, useVoice } from "@/lib/voice";
import type { ChatHistory, ChatMessage, ChatStreamRequest, FileUploadResponse, Profile, SceneSpec } from "@/lib/types";
import { HologramLabTab } from "./HologramLabTab";
import { InputBar } from "./InputBar";
import { MessageBubble } from "./MessageBubble";
import { Sidebar } from "./Sidebar";

const SUGGESTIONS = [
  { label: "Show me the solar system in 3D", hint: "ASTRONOMY" },
  { label: "Explain a cube and its volume", hint: "GEOMETRY" },
  { label: "How does an atom look?", hint: "CHEMISTRY" },
  { label: "Solve 3x² - 12 = 0 step by step", hint: "ALGEBRA" },
];

type Tab = "chat" | "lab";

interface Props {
  profile: Profile;
  onReplayIntro: () => void;
  onResetProfile: () => void;
}

export function ChatScreen({ profile, onReplayIntro, onResetProfile }: Props) {
  const qc = useQueryClient();
  const voice = useVoice();
  const [sessionId, setSessionId] = useState(() => storage.get(KEYS.sessionId) ?? newId());
  const [tab, setTab] = useState<Tab>("chat");
  const [menuOpen, setMenuOpen] = useState(false);
  const [draft, setDraft] = useState<ChatMessage | null>(null);
  const [pendingUser, setPendingUser] = useState<ChatMessage | null>(null);
  const [listening, setListening] = useState(false);
  const [voiceMode, setVoiceMode] = useState(false);
  const [greeting, setGreeting] = useState<ChatMessage | null>(null);
  const greetedRef = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const sendRef = useRef<(text: string, files: FileUploadResponse[]) => Promise<void>>(async () => {});

  useEffect(() => storage.set(KEYS.sessionId, sessionId), [sessionId]);

  const history = useQuery({
    queryKey: ["history", sessionId],
    queryFn: () => apiGet<ChatHistory>(`/pandi/history/${sessionId}`),
  });

  const messages = useMemo(() => {
    const base = history.data?.messages ?? [];
    const list = [...base];
    if (pendingUser) list.push(pendingUser);
    if (draft) list.push(draft);
    return list;
  }, [history.data, pendingUser, draft]);

  const latestScene = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      const m = messages[i];
      if (m.role === "assistant" && m.scene) return { scene: m.scene as SceneSpec, id: m.id };
    }
    return null;
  }, [messages]);
  const lastQuestion = useMemo(() => [...messages].reverse().find((m) => m.role === "user")?.content ?? null, [messages]);

  // Greet by name (spoken) the first time the chat opens in this browser session.
  useEffect(() => {
    if (greetedRef.current || !history.isSuccess) return;
    greetedRef.current = true;
    if ((history.data?.messages.length ?? 0) > 0) return;
    const hour = new Date().getHours();
    const part = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
    const text = `${part}, ${profile.name}. PANDI AI Mark II is online and all systems are nominal. What shall we explore today?`;
    const msg: ChatMessage = { id: `greeting-${sessionId}`, session_id: sessionId, role: "assistant", content: text, created_at: new Date().toISOString(), live_search: false, sources: [], scene: null, attachments: [] };
    setGreeting(msg);
    void speak(msg.id, text);
  }, [history.isSuccess, history.data, profile.name, sessionId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length, draft?.content.length, draft?.scene]);

  const switchSession = useCallback((id: string) => {
    abortRef.current?.abort();
    stopSpeaking();
    setDraft(null);
    setPendingUser(null);
    setGreeting(null);
    setSessionId(id);
    setMenuOpen(false);
    setTab("chat");
  }, []);

  const newChat = useCallback(() => switchSession(newId()), [switchSession]);

  const send = useCallback(
    async (text: string, files: FileUploadResponse[]) => {
      if (draft) return;
      stopSpeaking();
      const userMsg: ChatMessage = { id: newId(), session_id: sessionId, role: "user", content: text, created_at: new Date().toISOString(), live_search: false, sources: [], scene: null, attachments: files.map((f) => f.filename) };
      setPendingUser(userMsg);
      const draftId = newId();
      setDraft({ ...userMsg, id: draftId, role: "assistant", content: "", attachments: [] });
      const body: ChatStreamRequest = {
        session_id: sessionId,
        profile_id: profile.profile_id,
        message: text,
        language: "auto",
        model: storage.get(KEYS.model) ?? "gpt-5.1",
        use_live_search: storage.get(KEYS.liveSearch) !== "off",
        file_ids: files.map((f) => f.file_id),
      };
      const controller = new AbortController();
      abortRef.current = controller;
      let content = "";
      let scene: SceneSpec | null = null;
      let finalId = draftId;
      let failed: string | null = null;
      try {
        const res = await apiStream("/pandi/chat/stream", body);
        const reader = res.body?.getReader();
        if (!reader) throw new Error("No stream");
        const decoder = new TextDecoder();
        let buffer = "";
        const timeout = window.setTimeout(() => controller.abort(), 90_000);
        controller.signal.addEventListener("abort", () => reader.cancel().catch(() => undefined));
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          let idx = buffer.indexOf("\n\n");
          while (idx >= 0) {
            const chunk = buffer.slice(0, idx);
            buffer = buffer.slice(idx + 2);
            idx = buffer.indexOf("\n\n");
            const eventLine = chunk.split("\n").find((l) => l.startsWith("event:"));
            const dataLine = chunk.split("\n").find((l) => l.startsWith("data:"));
            if (!eventLine || !dataLine) continue;
            const event = eventLine.slice(6).trim();
            const data = JSON.parse(dataLine.slice(5));
            if (event === "delta") {
              content += data.text as string;
              setDraft((d) => (d ? { ...d, content } : d));
            } else if (event === "scene") {
              scene = data as SceneSpec;
              setDraft((d) => (d ? { ...d, scene } : d));
            } else if (event === "meta") {
              if (data.live_search) setDraft((d) => (d ? { ...d, live_search: true } : d));
              if (data.remembered) {
                toast.success(`Remembered: ${data.remembered}`);
                void qc.invalidateQueries({ queryKey: ["profile", profile.profile_id] });
              }
            } else if (event === "done") {
              finalId = data.message_id as string;
              content = (data.content as string) ?? content;
              scene = (data.scene as SceneSpec | null) ?? scene;
            } else if (event === "error") {
              failed = data.message as string;
            }
          }
        }
        window.clearTimeout(timeout);
      } catch (err) {
        if (controller.signal.aborted) failed = failed ?? "The response was interrupted. You can retry your question.";
        else if (err instanceof ApiError) failed = `PANDI could not reach its AI core (HTTP ${err.status}).`;
        else failed = "Connection to the PANDI core was lost. Please try again.";
      }
      abortRef.current = null;
      if (failed && !content) {
        toast.error(failed);
        setDraft(null);
        setPendingUser(null);
        return;
      }
      if (failed) toast.warning(failed);
      await qc.invalidateQueries({ queryKey: ["history", sessionId] });
      void qc.invalidateQueries({ queryKey: ["sessions", profile.profile_id] });
      setDraft(null);
      setPendingUser(null);
      if (content) void speak(finalId, content);
    },
    [draft, profile.profile_id, qc, sessionId],
  );
  sendRef.current = send;

  // Hands-free voice mode: listen → send → speak → listen again.
  const onVoiceFinal = useCallback((text: string) => {
    void sendRef.current(text, []);
  }, []);
  const handsFree = useSpeechRecognition(onVoiceFinal);
  useEffect(() => {
    if (!voiceMode) return;
    if (!handsFree.supported) {
      toast.error("Speech recognition is not supported in this browser.");
      setVoiceMode(false);
      return;
    }
    if (draft || voice.status !== "idle" || handsFree.listening) return;
    const id = window.setTimeout(() => handsFree.start(), 700);
    return () => window.clearTimeout(id);
  }, [voiceMode, draft, voice.status, handsFree.listening, handsFree.supported, handsFree.start]);
  useEffect(() => {
    if (voiceMode && handsFree.error) toast.error(handsFree.error);
  }, [voiceMode, handsFree.error]);
  const exitVoiceMode = () => {
    setVoiceMode(false);
    handsFree.stop();
    stopSpeaking();
  };

  const reactorMode = draft ? "thinking" : voice.status === "speaking" ? "speaking" : listening || handsFree.listening ? "listening" : "idle";
  const showGreeting = greeting && (history.data?.messages.length ?? 0) === 0 && !pendingUser;
  const empty = !history.isLoading && messages.length === 0;
  const initial = profile.name.charAt(0).toUpperCase();

  const sidebar = (
    <Sidebar profile={profile} sessionId={sessionId} onNewChat={newChat} onOpenSession={switchSession} onReplayIntro={onReplayIntro} onResetProfile={onResetProfile} onClose={() => setMenuOpen(false)} />
  );

  return (
    <div className="screen-enter relative flex h-screen overflow-hidden" data-testid="chat-screen">
      <HoloBackground particles={18} />
      <div className="relative z-10 hidden w-72 shrink-0 border-r border-[#ff8a1f]/15 lg:block">{sidebar}</div>
      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetContent side="left" showCloseButton={false} className="w-80 border-[#ff8a1f]/20 bg-[#050302] p-0">
          <SheetTitle className="sr-only">Menu</SheetTitle>
          {sidebar}
        </SheetContent>
      </Sheet>

      <main className="relative z-10 flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between gap-3 border-b border-[#ff8a1f]/15 bg-[#000000]/70 px-3 py-2 backdrop-blur sm:px-5" data-testid="chat-header">
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => setMenuOpen(true)} aria-label="Open menu" data-testid="menu-button" className="rounded border border-[#ff8a1f]/30 p-2 text-[#ffd27a] hover:border-[#ff8a1f] hover:text-white lg:hidden">
              <Menu size={16} />
            </button>
            <ArcReactor size={34} mode={reactorMode} testId="header-reactor" />
            <div>
              <p className="font-heading text-xs tracking-[0.3em] text-white glow-text" data-testid="header-title">
                PANDI AI
              </p>
              <p className="font-heading text-[8px] tracking-[0.3em] text-[#ff8a1f]" data-testid="header-status">
                {reactorMode === "thinking" ? "PROCESSING" : reactorMode === "speaking" ? "SPEAKING" : reactorMode === "listening" ? "LISTENING" : "ONLINE"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1 rounded border border-[#ff8a1f]/30 bg-black/40 p-0.5" role="tablist" data-testid="main-tabs">
            <button type="button" role="tab" aria-selected={tab === "chat"} onClick={() => setTab("chat")} data-testid="tab-chat" className={`inline-flex items-center gap-1 rounded px-3 py-1.5 font-heading text-[10px] tracking-[0.2em] ${tab === "chat" ? "bg-[#ff8a1f]/25 text-white shadow-[0_0_12px_rgba(255, 138, 31,0.35)]" : "text-[#d9a66a] hover:text-white"}`}>
              <MessageSquareText size={12} /> CHAT
            </button>
            <button type="button" role="tab" aria-selected={tab === "lab"} onClick={() => setTab("lab")} data-testid="tab-lab" className={`inline-flex items-center gap-1 rounded px-3 py-1.5 font-heading text-[10px] tracking-[0.2em] ${tab === "lab" ? "bg-[#ff8a1f]/25 text-white shadow-[0_0_12px_rgba(255, 138, 31,0.35)]" : "text-[#d9a66a] hover:text-white"}`}>
              <Boxes size={12} /> HOLOGRAM LAB
            </button>
          </div>
          <button type="button" onClick={newChat} data-testid="header-new-chat" className="inline-flex items-center gap-1 rounded border border-[#ff8a1f]/60 bg-[#ff8a1f]/10 px-3 py-1.5 font-heading text-[10px] tracking-[0.25em] text-white hover:bg-[#ff8a1f]/25">
            <Plus size={12} /> <span className="hidden sm:inline">NEW</span>
          </button>
        </header>

        {tab === "lab" ? (
          <div className="flex-1 overflow-y-auto">
            <HologramLabTab scene={latestScene?.scene ?? null} messageId={latestScene?.id ?? null} lastQuestion={lastQuestion} busy={Boolean(draft)} onAsk={(t) => void send(t, [])} />
          </div>
        ) : (
          <div ref={scrollRef} className="screen-enter flex-1 overflow-y-auto px-3 py-4 sm:px-6" data-testid="message-list">
            <div className="mx-auto flex max-w-3xl flex-col gap-5">
              {history.isLoading && (
                <div className="flex flex-col items-center gap-3 py-16" data-testid="history-loading">
                  <ArcReactor size={64} mode="thinking" testId="history-loading-reactor" />
                  <p className="font-heading text-[10px] tracking-[0.3em] text-[#ffd27a] animate-pulse">SYNCHRONIZING MEMORY…</p>
                </div>
              )}
              {history.isError && (
                <p className="rounded border border-[#ff3b3b]/40 bg-[#ff3b3b]/10 px-3 py-2 text-xs text-[#ff9d9d]" data-testid="history-error">
                  Chat history could not be loaded — you can still send new messages.
                </p>
              )}
              {showGreeting && <MessageBubble message={greeting} operatorInitial={initial} />}
              {empty && (
                <div className="animate-fade-up">
                  <div className="mb-6 flex flex-col items-center text-center">
                    <ArcReactor size={120} mode={reactorMode} className="mb-7" testId="hero-reactor" beam />
                    <h2 className="font-heading text-lg tracking-[0.22em] text-white glow-text">PANDI AI MARK II</h2>
                    <p className="mt-1 font-heading text-[9px] tracking-[0.4em] text-[#ff8a1f]">THE HOLOGRAM INTELLIGENCE</p>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2" data-testid="suggestion-cards">
                    {SUGGESTIONS.map((s) => (
                      <button key={s.label} type="button" onClick={() => void send(s.label, [])} data-testid="suggestion-card" className="hud-panel hud-corners group rounded-md px-4 py-3 text-left hover:bg-[#ff8a1f]/10 hover:shadow-[0_0_20px_rgba(255, 138, 31,0.25)]">
                        <span className="hud-c" />
                        <p className="font-heading text-[9px] tracking-[0.3em] text-[#ff8a1f]">{s.hint}</p>
                        <p className="mt-1 text-sm text-[#fff5e8] group-hover:text-white">{s.label}</p>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {messages.map((m) => (
                <MessageBubble key={m.id} message={m} streaming={draft?.id === m.id} operatorInitial={initial} />
              ))}
            </div>
          </div>
        )}

        <div className="border-t border-[#ff8a1f]/15 bg-[#000000]/70 px-3 py-3 backdrop-blur sm:px-6">
          <div className="mx-auto flex max-w-3xl items-end gap-2">
            <div className="min-w-0 flex-1">
              <InputBar disabled={Boolean(draft)} onSend={(t, f) => void send(t, f)} onListeningChange={setListening} />
            </div>
            <button
              type="button"
              onClick={() => (voiceMode ? exitVoiceMode() : setVoiceMode(true))}
              title="Voice conversation mode"
              aria-label="Voice conversation mode"
              data-testid="voice-mode-button"
              data-active={voiceMode}
              className={`mb-[2px] inline-flex h-[52px] w-12 shrink-0 flex-col items-center justify-center gap-0.5 rounded border font-heading text-[7px] tracking-widest ${voiceMode ? "border-[#ff8a1f] bg-[#ff8a1f]/30 text-white animate-reactor-pulse" : "border-[#ff8a1f]/40 bg-black/40 text-[#ffd27a] hover:border-[#ff8a1f] hover:text-white"}`}
            >
              <AudioLines size={16} /> TALK
            </button>
          </div>
          <p className="mt-1.5 text-center text-[9px] tracking-[0.25em] text-[#7a4a22]">PANDI AI MARK II · CREATED BY VIGNEASHWAR · {voice.provider === "elevenlabs" ? "OFFICIAL VOICE" : voice.provider === "browser" ? "FALLBACK VOICE" : "VOICE READY"}</p>
        </div>
      </main>

      {voiceMode && (
        <div className="screen-enter fixed inset-0 z-40 flex flex-col items-center justify-center bg-black/80 backdrop-blur-md" data-testid="voice-mode-overlay">
          <ArcReactor size={200} mode={reactorMode} testId="voice-mode-reactor" beam />
          <p className="mt-8 font-heading text-sm tracking-[0.35em] text-white glow-text" data-testid="voice-mode-status">
            {draft ? "THINKING…" : voice.status === "speaking" ? "SPEAKING" : voice.status === "loading" ? "PREPARING VOICE" : handsFree.listening ? "LISTENING…" : "STANDBY"}
          </p>
          <div className="mt-4 flex h-10 items-end gap-1" aria-hidden>
            {Array.from({ length: 16 }, (_v, i) => (
              <span key={i} className={`w-1.5 rounded-sm bg-[#ff8a1f] ${voice.status === "speaking" || handsFree.listening ? "animate-wave" : ""}`} style={{ height: voice.status === "speaking" || handsFree.listening ? "100%" : "15%", animationDelay: `${i * 0.06}s`, opacity: 0.5 + (i % 3) * 0.2 }} />
            ))}
          </div>
          <p className="mt-4 max-w-md px-6 text-center text-sm text-[#ffe3b8]">{handsFree.interim || (draft?.content ? draft.content.slice(0, 160) : "Speak naturally — PANDI replies out loud and listens again.")}</p>
          <button type="button" onClick={exitVoiceMode} data-testid="voice-mode-exit" className="mt-8 inline-flex items-center gap-2 rounded border border-[#ff8a1f]/60 bg-black/60 px-5 py-2 font-heading text-[11px] tracking-[0.25em] text-white hover:bg-[#ff8a1f]/25">
            <X size={14} /> EXIT VOICE MODE
          </button>
          <p className="mt-3 inline-flex items-center gap-1 text-[10px] tracking-[0.25em] text-[#7a4a22]">
            <Mic size={10} /> HANDS-FREE CONVERSATION
          </p>
        </div>
      )}
    </div>
  );
}
