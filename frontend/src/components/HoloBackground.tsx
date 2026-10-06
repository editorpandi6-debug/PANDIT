import { useMemo } from "react";

/** Grid + floating particles + scan beam + scanlines. Pure CSS, sits behind every screen. */
export function HoloBackground({ particles = 26 }: { particles?: number }) {
  const dots = useMemo(
    () =>
      Array.from({ length: particles }, (_v, i) => ({
        left: `${(i * 37) % 100}%`,
        top: `${(i * 53 + 11) % 100}%`,
        delay: `${(i % 9) * -1.1}s`,
        duration: `${7 + (i % 5) * 1.7}s`,
        scale: 0.6 + (i % 4) * 0.3,
      })),
    [particles],
  );
  return (
    <div className="holo-fx pointer-events-none fixed inset-0 overflow-hidden scanlines" aria-hidden data-testid="holo-background">
      <div className="absolute inset-0 holo-grid" />
      <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse at 50% 35%, rgba(255, 42, 74,0.12), transparent 55%)" }} />
      <div className="scan-beam" />
      {dots.map((d, i) => (
        <span key={i} className="particle" style={{ left: d.left, top: d.top, animationDelay: d.delay, animationDuration: d.duration, transform: `scale(${d.scale})` }} />
      ))}
    </div>
  );
}
