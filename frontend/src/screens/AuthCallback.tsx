import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { PortalLogo } from "@/components/PortalLogo";
import { apiPost } from "@/lib/api";
import { adoptUser } from "@/lib/identity";
import { queryClient } from "@/lib/queryClient";
import { KEYS, storage } from "@/lib/storage";
import type { AuthUser, GoogleSessionRequest } from "@/lib/types";

/** Returning from Google sign-in: exchange the one-time session_id (URL fragment) for a session cookie. */
export function AuthCallback() {
  const location = useLocation();
  const navigate = useNavigate();
  const processed = useRef(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (processed.current) return;
    processed.current = true;
    const sessionId = new URLSearchParams(location.hash.replace(/^#/, "")).get("session_id") ?? "";
    apiPost<AuthUser>("/auth/google/session", { session_id: sessionId } satisfies GoogleSessionRequest)
      .then((user) => {
        queryClient.clear();
        adoptUser(user);
        storage.session.set(KEYS.introPending, "1");
        navigate("/", { replace: true });
      })
      .catch(() => setFailed(true));
  }, [location.hash, navigate]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-black px-4 text-center" data-testid="auth-callback">
      <PortalLogo testId="auth-callback-logo" className="w-24" mode="thinking" />
      {failed ? (
        <>
          <p className="text-sm text-[#ff9d9d]" data-testid="auth-callback-error">Google sign-in could not be completed.</p>
          <button type="button" onClick={() => navigate("/", { replace: true })} data-testid="auth-callback-retry" className="rounded border border-[#ff8a1f] bg-[#ff8a1f]/20 px-4 py-2 text-sm text-white hover:bg-[#ff8a1f]/35">
            Back to sign-in
          </button>
        </>
      ) : (
        <p className="font-heading text-[11px] tracking-[0.3em] text-[#ffd27a]">SIGNING YOU IN…</p>
      )}
    </div>
  );
}
