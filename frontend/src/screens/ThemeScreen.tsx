import { ArcReactor } from "@/components/ArcReactor";
import { HoloBackground } from "@/components/HoloBackground";
import { KEYS, storage } from "@/lib/storage";
import { VAJRA_FILTER, type InterfaceTheme } from "@/lib/theme";

const CARDS: { id: InterfaceTheme; title: string; tagline: string; filter?: string; accent: string }[] = [
  { id: "agni", title: "AGNI PORTAL", tagline: "Fire-forged ring, embers and sparks on pure black.", accent: "#ff8a1f" },
  { id: "vajra", title: "VAJRA CORE", tagline: "Jarvis-style holographic HUD in electric blue and cyan.", filter: VAJRA_FILTER, accent: "#00d4ff" },
];

/** "Choose your interface" — two live-preview cards; the choice can be changed later in Settings. */
export function ThemeScreen({ onDone }: { onDone: (theme: InterfaceTheme) => void }) {
  const choose = (theme: InterfaceTheme) => {
    storage.set(KEYS.interfaceTheme, theme);
    storage.set(KEYS.onboardingDone, "1");
    onDone(theme);
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10" data-testid="theme-screen">
      <HoloBackground />
      <div className="screen-enter relative z-10 flex w-full max-w-3xl flex-col items-center text-center">
        <h2 className="font-heading text-lg tracking-[0.3em] text-white glow-text sm:text-xl">CHOOSE YOUR INTERFACE</h2>
        <p className="mt-2 text-sm text-[#ffe3b8]">Pick the look of PANDI AI. You can switch anytime from Settings.</p>
        <div className="mt-8 grid w-full gap-5 sm:grid-cols-2">
          {CARDS.map((card) => (
            <button
              key={card.id}
              type="button"
              onClick={() => choose(card.id)}
              data-testid={`theme-card-${card.id}`}
              className="hud-panel hud-corners group flex flex-col items-center rounded-lg p-6 text-left transition-transform hover:-translate-y-1 hover:shadow-[0_0_30px_rgba(255,255,255,0.08)]"
              style={{ filter: card.filter }}
            >
              <span className="hud-c" />
              <ArcReactor size={110} mode="thinking" testId={`theme-preview-reactor-${card.id}`} beam />
              <h3 className="mt-5 font-heading text-sm tracking-[0.3em] text-white glow-text">{card.title}</h3>
              <p className="mt-2 text-xs text-[#ffe3b8]">{card.tagline}</p>
              <span className="mt-4 inline-flex items-center gap-2 rounded border px-4 py-1.5 font-heading text-[10px] tracking-[0.25em] text-white" style={{ borderColor: card.accent, background: `${card.accent}22` }}>
                SELECT
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
