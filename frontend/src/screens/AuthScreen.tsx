import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { BrandLogo } from "@/components/BrandLogo";
import { CreditsFooter } from "@/components/CreditsFooter";
import { HoloBackground } from "@/components/HoloBackground";
import { ApiError, apiPost } from "@/lib/api";
import { APP_FULL_FORM } from "@/lib/brand";
import type { AuthUser, LoginRequest, RegisterRequest } from "@/lib/types";

interface Props {
  onAuthed: (user: AuthUser) => void;
  onGuest: () => void;
}

function errorText(err: unknown): string {
  if (err instanceof ApiError) {
    const body = err.body as { detail?: unknown } | null;
    if (typeof body?.detail === "string") return body.detail;
    if (err.status === 422) return "Please check your details: a valid email, a name of 2–20 characters and a password of at least 8 characters.";
  }
  return "Could not reach the server. Please try again.";
}

const field = "h-11 w-full rounded border border-[#ff8a1f]/35 bg-black/50 px-3 text-white placeholder:text-[#7a4a22] focus:border-[#ff8a1f] focus:outline-none";

export function AuthScreen({ onAuthed, onGuest }: Props) {
  const [tab, setTab] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");

  const submit = useMutation({
    mutationFn: () =>
      tab === "login"
        ? apiPost<AuthUser>("/auth/login", { email, password } satisfies LoginRequest)
        : apiPost<AuthUser>("/auth/register", { email, password, name: name.trim() } satisfies RegisterRequest),
    onSuccess: onAuthed,
  });

  const google = () => {
    // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
    const redirectUrl = `${window.location.origin}/`;
    window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10" data-testid="auth-screen">
      <HoloBackground />
      <div className="screen-enter relative z-10 flex w-full max-w-md flex-col items-center text-center">
        <BrandLogo testId="auth-logo" className="mb-5 w-36 sm:w-44" />
        <h1 className="font-heading text-2xl font-bold tracking-[0.2em] text-white glow-text sm:text-3xl" data-testid="auth-title">
          PANDI AI MARK 2
        </h1>
        <p className="mt-2 text-xs text-[#d9a66a]">{APP_FULL_FORM}</p>

        <div className="hud-panel hud-corners mt-7 w-full rounded-md p-4 text-left">
          <span className="hud-c" />
          <button type="button" onClick={google} data-testid="auth-google-button" className="flex h-11 w-full items-center justify-center gap-2 rounded border border-white/40 bg-white/95 text-sm font-medium text-[#1f1f1f] hover:bg-white">
            <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
              <path fill="#4285F4" d="M22.5 12.2c0-.8-.1-1.5-.2-2.2H12v4.2h5.9a5 5 0 0 1-2.2 3.3v2.7h3.5c2.1-1.9 3.3-4.7 3.3-8z" />
              <path fill="#34A853" d="M12 23c3 0 5.500-1 7.300-2.700l-3.500-2.700c-1 .700-2.300 1.100-3.800 1.100-2.900 0-5.300-1.900-6.200-4.600H2.200v2.800A11 11 0 0 0 12 23z" />
              <path fill="#FBBC05" d="M5.800 14.100a6.600 6.600 0 0 1 0-4.200V7.100H2.200a11 11 0 0 0 0 9.800l3.600-2.800z" />
              <path fill="#EA4335" d="M12 5.400c1.600 0 3.100.600 4.200 1.600l3.100-3.100A11 11 0 0 0 2.200 7.100l3.600 2.800C6.700 7.300 9.100 5.400 12 5.400z" />
            </svg>
            Continue with Google
          </button>

          <div className="my-4 flex items-center gap-3 text-[10px] tracking-[0.25em] text-[#7a4a22]">
            <span className="h-px flex-1 bg-[#ff8a1f]/20" /> OR EMAIL <span className="h-px flex-1 bg-[#ff8a1f]/20" />
          </div>

          <div className="mb-3 grid grid-cols-2 gap-1 rounded border border-[#ff8a1f]/30 bg-black/40 p-0.5" role="tablist">
            {(["login", "register"] as const).map((t) => (
              <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => { setTab(t); submit.reset(); }} data-testid={`auth-tab-${t}`} className={`rounded py-1.5 font-heading text-[10px] tracking-[0.2em] ${tab === t ? "bg-[#ff8a1f]/25 text-white" : "text-[#d9a66a] hover:text-white"}`}>
                {t === "login" ? "SIGN IN" : "CREATE ACCOUNT"}
              </button>
            ))}
          </div>

          <form
            className="flex flex-col gap-2.5"
            onSubmit={(e) => {
              e.preventDefault();
              submit.mutate();
            }}
          >
            {tab === "register" && <input value={name} onChange={(e) => setName(e.target.value)} required minLength={2} maxLength={20} placeholder="Your name (2–20 characters)" aria-label="Your name" autoComplete="name" data-testid="auth-name-input" className={field} />}
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="Email" aria-label="Email" autoComplete="email" data-testid="auth-email-input" className={field} />
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={tab === "register" ? 8 : 1} placeholder={tab === "register" ? "Password (at least 8 characters)" : "Password"} aria-label="Password" autoComplete={tab === "register" ? "new-password" : "current-password"} data-testid="auth-password-input" className={field} />
            {submit.isError && (
              <p role="alert" className="text-xs text-[#ff9d9d]" data-testid="auth-error">
                {errorText(submit.error)}
              </p>
            )}
            <button type="submit" disabled={submit.isPending} data-testid="auth-submit-button" className="h-11 rounded border border-[#ff8a1f] bg-[#ff8a1f]/20 font-heading text-xs tracking-[0.25em] text-white hover:bg-[#ff8a1f]/35 disabled:opacity-50">
              {submit.isPending ? "PLEASE WAIT…" : tab === "login" ? "SIGN IN" : "CREATE ACCOUNT"}
            </button>
          </form>
        </div>

        <button type="button" onClick={onGuest} data-testid="auth-guest-button" className="mt-4 h-11 w-full rounded border border-[#ff8a1f]/50 bg-black/40 text-sm text-[#ffe3b8] hover:border-[#ff8a1f] hover:text-white">
          Continue as guest
        </button>
        <p className="mt-2 text-xs text-[#d9a66a]" data-testid="auth-limits-note">
          Guests get 10 credits and 2 images a day. Signed-in members get 50 credits and 7 images a day.
        </p>

        <nav className="mt-6 flex gap-4 text-xs text-[#d9a66a]">
          <Link to="/about" className="hover:text-white" data-testid="auth-link-about">About &amp; team</Link>
          <Link to="/privacy" className="hover:text-white" data-testid="auth-link-privacy">Privacy Policy</Link>
          <Link to="/terms" className="hover:text-white" data-testid="auth-link-terms">Terms</Link>
        </nav>
        <CreditsFooter testId="auth-footer-credits" className="mt-5" />
      </div>
    </div>
  );
}
