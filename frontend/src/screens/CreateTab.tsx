import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Sparkles, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { ArcReactor } from "@/components/ArcReactor";
import { GlbViewer } from "@/components/GlbViewer";
import { VirtualLab } from "@/components/VirtualLab";
import { ApiError, apiGet, apiPost } from "@/lib/api";
import { creditsKey } from "@/lib/credits";
import type { Creation, CreationRequest, CreationSummary } from "@/lib/types";

const EXAMPLES = ["A modern electric sports car", "A minimalist wooden dining chair", "A small lighthouse on a cliff", "A wireless gaming mouse", "A friendly cartoon dragon"];

interface Props {
  profileId: string;
}

/** PANDI 3D Creation Engine: design brief + concept image + procedural 3D model, with an honest limitation note. */
export function CreateTab({ profileId }: Props) {
  const qc = useQueryClient();
  const [prompt, setPrompt] = useState("");
  const [active, setActive] = useState<Creation | null>(null);

  const gallery = useQuery({
    queryKey: ["creation-gallery", profileId],
    queryFn: () => apiGet<CreationSummary[]>(`/creation/gallery/${profileId}`),
  });

  const generate = useMutation({
    mutationFn: (p: string) => apiPost<Creation>("/creation/generate", { profile_id: profileId, prompt: p } satisfies CreationRequest),
    onSuccess: (creation) => {
      setActive(creation);
      void qc.invalidateQueries({ queryKey: ["creation-gallery", profileId] });
    },
    onError: (err) => {
      const detail = err instanceof ApiError && err.body && typeof err.body === "object" && "detail" in err.body ? String((err.body as { detail: unknown }).detail) : null;
      toast.error(detail ?? "Pandi could not design that model. No credits were used — please try again.");
    },
    onSettled: () => void qc.invalidateQueries({ queryKey: creditsKey(profileId) }),
  });

  const openSaved = async (id: string) => {
    try {
      const creation = await apiGet<Creation>(`/creation/${id}`);
      setActive(creation);
    } catch {
      toast.error("Could not reopen that creation.");
    }
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const value = prompt.trim();
    if (!value || generate.isPending) return;
    generate.mutate(value);
  };

  return (
    <div className="screen-enter relative mx-auto flex h-full w-full max-w-6xl flex-col gap-3 px-3 py-3 sm:px-6" data-testid="create-tab">
      <form onSubmit={submit} className="hud-panel hud-corners rounded-md p-3">
        <span className="hud-c" />
        <p className="mb-2 flex items-center gap-1 font-heading text-[9px] tracking-[0.3em] text-[#ff8a1f]">
          <Wand2 size={10} /> DESCRIBE WHAT TO BUILD · 15 CREDITS PER 3D MODEL
        </p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="e.g. a vintage leather armchair"
            aria-label="Object to create"
            data-testid="create-prompt-input"
            className="h-10 flex-1 rounded border border-[#ff8a1f]/30 bg-black/50 px-3 text-sm text-white placeholder:text-[#7a4a22] focus:border-[#ff8a1f] focus:outline-none"
          />
          <button
            type="submit"
            disabled={!prompt.trim() || generate.isPending}
            data-testid="create-generate-button"
            className="inline-flex h-10 items-center justify-center gap-2 rounded border border-[#ff8a1f] bg-[#ff8a1f]/20 px-5 font-heading text-[11px] tracking-[0.2em] text-white hover:bg-[#ff8a1f]/35 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Sparkles size={14} /> {generate.isPending ? "DESIGNING…" : "GENERATE"}
          </button>
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {EXAMPLES.map((ex) => (
            <button key={ex} type="button" disabled={generate.isPending} onClick={() => setPrompt(ex)} data-testid="create-example" className="rounded-sm border border-[#ff8a1f]/30 bg-black/30 px-2 py-1 text-[11px] text-[#d9a66a] hover:text-white disabled:opacity-40">
              {ex}
            </button>
          ))}
        </div>
      </form>

      {generate.isPending && (
        <div className="hud-panel flex flex-1 flex-col items-center justify-center gap-3 rounded-md" data-testid="create-loading">
          <ArcReactor size={90} mode="thinking" testId="create-loading-reactor" beam />
          <p className="font-heading text-[11px] tracking-[0.3em] text-[#ffd27a] animate-pulse">PREPARING YOUR VIRTUAL MODEL…</p>
        </div>
      )}

      {!generate.isPending && active && (
        <div className="flex flex-1 flex-col gap-3 overflow-y-auto lg:flex-row">
          <div className="relative min-h-[320px] flex-1">
            {active.model_source === "tripo" && active.model_url ? <GlbViewer url={active.model_url} /> : <VirtualLab spec={active.scene} messageId={active.id} tall />}
          </div>
          <div className="hud-panel hud-corners w-full shrink-0 rounded-md p-4 lg:w-80" data-testid="create-details">
            <span className="hud-c" />
            {active.image_data_url && (
              <img src={active.image_data_url} alt={active.name} className="mb-3 w-full rounded border border-[#ff8a1f]/25" data-testid="create-concept-image" />
            )}
            <h3 className="font-heading text-xs tracking-[0.25em] text-white glow-text">{active.name}</h3>
            <p className="mt-1 text-[10px] uppercase tracking-[0.2em] text-[#ff8a1f]">
              {active.category} · {active.model_source === "tripo" ? "Tripo AI model" : "Procedural preview"}
            </p>
            <p className="mt-2 text-sm text-[#ffe3b8]">{active.brief}</p>
            {active.model_url && (
              <a href={active.model_url} download target="_blank" rel="noreferrer noopener" data-testid="create-download-glb" className="mt-3 inline-flex items-center gap-1 rounded border border-[#ff8a1f]/50 bg-[#ff8a1f]/10 px-2.5 py-1 text-xs text-white hover:bg-[#ff8a1f]/25">
                Download GLB
              </a>
            )}
            <div className="mt-3 flex items-start gap-2 rounded border border-[#ffb347]/30 bg-[#ffb347]/5 px-2.5 py-2 text-[11px] text-[#ffd27a]" data-testid="create-limitation-note">
              <AlertTriangle size={13} className="mt-0.5 shrink-0" />
              <span>{active.limitations}</span>
            </div>
          </div>
        </div>
      )}

      {!generate.isPending && !active && (
        <div className="hud-panel flex flex-1 flex-col items-center justify-center gap-2 rounded-md text-center" data-testid="create-empty">
          <ArcReactor size={90} mode="idle" testId="create-empty-reactor" />
          <p className="text-sm text-[#ffe3b8]">Describe a vehicle, furniture, building, product, creature or character to see it in 3D.</p>
        </div>
      )}

      {(gallery.data?.length ?? 0) > 0 && (
        <div className="hud-panel rounded-md p-3" data-testid="create-gallery">
          <p className="mb-2 font-heading text-[9px] tracking-[0.3em] text-[#ff8a1f]">YOUR GALLERY</p>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {gallery.data?.map((c) => (
              <button key={c.id} type="button" onClick={() => void openSaved(c.id)} data-testid="create-gallery-item" className="flex w-28 shrink-0 flex-col items-center gap-1 rounded border border-[#ff8a1f]/25 bg-black/40 p-1.5 text-left hover:border-[#ff8a1f]">
                {c.image_data_url ? (
                  <img src={c.image_data_url} alt={c.name} className="h-16 w-full rounded object-cover" />
                ) : (
                  <div className="flex h-16 w-full items-center justify-center rounded bg-black/60 text-[9px] text-[#7a4a22]">NO PREVIEW</div>
                )}
                <span className="line-clamp-1 w-full text-[10px] text-[#ffe3b8]">{c.name || c.prompt}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
