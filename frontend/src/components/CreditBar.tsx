import { useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatCountdown, useCredits } from "@/lib/credits";
import { useSettings } from "@/lib/settings";

interface Props {
  profileId: string;
  isUser: boolean;
  onSignIn: () => void;
}

function barColour(left: number, total: number): string {
  if (left <= 0) return "#6b7280";
  const pct = left / Math.max(1, total);
  return pct > 0.5 ? "#34d399" : pct >= 0.2 ? "#fbbf24" : "#f87171";
}

/** Always-visible daily credit bar. Rendered through a portal so the theme colour filter never tints its status colours. */
export function CreditBar({ profileId, isUser, onSignIn }: Props) {
  const { status, secondsLeft, isError } = useCredits(profileId);
  const [open, setOpen] = useState(false);
  const large = useSettings().large_text;

  if (!status) {
    return createPortal(
      <div className="fixed inset-x-0 top-0 z-40 flex h-9 items-center border-b border-white/10 bg-[#07090c] px-3 text-xs text-slate-300" data-testid="credit-bar-loading">
        {isError ? "Credits unavailable — retrying…" : "Loading credits…"}
      </div>,
      document.body,
    );
  }

  const colour = barColour(status.credits_left, status.credits_total);
  const pct = Math.round((status.credits_left / Math.max(1, status.credits_total)) * 100);
  const imageColour = status.images_left === 0 ? "#f87171" : status.images_left <= 2 ? "#fbbf24" : "#e2e8f0";
  const countdown = formatCountdown(secondsLeft);
  const label = `${status.tier} plan, ${status.credits_left} of ${status.credits_total} credits left today, ${status.images_used} of ${status.images_total} images used.`;
  const text = large ? "text-sm" : "text-xs";

  return createPortal(
    <>
      <div className={`fixed inset-x-0 top-0 z-40 flex h-9 items-center gap-2 border-b border-white/10 bg-[#07090c] pl-2 pr-[4.5rem] text-slate-100 ${text}`} data-testid="credit-bar">
        <button type="button" onClick={() => setOpen(true)} aria-label={`${label} Open today's credit history.`} data-testid="credit-bar-button" className="flex h-full min-w-0 flex-1 items-center gap-3 rounded px-1 text-left hover:bg-white/5">
          <span className="shrink-0 rounded-sm border border-white/20 px-1.5 py-0.5 font-heading text-[10px] tracking-[0.2em] text-white" data-testid="credit-bar-tier">
            {status.tier.toUpperCase()}
          </span>
          <span className="shrink-0 font-medium" data-testid="credit-bar-credits">
            {status.credits_left} of {status.credits_total} credits left
          </span>
          <span className="hidden shrink-0 sm:inline" style={{ color: imageColour }} data-testid="credit-bar-images">
            Images today: {status.images_used} of {status.images_total}
          </span>
          <span className="h-1 min-w-10 flex-1 overflow-hidden rounded-full bg-white/10" role="progressbar" aria-valuemin={0} aria-valuemax={status.credits_total} aria-valuenow={status.credits_left} aria-label="Credits remaining" data-testid="credit-bar-progress">
            <span className="block h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: colour, transition: "width 400ms ease, background-color 400ms ease" }} />
          </span>
          {status.low && (
            <span className="hidden shrink-0 text-[#f87171] lg:inline" data-testid="credit-bar-low">
              Low credits. Image and 3D tools may stop soon.
            </span>
          )}
          <span className="hidden shrink-0 text-slate-300 sm:inline" data-testid="credit-bar-reset">
            Reset in {countdown}
          </span>
          <ChevronDown size={13} className="shrink-0 text-slate-400" />
        </button>
        {!isUser && (
          <button type="button" onClick={onSignIn} data-testid="credit-bar-signin" className="hidden shrink-0 rounded border border-[#34d399]/60 bg-[#34d399]/10 px-2 py-0.5 text-[11px] font-medium text-[#a7f3d0] hover:bg-[#34d399]/25 sm:inline-block">
            Sign in for more
          </button>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85dvh] overflow-y-auto border-white/15 bg-[#07090c] text-slate-100 sm:max-w-md" data-testid="credit-panel">
          <DialogHeader>
            <DialogTitle className="font-heading text-sm tracking-[0.2em] text-white">TODAY'S CREDITS</DialogTitle>
            <DialogDescription className="text-xs text-slate-400">Credits and image slots reset every day at 12:00 AM IST. Unused amounts do not carry over.</DialogDescription>
          </DialogHeader>
          <dl className="grid grid-cols-2 gap-2 text-sm">
            <div className="rounded border border-white/10 bg-white/5 p-2">
              <dt className="text-[11px] text-slate-400">Plan</dt>
              <dd data-testid="credit-panel-tier">{status.tier}</dd>
            </div>
            <div className="rounded border border-white/10 bg-white/5 p-2">
              <dt className="text-[11px] text-slate-400">Resets in</dt>
              <dd data-testid="credit-panel-reset">{countdown}</dd>
            </div>
            <div className="rounded border border-white/10 bg-white/5 p-2">
              <dt className="text-[11px] text-slate-400">Credits left</dt>
              <dd style={{ color: colour }} data-testid="credit-panel-credits">
                {status.credits_left} of {status.credits_total}
              </dd>
            </div>
            <div className="rounded border border-white/10 bg-white/5 p-2">
              <dt className="text-[11px] text-slate-400">Images today</dt>
              <dd style={{ color: imageColour }} data-testid="credit-panel-images">
                {status.images_used} of {status.images_total}
              </dd>
            </div>
          </dl>
          <p className="text-xs text-slate-400">
            Chat is free. An image costs {status.image_cost} credits and one image slot. A 3D model costs {status.model3d_cost} credits.
          </p>
          <div>
            <p className="mb-1 font-heading text-[10px] tracking-[0.25em] text-slate-400">HISTORY</p>
            <ul className="space-y-1 text-xs" data-testid="credit-panel-history">
              {status.events.length === 0 && <li className="text-slate-500">Nothing used yet today.</li>}
              {status.events.map((e, i) => (
                <li key={`${e.at}-${i}`} className="flex items-center justify-between gap-2 rounded border border-white/10 bg-white/5 px-2 py-1" data-testid="credit-panel-event">
                  <span className="min-w-0 truncate">
                    <b className="mr-1 uppercase text-slate-300">{e.kind === "3d" ? "3D" : e.kind}</b>
                    {e.note}
                  </span>
                  <span className="shrink-0 font-medium" style={{ color: e.credits > 0 ? "#34d399" : "#fbbf24" }}>
                    {e.credits > 0 ? `+${e.credits}` : e.credits}
                  </span>
                </li>
              ))}
            </ul>
          </div>
          {!isUser && (
            <button type="button" onClick={onSignIn} data-testid="credit-panel-signin" className="rounded border border-[#34d399]/60 bg-[#34d399]/10 px-3 py-2 text-sm font-medium text-[#a7f3d0] hover:bg-[#34d399]/25">
              Sign in for 50 credits and 7 images a day
            </button>
          )}
        </DialogContent>
      </Dialog>
    </>,
    document.body,
  );
}
