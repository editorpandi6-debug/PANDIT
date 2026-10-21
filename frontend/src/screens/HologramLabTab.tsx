import { Activity, Boxes, Orbit, Sparkles } from "lucide-react";
import { VirtualLab } from "@/components/VirtualLab";
import type { SceneSpec } from "@/lib/types";

const CORE: SceneSpec = { scene: "core", params: {}, title: "PANDI CORE", steps: [], stats: ["IDLE", "ORBIT · ZOOM · PAN"] };

const PRESETS = ["Show me the solar system", "How does the human heart work?", "What is the structure of DNA?", "Visualize a water molecule", "Explain projectile motion", "Show the phases of the Moon"];

interface Props {
  scene: SceneSpec | null;
  messageId: string | null;
  lastQuestion: string | null;
  busy: boolean;
  onAsk: (text: string) => void;
}

/** Hologram Lab tab: full-size 3D stage (latest scene or the idle red core) with floating HUD panels. */
export function HologramLabTab({ scene, messageId, lastQuestion, busy, onAsk }: Props) {
  const spec = scene ?? CORE;
  return (
    <div className="screen-enter relative mx-auto flex h-full w-full max-w-6xl flex-col gap-3 px-3 py-3 sm:px-6" data-testid="hologram-lab-tab">
      <div className="relative flex-1">
        <VirtualLab spec={spec} messageId={messageId ?? "core"} tall />
        {/* floating panels */}
        <div className="pointer-events-none absolute left-4 top-16 hidden w-52 flex-col gap-2 md:flex">
          <div className="hud-panel rounded px-3 py-2 text-[11px] animate-float" style={{ animationDuration: "11s" }} data-testid="lab-panel-status">
            <p className="mb-1 flex items-center gap-1 font-heading text-[9px] tracking-[0.3em] text-[#ff8a1f]">
              <Activity size={10} /> LAB STATUS
            </p>
            <p className="text-[#ffe3b8]">{busy ? "Projecting new hologram…" : scene ? `Scene: ${scene.scene}` : "Core idle — ask anything"}</p>
            <p className="text-[#a8713a]">Renderer: WebGL · procedural</p>
          </div>
          <div className="hud-panel rounded px-3 py-2 text-[11px] animate-float" style={{ animationDuration: "13s", animationDelay: "-4s" }} data-testid="lab-panel-query">
            <p className="mb-1 flex items-center gap-1 font-heading text-[9px] tracking-[0.3em] text-[#ff8a1f]">
              <Sparkles size={10} /> LAST QUERY
            </p>
            <p className="line-clamp-3 text-[#ffe3b8]">{lastQuestion ?? "—"}</p>
          </div>
        </div>
        <div className="pointer-events-none absolute right-4 top-16 hidden w-48 md:block">
          <div className="hud-panel rounded px-3 py-2 text-[11px] animate-float" style={{ animationDuration: "12s", animationDelay: "-7s" }} data-testid="lab-panel-controls">
            <p className="mb-1 flex items-center gap-1 font-heading text-[9px] tracking-[0.3em] text-[#ff8a1f]">
              <Orbit size={10} /> CONTROLS
            </p>
            <ul className="space-y-0.5 text-[#d9a66a]">
              <li>Drag — rotate</li>
              <li>Scroll / pinch — zoom</li>
              <li>Right-drag — pan</li>
              <li>Click object — info</li>
            </ul>
          </div>
        </div>
      </div>
      <div className="hud-panel rounded-md px-3 py-2" data-testid="lab-presets">
        <p className="mb-1.5 flex items-center gap-1 font-heading text-[9px] tracking-[0.3em] text-[#ff8a1f]">
          <Boxes size={10} /> PROJECT A HOLOGRAM
        </p>
        <div className="flex flex-wrap gap-1.5">
          {PRESETS.map((p) => (
            <button key={p} type="button" disabled={busy} onClick={() => onAsk(p)} data-testid="lab-preset" className="rounded-sm border border-[#ff8a1f]/40 bg-black/40 px-2.5 py-1 text-xs text-[#ffe3b8] hover:bg-[#ff8a1f]/20 hover:text-white disabled:opacity-40">
              {p}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
