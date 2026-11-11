import { CREDITS, SCHOOL_THANKS } from "@/lib/brand";
import { cn } from "@/lib/utils";

/** Contributor acknowledgements, separate from the planned usage-credit balance. */
export function CreditsFooter({ testId, className }: { testId: string; className?: string }) {
  return (
    <footer aria-label="Pandi AI Mark 2 credits" data-testid={testId} className={cn("text-center text-[10px] leading-relaxed text-[#d9a66a]", className)}>
      <dl className="flex flex-wrap justify-center gap-x-4 gap-y-1">
        {CREDITS.map((credit, index) => (
          <div key={credit.role} className="inline-flex flex-wrap justify-center gap-x-1" data-testid={`${testId}-contributor-${index}`}>
            <dt data-testid={`${testId}-role-${index}`}>{credit.role}</dt>
            <dd className="font-medium text-[#ffe3b8]" data-testid={`${testId}-name-${index}`}>{credit.name}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-1 text-[#b88a55]" data-testid={`${testId}-school-thanks`}>{SCHOOL_THANKS}</p>
    </footer>
  );
}