import { PortalLogo } from "@/components/PortalLogo";

interface Props {
  testId: string;
  className?: string;
  variant?: "full" | "emblem";
  still?: boolean;
}

/** The brand mark is the animated portal everywhere (the old static image logo was removed). */
export function BrandLogo({ testId, className, still }: Props) {
  return <PortalLogo testId={testId} className={className} still={still} />;
}
