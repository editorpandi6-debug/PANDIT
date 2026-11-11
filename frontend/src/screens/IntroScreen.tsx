import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Play, SkipForward, Volume2, VolumeX } from "lucide-react";
import { ArcReactor } from "@/components/ArcReactor";
import { HoloBackground } from "@/components/HoloBackground";
import { apiGet } from "@/lib/api";
import { INTRO_VIDEO_FALLBACK_URL, INTRO_VIDEO_URL } from "@/lib/brand";
import type { IntroVideoResponse } from "@/lib/types";

const BOOT_LINES = ["INITIALIZING NEURAL CORE", "LOADING HOLOGRAM ENGINE", "CALIBRATING VOICE MATRIX", "LINKING LIVE DATA FEEDS", "PANDI AI MARK II ONLINE"];

/** Generated cinematic intro used when the video file is missing or cannot play: hologram boot-up, logo assembling. */
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
            <div key={i} className="boot-ring absolute rounded-full border border-[#ff8a1f]/60" style={{ width: 200 + i * 70, height: 200 + i * 70, animationDelay: `${i * 0.25}s`, borderStyle: i === 1 ? "dashed" : "solid" }} />
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
        <p className="assemble mt-3 font-heading text-[10px] tracking-[0.45em] text-[#ff8a1f]" style={{ animationDelay: "1.9s" }}>
          THE HOLOGRAM INTELLIGENCE
        </p>
        <p className="mt-10 font-heading text-[10px] tracking-[0.3em] text-[#ffd27a]" data-testid="intro-boot-line">
          <span className="mr-2 inline-block h-1.5 w-1.5 rounded-full bg-[#ff8a1f] animate-blink" />
          {BOOT_LINES[line]}
        </p>
        <div className="mt-3 h-[2px] w-56 overflow-hidden rounded bg-[#ff8a1f]/15">
          <div className="h-full bg-[#ff8a1f] shadow-[0_0_10px_#ff8a1f] transition-[width] duration-700" style={{ width: `${((line + 1) / BOOT_LINES.length) * 100}%` }} />
        </div>
      </div>
    </div>
  );
}

/** Full-screen title-card intro: muted autoplay (browser-safe), sound toggle, Skip/Esc/Space — never blocks the app on media. */
export function IntroScreen({ onDone }: { onDone: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [fading, setFading] = useState(false);
  const [fallback, setFallback] = useState(false);
  const [muted, setMuted] = useState(true);
  const [needsPlay, setNeedsPlay] = useState(false);
  const [useWebm, setUseWebm] = useState(() => !document.createElement("video").canPlayType('video/mp4; codecs="avc1.64001f, mp4a.40.2"'));
  const doneRef = useRef(false);
  const video = useQuery({ queryKey: ["intro-video"], queryFn: () => apiGet<IntroVideoResponse>("/pandi/settings/intro-video"), staleTime: 60_000 });
  const videoUrl = video.data?.video_url || INTRO_VIDEO_URL;
  const playbackUrl = videoUrl === INTRO_VIDEO_URL && useWebm ? INTRO_VIDEO_FALLBACK_URL : videoUrl;

  const mediaFailure = () => {
    if (videoUrl === INTRO_VIDEO_URL && !useWebm) setUseWebm(true);
    else setFallback(true);
  };

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
    // Only time out stalled playback, not a longer video that is still progressing.
    let lastProgress = performance.now();
    let lastTime = 0;
    const safety = window.setInterval(() => {
      const currentTime = videoRef.current?.currentTime ?? 0;
      if (currentTime !== lastTime) {
        lastTime = currentTime;
        lastProgress = performance.now();
      }
      if (performance.now() - lastProgress > 20_000) finish();
    }, 1000);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.clearInterval(safety);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (fallback) return;
    let active = true;
    const v = videoRef.current;
    v?.play().catch((error: DOMException) => {
      if (!active || error.name === "AbortError") return;
      if (error.name === "NotAllowedError") setNeedsPlay(true);
      else mediaFailure();
    });
    return () => { active = false; };
    // Media callbacks belong to the current source, not a superseded play promise.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playbackUrl, fallback]);

  const toggleSound = () => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    setMuted(v.muted);
    if (!v.muted) v.play().catch(() => undefined);
  };

  const showVideo = !fallback;

  return (
    <div className={`fixed inset-0 z-50 bg-black transition-opacity duration-500 ${fading ? "opacity-0" : "opacity-100"}`} data-testid="intro-screen">
      {showVideo ? (
        <video
          ref={videoRef}
          src={playbackUrl}
          preload="auto"
          className="h-full w-full object-contain"
          playsInline
          autoPlay
          muted
          onEnded={finish}
          onPlaying={() => setNeedsPlay(false)}
          onError={mediaFailure}
          data-testid="intro-video"
        />
      ) : (
        <AnimatedIntro onDone={finish} />
      )}
      {showVideo && needsPlay && (
        <button
          type="button"
          data-testid="intro-play-button"
          onClick={() => videoRef.current?.play().catch(mediaFailure)}
          className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center gap-2 rounded border border-[#ff8a1f]/60 bg-black/80 px-5 py-3 text-white transition-colors hover:bg-[#ff8a1f]/30"
        >
          <Play size={18} /> Play intro
        </button>
      )}
      <div className="absolute right-4 top-4 z-10 flex items-center gap-2">
        {showVideo && (
          <button
            type="button"
            onClick={toggleSound}
            data-testid="intro-sound-toggle"
            aria-label={muted ? "Unmute" : "Mute"}
            className="inline-flex items-center justify-center rounded border border-[#ff8a1f]/60 bg-black/60 p-2 text-white backdrop-blur hover:bg-[#ff8a1f]/25"
          >
            {muted ? <VolumeX size={14} /> : <Volume2 size={14} />}
          </button>
        )}
        <button
          type="button"
          onClick={finish}
          data-testid="intro-skip-button"
          className="inline-flex items-center gap-2 rounded border border-[#ff8a1f]/60 bg-black/60 px-4 py-2 font-heading text-[11px] tracking-[0.25em] text-white backdrop-blur hover:bg-[#ff8a1f]/25 hover:shadow-[0_0_16px_rgba(255, 138, 31,0.5)]"
        >
          SKIP <SkipForward size={14} />
        </button>
      </div>
      <p className="pointer-events-none absolute bottom-4 left-1/2 z-10 -translate-x-1/2 text-[10px] tracking-[0.3em] text-[#7a4a22]">ESC / SPACE TO SKIP</p>
    </div>
  );
}
