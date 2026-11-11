import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { getVoiceLevel } from "@/lib/voice";
import { BrandLogo } from "@/components/BrandLogo";

export type ReactorMode = "idle" | "thinking" | "speaking" | "listening";

interface Props {
  size?: number;
  mode?: ReactorMode;
  className?: string;
  testId?: string;
  /** render the light beam rising from beneath (for large hero placements) */
  beam?: boolean;
}

interface Spark {
  a: number; // angle
  r: number; // radius factor (1 = on the ring)
  v: number; // angular speed
  drift: number; // radial drift speed
  s: number; // size
  life: number;
  hue: number; // 0 white-yellow .. 1 ember
}

/**
 * PANDI core: a large glowing fire ring (white-hot yellow → orange → ember red) with a dark hollow centre and
 * hundreds of spark particles streaming in a spiral around it. Soft pulse when idle; sparks speed up and brighten
 * while thinking or speaking (voice level drives the pulse).
 */
export function ArcReactor({ size = 64, mode = "idle", className, testId = "arc-reactor", beam = false }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const modeRef = useRef(mode);
  modeRef.current = mode;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const px = Math.round(size * 1.5); // overflow room for sparks/glow
    canvas.width = px * dpr;
    canvas.height = px * dpr;
    ctx.scale(dpr, dpr);
    const count = Math.min(420, Math.max(90, Math.round(size * 2.2)));
    const sparks: Spark[] = Array.from({ length: count }, () => ({
      a: Math.random() * Math.PI * 2,
      r: 0.75 + Math.random() * 0.7,
      v: 0.4 + Math.random() * 0.9,
      drift: (Math.random() - 0.5) * 0.25,
      s: 0.4 + Math.random() * 1.1,
      life: Math.random(),
      hue: Math.random(),
    }));
    let raf = 0;
    let last = performance.now();
    let t = 0;
    const cx = px / 2;
    const cy = px / 2;
    const R = size * 0.36;

    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      t += dt;
      const m = modeRef.current;
      const level = m === "speaking" ? getVoiceLevel() : m === "thinking" ? 0.45 + 0.35 * Math.sin(t * 6) : m === "listening" ? 0.3 + 0.2 * Math.sin(t * 3) : 0.08 + 0.08 * Math.sin(t * 1.6);
      const energy = m === "idle" ? 1 : 1.8 + level * 1.4;

      ctx.clearRect(0, 0, px, px);
      ctx.globalCompositeOperation = "lighter";

      // outer glow halo
      const halo = ctx.createRadialGradient(cx, cy, R * 0.6, cx, cy, R * (1.9 + level * 0.4));
      halo.addColorStop(0, `rgba(255, 138, 31, ${0.18 + level * 0.25})`);
      halo.addColorStop(0.5, `rgba(194, 48, 10, ${0.1 + level * 0.1})`);
      halo.addColorStop(1, "rgba(194, 48, 10, 0)");
      ctx.fillStyle = halo;
      ctx.fillRect(0, 0, px, px);

      // the fire ring: ember outer, orange body, white-hot inner edge
      const w = Math.max(2, size * 0.085) * (1 + level * 0.25);
      const ringGrad = ctx.createRadialGradient(cx, cy, R - w, cx, cy, R + w);
      ringGrad.addColorStop(0, "rgba(255, 210, 122, 0)");
      ringGrad.addColorStop(0.35, "rgba(255, 210, 122, 0.95)");
      ringGrad.addColorStop(0.55, "rgba(255, 138, 31, 0.95)");
      ringGrad.addColorStop(0.8, "rgba(194, 48, 10, 0.7)");
      ringGrad.addColorStop(1, "rgba(194, 48, 10, 0)");
      ctx.fillStyle = ringGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, R + w, 0, Math.PI * 2);
      ctx.arc(cx, cy, Math.max(0, R - w), 0, Math.PI * 2, true);
      ctx.fill();

      // bright rotating hot-spots on the ring
      for (let i = 0; i < 3; i += 1) {
        const a = t * (0.6 + i * 0.25) * energy + (i * Math.PI * 2) / 3;
        const hx = cx + Math.cos(a) * R;
        const hy = cy + Math.sin(a) * R;
        const g = ctx.createRadialGradient(hx, hy, 0, hx, hy, w * 2.2);
        g.addColorStop(0, "rgba(255, 245, 220, 0.9)");
        g.addColorStop(0.4, "rgba(255, 210, 122, 0.5)");
        g.addColorStop(1, "rgba(255, 138, 31, 0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(hx, hy, w * 2.2, 0, Math.PI * 2);
        ctx.fill();
      }

      // sparks streaming in a spiral
      for (const sp of sparks) {
        sp.a += dt * sp.v * energy * (1.2 - sp.r * 0.3);
        sp.r += dt * (sp.drift + Math.sin(t * 0.7 + sp.a) * 0.08) * energy * 0.6;
        sp.life += dt * 0.35 * energy;
        if (sp.r > 1.55 || sp.r < 0.55 || sp.life > 1) {
          sp.r = 0.95 + (Math.random() - 0.5) * 0.15;
          sp.a = Math.random() * Math.PI * 2;
          sp.drift = (Math.random() - 0.3) * 0.3;
          sp.life = 0;
          sp.hue = Math.random();
        }
        const fade = Math.sin(Math.min(1, sp.life) * Math.PI);
        const x = cx + Math.cos(sp.a) * R * sp.r;
        const y = cy + Math.sin(sp.a) * R * sp.r;
        const alpha = (0.35 + 0.65 * fade) * (0.6 + level * 0.4);
        const rr = sp.s * (size / 90) * (1 + level * 0.5);
        ctx.fillStyle = sp.hue < 0.3 ? `rgba(255, 235, 190, ${alpha})` : sp.hue < 0.75 ? `rgba(255, 138, 31, ${alpha})` : `rgba(194, 48, 10, ${alpha})`;
        ctx.beginPath();
        ctx.arc(x, y, Math.max(0.4, rr), 0, Math.PI * 2);
        ctx.fill();
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [size]);

  return (
    <div className={cn("relative shrink-0 select-none", className)} style={{ width: size, height: size }} data-testid={testId} data-mode={mode}>
      {beam && <div className="reactor-beam" aria-hidden />}
      <canvas ref={canvasRef} className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2" style={{ width: size * 1.5, height: size * 1.5 }} aria-hidden />
      <BrandLogo variant="emblem" testId={`${testId}-logo`} className="absolute inset-[8%]" />
    </div>
  );
}
