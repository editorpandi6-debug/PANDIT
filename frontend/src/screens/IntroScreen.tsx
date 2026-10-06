import { useEffect, useRef, useState } from "react";
import { SkipForward } from "lucide-react";
import { ArcReactor } from "@/components/ArcReactor";
import { HoloBackground } from "@/components/HoloBackground";

const BOOT_LINES = ["INITIALIZING NEURAL CORE", "LOADING HOLOGRAM ENGINE", "CALIBRATING VOICE MATRIX", "LINKING LIVE DATA FEEDS", "PANDI AI MARK II ONLINE"];

/** Generated cinematic intro used when the video file is missing or cannot play: red hologram boot-up, logo assembling. */
function AnimatedIntro({ onDone }: { onDone: () => void }) {
  const [line, setLine] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setLine((l) => Math.min(BOOT_LINES.length - 1, l + 1)), 900);
    const end = window.setTimeout(onDone, 6200);
    return () => {
      window.clearInterval(id);
      window.clearTimeout(end);
    };
  }, [onDone]);
  const letters = "PANDI AI MARK II".split("");
  return (
    <div className="relative flex h-full w-full items-center justify-center overflow-hidden" data-testid="intro-animated">
      <HoloBackground particles={40} />
      <div className="relative flex flex-col items-center">
        <div className="relative mb-10 flex items-center justify-center">
          {[0, 1, 2].map((i) => (
            <div key={i} className="boot-ring absolute rounded-full border border-[#ff2a4a]/60" style={{ width: 200 + i * 70, height: 200 + i * 70, animationDelay: `${i * 0.25}s`, borderStyle: i === 1 ? "dashed" : "solid" }} />
          ))}
          <div className="assemble">
            <ArcReactor size={150} mode="thinking" testId="intro-animated-reactor" beam />
          </div>
        </div>
        <h1 className="flex gap-[0.12em] font-heading text-2xl font-bold tracking-[0.2em] text-white glow-text sm:text-4xl">
          {letters.map((ch, i) => (
            <span key={i} className="assemble inline-block" style={{ animationDelay: `${0.6 + i * 0.07}s`, minWidth: ch === " " ? "0.5em" : undefined }}>
              {ch}
            </span>
          ))}
        </h1>
        <p className="assemble mt-3 font-heading text-[10px] tracking-[0.45em] text-[#ff2a4a]" style={{ animationDelay: "1.9s" }}>
          THE HOLOGRAM INTELLIGENCE
        </p>
        <p className="mt-10 font-heading text-[10px] tracking-[0.3em] text-[#ffb0bc]" data-testid="intro-boot-line">
          <span className="mr-2 inline-block h-1.5 w-1.5 rounded-full bg-[#ff2a4a] animate-blink" />
          {BOOT_LINES[line]}
        </p>
        <div className="mt-3 h-[2px] w-56 overflow-hidden rounded bg-[#ff2a4a]/15">
          <div className="h-full bg-[#ff2a4a] shadow-[0_0_10px_#ff2a4a] transition-[width] duration-700" style={{ width: `${((line + 1) / BOOT_LINES.length) * 100}%` }} />
        </div>
      </div>
    </div>
  );
}

/** Full-screen title-card intro. Ends, errors or Skip/Esc/Space all lead to onDone — the app never waits on media. */
export function IntroScreen({ onDone }: { onDone: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [fading, setFading] = useState(false);
  const [fallback, setFallback] = useState(false);
  const doneRef = useRef(false);

  const finish = () => {
    if (doneRef.current) return;
    doneRef.current = true;
    setFading(true);
    window.setTimeout(onDone, 500);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === " " || e.code === "Space") {
        e.preventDefault();
        finish();
      }
    };
    window.addEventListener("keydown", onKey);
    const safety = window.setTimeout(finish, 45_000); // never hang on a stalled video
    const v = videoRef.current;
    v?.play().catch(() => setFallback(true)); // autoplay blocked or unsupported codec → generated intro
    return () => {
      window.removeEventListener("keydown", onKey);
      window.clearTimeout(safety);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className={`fixed inset-0 z-50 bg-black transition-opacity duration-500 ${fading ? "opacity-0" : "opacity-100"}`} data-testid="intro-screen">
      {fallback ? (
        <AnimatedIntro onDone={finish} />
      ) : (
        <video ref={videoRef} src="/assets/intro.mp4" className="h-full w-full object-contain" playsInline autoPlay onEnded={finish} onError={() => setFallback(true)} data-testid="intro-video" />
      )}
      <button
        type="button"
        onClick={finish}
        data-testid="intro-skip-button"
        className="absolute right-4 top-4 z-10 inline-flex items-center gap-2 rounded border border-[#ff2a4a]/60 bg-black/60 px-4 py-2 font-heading text-[11px] tracking-[0.25em] text-white backdrop-blur hover:bg-[#ff2a4a]/25 hover:shadow-[0_0_16px_rgba(255,42,74,0.5)]"
      >
        SKIP <SkipForward size={14} />
      </button>
      <p className="pointer-events-none absolute bottom-4 left-1/2 z-10 -translate-x-1/2 text-[10px] tracking-[0.3em] text-[#7d4f58]">ESC / SPACE TO SKIP</p>
    </div>
  );
}
