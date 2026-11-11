import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { formatCountdown, useCredits } from "@/lib/credits";

interface Props {
  profileId: string;
  isUser: boolean;
  onSignIn: () => void;
  onSignOut: () => void;
}

function clickSound() {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "square";
    osc.frequency.setValueAtTime(1800, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(600, ctx.currentTime + 0.06);
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.09);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.1);
    osc.onended = () => void ctx.close();
  } catch {
    /* sound is optional */
  }
}

/** Zero-credit lock. Driven only by the server's credit status; plays the key-unlock animation when the server reports credits again. */
export function LockOverlay({ profileId, isUser, onSignIn, onSignOut }: Props) {
  const { status, secondsLeft } = useCredits(profileId);
  const [phase, setPhase] = useState<"hidden" | "locked" | "unlocking">("hidden");
  const wasLocked = useRef(false);
  const locked = status?.locked ?? false;

  useEffect(() => {
    if (locked) {
      wasLocked.current = true;
      setPhase("locked");
      return;
    }
    if (!wasLocked.current) return;
    wasLocked.current = false;
    setPhase("unlocking");
    const click = window.setTimeout(clickSound, 1700);
    const done = window.setTimeout(() => {
      setPhase("hidden");
      toast.success("Welcome back. Your credits are ready.");
    }, 2700);
    return () => {
      window.clearTimeout(click);
      window.clearTimeout(done);
    };
  }, [locked]);

  if (phase === "hidden") return null;

  return createPortal(
    <div className="lock-overlay fixed inset-x-0 bottom-0 top-9 z-30 flex flex-col items-center justify-center bg-black/85 px-6 text-center backdrop-blur-sm" data-phase={phase} role="alertdialog" aria-label="Your credits are finished." data-testid="lock-overlay">
      <svg viewBox="0 0 160 120" className="lock-svg h-40 w-52" aria-hidden>
        <path className="lock-shackle" d="M58 56 V40 a22 22 0 0 1 44 0 V56" fill="none" stroke="#9ca3af" strokeWidth="9" strokeLinecap="round" />
        <rect x="46" y="54" width="68" height="54" rx="9" fill="#4b5563" stroke="#9ca3af" strokeWidth="2" />
        <circle cx="80" cy="76" r="6" fill="#111827" />
        <rect x="77.5" y="78" width="5" height="14" rx="2" fill="#111827" />
        <g className="lock-key" fill="#fbbf24">
          <circle cx="16" cy="81" r="9" />
          <circle cx="16" cy="81" r="3.6" fill="#111827" />
          <rect x="24" y="78.5" width="46" height="5" rx="2" />
          <rect x="56" y="83" width="4" height="7" />
          <rect x="63" y="83" width="4" height="5" />
        </g>
      </svg>
      {phase === "locked" ? (
        <>
          <h2 className="mt-4 font-heading text-lg tracking-[0.15em] text-white" data-testid="lock-title">
            Your credits are finished.
          </h2>
          <p className="mt-2 max-w-sm text-sm text-slate-300" data-testid="lock-reset">
            Chat and creation tools unlock when your credits reset at 12:00 AM IST — in {formatCountdown(secondsLeft)}.
          </p>
          {isUser ? (
            <button type="button" onClick={onSignOut} data-testid="lock-signout" className="mt-5 rounded border border-white/30 px-4 py-2 text-sm text-slate-200 hover:bg-white/10">
              Sign out
            </button>
          ) : (
            <button type="button" onClick={onSignIn} data-testid="lock-signin" className="mt-5 rounded border border-[#34d399] bg-[#34d399]/15 px-4 py-2 text-sm font-medium text-[#a7f3d0] hover:bg-[#34d399]/30">
              Sign in for 50 credits a day
            </button>
          )}
        </>
      ) : (
        <h2 className="mt-4 font-heading text-lg tracking-[0.15em] text-[#fbbf24]" data-testid="lock-unlocking">
          Unlocking…
        </h2>
      )}
    </div>,
    document.body,
  );
}
