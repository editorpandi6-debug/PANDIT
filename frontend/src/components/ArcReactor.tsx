import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { getVoiceLevel } from "@/lib/voice";

export type ReactorMode = "idle" | "thinking" | "speaking" | "listening";

interface Props {
  size?: number;
  mode?: ReactorMode;
  className?: string;
  testId?: string;
  /** render the light beam rising from beneath (for large hero placements) */
  beam?: boolean;
}

const RED = "#ff2a4a";
const CRIMSON = "#b3001b";

/**
 * Live holographic arc reactor drawn in SVG/CSS: concentric wireframe rings rotating in opposite directions,
 * segmented plates, a triangular core that pulses (in sync with the voice level while speaking), orbiting energy
 * particles, red glow/bloom, scanline flicker and a projected light beam underneath. No raster image is used.
 */
export function ArcReactor({ size = 64, mode = "idle", className, testId = "arc-reactor", beam = false }: Props) {
  const coreRef = useRef<SVGGElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);

  // Voice-synced pulse: scale the core with the live audio level while speaking, gentle breathing otherwise.
  useEffect(() => {
    let raf = 0;
    let t = 0;
    const tick = () => {
      t += 0.016;
      let level = 0;
      if (mode === "speaking") level = getVoiceLevel();
      else if (mode === "thinking") level = 0.35 + 0.35 * Math.sin(t * 5);
      else if (mode === "listening") level = 0.25 + 0.25 * Math.sin(t * 2.5);
      else level = 0.1 + 0.1 * Math.sin(t * 1.4);
      const s = 1 + level * 0.28;
      if (coreRef.current) coreRef.current.setAttribute("transform", `translate(100 100) scale(${s.toFixed(3)}) translate(-100 -100)`);
      if (glowRef.current) glowRef.current.style.opacity = String(0.45 + level * 0.55);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [mode]);

  const speed = mode === "speaking" ? 0.45 : mode === "thinking" ? 0.6 : 1;
  const segs = Array.from({ length: 12 }, (_v, i) => i * 30);
  const plates = Array.from({ length: 8 }, (_v, i) => i * 45);

  return (
    <div className={cn("reactor relative shrink-0 select-none", className)} style={{ width: size, height: size }} data-testid={testId} data-mode={mode}>
      {beam && <div className="reactor-beam" aria-hidden />}
      <div ref={glowRef} className="absolute inset-[-25%] rounded-full" style={{ background: `radial-gradient(circle, rgba(255,42,74,0.55) 0%, rgba(255,42,74,0.18) 40%, transparent 70%)`, filter: "blur(6px)" }} />
      <svg viewBox="0 0 200 200" className="relative z-10 h-full w-full overflow-visible reactor-flicker" style={{ filter: "drop-shadow(0 0 6px rgba(255,42,74,0.9)) drop-shadow(0 0 18px rgba(255,42,74,0.45))" }}>
        <defs>
          <radialGradient id="pandiCore" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="35%" stopColor="#ffd0d6" />
            <stop offset="70%" stopColor={RED} />
            <stop offset="100%" stopColor={CRIMSON} stopOpacity="0.2" />
          </radialGradient>
        </defs>
        {/* outer ring — slow clockwise */}
        <g className="reactor-spin" style={{ animationDuration: `${18 * speed}s` }}>
          <circle cx="100" cy="100" r="94" fill="none" stroke={RED} strokeWidth="1.2" strokeOpacity="0.8" />
          <circle cx="100" cy="100" r="88" fill="none" stroke={RED} strokeWidth="5" strokeOpacity="0.55" strokeDasharray="28 18" strokeLinecap="butt" />
          {segs.map((a) => (
            <line key={a} x1="100" y1="6" x2="100" y2="16" stroke={RED} strokeWidth="1.5" transform={`rotate(${a} 100 100)`} strokeOpacity="0.9" />
          ))}
        </g>
        {/* segmented plate ring — counter-clockwise */}
        <g className="reactor-spin-rev" style={{ animationDuration: `${11 * speed}s` }}>
          <circle cx="100" cy="100" r="72" fill="none" stroke={RED} strokeWidth="1" strokeOpacity="0.7" />
          {plates.map((a) => (
            <path key={a} d="M 100 36 L 100 46 L 118 49 L 118 39 Z" fill={RED} fillOpacity="0.25" stroke={RED} strokeWidth="1" transform={`rotate(${a} 100 100)`} />
          ))}
          <circle cx="100" cy="100" r="62" fill="none" stroke="#ffffff" strokeWidth="0.6" strokeOpacity="0.5" strokeDasharray="4 8" />
        </g>
        {/* inner ring — clockwise, faster */}
        <g className="reactor-spin" style={{ animationDuration: `${7 * speed}s` }}>
          <circle cx="100" cy="100" r="52" fill="none" stroke={RED} strokeWidth="2.5" strokeOpacity="0.8" strokeDasharray="60 22" />
          {[0, 120, 240].map((a) => (
            <circle key={a} cx="100" cy="48" r="3" fill={RED} transform={`rotate(${a} 100 100)`} />
          ))}
        </g>
        {/* triangular core */}
        <g ref={coreRef}>
          <polygon points="100,62 136,122 64,122" fill="none" stroke={RED} strokeWidth="2.2" strokeLinejoin="round" />
          <polygon points="100,74 126,116 74,116" fill="url(#pandiCore)" fillOpacity="0.95" stroke="#ffffff" strokeWidth="1" strokeOpacity="0.9" strokeLinejoin="round" />
          <polygon points="100,86 114,110 86,110" fill="#ffffff" fillOpacity="0.9" />
          <circle cx="100" cy="100" r="34" fill="none" stroke={RED} strokeWidth="0.8" strokeOpacity="0.6" />
        </g>
        {/* orbiting energy particles */}
        <g className="reactor-spin" style={{ animationDuration: `${4.5 * speed}s` }}>
          <circle cx="100" cy="20" r="2.4" fill="#ffffff" />
          <circle cx="100" cy="20" r="5" fill={RED} fillOpacity="0.35" />
        </g>
        <g className="reactor-spin-rev" style={{ animationDuration: `${6.5 * speed}s` }}>
          <circle cx="100" cy="170" r="2" fill="#ffd0d6" />
          <circle cx="100" cy="170" r="4.5" fill={RED} fillOpacity="0.35" />
        </g>
        <g className="reactor-spin" style={{ animationDuration: `${9 * speed}s`, transformOrigin: "100px 100px" }}>
          <circle cx="178" cy="100" r="1.8" fill="#ffffff" fillOpacity="0.9" />
        </g>
      </svg>
    </div>
  );
}
