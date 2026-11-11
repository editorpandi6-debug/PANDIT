import { LifeBuoy } from "lucide-react";
import { SUPPORT_EMAIL } from "@/lib/brand";

/** Help button shown on every page; opens the user's email app addressed to support. */
export function SupportButton() {
  return (
    <a
      href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent("Pandi AI Mark 2 support")}`}
      aria-label={`Contact support at ${SUPPORT_EMAIL}`}
      title={`Contact support: ${SUPPORT_EMAIL}`}
      data-testid="support-button"
      className="fixed right-2 top-1.5 z-[60] inline-flex h-6 items-center gap-1 rounded-full border border-[#38e1ff]/50 bg-black/80 px-2.5 text-[11px] font-medium text-[#bff4ff] backdrop-blur hover:border-[#38e1ff] hover:bg-[#38e1ff]/15 hover:text-white"
    >
      <LifeBuoy size={12} /> Help
    </a>
  );
}
