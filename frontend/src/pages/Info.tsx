import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";
import { CreditsFooter } from "@/components/CreditsFooter";
import { APP_FULL_FORM, APP_NAME, CREDITS, SCHOOL_THANKS, SUPPORT_EMAIL } from "@/lib/brand";

function Shell({ title, testId, children }: { title: string; testId: string; children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[#050302] px-4 py-10 text-[#ffe3b8]" data-testid={testId}>
      <div className="mx-auto max-w-2xl">
        <Link to="/" className="inline-flex items-center gap-1 text-xs text-[#d9a66a] hover:text-white" data-testid="page-back-link">
          <ArrowLeft size={13} /> Back to {APP_NAME}
        </Link>
        <header className="mt-6 flex items-center gap-4">
          <BrandLogo testId={`${testId}-logo`} className="w-16" />
          <div>
            <p className="font-heading text-[10px] tracking-[0.3em] text-[#ff8a1f]">{APP_NAME.toUpperCase()}</p>
            <h1 className="font-heading text-xl tracking-[0.12em] text-white" data-testid="page-title">{title}</h1>
          </div>
        </header>
        <main className="mt-8 space-y-6 text-sm leading-relaxed">{children}</main>
        <nav className="mt-10 flex flex-wrap gap-4 border-t border-[#ff8a1f]/20 pt-4 text-xs text-[#d9a66a]">
          <Link to="/about" className="hover:text-white" data-testid="page-link-about">About &amp; team</Link>
          <Link to="/privacy" className="hover:text-white" data-testid="page-link-privacy">Privacy Policy</Link>
          <Link to="/terms" className="hover:text-white" data-testid="page-link-terms">Terms</Link>
          <a href={`mailto:${SUPPORT_EMAIL}`} className="hover:text-white" data-testid="page-link-support">{SUPPORT_EMAIL}</a>
        </nav>
        <CreditsFooter testId="page-footer-credits" className="mt-6" />
      </div>
    </div>
  );
}

function Section({ heading, children }: { heading: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="mb-1.5 font-heading text-xs tracking-[0.2em] text-[#ffd27a]">{heading}</h2>
      <div className="space-y-2 text-[#ffe3b8]/90">{children}</div>
    </section>
  );
}

export function AboutPage() {
  return (
    <Shell title="About & Team" testId="about-page">
      <Section heading="WHAT IT IS">
        <p>
          <b className="text-white">{APP_NAME}</b> — {APP_FULL_FORM}. A personal AI assistant that talks, listens, searches the live web, creates images, analyses files and explains ideas with accurate, interactive 3D.
        </p>
      </Section>
      <Section heading="OUR TEAM">
        <dl className="space-y-2" data-testid="about-team">
          {CREDITS.map((c, i) => (
            <div key={c.role} className="rounded border border-[#ff8a1f]/25 bg-black/40 px-3 py-2" data-testid={`about-team-${i}`}>
              <dt className="text-xs text-[#d9a66a]">{c.role}</dt>
              <dd className="text-base font-medium text-white">{c.name}</dd>
            </div>
          ))}
        </dl>
        <p className="pt-2 text-white" data-testid="about-school-thanks">{SCHOOL_THANKS}</p>
      </Section>
      <Section heading="SUPPORT">
        <p>
          Need help? Email <a className="text-[#38e1ff] underline" href={`mailto:${SUPPORT_EMAIL}`} data-testid="about-support-email">{SUPPORT_EMAIL}</a> or use the Help button at the top of every page.
        </p>
      </Section>
    </Shell>
  );
}

export function PrivacyPage() {
  return (
    <Shell title="Privacy Policy" testId="privacy-page">
      <Section heading="WHAT WE COLLECT">
        <p>Account details you give us (name, email, age, and a parent or guardian email for users under 18), your chats, files you upload for analysis, images and 3D models you create, and your daily credit usage.</p>
        <p>Guests are identified only by a random ID stored in their browser. Passwords are stored as one-way hashes and are never readable by us.</p>
      </Section>
      <Section heading="HOW WE USE IT">
        <p>To answer your questions, keep your chat history, apply age-appropriate safety settings, and enforce daily credit and image limits. We do not sell your personal data.</p>
      </Section>
      <Section heading="SERVICES WE SHARE DATA WITH">
        <p>To produce answers, your messages and uploads are sent to AI providers (OpenAI, Anthropic, Google), voice text to Fish Audio, 3D prompts to Tripo, and search questions to a web search provider. Google handles Google sign-in.</p>
      </Section>
      <Section heading="CHILDREN">
        <p>Users under 18 need a parent or guardian's consent. Child and teen accounts use stricter safety filters for answers, web results and images. A parent or guardian can ask us to delete a child's account at any time.</p>
      </Section>
      <Section heading="MICROPHONE">
        <p>The microphone is used only while you turn it on. Speech is converted to text to send your message; we do not keep voice recordings.</p>
      </Section>
      <Section heading="YOUR CHOICES">
        <p>You can delete chats from the sidebar, and you can ask us to delete your account and data by emailing <a className="text-[#38e1ff] underline" href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.</p>
      </Section>
    </Shell>
  );
}

export function TermsPage() {
  return (
    <Shell title="Terms of Use" testId="terms-page">
      <Section heading="USING PANDI AI MARK 2">
        <p>Use the app lawfully and respectfully. Do not try to create harmful, hateful, sexual or illegal content, and do not attempt to bypass safety filters, credit limits or other people's accounts.</p>
      </Section>
      <Section heading="AI ANSWERS">
        <p>AI answers, live web results, images and 3D visualisations can be wrong or incomplete. They are for learning and general information — not professional medical, legal or financial advice. 3D scenes use an educational scale unless stated otherwise.</p>
      </Section>
      <Section heading="CREDITS">
        <p>Chat is free. Each image uses 5 credits and one daily image slot; each 3D model uses 15 credits. Guests get 10 credits and 2 images a day; signed-in members get 50 credits and 7 images a day. Credits and image slots reset every day at 12:00 AM IST and do not carry over. Failed generations are refunded.</p>
      </Section>
      <Section heading="ACCOUNTS AND AGE">
        <p>Give your real age. Users under 18 may use the app only with a parent or guardian's consent. Keep your password private; you are responsible for activity on your account.</p>
      </Section>
      <Section heading="CONTACT">
        <p>Questions about these terms: <a className="text-[#38e1ff] underline" href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.</p>
      </Section>
    </Shell>
  );
}
