// Shared holographic primitives for every Virtual Lab scene.
import { Edges } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { Children, createContext, isValidElement, useContext, useEffect, useMemo, useRef } from "react";
import type { ReactNode } from "react";
import { CanvasTexture, LinearFilter, SRGBColorSpace } from "three";
import type { Group } from "three";

export const HOLO = "#ff2a4a";
export const HOLO_DIM = "#8a1020";
export const WARM = "#ffb347";
export const HOT = "#ff7a00";
export const GREEN = "#52ffa8";
export const VIOLET = "#9d7cff";

export interface SelectInfo {
  title: string;
  lines: string[];
}

export interface LabState {
  playing: boolean;
  speed: number;
  activeStep: number;
  /** extra scene flag (geometry: unfold net) */
  toggle: boolean;
  select: (info: SelectInfo | null) => void;
}

export const LabContext = createContext<LabState>({
  playing: true,
  speed: 1,
  activeStep: -1,
  toggle: false,
  select: () => {},
});

export const useLab = () => useContext(LabContext);

/** Accumulated animation clock honouring play/pause and speed. */
export function useLabClock(): { current: number } {
  const lab = useLab();
  const t = useRef(0);
  useFrame((_s, delta) => {
    if (lab.playing) t.current += Math.min(delta, 0.05) * lab.speed;
  });
  return t;
}

interface HoloProps {
  color?: string;
  opacity?: number;
  emissive?: number;
  edges?: boolean;
  active?: boolean;
  children: ReactNode; // the geometry element
  position?: [number, number, number];
  rotation?: [number, number, number];
  onClick?: () => void;
}

/** Glowing translucent solid with red wire edges. Children = a geometry element. */
export function Holo({ color = HOLO, opacity = 0.28, emissive = 0.9, edges = true, active = false, children, position, rotation, onClick }: HoloProps) {
  return (
    <mesh
      position={position}
      rotation={rotation}
      onClick={
        onClick
          ? (e) => {
              e.stopPropagation();
              onClick();
            }
          : undefined
      }
      onPointerOver={onClick ? () => (document.body.style.cursor = "pointer") : undefined}
      onPointerOut={onClick ? () => (document.body.style.cursor = "auto") : undefined}
    >
      {children}
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={active ? emissive * 1.8 : emissive}
        transparent
        opacity={active ? Math.min(1, opacity + 0.3) : opacity}
        roughness={0.3}
        metalness={0.1}
        depthWrite={false}
      />
      {edges && <Edges threshold={15} color={active ? "#ffffff" : color} />}
    </mesh>
  );
}

/** Flatten React children (strings, numbers, nested spans) into the plain text drawn on the label sprite. */
function toText(node: ReactNode): string {
  if (node === null || node === undefined || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(toText).join("");
  if (isValidElement<{ children?: ReactNode }>(node)) return toText(node.props.children);
  return Children.toArray(node).map(toText).join("");
}

interface LabelProps {
  position: [number, number, number];
  children: ReactNode;
  active?: boolean;
  small?: boolean;
  onClick?: () => void;
}

/**
 * Billboard label rendered as a WebGL sprite from an offscreen canvas — no DOM portals (drei's Html crashes on
 * unmount under React 19), always faces the camera, constant on-screen size.
 */
export function Label({ position, children, active = false, small = false, onClick }: LabelProps) {
  const text = toText(children).replace(/\s+/g, " ").trim();
  const { texture, aspect } = useMemo(() => {
    const px = small ? 26 : 30;
    const pad = 14;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d")!;
    const font = `600 ${px}px "Orbitron Variable", "Inter Variable", sans-serif`;
    ctx.font = font;
    const w = Math.ceil(ctx.measureText(text).width) + pad * 2;
    const h = px + pad * 1.4;
    canvas.width = Math.max(8, w);
    canvas.height = Math.ceil(h);
    ctx.font = font;
    ctx.fillStyle = active ? "rgba(255,42,74,0.35)" : "rgba(15,2,5,0.82)";
    ctx.strokeStyle = active ? "#ffffff" : "rgba(255,42,74,0.75)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(1, 1, canvas.width - 2, canvas.height - 2, 6);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = active ? "#ffffff" : "#ffd9de";
    ctx.textBaseline = "middle";
    ctx.textAlign = "center";
    ctx.fillText(text, canvas.width / 2, canvas.height / 2 + 1);
    const tex = new CanvasTexture(canvas);
    tex.colorSpace = SRGBColorSpace;
    tex.minFilter = LinearFilter;
    tex.needsUpdate = true;
    return { texture: tex, aspect: canvas.width / canvas.height };
  }, [text, active, small]);
  useEffect(() => () => texture.dispose(), [texture]);
  const h = small ? 0.052 : 0.062;
  return (
    <sprite
      position={position}
      scale={[h * aspect, h, 1]}
      onClick={
        onClick
          ? (e) => {
              e.stopPropagation();
              onClick();
            }
          : undefined
      }
      onPointerOver={onClick ? () => (document.body.style.cursor = "pointer") : undefined}
      onPointerOut={onClick ? () => (document.body.style.cursor = "auto") : undefined}
    >
      <spriteMaterial map={texture} transparent depthTest={false} sizeAttenuation={false} />
    </sprite>
  );
}

export function Floor({ y = -2.5, size = 30 }: { y?: number; size?: number }) {
  return <gridHelper args={[size, size, HOLO_DIM, "#3a0a12"]} position={[0, y, 0]} />;
}

export function Lights() {
  return (
    <>
      <ambientLight intensity={0.6} />
      <pointLight position={[6, 8, 6]} intensity={60} color="#ffd6dc" />
      <pointLight position={[-6, -4, -6]} intensity={25} color={HOLO} />
    </>
  );
}

/** Slowly spinning group driven by the lab clock. */
export function Spin({ children, speed = 0.15, axis = "y" }: { children: ReactNode; speed?: number; axis?: "x" | "y" | "z" }) {
  const ref = useRef<Group>(null);
  const lab = useLab();
  useFrame((_s, delta) => {
    if (ref.current && lab.playing) ref.current.rotation[axis] += delta * speed * lab.speed;
  });
  return <group ref={ref}>{children}</group>;
}

export function num(v: unknown, fallback: number): number {
  const n = typeof v === "string" ? parseFloat(v) : (v as number);
  return typeof n === "number" && Number.isFinite(n) ? n : fallback;
}

export function str(v: unknown, fallback: string): string {
  return typeof v === "string" && v.trim() ? v : fallback;
}
