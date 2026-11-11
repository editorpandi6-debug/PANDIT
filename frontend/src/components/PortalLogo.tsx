import { useEffect, useRef, useState } from "react";
import { APP_NAME } from "@/lib/brand";
import { cn } from "@/lib/utils";

interface Props {
  testId: string;
  className?: string;
  /** "thinking" pulses the core slowly while the AI works. */
  mode?: "idle" | "thinking";
  /** Change this number to flash the portal once (an AI reply arrived). */
  flashKey?: number;
  /** Force the static version (tiny avatars, embedded uses). */
  still?: boolean;
}

function lowPower(): boolean {
  const nav = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } };
  return (nav.hardwareConcurrency ?? 8) <= 2 || (nav.deviceMemory ?? 8) <= 2 || Boolean(nav.connection?.saveData);
}

/** Original spinning-portal logo: pure SVG + CSS (a few KB). Static with reduced motion or on low-power devices. */
export function PortalLogo({ testId, className, mode = "idle", flashKey = 0, still = false }: Props) {
  const [boost, setBoost] = useState(false);
  const [flash, setFlash] = useState(false);
  const [isStill] = useState(() => still || lowPower());
  const firstFlash = useRef(flashKey);

  useEffect(() => {
    if (flashKey === firstFlash.current) return;
    setFlash(true);
    const id = window.setTimeout(() => setFlash(false), 700);
    return () => window.clearTimeout(id);
  }, [flashKey]);

  const spinFaster = () => {
    if (isStill) return;
    setBoost(true);
    window.setTimeout(() => setBoost(false), 1000);
  };

  return (
    <div
      role="img"
      aria-label={`${APP_NAME} logo`}
      onClick={spinFaster}
      data-testid={testId}
      data-mode={mode}
      data-boost={boost}
      data-flash={flash}
      data-still={isStill}
      className={cn("portal aspect-square shrink-0 select-none", className)}
    >
      <svg viewBox="0 0 100 100" className="h-full w-full overflow-visible" aria-hidden>
        <defs>
          <radialGradient id={`${testId}-core`}>
            <stop offset="0" stopColor="#ffffff" />
            <stop offset="0.35" stopColor="#38e1ff" />
            <stop offset="0.75" stopColor="#ff8a1f" stopOpacity="0.7" />
            <stop offset="1" stopColor="#ff8a1f" stopOpacity="0" />
          </radialGradient>
        </defs>
        <circle className="portal-core" cx="50" cy="50" r="19" fill={`url(#${testId}-core)`} />
        <g fill="none" strokeLinecap="round">
          <g className="portal-ring" style={{ "--d": "14s" } as React.CSSProperties}>
            <circle cx="50" cy="50" r="46" stroke="#ff8a1f" strokeWidth="1.6" strokeDasharray="70 22" />
            <circle cx="96" cy="50" r="2.4" fill="#ffd27a" stroke="none" />
            <circle cx="27" cy="10.2" r="2" fill="#38e1ff" stroke="none" />
            <circle cx="27" cy="89.8" r="1.6" fill="#ffd27a" stroke="none" />
          </g>
          <g className="portal-ring portal-ring-rev" style={{ "--d": "9s" } as React.CSSProperties}>
            <circle cx="50" cy="50" r="38" stroke="#38e1ff" strokeWidth="1.3" strokeDasharray="34 12 8 12" />
          </g>
          <g className="portal-ring" style={{ "--d": "6s" } as React.CSSProperties}>
            <circle cx="50" cy="50" r="30" stroke="#ff8a1f" strokeWidth="1.2" strokeDasharray="90 40" />
          </g>
          <g className="portal-ring portal-ring-rev" style={{ "--d": "11s" } as React.CSSProperties}>
            <circle cx="50" cy="50" r="23.5" stroke="#38e1ff" strokeWidth="0.9" strokeDasharray="8 6" opacity="0.8" />
          </g>
        </g>
      </svg>
    </div>
  );
}
