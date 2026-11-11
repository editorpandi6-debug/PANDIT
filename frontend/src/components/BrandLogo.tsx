import { useState } from "react";
import { LOGO_URL } from "@/lib/brand";
import { cn } from "@/lib/utils";

interface Props {
  testId: string;
  className?: string;
  variant?: "full" | "emblem";
}

/** Restored original artwork; preserve the full wordmark without the gold-logo crop. */
export function BrandLogo({ testId, className, variant = "full" }: Props) {
  const [failed, setFailed] = useState(false);
  return (
    <div
      role="img"
      aria-label="PANDI AI MARK II original logo"
      data-testid={testId}
      className={cn("relative shrink-0 overflow-hidden bg-black", variant === "emblem" ? "aspect-square rounded" : "aspect-video", className)}
    >
      {failed ? (
        <span data-testid={`${testId}-fallback`} className="absolute inset-0 flex items-center justify-center font-heading text-[#ffd27a]">P</span>
      ) : (
        <img
          src={LOGO_URL}
          alt=""
          draggable={false}
          decoding="async"
          data-testid={`${testId}-image`}
          onError={() => setFailed(true)}
          className="h-full w-full object-contain"
        />
      )}
    </div>
  );
}