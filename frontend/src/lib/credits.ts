import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api";
import type { CreditStatus } from "@/lib/types";

export const creditsKey = (profileId: string) => ["credits", profileId] as const;

/** Server-owned daily credits. `secondsLeft` counts down locally and refetches at the 00:00 IST reset. */
export function useCredits(profileId: string) {
  const query = useQuery({
    queryKey: creditsKey(profileId),
    queryFn: () => apiGet<CreditStatus>(`/credits/status/${profileId}`),
    refetchInterval: 60_000,
  });
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 15_000);
    return () => window.clearInterval(id);
  }, []);
  const secondsLeft = query.data ? Math.max(0, query.data.seconds_to_reset - Math.floor((now - query.dataUpdatedAt) / 1000)) : null;
  const { refetch } = query;
  useEffect(() => {
    if (secondsLeft === 0) void refetch();
  }, [secondsLeft, refetch]);
  return { status: query.data, secondsLeft, isError: query.isError };
}

export function formatCountdown(seconds: number | null): string {
  if (seconds === null) return "—";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${Math.max(1, m)}m`;
}
