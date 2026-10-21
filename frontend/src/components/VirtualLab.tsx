// Virtual Lab viewer: header, 3D canvas (lazy), controls, stat chips, steps that highlight in sync with the voice.
import { Component, Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ErrorInfo, ReactNode } from "react";
import { Box, Expand, Gauge, Layers, MessageCircleQuestion, Minimize2, Pause, Play, RefreshCw, RotateCw, Scan, Shrink } from "lucide-react";
import { ArcReactor } from "@/components/ArcReactor";
import { useVoice } from "@/lib/voice";
import type { SceneSpec } from "@/lib/types";
import type { RenderMode, SelectInfo } from "@/lab/holo";

const LabCanvas = lazy(() => import("@/lab/LabCanvas"));

class LabBoundary extends Component<{ onError: (m: string) => void; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: Error, _info: ErrorInfo) {
    this.props.onError(error.message || "The 3D scene could not be rendered.");
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

const SCALE_NOTE: Record<string, string> = {
  "solar-system": "Educational scale: sizes and distances are compressed so all 8 planets fit on screen. Order and relative sequence are accurate.",
  atom: "Bohr-style model: electrons are shown on shells for clarity; real electrons occupy probability clouds (orbitals).",
  "earth-seasons": "Educational scale: Earth is enlarged and its orbit shrunk; the 23.5° tilt is accurate.",
  "moon-phases": "Educational scale: distances compressed; sunlight direction and phase order are accurate.",
  eclipse: "Educational scale: distances compressed so Sun, Earth and Moon fit in one view.",
  heart: "Simplified schematic of the four chambers — not anatomically exact.",
  cell: "Schematic model: organelle count and positions are illustrative.",
};

function ToolButton({ onClick, label, active, children, testId }: { onClick: () => void; label: string; active?: boolean; children: ReactNode; testId: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      data-testid={testId}
      className={`inline-flex h-7 w-7 items-center justify-center rounded border text-[#ffd27a] hover:bg-[#ff8a1f]/15 hover:text-white ${active ? "border-[#ff8a1f] bg-[#ff8a1f]/20 text-white" : "border-[#ff8a1f]/30 bg-black/40"}`}
    >
      {children}
    </button>
  );
}

interface VirtualLabProps {
  spec: SceneSpec;
  messageId: string;
  tall?: boolean;
  /** ask PANDI to explain the selected part */
  onExplain?: (part: string, topic: string) => void;
}

const MODES: RenderMode[] = ["solid", "wire", "xray"];

export function VirtualLab({ spec, messageId, tall = false, onExplain }: VirtualLabProps) {
  const [playing, setPlaying] = useState(true);
  const [renderMode, setRenderMode] = useState<RenderMode>("solid");
  const [explode, setExplode] = useState(0);
  const [autoRotate, setAutoRotate] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [toggle, setToggle] = useState(false);
  const [resetSignal, setResetSignal] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<SelectInfo | null>(null);
  const [manualStep, setManualStep] = useState(-1);
  const [inView, setInView] = useState(true);
  const [webglOk] = useState(() => {
    try {
      const c = document.createElement("canvas");
      return Boolean(c.getContext("webgl2") || c.getContext("webgl"));
    } catch {
      return false;
    }
  });
  const box = useRef<HTMLDivElement>(null);
  const voice = useVoice();

  // Voice sync: while this message is being spoken, the active step follows playback progress.
  const speakingThis = voice.messageId === messageId && voice.status === "speaking";
  const steps = spec.steps ?? [];
  const activeStep = speakingThis && steps.length ? Math.min(steps.length - 1, Math.floor(voice.progress * steps.length)) : manualStep;

  useEffect(() => {
    const el = box.current;
    if (!el || !("IntersectionObserver" in window)) return;
    const io = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { rootMargin: "300px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    const onChange = () => setFullscreen(document.fullscreenElement === box.current);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const toggleFullscreen = async () => {
    const el = box.current;
    if (!el) return;
    try {
      if (document.fullscreenElement === el) await document.exitFullscreen();
      else await el.requestFullscreen();
    } catch {
      setFullscreen((f) => !f); // CSS fallback below
    }
  };

  const onSelect = useCallback((info: SelectInfo | null) => setSelected(info), []);
  const onError = useCallback((m: string) => setError(m), []);
  const title = useMemo(() => (spec.title || spec.scene.replace(/-/g, " ")).toUpperCase(), [spec.title, spec.scene]);
  const isGeometryBox = spec.scene === "geometry" && ["cube", "cuboid", undefined].includes((spec.params?.shape as string | undefined)?.toLowerCase());
  const note = SCALE_NOTE[spec.scene];

  return (
    <div
      ref={box}
      data-testid="virtual-lab"
      data-scene={spec.scene}
      className={`hud-panel hud-corners ${tall ? "h-full" : "my-3"} overflow-hidden rounded-md ${fullscreen && !document.fullscreenElement ? "fixed inset-2 z-50" : ""} ${document.fullscreenElement === box.current ? "flex h-screen flex-col bg-black" : ""}`}
    >
      <span className="hud-c" />
      <div className="flex items-center justify-between gap-2 border-b border-[#ff8a1f]/20 bg-black/40 px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="h-2 w-2 shrink-0 rounded-full bg-[#ff8a1f] shadow-[0_0_8px_#ff8a1f] animate-blink" />
          <h3 className="truncate font-heading text-[11px] tracking-[0.2em] text-[#ffd27a] glow-text" data-testid="virtual-lab-title">
            VIRTUAL LAB – {title} 3D PROJECTION
          </h3>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <ToolButton onClick={() => setPlaying((p) => !p)} label={playing ? "Pause animation" : "Play animation"} active={!playing} testId="lab-play-pause">
            {playing ? <Pause size={14} /> : <Play size={14} />}
          </ToolButton>
          <ToolButton onClick={() => setSpeed((s) => (s >= 4 ? 0.5 : s * 2))} label={`Speed ×${speed}`} active={speed !== 1} testId="lab-speed">
            <Gauge size={14} />
          </ToolButton>
          <ToolButton onClick={() => setAutoRotate((a) => !a)} label="Auto-rotate" active={autoRotate} testId="lab-auto-rotate">
            <RotateCw size={14} />
          </ToolButton>
          {isGeometryBox && (
            <ToolButton onClick={() => setToggle((t) => !t)} label={toggle ? "Fold back" : "Unfold net"} active={toggle} testId="lab-unfold-net">
              <Layers size={14} />
            </ToolButton>
          )}
          <ToolButton onClick={() => setRenderMode((m) => MODES[(MODES.indexOf(m) + 1) % MODES.length])} label={`Render: ${renderMode} (click to cycle solid / wireframe / x-ray)`} active={renderMode !== "solid"} testId="lab-render-mode">
            {renderMode === "wire" ? <Box size={14} /> : renderMode === "xray" ? <Scan size={14} /> : <Layers size={14} className="opacity-70" />}
          </ToolButton>
          <ToolButton onClick={() => setResetSignal((n) => n + 1)} label="Reset view" testId="lab-reset-view">
            <RefreshCw size={14} />
          </ToolButton>
          <ToolButton onClick={toggleFullscreen} label={fullscreen ? "Exit fullscreen" : "Fullscreen"} active={fullscreen} testId="lab-fullscreen">
            {fullscreen ? <Shrink size={14} /> : <Expand size={14} />}
          </ToolButton>
        </div>
      </div>

      <div className={`relative ${fullscreen ? "flex-1" : tall ? "h-[46vh] min-h-[300px] sm:h-[56vh]" : "h-[300px] sm:h-[360px]"} bg-[radial-gradient(ellipse_at_center,rgba(255, 138, 31,0.08),transparent_70%)]`} data-testid="lab-viewport">
        {error || !webglOk ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center" data-testid="lab-fallback">
            <ArcReactor size={48} mode="idle" testId="lab-fallback-reactor" />
            <p className="font-heading text-[11px] tracking-widest text-[#ff9d9d]">3D PROJECTION UNAVAILABLE</p>
            <p className="text-xs text-[#d9a66a]">{error ?? "WebGL is not available on this device. The text explanation below is complete."}</p>
            {error && (
              <button type="button" className="mt-1 rounded border border-[#ff8a1f]/40 px-3 py-1 text-xs text-[#ffd27a] hover:bg-[#ff8a1f]/15" onClick={() => setError(null)} data-testid="lab-retry">
                Retry projection
              </button>
            )}
          </div>
        ) : inView ? (
          <LabBoundary onError={onError}>
            <Suspense
              fallback={
                <div className="flex h-full flex-col items-center justify-center gap-3" data-testid="lab-loading">
                  <ArcReactor size={56} mode="thinking" testId="lab-loading-reactor" />
                  <p className="font-heading text-[11px] tracking-[0.25em] text-[#ffd27a] animate-pulse">PREPARING YOUR VIRTUAL EXPLANATION…</p>
                </div>
              }
            >
              <LabCanvas spec={spec} playing={playing} speed={speed} autoRotate={autoRotate} toggle={toggle} renderMode={renderMode} explode={explode} activeStep={activeStep} resetSignal={resetSignal} onSelect={onSelect} onError={onError} />
            </Suspense>
          </LabBoundary>
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-[#a8713a]">Projection paused while off-screen</div>
        )}

        {selected && !error && (
          <div className="hud-panel absolute left-3 top-3 max-w-[240px] rounded px-3 py-2 text-xs animate-fade-up" data-testid="lab-info-panel">
            <div className="mb-1 flex items-center justify-between gap-3">
              <p className="font-heading text-[11px] tracking-widest text-white">{selected.title}</p>
              <button type="button" onClick={() => setSelected(null)} className="text-[#ffd27a] hover:text-white" aria-label="Close info" data-testid="lab-info-close">
                <Minimize2 size={12} />
              </button>
            </div>
            <ul className="space-y-0.5 text-[#ffe3b8]">
              {selected.lines.map((l) => (
                <li key={l}>• {l}</li>
              ))}
            </ul>
            {onExplain && (
              <button type="button" onClick={() => onExplain(selected.title, spec.title || spec.scene)} data-testid="lab-explain-part" className="mt-2 inline-flex items-center gap-1 rounded border border-[#ff8a1f]/60 bg-[#ff8a1f]/15 px-2 py-1 font-heading text-[9px] tracking-widest text-white hover:bg-[#ff8a1f]/30">
                <MessageCircleQuestion size={11} /> ASK PANDI
              </button>
            )}
          </div>
        )}
        <p className="pointer-events-none absolute bottom-2 right-3 text-[10px] tracking-wider text-[#a8713a]">drag · rotate &nbsp; scroll · zoom &nbsp; right-drag · pan</p>
        {spec.scene === "custom" && !error && (
          <label className="absolute bottom-2 left-3 flex items-center gap-2 rounded border border-[#ff8a1f]/40 bg-black/60 px-2 py-1 text-[9px] tracking-widest text-[#ffd27a]" data-testid="lab-explode-control">
            EXPLODE
            <input type="range" min={0} max={100} value={Math.round(explode * 100)} onChange={(e) => setExplode(Number(e.target.value) / 100)} className="w-24 accent-[#ff8a1f]" aria-label="Exploded view" data-testid="lab-explode-slider" />
          </label>
        )}
      </div>

      {(spec.stats?.length > 0 || note) && (
        <div className="flex flex-wrap items-center gap-1.5 border-t border-[#ff8a1f]/15 bg-black/30 px-3 py-2" data-testid="lab-stats">
          {spec.stats?.map((s) => (
            <span key={s} className="rounded-sm border border-[#ff8a1f]/40 bg-[#ff8a1f]/10 px-2 py-0.5 font-heading text-[10px] tracking-wider text-[#ffe3b8]" data-testid="lab-stat-chip">
              {s}
            </span>
          ))}
          {note && <span className="ml-auto text-[10px] text-[#a8713a]">{note}</span>}
        </div>
      )}

      {steps.length > 0 && (
        <ol className="space-y-1 border-t border-[#ff8a1f]/15 px-3 py-2" data-testid="lab-steps">
          {steps.map((s, i) => (
            <li key={i}>
              <button
                type="button"
                onClick={() => setManualStep(i === manualStep ? -1 : i)}
                data-testid={`lab-step-${i}`}
                data-active={activeStep === i}
                className={`flex w-full items-start gap-2 rounded px-2 py-1 text-left text-xs transition-colors ${activeStep === i ? "bg-[#ff8a1f]/20 text-white shadow-[inset_2px_0_0_#ff8a1f]" : "text-[#d9a66a] hover:bg-[#ff8a1f]/10"}`}
              >
                <span className="font-heading text-[10px] text-[#ff8a1f]">{String(i + 1).padStart(2, "0")}</span>
                <span>{s}</span>
              </button>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
