import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Atom,
  AudioLines,
  Box,
  BrainCircuit,
  ChevronRight,
  CircleHelp,
  FileText,
  Globe2,
  History,
  Info,
  Maximize2,
  Mic,
  Move3d,
  Orbit,
  Paperclip,
  Pause,
  Play,
  Plus,
  Radio,
  RotateCcw,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  Upload,
  Volume2,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent, FormEvent, PointerEvent as ReactPointerEvent, ReactNode, WheelEvent as ReactWheelEvent } from "react";
import { toast } from "sonner";

import { apiGet, apiPut, apiStream, apiUpload } from "@/lib/api";
import type {
  ChatHistory,
  ChatMessage,
  FileUploadResponse,
  Profile,
  SceneKey,
  TodayResponse,
} from "@/lib/types";

const INTRO_VIDEO =
  "https://customer-assets-cm19k8pv.emergentagent.net/job_feee3313-d0c0-4676-bacb-c576a9e7f582/artifacts/920bea1d75fb9cfe_Pandi_AI_Mark_II_title_20261006095531.mp4";
const VOICE_SAMPLE =
  "https://customer-assets-gfyr7b9c.emergentagent.net/job_pandi-ai-mark2/artifacts/ae60dfd183297d84_Prototype-2026-10-06-09-44-i-am-paandi-personalized-advanced-neural-data-in%20%281%29.mp3";

type Stage = "loading" | "intro" | "profile" | "mic" | "main";
type InteractionMode = "rotate" | "pan";

const PLANETS = [
  { name: "Mercury", color: "#a8a29e", radius: 36, size: 4, phase: 0.2, fact: "1st planet from the Sun; the smallest planet." },
  { name: "Venus", color: "#e8b86d", radius: 54, size: 6, phase: 1.2, fact: "2nd planet from the Sun; its dense atmosphere traps heat." },
  { name: "Earth", color: "#36a9ff", radius: 76, size: 7, phase: 2.0, fact: "3rd planet from the Sun and home to known life; it has one Moon." },
  { name: "Mars", color: "#ef6348", radius: 98, size: 6, phase: 2.8, fact: "4th planet from the Sun; an iron-rich world with two tiny moons." },
  { name: "Jupiter", color: "#d4a373", radius: 130, size: 12, phase: 3.5, fact: "5th planet from the Sun and the largest planet in the Solar System." },
  { name: "Saturn", color: "#f0c987", radius: 166, size: 10, phase: 4.1, fact: "6th planet from the Sun; its visible rings are made largely of ice and rock." },
  { name: "Uranus", color: "#8ddbd7", radius: 205, size: 8, phase: 5.0, fact: "7th planet from the Sun; an ice giant rotating on its side." },
  { name: "Neptune", color: "#4778e8", radius: 244, size: 8, phase: 5.8, fact: "8th planet from the Sun; a distant ice giant with supersonic winds." },
] as const;

const SCENE_META: Record<SceneKey, { eyebrow: string; title: string; description: string; accent: string }> = {
  "solar-system": {
    eyebrow: "ASTRONOMY / EDUCATIONAL SCALE",
    title: "Solar System",
    description: "Eight planets in the correct order. Distances and sizes use separate educational adjustments so the whole system remains visible and legible.",
    accent: "#ff1e42",
  },
  atom: {
    eyebrow: "CHEMISTRY / QUANTUM MODEL",
    title: "Inside an atom",
    description: "A conceptual probability-cloud model: electrons are shown as orbital regions, not tiny planets on fixed tracks.",
    accent: "#00f0ff",
  },
  geometry: {
    eyebrow: "MATHEMATICS / SOLID GEOMETRY",
    title: "Rotating geometry",
    description: "A labelled cube shows vertices, edges, faces, diagonals, and a dimension line as the object rotates in space.",
    accent: "#ff9500",
  },
  "math-surface": {
    eyebrow: "MATHEMATICS / PARAMETRIC SURFACE",
    title: "A function you can see",
    description: "A lightweight wireframe of z = sin(x) · cos(y), sampled across a coordinate surface for visual reasoning.",
    accent: "#9f7aea",
  },
};

interface Point3 { x: number; y: number; z: number }
interface ProjectedPoint { x: number; y: number; depth: number }

function project(point: Point3, rotationX: number, rotationY: number, zoom: number, panX: number, panY: number, width: number, height: number): ProjectedPoint {
  const yaw = rotationY * (Math.PI / 180);
  const pitch = rotationX * (Math.PI / 180);
  const x1 = point.x * Math.cos(yaw) - point.z * Math.sin(yaw);
  const z1 = point.x * Math.sin(yaw) + point.z * Math.cos(yaw);
  const y1 = point.y * Math.cos(pitch) - z1 * Math.sin(pitch);
  const z2 = point.y * Math.sin(pitch) + z1 * Math.cos(pitch);
  const perspective = 1 + z2 / 900;
  return { x: width / 2 + (x1 / perspective) * zoom + panX, y: height / 2 + (y1 / perspective) * zoom + panY, depth: z2 };
}

function drawLabel(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, color = "#f4f5fb") {
  ctx.font = "600 11px 'JetBrains Mono', monospace";
  ctx.fillStyle = color;
  ctx.shadowColor = "rgba(0,0,0,0.9)";
  ctx.shadowBlur = 5;
  ctx.fillText(text, x + 9, y - 9);
  ctx.shadowBlur = 0;
}

function drawSphere(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color: string, selected = false) {
  const gradient = ctx.createRadialGradient(x - size * 0.35, y - size * 0.35, 1, x, y, size * 1.2);
  gradient.addColorStop(0, "#ffffff");
  gradient.addColorStop(0.18, color);
  gradient.addColorStop(1, "#090a12");
  ctx.beginPath();
  ctx.fillStyle = gradient;
  ctx.shadowColor = color;
  ctx.shadowBlur = selected ? 18 : 8;
  ctx.arc(x, y, size, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  if (selected) {
    ctx.beginPath();
    ctx.strokeStyle = "rgba(255,255,255,0.88)";
    ctx.lineWidth = 1;
    ctx.arc(x, y, size + 5, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function SceneCanvas({ scene, labels, playing, speed, selectedPlanet, onSelectPlanet, onStateChange }: {
  scene: SceneKey;
  labels: boolean;
  playing: boolean;
  speed: number;
  selectedPlanet: string;
  onSelectPlanet: (name: string) => void;
  onStateChange: (mode: InteractionMode) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hitTargets = useRef<{ name: string; x: number; y: number; size: number }[]>([]);
  const [rotationX, setRotationX] = useState(-18);
  const [rotationY, setRotationY] = useState(24);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [mode, setMode] = useState<InteractionMode>("rotate");
  const [clock, setClock] = useState(0);
  const pointer = useRef({ x: 0, y: 0, active: false });

  useEffect(() => {
    onStateChange(mode);
  }, [mode, onStateChange]);

  useEffect(() => {
    if (!playing) return;
    let frame = 0;
    const tick = (time: number) => {
      setClock(time);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const ratio = window.devicePixelRatio || 1;
    canvas.width = rect.width * ratio;
    canvas.height = rect.height * ratio;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(ratio, ratio);
    const width = rect.width;
    const height = rect.height;
    ctx.clearRect(0, 0, width, height);
    const background = ctx.createRadialGradient(width * 0.52, height * 0.4, 10, width * 0.52, height * 0.45, width * 0.75);
    background.addColorStop(0, "#17111c");
    background.addColorStop(0.5, "#0b0c15");
    background.addColorStop(1, "#05060a");
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, width, height);
    for (let i = 0; i < 75; i += 1) {
      const x = (i * 83) % width;
      const y = (i * 47) % height;
      ctx.fillStyle = i % 7 === 0 ? "rgba(255,30,66,0.5)" : "rgba(255,255,255,0.22)";
      ctx.fillRect(x, y, i % 5 === 0 ? 1.5 : 1, i % 5 === 0 ? 1.5 : 1);
    }
    hitTargets.current = [];
    const line = (from: ProjectedPoint, to: ProjectedPoint, color = "rgba(255,255,255,0.32)") => {
      ctx.beginPath();
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(to.x, to.y);
      ctx.stroke();
    };
    const point = (value: Point3) => project(value, rotationX, rotationY, zoom, pan.x, pan.y, width, height);

    if (scene === "solar-system") {
      const orbitClock = clock * speed * 0.00018;
      const center = point({ x: 0, y: 0, z: 0 });
      const sunGradient = ctx.createRadialGradient(center.x - 4, center.y - 6, 2, center.x, center.y, 28);
      sunGradient.addColorStop(0, "#fff7bc");
      sunGradient.addColorStop(0.3, "#ffb000");
      sunGradient.addColorStop(1, "#e33622");
      ctx.beginPath();
      ctx.fillStyle = sunGradient;
      ctx.shadowColor = "#ff4a1f";
      ctx.shadowBlur = 34;
      ctx.arc(center.x, center.y, 20, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      if (labels) drawLabel(ctx, "SUN", center.x, center.y, "#ffbd55");
      PLANETS.forEach((planet) => {
        ctx.beginPath();
        for (let step = 0; step <= 70; step += 1) {
          const theta = (step / 70) * Math.PI * 2;
          const orbitPoint = point({ x: planet.radius * Math.cos(theta), y: 0, z: planet.radius * Math.sin(theta) });
          if (step === 0) ctx.moveTo(orbitPoint.x, orbitPoint.y);
          else ctx.lineTo(orbitPoint.x, orbitPoint.y);
        }
        ctx.strokeStyle = "rgba(255,255,255,0.16)";
        ctx.lineWidth = 1;
        ctx.stroke();
        const theta = planet.phase + orbitClock / Math.sqrt(planet.radius / 36);
        const planetPoint = point({ x: planet.radius * Math.cos(theta), y: 0, z: planet.radius * Math.sin(theta) });
        drawSphere(ctx, planetPoint.x, planetPoint.y, planet.size, planet.color, selectedPlanet === planet.name);
        hitTargets.current.push({ name: planet.name, x: planetPoint.x, y: planetPoint.y, size: planet.size + 10 });
        if (planet.name === "Saturn") {
          ctx.beginPath();
          ctx.strokeStyle = "rgba(242,205,140,0.9)";
          ctx.lineWidth = 2;
          ctx.ellipse(planetPoint.x, planetPoint.y, 17, 5, -0.25, 0, Math.PI * 2);
          ctx.stroke();
        }
        if (planet.name === "Earth") {
          const moonTheta = theta * 4 + orbitClock * 3;
          const moon = point({ x: planet.radius * Math.cos(theta) + 13 * Math.cos(moonTheta), y: 0, z: planet.radius * Math.sin(theta) + 13 * Math.sin(moonTheta) });
          drawSphere(ctx, moon.x, moon.y, 2.2, "#d9e1ee");
          if (labels) drawLabel(ctx, "MOON", moon.x, moon.y, "#cbd5e1");
        }
        if (labels) drawLabel(ctx, planet.name.toUpperCase(), planetPoint.x, planetPoint.y, planet.color);
      });
    }

    if (scene === "atom") {
      const center = point({ x: 0, y: 0, z: 0 });
      [70, 105, 142].forEach((radius, index) => {
        ctx.beginPath();
        ctx.strokeStyle = index === 1 ? "rgba(0,240,255,0.35)" : "rgba(0,240,255,0.16)";
        ctx.lineWidth = 1;
        ctx.ellipse(center.x, center.y, radius * zoom, radius * zoom * 0.43, index * 0.55, 0, Math.PI * 2);
        ctx.stroke();
      });
      const cloud = ctx.createRadialGradient(center.x, center.y, 8, center.x, center.y, 108);
      cloud.addColorStop(0, "rgba(0,240,255,0.52)");
      cloud.addColorStop(0.38, "rgba(0,142,255,0.18)");
      cloud.addColorStop(1, "rgba(0,240,255,0)");
      ctx.beginPath();
      ctx.fillStyle = cloud;
      ctx.arc(center.x, center.y, 108 * zoom, 0, Math.PI * 2);
      ctx.fill();
      drawSphere(ctx, center.x - 11, center.y, 9, "#ff3b5c");
      drawSphere(ctx, center.x + 10, center.y - 4, 9, "#5c6bff");
      drawSphere(ctx, center.x + 3, center.y + 11, 8, "#7a8494");
      if (labels) {
        drawLabel(ctx, "PROTONS", center.x - 25, center.y - 10, "#ff6d85");
        drawLabel(ctx, "NEUTRONS", center.x + 25, center.y + 29, "#a8b2c3");
        drawLabel(ctx, "ELECTRON PROBABILITY CLOUD", center.x + 42, center.y - 82, "#4cefff");
      }
    }

    if (scene === "geometry") {
      const vertices = [
        { x: -88, y: -68, z: -60 }, { x: 88, y: -68, z: -60 }, { x: 88, y: 68, z: -60 }, { x: -88, y: 68, z: -60 },
        { x: -88, y: -68, z: 60 }, { x: 88, y: -68, z: 60 }, { x: 88, y: 68, z: 60 }, { x: -88, y: 68, z: 60 },
      ].map(point);
      const edges = [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]];
      edges.forEach(([a, b]) => line(vertices[a], vertices[b], "rgba(255,149,0,0.72)"));
      line(vertices[0], vertices[6], "rgba(255,255,255,0.6)");
      vertices.forEach((vertex, index) => {
        drawSphere(ctx, vertex.x, vertex.y, 4, "#ff9500");
        if (labels) drawLabel(ctx, `V${index + 1}`, vertex.x, vertex.y, "#ffca70");
      });
      if (labels) {
        drawLabel(ctx, "EDGE = 2a", (vertices[0].x + vertices[1].x) / 2, vertices[0].y, "#f4f5fb");
        drawLabel(ctx, "SPACE DIAGONAL", vertices[3].x + 8, vertices[3].y + 24, "#f4f5fb");
      }
    }

    if (scene === "math-surface") {
      const grid = 13;
      for (let row = 0; row < grid; row += 1) {
        ctx.beginPath();
        for (let col = 0; col < grid; col += 1) {
          const x = -130 + (col / (grid - 1)) * 260;
          const y = -100 + (row / (grid - 1)) * 200;
          const z = Math.sin(x / 36) * Math.cos(y / 31) * 35;
          const projected = point({ x, y, z });
          if (col === 0) ctx.moveTo(projected.x, projected.y);
          else ctx.lineTo(projected.x, projected.y);
        }
        ctx.strokeStyle = "rgba(159,122,234,0.54)";
        ctx.lineWidth = 1;
        ctx.stroke();
      }
      for (let col = 0; col < grid; col += 1) {
        ctx.beginPath();
        for (let row = 0; row < grid; row += 1) {
          const x = -130 + (col / (grid - 1)) * 260;
          const y = -100 + (row / (grid - 1)) * 200;
          const z = Math.sin(x / 36) * Math.cos(y / 31) * 35;
          const projected = point({ x, y, z });
          if (row === 0) ctx.moveTo(projected.x, projected.y);
          else ctx.lineTo(projected.x, projected.y);
        }
        ctx.strokeStyle = "rgba(0,240,255,0.32)";
        ctx.lineWidth = 1;
        ctx.stroke();
      }
      if (labels) {
        const origin = point({ x: 0, y: 0, z: 0 });
        drawLabel(ctx, "z = sin(x) · cos(y)", origin.x + 20, origin.y - 80, "#d5c2ff");
        drawLabel(ctx, "x", origin.x + 135, origin.y + 4, "#4cefff");
        drawLabel(ctx, "y", origin.x - 10, origin.y + 102, "#4cefff");
      }
    }
  }, [scene, labels, playing, speed, selectedPlanet, rotationX, rotationY, zoom, pan, clock]);

  const onPointerDown = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    pointer.current = { x: event.clientX, y: event.clientY, active: true };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const onPointerMove = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!pointer.current.active) return;
    const dx = event.clientX - pointer.current.x;
    const dy = event.clientY - pointer.current.y;
    pointer.current = { x: event.clientX, y: event.clientY, active: true };
    if (mode === "rotate") {
      setRotationY((value) => value + dx * 0.45);
      setRotationX((value) => Math.max(-80, Math.min(80, value + dy * 0.35)));
    } else {
      setPan((value) => ({ x: value.x + dx, y: value.y + dy }));
    }
  };
  const onWheel = (event: ReactWheelEvent<HTMLCanvasElement>) => {
    event.preventDefault();
    setZoom((value) => Math.max(0.55, Math.min(2.2, value - event.deltaY * 0.001)));
  };
  const onPointerUp = () => { pointer.current.active = false; };
  const onCanvasClick = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (scene !== "solar-system") return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const target = hitTargets.current.find((item) => Math.hypot(item.x - x, item.y - y) <= item.size);
    if (target) onSelectPlanet(target.name);
  };
  const reset = () => { setRotationX(-18); setRotationY(24); setZoom(1); setPan({ x: 0, y: 0 }); };

  return (
    <div className="relative h-[min(62vh,560px)] min-h-[340px] overflow-hidden rounded-2xl border border-white/10 bg-[#05060a]" data-testid="explainer-canvas-shell">
      <canvas
        ref={canvasRef}
        className="h-full w-full cursor-grab touch-none active:cursor-grabbing"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onWheel={onWheel}
        onClick={onCanvasClick}
        aria-label="Interactive PANDI educational 3D canvas"
        data-testid="explainer-3d-canvas"
      />
      <div className="pointer-events-none absolute left-4 top-4 flex items-center gap-2 text-[10px] font-mono uppercase tracking-[0.2em] text-white/50" data-testid="explainer-canvas-status">
        <span className="h-2 w-2 animate-pulse rounded-full bg-[#ff1e42]" /> Canvas 3D / {mode} mode
      </div>
      <div className="absolute bottom-4 left-4 flex items-center gap-2 rounded-lg border border-white/10 bg-black/40 px-2 py-1 text-[10px] text-white/50" data-testid="explainer-canvas-hint">
        <Move3d className="h-3 w-3" /> Drag to {mode}; wheel to zoom
      </div>
      <button className="absolute bottom-4 right-4 rounded-lg border border-white/10 bg-black/45 p-2 text-white/70 hover:border-[#ff1e42]/60 hover:text-white" onClick={reset} aria-label="Reset 3D view" data-testid="explainer-reset-button">
        <RotateCcw className="h-4 w-4" />
      </button>
      <div className="absolute right-4 top-4 flex gap-1 rounded-lg border border-white/10 bg-black/45 p-1">
        <button className={`rounded-md p-2 ${mode === "rotate" ? "bg-[#ff1e42] text-white" : "text-white/50 hover:text-white"}`} onClick={() => setMode("rotate")} aria-label="Rotate mode" data-testid="explainer-rotate-mode-button"><RotateCcw className="h-4 w-4" /></button>
        <button className={`rounded-md p-2 ${mode === "pan" ? "bg-[#ff1e42] text-white" : "text-white/50 hover:text-white"}`} onClick={() => setMode("pan")} aria-label="Pan mode" data-testid="explainer-pan-mode-button"><Move3d className="h-4 w-4" /></button>
        <button className="rounded-md p-2 text-white/50 hover:text-white" onClick={() => setZoom((value) => Math.min(2.2, value + 0.15))} aria-label="Zoom in" data-testid="explainer-zoom-in-button"><ZoomIn className="h-4 w-4" /></button>
        <button className="rounded-md p-2 text-white/50 hover:text-white" onClick={() => setZoom((value) => Math.max(0.55, value - 0.15))} aria-label="Zoom out" data-testid="explainer-zoom-out-button"><ZoomOut className="h-4 w-4" /></button>
      </div>
    </div>
  );
}

function ScenePanel({ scene, onClose }: { scene: SceneKey; onClose: () => void }) {
  const [labels, setLabels] = useState(true);
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [selectedPlanet, setSelectedPlanet] = useState("Earth");
  const [mode, setMode] = useState<InteractionMode>("rotate");
  const shellRef = useRef<HTMLDivElement>(null);
  const meta = SCENE_META[scene];
  const selected = PLANETS.find((planet) => planet.name === selectedPlanet) ?? PLANETS[2];
  const immersive = async () => {
    const xr = (navigator as Navigator & { xr?: { isSessionSupported?: (mode: string) => Promise<boolean> } }).xr;
    if (!xr?.isSessionSupported) {
      toast.info("Virtual mode is not available here; PANDI is using interactive desktop 3D.");
      return;
    }
    const supported = await xr.isSessionSupported("immersive-vr").catch(() => false);
    toast.info(supported ? "A compatible immersive device was detected. The lightweight scene remains active here." : "WebXR is unavailable; using interactive desktop 3D fallback.");
  };
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-[#030308]/90 p-3 backdrop-blur-xl sm:p-6" data-testid="explainer-modal">
      <div ref={shellRef} className="mx-auto max-w-7xl rounded-3xl border border-[#ff1e42]/25 bg-[#0b0c14]/95 p-4 shadow-[0_0_70px_rgba(255,30,66,0.18)] sm:p-6">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="mb-2 flex items-center gap-2 text-[10px] font-mono uppercase tracking-[0.25em] text-[#ff667e]" data-testid="explainer-eyebrow"><Orbit className="h-3.5 w-3.5" /> {meta.eyebrow}</div>
            <h2 className="font-heading text-2xl font-bold tracking-tight text-white sm:text-4xl" data-testid="explainer-title">{meta.title}</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-white/55" data-testid="explainer-description">{meta.description}</p>
          </div>
          <div className="flex items-center gap-2">
            <button className="rounded-lg border border-cyan-400/25 bg-cyan-400/5 px-3 py-2 text-[10px] font-mono uppercase tracking-[0.15em] text-cyan-200 hover:bg-cyan-400/10" onClick={immersive} data-testid="explainer-virtual-mode-button"><Radio className="mr-2 inline h-3.5 w-3.5" />Virtual mode</button>
            <button className="rounded-lg border border-white/10 p-2 text-white/60 hover:border-[#ff1e42]/60 hover:text-white" onClick={onClose} aria-label="Close 3D explainer" data-testid="explainer-close-button"><X className="h-5 w-5" /></button>
          </div>
        </div>
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_290px]">
          <SceneCanvas scene={scene} labels={labels} playing={playing} speed={speed} selectedPlanet={selectedPlanet} onSelectPlanet={setSelectedPlanet} onStateChange={setMode} />
          <aside className="rounded-2xl border border-white/10 bg-white/[0.03] p-4" data-testid="explainer-info-panel">
            <div className="mb-4 flex items-center justify-between border-b border-white/10 pb-4"><div className="text-[10px] font-mono uppercase tracking-[0.2em] text-white/40" data-testid="explainer-controls-label">Scene controls</div><span className="text-[10px] text-[#ff667e]" data-testid="explainer-mode-label">{mode}</span></div>
            <div className="space-y-2">
              <button className="flex w-full items-center justify-between rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-white/75 hover:border-[#ff1e42]/50" onClick={() => setPlaying((value) => !value)} data-testid="explainer-play-pause-button">{playing ? <><Pause className="h-4 w-4 text-[#ff667e]" />Pause animation</> : <><Play className="h-4 w-4 text-[#ff667e]" />Play animation</>}</button>
              <button className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-xs ${labels ? "border-cyan-300/40 bg-cyan-300/5 text-cyan-100" : "border-white/10 text-white/55"}`} onClick={() => setLabels((value) => !value)} data-testid="explainer-labels-toggle-button">Labels {labels ? "on" : "off"}<span className="text-[10px]">{labels ? "VISIBLE" : "HIDDEN"}</span></button>
              <label className="block rounded-lg border border-white/10 px-3 py-2" data-testid="explainer-speed-control"><span className="flex justify-between text-xs text-white/60"><span>Orbit speed</span><span>{speed.toFixed(1)}×</span></span><input className="mt-2 w-full accent-[#ff1e42]" type="range" min="0.2" max="3" step="0.1" value={speed} onChange={(event) => setSpeed(Number(event.target.value))} aria-label="Animation speed" data-testid="explainer-speed-slider" /></label>
              <button className="flex w-full items-center justify-between rounded-lg border border-white/10 px-3 py-2 text-xs text-white/60 hover:border-white/25 hover:text-white" onClick={() => shellRef.current?.requestFullscreen().catch(() => undefined)} data-testid="explainer-fullscreen-button"><Maximize2 className="h-4 w-4" />Fullscreen</button>
            </div>
            {scene === "solar-system" ? (
              <div className="mt-5 border-t border-white/10 pt-4" data-testid="planet-info-section">
                <div className="mb-3 text-[10px] font-mono uppercase tracking-[0.2em] text-[#ff667e]">Selected body</div>
                <h3 className="text-lg font-semibold text-white" data-testid="selected-planet-name">{selected.name}</h3>
                <p className="mt-2 text-xs leading-5 text-white/55" data-testid="selected-planet-fact">{selected.fact}</p>
                <div className="mt-3 grid grid-cols-2 gap-1.5">
                  {PLANETS.map((planet) => <button key={planet.name} className={`rounded-md border px-2 py-1.5 text-left text-[10px] ${planet.name === selected.name ? "border-[#ff1e42]/70 bg-[#ff1e42]/10 text-white" : "border-white/10 text-white/45 hover:text-white"}`} onClick={() => setSelectedPlanet(planet.name)} data-testid={`planet-select-${planet.name.toLowerCase()}`}>{planet.name}</button>)}
                </div>
                <p className="mt-4 text-[10px] leading-4 text-white/35" data-testid="solar-scale-note">Scale note: orbital spacing is educationally adjusted. It is not physical scale.</p>
              </div>
            ) : (
              <div className="mt-5 rounded-xl border border-white/10 bg-black/20 p-3 text-xs leading-5 text-white/55" data-testid="scene-accuracy-note"><ShieldCheck className="mb-2 h-4 w-4 text-[#ff1e42]" />This model is designed to teach relationships clearly without claiming that a screen-sized drawing is physically to scale.</div>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}

function IntroScreen({ onSkip }: { onSkip: () => void }) {
  const [videoError, setVideoError] = useState(false);
  return (
    <div className="relative min-h-svh overflow-hidden bg-[#030308]" data-testid="intro-screen">
      <video className="absolute inset-0 h-full w-full object-cover opacity-55" src={INTRO_VIDEO} autoPlay muted playsInline onEnded={onSkip} onError={() => setVideoError(true)} data-testid="intro-title-video" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,30,66,0.2),transparent_42%),linear-gradient(90deg,#030308_0%,transparent_42%,#030308_100%)]" />
      <div className="relative z-10 flex min-h-svh flex-col justify-between p-6 sm:p-12">
        <div className="flex items-center justify-between"><div className="flex items-center gap-3" data-testid="intro-brand-lockup"><span className="h-3 w-3 animate-pulse rounded-full bg-[#ff1e42] shadow-[0_0_20px_#ff1e42]" /><span className="text-xs font-mono uppercase tracking-[0.3em] text-white/70">PANDI / MARK II</span></div><button className="rounded-full border border-white/20 bg-black/30 px-4 py-2 text-[10px] font-mono uppercase tracking-[0.2em] text-white/75 hover:border-[#ff1e42] hover:text-white" onClick={onSkip} data-testid="skip-intro-button">Skip intro <ChevronRight className="ml-1 inline h-3 w-3" /></button></div>
        <div className="max-w-xl"><div className="mb-5 text-[10px] font-mono uppercase tracking-[0.28em] text-[#ff667e]" data-testid="intro-eyebrow">Personalized Advanced Neural Digital Intelligence</div><h1 className="font-heading text-5xl font-black tracking-[-0.06em] text-white sm:text-7xl" data-testid="intro-title">PANDI<span className="text-[#ff1e42]">.</span><br /><span className="text-white/55">MARK II</span></h1><p className="mt-5 max-w-md text-sm leading-6 text-white/55" data-testid="intro-copy">A visual intelligence system built to show you the answer — not just tell you.</p>{videoError && <p className="mt-4 flex items-center gap-2 text-xs text-amber-200" data-testid="intro-video-fallback"><AlertTriangle className="h-4 w-4" /> Title reveal unavailable. Continuing with the PANDI onboarding.</p>}</div>
        <div className="flex items-end justify-between gap-5"><div className="max-w-xs"><div className="mb-2 text-[10px] font-mono uppercase tracking-[0.2em] text-white/35" data-testid="intro-voice-label">Official PANDI voice / intro asset</div><audio controls className="h-8 w-72 max-w-full" src={VOICE_SAMPLE} data-testid="intro-voice-player" /></div><div className="text-right text-[10px] font-mono uppercase tracking-[0.2em] text-white/35" data-testid="intro-creator-credit">Created by VIGNASHWAR S.</div></div>
      </div>
    </div>
  );
}

function LoadingScreen() {
  return <div className="flex min-h-svh items-center justify-center bg-[#030308] text-white" data-testid="loading-screen"><div className="text-center"><div className="mx-auto mb-5 h-14 w-14 animate-pulse rounded-full border border-[#ff1e42] shadow-[0_0_35px_rgba(255,30,66,0.6)]" /><div className="text-[10px] font-mono uppercase tracking-[0.3em] text-[#ff667e]" data-testid="loading-status">Restoring PANDI profile</div></div></div>;
}

function ProfileStep({ onSaved }: { onSaved: (profile: Profile) => void }) {
  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState<string | null>(null);
  const profileMutation = useMutation({ mutationFn: ({ profileId, payload }: { profileId: string; payload: { name: string; avatar_data_url: string | null } }) => apiPut<Profile>(`/pandi/profile/${profileId}`, payload), onSuccess: onSaved });
  const onAvatar = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setAvatar(typeof reader.result === "string" ? reader.result : null);
    reader.readAsDataURL(file);
  };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return;
    profileMutation.mutate({ profileId: crypto.randomUUID(), payload: { name: name.trim(), avatar_data_url: avatar } });
  };
  return <div className="relative flex min-h-svh items-center justify-center overflow-hidden bg-[#05050a] p-5" data-testid="profile-step"><div className="absolute -left-20 top-1/4 h-72 w-72 rounded-full bg-[#ff1e42]/10 blur-3xl" /><form onSubmit={submit} className="relative w-full max-w-lg rounded-3xl border border-[#ff1e42]/25 bg-[#0c0d14]/85 p-7 shadow-[0_0_70px_rgba(255,30,66,0.12)] backdrop-blur-xl sm:p-10"><div className="mb-8 flex items-center gap-3"><div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[#ff1e42]/40 bg-[#ff1e42]/10 text-[#ff667e]"><Sparkles className="h-5 w-5" /></div><div><div className="text-[10px] font-mono uppercase tracking-[0.2em] text-[#ff667e]" data-testid="profile-eyebrow">Identity handshake</div><div className="text-xs text-white/40" data-testid="profile-step-count">01 / 03</div></div></div><h1 className="font-heading text-4xl font-bold tracking-tight text-white" data-testid="profile-title">What should I call you?</h1><p className="mt-3 text-sm leading-6 text-white/50" data-testid="profile-description">Your name personalizes the command deck. You can reset it any time from your profile.</p><label className="mt-8 block text-[10px] font-mono uppercase tracking-[0.2em] text-white/45" htmlFor="pandi-name">Display name</label><input id="pandi-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Enter your name" className="mt-2 h-13 w-full rounded-xl border border-white/10 bg-black/25 px-4 text-base text-white outline-none placeholder:text-white/25 focus:border-[#ff1e42]/70" autoFocus data-testid="profile-name-input" /><div className="mt-5 flex items-center gap-4"><label className="flex h-16 w-16 cursor-pointer items-center justify-center overflow-hidden rounded-2xl border border-dashed border-white/20 bg-white/[0.03] text-white/35 hover:border-[#ff1e42]/60" data-testid="profile-avatar-upload"><input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={onAvatar} data-testid="profile-avatar-input" />{avatar ? <img src={avatar} alt="Profile preview" className="h-full w-full object-cover" data-testid="profile-avatar-preview" /> : <Upload className="h-5 w-5" />}</label><div><div className="text-sm text-white/70" data-testid="profile-avatar-label">Optional profile picture</div><div className="text-xs text-white/35" data-testid="profile-avatar-help">PNG, JPG, or WEBP</div></div></div><button type="submit" disabled={!name.trim() || profileMutation.isPending} className="mt-9 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#ff1e42] text-sm font-bold text-white shadow-[0_0_24px_rgba(255,30,66,0.3)] transition hover:bg-[#ff3b5c] disabled:cursor-not-allowed disabled:opacity-40" data-testid="profile-continue-button">{profileMutation.isPending ? "Saving profile…" : "Continue to PANDI"}<ChevronRight className="h-4 w-4" /></button>{profileMutation.isError && <p className="mt-3 text-xs text-red-300" data-testid="profile-error">Profile save failed. Please try again.</p>}</form></div>;
}

function MicStep({ onFinish }: { onFinish: () => void }) {
  const [status, setStatus] = useState("Microphone is optional. Text mode is always available.");
  const requestMic = async () => {
    if (!navigator.mediaDevices?.getUserMedia) { setStatus("Microphone access is unavailable here. Text mode is ready."); return; }
    try { const stream = await navigator.mediaDevices.getUserMedia({ audio: true }); stream.getTracks().forEach((track) => track.stop()); setStatus("Microphone permission granted. Voice input is ready when a voice service is connected."); } catch { setStatus("Microphone permission was skipped. Text mode remains fully available."); }
  };
  return <div className="flex min-h-svh items-center justify-center bg-[#05050a] p-5" data-testid="mic-step"><div className="w-full max-w-lg text-center"><div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full border border-[#ff1e42]/45 bg-[#ff1e42]/10 shadow-[0_0_50px_rgba(255,30,66,0.28)]"><Mic className="h-9 w-9 text-[#ff667e]" /></div><div className="mt-8 text-[10px] font-mono uppercase tracking-[0.25em] text-[#ff667e]" data-testid="mic-eyebrow">Voice channel / optional</div><h1 className="mt-3 font-heading text-4xl font-bold text-white" data-testid="mic-title">Give PANDI a listening channel</h1><p className="mx-auto mt-4 max-w-md text-sm leading-6 text-white/50" data-testid="mic-description">Microphone access is optional. The text assistant works without it, and no permission is stored by PANDI.</p><button className="mt-8 rounded-xl border border-[#ff1e42]/50 bg-[#ff1e42]/10 px-5 py-3 text-sm font-semibold text-white hover:bg-[#ff1e42]/20" onClick={requestMic} data-testid="mic-permission-button"><Mic className="mr-2 inline h-4 w-4" />Request microphone</button><p className="mt-4 min-h-5 text-xs text-white/40" data-testid="mic-status">{status}</p><button className="mt-8 text-xs font-mono uppercase tracking-[0.2em] text-white/50 hover:text-white" onClick={onFinish} data-testid="mic-finish-button">Enter main interface <ChevronRight className="ml-1 inline h-3 w-3" /></button></div></div>;
}

function ExploreCard({ scene, icon, label, description, onOpen }: { scene: SceneKey; icon: ReactNode; label: string; description: string; onOpen: (scene: SceneKey) => void }) {
  return <button className="group relative min-h-[132px] overflow-hidden rounded-2xl border border-white/10 bg-[#11121b] p-4 text-left transition duration-300 hover:-translate-y-1 hover:border-[#ff1e42]/55 hover:bg-[#17131d] hover:shadow-[0_12px_38px_rgba(255,30,66,0.14)]" onClick={() => onOpen(scene)} data-testid={`showcase-card-${scene}`}><div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-[#ff1e42]/10 blur-2xl transition group-hover:bg-[#ff1e42]/20" /><div className="relative flex items-start justify-between"><span className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#ff1e42]/25 bg-[#ff1e42]/10 text-[#ff667e]" data-testid={`showcase-icon-${scene}`}>{icon}</span><ChevronRight className="h-4 w-4 text-white/25 transition group-hover:translate-x-1 group-hover:text-[#ff667e]" /></div><div className="relative mt-4 text-sm font-semibold text-white" data-testid={`showcase-label-${scene}`}>{label}</div><div className="relative mt-1 text-xs leading-5 text-white/40" data-testid={`showcase-description-${scene}`}>{description}</div></button>;
}

function MainAssistant({ profile, onReset }: { profile: Profile; onReset: () => void }) {
  const queryClient = useQueryClient();
  const sessionIdRef = useRef(localStorage.getItem("pandi-session-id") ?? crypto.randomUUID());
  const sessionId = sessionIdRef.current;
  useEffect(() => localStorage.setItem("pandi-session-id", sessionId), [sessionId]);
  const [scene, setScene] = useState<SceneKey | null>(null);
  const [message, setMessage] = useState("");
  const [liveSearch, setLiveSearch] = useState(true);
  const [language, setLanguage] = useState("auto");
  const [localMessages, setLocalMessages] = useState<ChatMessage[]>([]);
  const [streamingText, setStreamingText] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [voicePanel, setVoicePanel] = useState(false);
  const [micStatus, setMicStatus] = useState("Text mode online");
  const [files, setFiles] = useState<FileUploadResponse[]>([]);
  const historyQuery = useQuery({ queryKey: ["pandi-history", sessionId], queryFn: () => apiGet<ChatHistory>(`/pandi/history/${sessionId}`) });
  const todayQuery = useQuery({ queryKey: ["pandi-today"], queryFn: () => apiGet<TodayResponse>("/pandi/today"), staleTime: 60_000 });
  const healthQuery = useQuery({ queryKey: ["pandi-health"], queryFn: () => apiGet<{ status: string; assistant: string }>("/pandi/health"), retry: false });
  const uploadMutation = useMutation({ mutationFn: (file: File) => apiUpload<FileUploadResponse>("/pandi/files", file), onSuccess: (uploaded) => { setFiles((current) => [...current, uploaded]); toast.success(`${uploaded.filename} is ready for analysis.`); }, onError: () => toast.error("This file could not be prepared for analysis.") });

  const sendMutation = useMutation({
    mutationFn: async ({ text, fileIds }: { text: string; fileIds: string[] }) => {
      setStreaming(true); setStreamingText("");
      const response = await apiStream("/pandi/chat/stream", { session_id: sessionId, message: text, language, use_live_search: liveSearch, file_ids: fileIds });
      if (!response.body) throw new Error("No stream body");
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let content = "";
      const processChunk = (chunk: string) => {
        const blocks = chunk.split("\n\n");
        buffer = blocks.pop() ?? "";
        blocks.forEach((block) => {
          let event = "message"; let data = "";
          block.split("\n").forEach((line) => { if (line.startsWith("event:")) event = line.slice(6).trim(); if (line.startsWith("data:")) data += line.slice(5).trim(); });
          if (!data) return;
          const payload = JSON.parse(data) as { text?: string; message?: string; visual_scene?: SceneKey | null };
          if (event === "delta" && payload.text) { content += payload.text; setStreamingText(content); }
          if (event === "meta" && payload.visual_scene) setScene(payload.visual_scene);
          if (event === "done" && payload.visual_scene) setScene(payload.visual_scene);
          if (event === "error") throw new Error(payload.message ?? "PANDI could not respond.");
        });
      };
      while (true) { const { value, done } = await reader.read(); if (done) break; processChunk(decoder.decode(value, { stream: true })); }
      processChunk(buffer + "\n\n");
      if (!content) throw new Error("PANDI returned an empty response.");
      return content;
    },
    onSuccess: () => { setStreaming(false); setStreamingText(""); setLocalMessages([]); setFiles([]); void queryClient.invalidateQueries({ queryKey: ["pandi-history", sessionId] }); },
    onError: (error) => { setStreaming(false); setStreamingText(""); toast.error(error instanceof Error ? error.message : "PANDI could not respond."); },
  });

  const messages = useMemo(() => [...(historyQuery.data?.messages ?? []), ...localMessages], [historyQuery.data?.messages, localMessages]);
  const submit = (event: FormEvent) => { event.preventDefault(); const text = message.trim() || (files.length ? "Please analyze the uploaded files and summarize the key findings." : ""); if (!text || streaming) return; const localUser: ChatMessage = { id: crypto.randomUUID(), session_id: sessionId, role: "user", content: text, created_at: new Date().toISOString(), live_search: liveSearch, sources: [], visual_scene: null }; setLocalMessages([localUser]); setMessage(""); sendMutation.mutate({ text, fileIds: files.map((file) => file.file_id) }); };
  const upload = (event: ChangeEvent<HTMLInputElement>) => { const selected = Array.from(event.target.files ?? []); selected.forEach((file) => uploadMutation.mutate(file)); event.target.value = ""; };
  const requestMic = async () => { if (!navigator.mediaDevices?.getUserMedia) { setMicStatus("Microphone unavailable; text mode is active."); return; } try { const stream = await navigator.mediaDevices.getUserMedia({ audio: true }); stream.getTracks().forEach((track) => track.stop()); setMicStatus("Permission granted; speech recognition needs a connected voice service."); } catch { setMicStatus("Microphone permission denied; text mode is active."); } };
  const reset = () => { localStorage.removeItem("pandi-profile-id"); localStorage.removeItem("pandi-session-id"); onReset(); };
  return <div className="min-h-svh bg-[#06060a] text-white" data-testid="main-assistant">
    <header className="sticky top-0 z-30 border-b border-white/10 bg-[#06060a]/85 px-4 py-3 backdrop-blur-xl sm:px-6" data-testid="main-header"><div className="mx-auto flex max-w-[1500px] items-center justify-between gap-4"><div className="flex items-center gap-3"><div className="relative flex h-9 w-9 items-center justify-center rounded-xl border border-[#ff1e42]/50 bg-[#ff1e42]/10"><span className="h-3 w-3 animate-pulse rounded-full bg-[#ff1e42] shadow-[0_0_15px_#ff1e42]" /></div><div><div className="text-xs font-bold tracking-[0.22em] text-white" data-testid="header-brand">PANDI <span className="text-[#ff1e42]">AI</span> / MARK II</div><div className="text-[9px] font-mono uppercase tracking-[0.18em] text-white/35" data-testid="header-subtitle">Visual intelligence command deck</div></div></div><div className="hidden items-center gap-4 md:flex"><div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-[0.15em] text-white/40" data-testid="system-date"><span className="h-1.5 w-1.5 rounded-full bg-cyan-300" />{todayQuery.data?.today ?? "Synchronizing date"}</div><div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-[0.15em] text-white/40" data-testid="system-status"><span className={`h-1.5 w-1.5 rounded-full ${healthQuery.isError ? "bg-amber-400" : "bg-emerald-400"}`} />{healthQuery.isError ? "degraded" : "systems nominal"}</div></div><div className="flex items-center gap-2"><button className="rounded-lg border border-white/10 p-2 text-white/55 hover:border-[#ff1e42]/50 hover:text-white" onClick={() => setAboutOpen(true)} aria-label="About PANDI" data-testid="about-button"><Info className="h-4 w-4" /></button><button className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-2 py-1.5 text-xs text-white/70 hover:border-[#ff1e42]/50" onClick={reset} data-testid="profile-menu-button">{profile.avatar_data_url ? <img src={profile.avatar_data_url} alt="" className="h-6 w-6 rounded-md object-cover" /> : <span className="flex h-6 w-6 items-center justify-center rounded-md bg-[#ff1e42]/15 text-[#ff667e]">{profile.name.slice(0, 1).toUpperCase()}</span>}<span className="hidden sm:inline">{profile.name}</span></button></div></div></header>
    <main className="mx-auto grid max-w-[1500px] gap-5 p-4 sm:p-6 lg:grid-cols-[210px_minmax(0,1fr)_280px]">
      <aside className="hidden space-y-3 lg:block" data-testid="left-sidebar"><button className="flex w-full items-center gap-2 rounded-xl border border-[#ff1e42]/45 bg-[#ff1e42]/10 px-3 py-3 text-xs font-semibold text-white hover:bg-[#ff1e42]/20" onClick={() => { setLocalMessages([]); void queryClient.invalidateQueries({ queryKey: ["pandi-history", sessionId] }); }} data-testid="new-chat-button"><Plus className="h-4 w-4" /> New conversation</button><div className="rounded-xl border border-white/10 bg-white/[0.02] p-3"><div className="mb-3 flex items-center gap-2 text-[10px] font-mono uppercase tracking-[0.2em] text-white/35" data-testid="history-label"><History className="h-3 w-3" /> History</div><div className="rounded-lg bg-white/[0.03] px-3 py-2 text-xs text-white/55" data-testid="history-current-item">Current session</div></div><div className="rounded-xl border border-white/10 bg-[#0c0d14] p-3"><div className="text-[10px] font-mono uppercase tracking-[0.2em] text-[#ff667e]" data-testid="sidebar-mode-label">Primary mode</div><div className="mt-2 text-sm font-semibold text-white" data-testid="sidebar-mode-value">Show me the answer</div><p className="mt-2 text-xs leading-5 text-white/35" data-testid="sidebar-mode-help">Ask naturally. PANDI chooses text, live search, or a visual explainer when it helps.</p></div></aside>
      <section className="min-w-0 space-y-5"><div className="relative overflow-hidden rounded-3xl border border-[#ff1e42]/20 bg-[radial-gradient(circle_at_50%_20%,rgba(255,30,66,0.18),transparent_38%),#0c0d14] p-5 sm:p-7" data-testid="reactor-hero"><div className="absolute -right-28 -top-28 h-72 w-72 rounded-full bg-[#ff1e42]/10 blur-3xl" /><div className="relative flex flex-col items-center gap-5 sm:flex-row sm:items-center"><div className="relative flex h-32 w-32 shrink-0 items-center justify-center rounded-full border border-[#ff1e42]/40 bg-[#08080e] shadow-[0_0_35px_rgba(255,30,66,0.35),inset_0_0_22px_rgba(255,59,92,0.6)]"><div className="absolute inset-3 animate-[spin_14s_linear_infinite] rounded-full border border-dashed border-[#ff1e42]/40" /><div className="absolute inset-7 rounded-full border border-cyan-300/20" /><div className="h-12 w-12 rounded-full bg-[#ff1e42]/80 shadow-[0_0_30px_#ff1e42]" /><div className="absolute bottom-1 text-[8px] font-mono tracking-[0.25em] text-white/50">CORE</div></div><div className="text-center sm:text-left"><div className="mb-2 flex items-center justify-center gap-2 text-[10px] font-mono uppercase tracking-[0.23em] text-[#ff667e] sm:justify-start" data-testid="reactor-eyebrow"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#ff1e42]" /> PANDI 3D Explainer Engine / ready</div><h1 className="font-heading text-3xl font-bold tracking-tight text-white sm:text-4xl" data-testid="welcome-heading">Good to see you, {profile.name}.</h1><p className="mt-2 max-w-xl text-sm leading-6 text-white/50" data-testid="welcome-copy">Don’t just ask PANDI. See the answer. Start with a showcase question or ask anything below.</p><button className="mt-4 rounded-lg border border-[#ff1e42]/45 bg-[#ff1e42]/10 px-3 py-2 text-[10px] font-mono uppercase tracking-[0.15em] text-white hover:bg-[#ff1e42]/20" onClick={() => setScene("solar-system")} data-testid="virtual-3d-button"><Orbit className="mr-2 inline h-3.5 w-3.5 text-[#ff667e]" />Open virtual 3D</button></div></div></div>
        <div><div className="mb-3 flex items-end justify-between"><div><div className="text-[10px] font-mono uppercase tracking-[0.25em] text-[#ff667e]" data-testid="showcase-eyebrow">Explore PANDI in 3D</div><h2 className="mt-1 text-xl font-semibold text-white" data-testid="showcase-title">See the answer in space</h2></div><div className="hidden text-[10px] font-mono uppercase tracking-[0.15em] text-white/25 sm:block" data-testid="showcase-hint">Four guided scenes / interactive</div></div><div className="grid gap-3 sm:grid-cols-2"><ExploreCard scene="atom" icon={<Atom className="h-5 w-5" />} label="How does an atom look? 🔬" description="Explore orbitals as probability clouds, not tiny planet paths." onOpen={setScene} /><ExploreCard scene="solar-system" icon={<Orbit className="h-5 w-5" />} label="How does a solar system look? 🌌" description="Navigate all eight planets in the correct order." onOpen={setScene} /><ExploreCard scene="geometry" icon={<Box className="h-5 w-5" />} label="Can you solve this difficult 3D maths problem? 📐" description="Rotate a labelled solid and inspect its geometry." onOpen={setScene} /><ExploreCard scene="math-surface" icon={<BrainCircuit className="h-5 w-5" />} label="Can you visualize an advanced maths problem in 3D? 🧠" description="See a function surface emerge from coordinate samples." onOpen={setScene} /></div></div>
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#0c0d14]" data-testid="chat-panel"><div className="flex items-center justify-between border-b border-white/10 px-4 py-3"><div className="flex items-center gap-2"><div className="h-2 w-2 rounded-full bg-emerald-400" /><span className="text-xs font-semibold text-white" data-testid="chat-panel-title">Conversation channel</span>{liveSearch && <span className="flex items-center gap-1 rounded-full border border-cyan-300/20 bg-cyan-300/5 px-2 py-1 text-[9px] font-mono uppercase tracking-[0.14em] text-cyan-200" data-testid="live-search-indicator"><Globe2 className="h-3 w-3" /> Live web ready</span>}</div><button className="text-white/40 hover:text-white" onClick={() => setVoicePanel((value) => !value)} aria-label="Open voice controls" data-testid="voice-controls-toggle"><AudioLines className="h-4 w-4" /></button></div><div className="max-h-[410px] min-h-[190px] space-y-4 overflow-y-auto p-4" data-testid="chat-message-list">{historyQuery.isLoading && <div className="text-xs text-white/35" data-testid="chat-history-loading">Restoring conversation…</div>}{!historyQuery.isLoading && !messages.length && <div className="flex h-40 flex-col items-center justify-center text-center"><CircleHelp className="h-7 w-7 text-[#ff1e42]/65" /><p className="mt-3 text-sm text-white/60" data-testid="chat-empty-state">Ask a question or launch a 3D scene above.</p><p className="mt-1 text-xs text-white/30" data-testid="chat-empty-hint">Try “Show me the Solar System.”</p></div>}{messages.map((item) => <div key={item.id} className={`flex ${item.role === "user" ? "justify-end" : "justify-start"}`} data-testid={`chat-message-${item.role}`}><div className={`max-w-[88%] rounded-2xl px-4 py-3 text-sm leading-6 ${item.role === "user" ? "rounded-br-sm bg-[#ff1e42] text-white" : "rounded-bl-sm border border-white/10 bg-white/[0.04] text-white/75"}`}><div className="whitespace-pre-wrap" data-testid={`chat-message-content-${item.role}`}>{item.content}</div>{item.sources.length > 0 && <div className="mt-3 border-t border-white/10 pt-2 text-[10px] text-cyan-200" data-testid="message-sources">Sources: {item.sources.map((source) => <a key={source.url} href={source.url} target="_blank" rel="noreferrer" className="ml-1 underline">{source.url}</a>)}</div>}</div></div>)}{streaming && <div className="flex justify-start"><div className="max-w-[88%] rounded-2xl rounded-bl-sm border border-[#ff1e42]/20 bg-white/[0.04] px-4 py-3 text-sm leading-6 text-white/75" data-testid="chat-streaming-response">{streamingText || <span className="animate-pulse text-white/40">PANDI is thinking…</span>}</div></div>}</div><form className="border-t border-white/10 p-3" onSubmit={submit} data-testid="chat-composer-form"><div className="mb-2 flex flex-wrap items-center gap-2">{files.map((file) => <span key={file.file_id} className="flex items-center gap-1 rounded-md border border-[#ff1e42]/30 bg-[#ff1e42]/10 px-2 py-1 text-[10px] text-white/70" data-testid="attached-file-chip"><FileText className="h-3 w-3" />{file.filename}<button type="button" onClick={() => setFiles((current) => current.filter((item) => item.file_id !== file.file_id))} aria-label={`Remove ${file.filename}`} data-testid="remove-file-button"><X className="h-3 w-3" /></button></span>)}</div><div className="flex items-end gap-2 rounded-xl border border-white/10 bg-black/20 p-2 focus-within:border-[#ff1e42]/50"><label className="cursor-pointer rounded-lg p-2 text-white/45 hover:bg-white/5 hover:text-white" aria-label="Upload a file"><input type="file" multiple accept=".pdf,.doc,.docx,.txt,.csv,.xls,.xlsx,.png,.jpg,.jpeg,.webp,.mp3,.wav,.mp4" className="hidden" onChange={upload} data-testid="file-upload-input" /><Paperclip className="h-4 w-4" /></label><textarea value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Ask PANDI anything…" rows={1} className="max-h-28 min-h-10 flex-1 resize-none bg-transparent px-2 py-2 text-sm text-white outline-none placeholder:text-white/25" onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); submit(event); } }} data-testid="chat-message-input" /><button type="submit" disabled={streaming || (!message.trim() && !files.length)} className="rounded-lg bg-[#ff1e42] p-2.5 text-white shadow-[0_0_15px_rgba(255,30,66,0.25)] transition hover:bg-[#ff3b5c] disabled:cursor-not-allowed disabled:opacity-35" aria-label="Send message" data-testid="chat-send-button"><Send className="h-4 w-4" /></button></div><div className="mt-2 flex items-center justify-between gap-2"><label className="flex items-center gap-2 text-[10px] text-white/35" data-testid="live-search-toggle-label"><input type="checkbox" checked={liveSearch} onChange={(event) => setLiveSearch(event.target.checked)} className="accent-[#ff1e42]" data-testid="live-search-toggle" /> Use live web when current information matters</label><div className="flex items-center gap-2"><select value={language} onChange={(event) => setLanguage(event.target.value)} className="bg-transparent text-[10px] text-white/35 outline-none" aria-label="Response language" data-testid="language-selector"><option value="auto">Auto language</option><option value="en">English</option><option value="ta">தமிழ்</option><option value="hi">हिन्दी</option><option value="ml">മലയാളം</option><option value="te">తెలుగు</option><option value="es">Español</option></select><span className="text-[10px] text-white/25" data-testid="chat-safety-note">Text remains available if any service fails</span></div></div></form></div></section>
      <aside className="space-y-4" data-testid="right-sidebar"><div className="rounded-2xl border border-[#ff1e42]/20 bg-[#0c0d14] p-4" data-testid="voice-panel"><div className="flex items-center justify-between"><div className="flex items-center gap-2 text-xs font-semibold text-white"><Volume2 className="h-4 w-4 text-[#ff667e]" /> Official voice</div><span className="rounded-full border border-amber-300/20 bg-amber-300/5 px-2 py-1 text-[9px] font-mono uppercase text-amber-200" data-testid="voice-status-badge">Intro asset</span></div><p className="mt-3 text-xs leading-5 text-white/40" data-testid="voice-panel-copy">The supplied PANDI voice track is available for onboarding and replay. Dynamic multilingual synthesis is not connected, so PANDI will never substitute a system voice.</p><audio controls className="mt-3 h-8 w-full" src={VOICE_SAMPLE} data-testid="main-voice-replay" /><button className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs text-white/60 hover:border-[#ff1e42]/50 hover:text-white" onClick={requestMic} data-testid="voice-mic-trigger"><Mic className="h-4 w-4" /> {micStatus}</button></div><div className="rounded-2xl border border-white/10 bg-[#0c0d14] p-4" data-testid="live-search-panel"><div className="flex items-center gap-2 text-xs font-semibold text-white"><Search className="h-4 w-4 text-cyan-300" /> Live information</div><p className="mt-3 text-xs leading-5 text-white/40" data-testid="live-search-copy">Current answers use server date {todayQuery.data?.today ?? "from the secure clock"} and web grounding when enabled. If search fails, PANDI says so.</p><div className="mt-3 flex items-center gap-2 text-[10px] font-mono uppercase tracking-[0.15em] text-emerald-300" data-testid="live-search-status"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> {liveSearch ? "Search enabled" : "Search off"}</div></div><div className="rounded-2xl border border-cyan-300/15 bg-cyan-300/[0.03] p-4" data-testid="reliability-panel"><div className="flex items-center gap-2 text-xs font-semibold text-white"><ShieldCheck className="h-4 w-4 text-cyan-300" /> Failure boundaries</div><p className="mt-3 text-xs leading-5 text-white/40" data-testid="reliability-copy">3D, live search, files, voice, and media can fail independently. Your text channel stays usable.</p></div></aside>
    </main>
    {scene && <ScenePanel scene={scene} onClose={() => setScene(null)} />}
    {aboutOpen && <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/75 p-5 backdrop-blur-md" role="dialog" aria-modal="true" data-testid="about-modal"><div className="relative w-full max-w-md rounded-3xl border border-[#ff1e42]/30 bg-[#0c0d14] p-7 shadow-[0_0_70px_rgba(255,30,66,0.18)]"><button className="absolute right-4 top-4 text-white/40 hover:text-white" onClick={() => setAboutOpen(false)} aria-label="Close about" data-testid="about-close-button"><X className="h-5 w-5" /></button><div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#ff1e42]/10 text-[#ff667e] shadow-[0_0_25px_rgba(255,30,66,0.25)]"><Sparkles className="h-6 w-6" /></div><div className="text-[10px] font-mono uppercase tracking-[0.24em] text-[#ff667e]" data-testid="about-eyebrow">About the intelligence</div><h2 className="mt-2 font-heading text-3xl font-bold text-white" data-testid="about-title">PANDI AI MARK II</h2><p className="mt-3 text-sm text-white/55" data-testid="about-full-form">Personalized Advanced Neural Digital Intelligence</p><div className="mt-6 border-t border-white/10 pt-4 text-xs font-mono uppercase tracking-[0.18em] text-white/35" data-testid="about-creator">Created by <span className="text-white/80">VIGNASHWAR S.</span></div></div></div>}
  </div>;
}

export default function Home() {
  const [profileId, setProfileId] = useState(() => localStorage.getItem("pandi-profile-id"));
  const [profile, setProfile] = useState<Profile | null>(null);
  const [stage, setStage] = useState<Stage>(() => (localStorage.getItem("pandi-profile-id") ? "loading" : "intro"));
  const profileQuery = useQuery({ queryKey: ["pandi-profile", profileId], queryFn: () => apiGet<Profile>(`/pandi/profile/${profileId}`), enabled: Boolean(profileId), retry: false });
  useEffect(() => { if (profileQuery.data && stage === "loading") { setProfile(profileQuery.data); setStage("main"); } else if (profileQuery.isError) { localStorage.removeItem("pandi-profile-id"); setProfileId(null); setStage("intro"); } }, [profileQuery.data, profileQuery.isError, stage]);
  if (stage === "loading") return <LoadingScreen />;
  if (stage === "intro") return <IntroScreen onSkip={() => setStage("profile")} />;
  if (stage === "profile") return <ProfileStep onSaved={(saved) => { localStorage.setItem("pandi-profile-id", saved.profile_id); setProfileId(saved.profile_id); setProfile(saved); setStage("mic"); }} />;
  if (stage === "mic") return <MicStep onFinish={() => setStage("main")} />;
  if (!profile) return <LoadingScreen />;
  return <MainAssistant profile={profile} onReset={() => { setProfile(null); setProfileId(null); setStage("intro"); }} />;
}