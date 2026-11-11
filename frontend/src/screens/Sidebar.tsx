import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Brain, Check, Info, MessageSquare, Pencil, Plus, Search, Settings, Trash2, Volume2, VolumeX, X } from "lucide-react";
import { toast } from "sonner";
import { ArcReactor } from "@/components/ArcReactor";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { apiDelete, apiGet, apiPatch, apiPut } from "@/lib/api";
import { CREDITS, LOGO_URL, SCHOOL_THANKS } from "@/lib/brand";
import { KEYS, storage } from "@/lib/storage";
import type { InterfaceTheme } from "@/lib/theme";
import { getPreferredVoice, listBrowserVoices, setPreferredVoice, setVoiceEnabled, useVoice } from "@/lib/voice";
import type { ChatSession, MemoryUpdate, ModelInfo, Profile, ProfileUpsert, SessionRename, VoiceStatus } from "@/lib/types";

interface Props {
  profile: Profile;
  sessionId: string;
  onNewChat: () => void;
  onOpenSession: (id: string) => void;
  onReplayIntro: () => void;
  onResetProfile: () => void;
  onClose?: () => void;
}

export function Sidebar({ profile, sessionId, onNewChat, onOpenSession, onReplayIntro, onResetProfile, onClose }: Props) {
  const qc = useQueryClient();
  const voice = useVoice();
  const [memoryOpen, setMemoryOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const rename = useMutation({
    mutationFn: ({ id, title }: { id: string; title: string }) => apiPatch<ChatSession>(`/pandi/sessions/${id}`, { title } satisfies SessionRename),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["sessions", profile.profile_id] });
      setRenaming(null);
    },
    onError: () => toast.error("Could not rename chat"),
  });

  const sessions = useQuery({
    queryKey: ["sessions", profile.profile_id],
    queryFn: () => apiGet<ChatSession[]>(`/pandi/sessions/${profile.profile_id}`),
  });

  const remove = useMutation({
    mutationFn: (id: string) => apiDelete<void>(`/pandi/sessions/${id}`),
    onSuccess: (_d, id) => {
      void qc.invalidateQueries({ queryKey: ["sessions", profile.profile_id] });
      if (id === sessionId) onNewChat();
      toast.success("Chat deleted");
    },
    onError: () => toast.error("Could not delete chat"),
  });

  return (
    <aside className="flex h-full w-full flex-col bg-[#050302]/95 text-[#ffe3b8]" data-testid="sidebar">
      <div className="flex items-center justify-between border-b border-[#ff8a1f]/15 px-4 py-3">
        <div className="flex items-center gap-2">
          <img src={LOGO_URL} alt="PANDI AI" data-testid="brand-logo" className="h-7 w-7 rounded object-cover" />
          <ArcReactor size={28} mode={voice.status === "speaking" ? "speaking" : "idle"} testId="sidebar-reactor" />
          <span className="font-heading text-[11px] tracking-[0.25em] text-white">PANDI AI</span>
        </div>
        {onClose && (
          <button type="button" onClick={onClose} aria-label="Close menu" data-testid="sidebar-close" className="text-[#ffd27a] hover:text-white lg:hidden">
            <X size={18} />
          </button>
        )}
      </div>

      <div className="px-3 pt-3">
        <button
          type="button"
          onClick={onNewChat}
          data-testid="sidebar-new-chat"
          className="flex w-full items-center justify-center gap-2 rounded border border-[#ff8a1f]/60 bg-[#ff8a1f]/10 py-2 font-heading text-[11px] tracking-[0.25em] text-white hover:bg-[#ff8a1f]/25"
        >
          <Plus size={14} /> NEW CHAT
        </button>
      </div>

      <div className="mt-3 flex-1 overflow-y-auto px-3" data-testid="chat-history">
        <p className="mb-2 px-1 font-heading text-[9px] tracking-[0.3em] text-[#7a4a22]">CHAT HISTORY</p>
        <div className="mb-2 flex items-center gap-2 rounded border border-[#ff8a1f]/25 bg-black/40 px-2">
          <Search size={12} className="shrink-0 text-[#a8713a]" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search chats" aria-label="Search chats" data-testid="chat-search-input" className="h-8 w-full bg-transparent text-xs text-white placeholder:text-[#7a4a22] focus:outline-none" />
        </div>
        {sessions.isError && <p className="px-1 text-xs text-[#a8713a]">History unavailable right now.</p>}
        {sessions.data?.length === 0 && <p className="px-1 text-xs text-[#a8713a]">No chats yet. Ask PANDI something.</p>}
        <ul className="space-y-1">
          {sessions.data
            ?.filter((s) => s.title.toLowerCase().includes(search.trim().toLowerCase()))
            .map((s) => (
              <li key={s.session_id} className="group flex items-center gap-1">
                {renaming === s.session_id ? (
                  <form
                    className="flex flex-1 items-center gap-1"
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (renameValue.trim()) rename.mutate({ id: s.session_id, title: renameValue.trim() });
                    }}
                  >
                    <input autoFocus value={renameValue} onChange={(e) => setRenameValue(e.target.value)} onKeyDown={(e) => e.key === "Escape" && setRenaming(null)} aria-label="New chat title" data-testid="chat-rename-input" className="h-8 min-w-0 flex-1 rounded border border-[#ff8a1f]/50 bg-black/60 px-2 text-xs text-white focus:outline-none" />
                    <button type="submit" aria-label="Save title" data-testid="chat-rename-save" className="rounded p-1 text-[#52ffa8] hover:bg-[#ff8a1f]/15">
                      <Check size={13} />
                    </button>
                  </form>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => onOpenSession(s.session_id)}
                      data-testid="chat-history-item"
                      data-active={s.session_id === sessionId}
                      className={`flex min-w-0 flex-1 items-center gap-2 rounded px-2 py-1.5 text-left text-xs ${s.session_id === sessionId ? "bg-[#ff8a1f]/15 text-white shadow-[inset_2px_0_0_#ff8a1f]" : "text-[#d9a66a] hover:bg-[#ff8a1f]/10"}`}
                    >
                      <MessageSquare size={12} className="shrink-0 text-[#ff8a1f]" />
                      <span className="truncate">{s.title}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setRenaming(s.session_id);
                        setRenameValue(s.title);
                      }}
                      aria-label="Rename chat"
                      data-testid="chat-history-rename"
                      className="rounded p-1 text-[#7a4a22] opacity-0 hover:text-white group-hover:opacity-100 focus:opacity-100"
                    >
                      <Pencil size={12} />
                    </button>
                    <button type="button" onClick={() => remove.mutate(s.session_id)} aria-label="Delete chat" data-testid="chat-history-delete" className="rounded p-1 text-[#7a4a22] opacity-0 hover:text-[#ff9d9d] group-hover:opacity-100 focus:opacity-100">
                      <Trash2 size={12} />
                    </button>
                  </>
                )}
              </li>
            ))}
        </ul>
      </div>

      <div className="space-y-1 border-t border-[#ff8a1f]/15 p-3 text-xs">
        <button
          type="button"
          onClick={() => {
            setVoiceEnabled(!voice.enabled);
            toast(voice.enabled ? "Voice OFF" : "Voice ON");
          }}
          data-testid="sidebar-voice-toggle"
          data-enabled={voice.enabled}
          className="flex w-full items-center justify-between rounded px-2 py-2 hover:bg-[#ff8a1f]/10"
        >
          <span className="flex items-center gap-2">{voice.enabled ? <Volume2 size={14} className="text-[#ff8a1f]" /> : <VolumeX size={14} className="text-[#a8713a]" />} Voice</span>
          <span className={`font-heading text-[10px] tracking-widest ${voice.enabled ? "text-[#52ffa8]" : "text-[#a8713a]"}`}>{voice.enabled ? "ON" : "OFF"}</span>
        </button>
        <button type="button" onClick={() => setMemoryOpen(true)} data-testid="sidebar-memory" className="flex w-full items-center gap-2 rounded px-2 py-2 hover:bg-[#ff8a1f]/10">
          <Brain size={14} className="text-[#ff8a1f]" /> Memory
          <span className="ml-auto rounded-sm border border-[#ff8a1f]/30 px-1.5 text-[10px] text-[#ffd27a]">{profile.memory.length}</span>
        </button>
        <button type="button" onClick={() => setSettingsOpen(true)} data-testid="sidebar-settings" className="flex w-full items-center gap-2 rounded px-2 py-2 hover:bg-[#ff8a1f]/10">
          <Settings size={14} className="text-[#ff8a1f]" /> Settings
        </button>
        <div className="mt-2 flex items-center gap-2 rounded border border-[#ff8a1f]/20 bg-black/40 px-2 py-2" data-testid="sidebar-operator">
          <div className="flex h-7 w-7 items-center justify-center rounded-full border border-[#ff8a1f]/40 font-heading text-[11px] text-[#ffd27a]">{profile.name.charAt(0).toUpperCase()}</div>
          <div className="min-w-0">
            <p className="font-heading text-[9px] tracking-[0.25em] text-[#7a4a22]">OPERATOR</p>
            <p className="truncate text-xs text-white" data-testid="sidebar-operator-name">
              {profile.name}
            </p>
          </div>
        </div>
      </div>

      <MemoryDialog open={memoryOpen} onOpenChange={setMemoryOpen} profile={profile} />
      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} onReplayIntro={onReplayIntro} onResetProfile={onResetProfile} profile={profile} />
    </aside>
  );
}

function MemoryDialog({ open, onOpenChange, profile }: { open: boolean; onOpenChange: (o: boolean) => void; profile: Profile }) {
  const qc = useQueryClient();
  const [draft, setDraft] = useState("");
  const save = useMutation({
    mutationFn: (memory: string[]) => apiPut<Profile>(`/pandi/profile/${profile.profile_id}/memory`, { memory } satisfies MemoryUpdate),
    onSuccess: (updated) => {
      qc.setQueryData(["profile", profile.profile_id], updated);
      toast.success("Memory updated");
    },
    onError: () => toast.error("Could not save memory"),
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="hud-panel border-[#ff8a1f]/30 text-[#fff5e8] sm:max-w-md" data-testid="memory-dialog">
        <DialogHeader>
          <DialogTitle className="font-heading text-sm tracking-[0.2em] text-white">OPERATOR MEMORY</DialogTitle>
          <DialogDescription className="text-xs text-[#d9a66a]">Facts PANDI keeps in mind across conversations. Say "remember that…" in chat to add one automatically.</DialogDescription>
        </DialogHeader>
        <ul className="max-h-56 space-y-1 overflow-y-auto text-sm" data-testid="memory-list">
          {profile.memory.length === 0 && <li className="text-xs text-[#a8713a]">Nothing stored yet.</li>}
          {profile.memory.map((m, i) => (
            <li key={`${m}-${i}`} className="flex items-start justify-between gap-2 rounded border border-[#ff8a1f]/20 bg-black/40 px-2 py-1.5" data-testid="memory-item">
              <span>{m}</span>
              <button type="button" onClick={() => save.mutate(profile.memory.filter((_x, j) => j !== i))} aria-label="Forget" data-testid="memory-forget" className="text-[#a8713a] hover:text-[#ff9d9d]">
                <Trash2 size={13} />
              </button>
            </li>
          ))}
        </ul>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!draft.trim()) return;
            save.mutate([...profile.memory, draft.trim()]);
            setDraft("");
          }}
        >
          <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="e.g. I am studying for class 10 physics" data-testid="memory-input" className="h-9 flex-1 rounded border border-[#ff8a1f]/30 bg-black/50 px-3 text-sm text-white placeholder:text-[#7a4a22] focus:border-[#ff8a1f] focus:outline-none" />
          <button type="submit" disabled={!draft.trim() || save.isPending} data-testid="memory-add" className="h-9 rounded border border-[#ff8a1f] bg-[#ff8a1f]/20 px-3 font-heading text-[10px] tracking-widest text-white disabled:opacity-40">
            ADD
          </button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function SettingsDialog({ open, onOpenChange, onReplayIntro, onResetProfile, profile }: { open: boolean; onOpenChange: (o: boolean) => void; onReplayIntro: () => void; onResetProfile: () => void; profile: Profile }) {
  const status = useQuery({ queryKey: ["voice-status"], queryFn: () => apiGet<VoiceStatus>("/voice/status"), enabled: open, staleTime: 60_000 });
  const [liveSearch, setLiveSearch] = useState(storage.get(KEYS.liveSearch) !== "off");
  const voice = useVoice();
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>(() => listBrowserVoices());
  const [selectedVoice, setSelectedVoice] = useState(getPreferredVoice());
  const [glow, setGlow] = useState(() => Number(storage.get(KEYS.glow) ?? "100"));
  const [theme, setTheme] = useState<InterfaceTheme>(profile.theme);
  const models = useQuery({ queryKey: ["models"], queryFn: () => apiGet<ModelInfo[]>("/pandi/models"), enabled: open, staleTime: Infinity });
  const [model, setModel] = useState(storage.get(KEYS.model) ?? "gpt-5.1");
  const MODEL_LABELS: Record<string, string> = { "gpt-5.1": "GPT-5.1 (primary)", "gemini-3-flash": "Gemini 3 Flash (fallback)", "gemini-3.1-pro-preview": "Gemini 3.1 Pro (live web search)", "claude-sonnet-5-5": "Claude Sonnet 5.5", "claude-opus-5-5": "Claude Opus 5.5", "claude-haiku-4-5-20251001": "Claude Haiku 4.5 (fastest)" };
  useEffect(() => {
    if (!("speechSynthesis" in window)) return;
    const refresh = () => setVoices(listBrowserVoices());
    refresh();
    window.speechSynthesis.addEventListener("voiceschanged", refresh);
    return () => window.speechSynthesis.removeEventListener("voiceschanged", refresh);
  }, []);
  const applyGlow = (value: number) => {
    setGlow(value);
    storage.set(KEYS.glow, String(value));
    document.documentElement.style.setProperty("--glow", String(value / 100));
  };
  const applyTheme = (next: InterfaceTheme) => {
    setTheme(next);
    storage.set(KEYS.interfaceTheme, next);
    const body: ProfileUpsert = { name: profile.name, theme: next };
    apiPut<Profile>(`/pandi/profile/${profile.profile_id}`, body)
      .then(() => window.location.reload())
      .catch(() => {
        toast.warning("Could not save to the server — applying locally.");
        window.location.reload();
      });
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="hud-panel border-[#ff8a1f]/30 text-[#fff5e8] sm:max-w-md" data-testid="settings-dialog">
        <DialogHeader>
          <DialogTitle className="font-heading text-sm tracking-[0.2em] text-white">SETTINGS</DialogTitle>
          <DialogDescription className="text-xs text-[#d9a66a]">System configuration for PANDI AI Mark II.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <div className="rounded border border-[#ff8a1f]/20 bg-black/40 p-3" data-testid="settings-voice-status">
            <p className="font-heading text-[10px] tracking-[0.25em] text-[#ff8a1f]">OFFICIAL VOICE</p>
            <p className="mt-1 text-xs text-[#ffe3b8]">
              {status.data ? (
                <>
                  Provider: <b>{status.data.provider === "elevenlabs" ? (status.data.cloned ? "ElevenLabs · cloned PANDI voice" : "ElevenLabs · stock voice (clone unavailable)") : "Browser speech synthesis (fallback)"}</b>
                  <br />
                  <span className="text-[#d9a66a]">{status.data.detail}</span>
                </>
              ) : status.isError ? (
                "Voice status unavailable."
              ) : (
                "Checking…"
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setVoiceEnabled(!voice.enabled);
              storage.set(KEYS.voiceSync, voice.enabled ? "off" : "on");
            }}
            data-testid="settings-voice-toggle"
            className="flex w-full items-center justify-between rounded border border-[#ff8a1f]/20 bg-black/40 px-3 py-2 hover:bg-[#ff8a1f]/10"
          >
            <span>Spoken replies (voice)</span>
            <span className={`font-heading text-[10px] tracking-widest ${voice.enabled ? "text-[#52ffa8]" : "text-[#a8713a]"}`}>{voice.enabled ? "ON" : "OFF"}</span>
          </button>
          <label className="block rounded border border-[#ff8a1f]/20 bg-black/40 px-3 py-2">
            <span className="text-xs text-[#d9a66a]">AI model</span>
            <select
              value={model}
              onChange={(e) => {
                setModel(e.target.value);
                storage.set(KEYS.model, e.target.value);
                toast(`Model: ${MODEL_LABELS[e.target.value] ?? e.target.value}`);
              }}
              data-testid="settings-model-select"
              className="mt-1 h-9 w-full rounded border border-[#ff8a1f]/30 bg-[#050302] px-2 text-sm text-white focus:border-[#ff8a1f] focus:outline-none"
            >
              {(models.data ?? [{ id: "gemini-3.1-pro-preview", provider: "gemini", label: "gemini-3.1-pro-preview" }]).map((m) => (
                <option key={m.id} value={m.id}>
                  {MODEL_LABELS[m.id] ?? m.label}
                </option>
              ))}
            </select>
            <span className="mt-1 block text-[10px] text-[#a8713a]">Questions needing current information always use Gemini live search.</span>
          </label>
          <label className="block rounded border border-[#ff8a1f]/20 bg-black/40 px-3 py-2">
            <span className="text-xs text-[#d9a66a]">Voice selection</span>
            <select
              value={selectedVoice}
              onChange={(e) => {
                setSelectedVoice(e.target.value);
                setPreferredVoice(e.target.value);
              }}
              data-testid="settings-voice-select"
              className="mt-1 h-9 w-full rounded border border-[#ff8a1f]/30 bg-[#050302] px-2 text-sm text-white focus:border-[#ff8a1f] focus:outline-none"
            >
              <option value="official">Official PANDI voice {status.data?.configured ? "(ElevenLabs)" : "(browser fallback until key is added)"}</option>
              {voices.map((v) => (
                <option key={v.name} value={v.name}>
                  {v.name} · {v.lang}
                </option>
              ))}
            </select>
          </label>
          <label className="block rounded border border-[#ff8a1f]/20 bg-black/40 px-3 py-2">
            <span className="flex items-center justify-between text-xs text-[#d9a66a]">
              Theme intensity <span className="font-heading text-[10px] text-[#ffd27a]">{glow}%</span>
            </span>
            <input type="range" min={20} max={150} step={5} value={glow} onChange={(e) => applyGlow(Number(e.target.value))} data-testid="settings-theme-intensity" className="mt-2 w-full accent-[#ff8a1f]" />
          </label>
          <button
            type="button"
            onClick={() => {
              const next = !liveSearch;
              setLiveSearch(next);
              storage.set(KEYS.liveSearch, next ? "on" : "off");
            }}
            data-testid="settings-live-search-toggle"
            className="flex w-full items-center justify-between rounded border border-[#ff8a1f]/20 bg-black/40 px-3 py-2 hover:bg-[#ff8a1f]/10"
          >
            <span>Live web search for current information</span>
            <span className={`font-heading text-[10px] tracking-widest ${liveSearch ? "text-[#52ffa8]" : "text-[#a8713a]"}`}>{liveSearch ? "ON" : "OFF"}</span>
          </button>
          <label className="block rounded border border-[#ff8a1f]/20 bg-black/40 px-3 py-2">
            <span className="text-xs text-[#d9a66a]">Interface theme</span>
            <select
              value={theme}
              onChange={(e) => applyTheme(e.target.value as InterfaceTheme)}
              data-testid="settings-theme-select"
              className="mt-1 h-9 w-full rounded border border-[#ff8a1f]/30 bg-[#050302] px-2 text-sm text-white focus:border-[#ff8a1f] focus:outline-none"
            >
              <option value="agni">IGNIS RIFT (fire)</option>
              <option value="vajra">NOVA STRIKE (electric blue / cyan)</option>
            </select>
            <span className="mt-1 block text-[10px] text-[#a8713a]">Changing this reloads PANDI to apply the new look.</span>
          </label>
          <button
            type="button"
            onClick={() => { onOpenChange(false); onReplayIntro(); }} data-testid="settings-replay-intro" className="w-full rounded border border-[#ff8a1f]/40 bg-[#ff8a1f]/10 px-3 py-2 text-left hover:bg-[#ff8a1f]/20">
            Replay intro video
          </button>
          <button
            type="button"
            onClick={() => {
              if (window.confirm("Reset your profile? This forgets your name, memory link and local chat selection on this device.")) {
                onOpenChange(false);
                onResetProfile();
              }
            }}
            data-testid="settings-reset-profile"
            className="w-full rounded border border-[#ff3b3b]/40 bg-[#ff3b3b]/10 px-3 py-2 text-left text-[#ff9d9d] hover:bg-[#ff3b3b]/20"
          >
            Reset profile
          </button>
          <div className="rounded border border-[#ff8a1f]/20 bg-black/40 p-3 text-center" data-testid="about-section">
            <Info size={14} className="mx-auto mb-1 text-[#ff8a1f]" />
            <p className="font-heading text-xs tracking-[0.25em] text-white">PANDI AI MARK II</p>
            <p className="mt-1 text-[11px] text-[#d9a66a]">Personalized Advanced Neural Digital Intelligence</p>
            <p className="mt-1 text-[11px] text-[#ffe3b8]">
              Created by <b>VIGNEASHWAR</b>
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
