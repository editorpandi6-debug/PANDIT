import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, Copy, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { apiGet } from "@/lib/api";
import type { OwnerEvent, OwnerOverview } from "@/lib/types";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  profileId: string;
  event: OwnerEvent | null;
}

/** Minimal Owner Console shell — unlocked only by the hidden 123P456P trigger. Full tabs land in a follow-up. */
export function OwnerConsole({ open, onOpenChange, profileId, event }: Props) {
  const [saved, setSaved] = useState(false);
  const overview = useQuery({
    queryKey: ["owner-overview", profileId],
    queryFn: () => apiGet<OwnerOverview>(`/pandi/owner/overview?profile_id=${encodeURIComponent(profileId)}`),
    enabled: open,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="hud-panel border-[#ff8a1f]/30 text-[#fff5e8] sm:max-w-md" data-testid="owner-console">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-heading text-sm tracking-[0.2em] text-white">
            <ShieldCheck size={15} className="text-[#ff8a1f]" /> OWNER CONSOLE
          </DialogTitle>
          <DialogDescription className="text-xs text-[#d9a66a]">{event?.action === "claimed" ? "This account is now the permanent owner." : "Welcome back, Owner."}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          {event?.action === "claimed" && event.recovery_key && (
            <div className="rounded border border-[#ff3b3b]/40 bg-[#ff3b3b]/10 p-3" data-testid="owner-recovery-key">
              <p className="font-heading text-[10px] tracking-[0.25em] text-[#ff9d9d]">ONE-TIME RECOVERY KEY — SAVE IT NOW</p>
              <p className="mt-2 break-all font-mono text-sm text-white">{event.recovery_key}</p>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard?.writeText(event.recovery_key ?? "").then(() => {
                    setSaved(true);
                    toast.success("Recovery key copied");
                  }).catch(() => toast.error("Copy failed"));
                }}
                data-testid="owner-recovery-copy"
                className="mt-2 inline-flex items-center gap-1 rounded border border-[#ff8a1f]/40 bg-black/40 px-2 py-1 text-[11px] text-[#ffd27a] hover:text-white"
              >
                {saved ? <Check size={12} /> : <Copy size={12} />} {saved ? "COPIED" : "COPY KEY"}
              </button>
              <p className="mt-2 text-[10px] text-[#ff9d9d]">This key will never be shown again — it will not appear anywhere else in the app.</p>
            </div>
          )}
          <div className="rounded border border-[#ff8a1f]/20 bg-black/40 p-3" data-testid="owner-overview">
            <p className="font-heading text-[10px] tracking-[0.25em] text-[#ff8a1f]">APP OVERVIEW</p>
            {overview.isLoading && <p className="mt-2 text-xs text-[#a8713a]">Loading…</p>}
            {overview.isError && <p className="mt-2 text-xs text-[#ff9d9d]">Could not load overview.</p>}
            {overview.data && (
              <ul className="mt-2 space-y-1 text-xs text-[#ffe3b8]">
                <li>Profiles: <b>{overview.data.total_profiles}</b></li>
                <li>Messages: <b>{overview.data.total_messages}</b></li>
                <li>3D creations: <b>{overview.data.total_creations}</b></li>
              </ul>
            )}
          </div>
          <p className="text-[11px] text-[#a8713a]">Full Users / Chat History / Intro Video / Settings tabs and the live-preview prompting area will land in a follow-up build. This shell confirms the hidden trigger and ownership claim work end to end.</p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
