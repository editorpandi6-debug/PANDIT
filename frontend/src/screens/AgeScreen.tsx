import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { BrandLogo } from "@/components/BrandLogo";
import { HoloBackground } from "@/components/HoloBackground";
import { ApiError, apiPut } from "@/lib/api";
import type { AgeUpdate, AuthUser } from "@/lib/types";

interface Props {
  user: AuthUser;
  onDone: (user: AuthUser) => void;
  onSignOut: () => void;
}

const AGES = Array.from({ length: 71 }, (_v, i) => i + 5); // 5 … 75 (75 = "75+")
const field = "h-11 w-full rounded border border-[#ff8a1f]/35 bg-[#050302] px-3 text-white placeholder:text-[#7a4a22] focus:border-[#ff8a1f] focus:outline-none";

/** Asked once after Google or email sign-in. Under 18 needs a parent/guardian email and their consent. */
export function AgeScreen({ user, onDone, onSignOut }: Props) {
  const [age, setAge] = useState<number | "">(user.age ?? "");
  const [parentEmail, setParentEmail] = useState(user.parent_email ?? "");
  const [consent, setConsent] = useState(false);
  const minor = age !== "" && age < 18;

  const save = useMutation({
    mutationFn: () => apiPut<AuthUser>("/auth/age", { age: Number(age), parent_email: minor ? parentEmail.trim() : null, parent_consent: minor ? consent : false } satisfies AgeUpdate),
    onSuccess: onDone,
  });
  const detail = save.error instanceof ApiError ? (save.error.body as { detail?: unknown } | null)?.detail : null;

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10" data-testid="age-screen">
      <HoloBackground />
      <form
        className="screen-enter hud-panel hud-corners relative z-10 w-full max-w-md rounded-md p-5"
        onSubmit={(e) => {
          e.preventDefault();
          if (age !== "") save.mutate();
        }}
      >
        <span className="hud-c" />
        <BrandLogo testId="age-logo" className="mx-auto mb-4 w-20" />
        <h1 className="text-center font-heading text-base tracking-[0.2em] text-white" data-testid="age-title">
          HOW OLD ARE YOU, {user.name.toUpperCase()}?
        </h1>
        <p className="mt-2 text-center text-xs text-[#d9a66a]">Pandi AI Mark 2 uses your age to keep answers, web results and images suitable for you.</p>

        <label className="mt-5 block text-xs text-[#ffe3b8]">
          Your age
          <select value={age} onChange={(e) => setAge(e.target.value === "" ? "" : Number(e.target.value))} required data-testid="age-select" className={`${field} mt-1`}>
            <option value="">Select your age</option>
            {AGES.map((a) => (
              <option key={a} value={a}>
                {a === 75 ? "75+" : a}
              </option>
            ))}
          </select>
        </label>

        {minor && (
          <div className="mt-4 rounded border border-[#38e1ff]/40 bg-[#38e1ff]/5 p-3" data-testid="parent-consent-block">
            <p className="text-xs text-[#bff4ff]">Because you are under 18, a parent or guardian must agree before you can use this account.</p>
            <label className="mt-3 block text-xs text-[#ffe3b8]">
              Parent or guardian email
              <input type="email" value={parentEmail} onChange={(e) => setParentEmail(e.target.value)} required placeholder="parent@example.com" data-testid="parent-email-input" className={`${field} mt-1`} />
            </label>
            <label className="mt-3 flex items-start gap-2 text-xs text-[#ffe3b8]">
              <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} data-testid="parent-consent-checkbox" className="mt-0.5 h-4 w-4 accent-[#38e1ff]" />
              <span>I am the parent or guardian. I have read the Privacy Policy and Terms and I give consent for my child to use Pandi AI Mark 2 with child-safe settings.</span>
            </label>
          </div>
        )}

        {save.isError && (
          <p role="alert" className="mt-3 text-xs text-[#ff9d9d]" data-testid="age-error">
            {typeof detail === "string" ? detail : "Could not save. Please check the details and try again."}
          </p>
        )}

        <button type="submit" disabled={age === "" || save.isPending || (minor && (!consent || !parentEmail.trim()))} data-testid="age-continue-button" className="mt-5 h-11 w-full rounded border border-[#ff8a1f] bg-[#ff8a1f]/20 font-heading text-xs tracking-[0.25em] text-white hover:bg-[#ff8a1f]/35 disabled:cursor-not-allowed disabled:opacity-40">
          {save.isPending ? "SAVING…" : "CONTINUE"}
        </button>
        <button type="button" onClick={onSignOut} data-testid="age-signout-button" className="mt-2 w-full text-center text-xs text-[#d9a66a] hover:text-white">
          Sign out
        </button>
      </form>
    </div>
  );
}
