// Procedural scene renderer: builds any concept from the LLM's JSON list of labelled shapes.
import { Line } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import type { Group } from "three";
import { Floor, HOLO, Holo, Label, num, useLab, useLabClock } from "../holo";
import type { CustomObject } from "@/lib/types";
import { getVoiceLevel } from "@/lib/voice";

function sizeOf(size: CustomObject["size"]): [number, number, number] {
  if (Array.isArray(size)) return [num(size[0], 1), num(size[1], 1), num(size[2], 1)];
  const s = num(size, 1);
  return [s, s, s];
}

function Geometry({ shape, size }: { shape: string; size: [number, number, number] }) {
  const [sx, sy, sz] = size;
  switch (shape) {
    case "box":
      return <boxGeometry args={[sx, sy, sz]} />;
    case "cylinder":
      return <cylinderGeometry args={[sx / 2, sx / 2, sy, 32]} />;
    case "cone":
      return <coneGeometry args={[sx / 2, sy, 32]} />;
    case "torus":
      return <torusGeometry args={[sx / 2, Math.max(0.05, sy / 6), 12, 48]} />;
    case "ring":
      return <ringGeometry args={[sx / 2.6, sx / 2, 48]} />;
    case "capsule":
      return <capsuleGeometry args={[sx / 2, sy, 6, 16]} />;
    case "octahedron":
      return <octahedronGeometry args={[sx / 2, 0]} />;
    case "icosahedron":
      return <icosahedronGeometry args={[sx / 2, 0]} />;
    case "plane":
      return <planeGeometry args={[sx, sy]} />;
    case "sphere":
    default:
      return <sphereGeometry args={[sx / 2, 28, 28]} />;
  }
}

function Item({ obj, index }: { obj: CustomObject; index: number }) {
  const lab = useLab();
  const ref = useRef<Group>(null);
  const clock = useLabClock();
  const base = useMemo<[number, number, number]>(() => {
    const p = obj.position ?? [0, 0, 0];
    return [num(p[0], 0), num(p[1], 0), num(p[2], 0)];
  }, [obj.position]);
  const size = sizeOf(obj.size);
  const speed = num(obj.speed, 1);
  const anim = obj.animation ?? "none";
  const orbitR = num(obj.orbitRadius, Math.hypot(base[0], base[2]) || 2);
  const phase = index * 1.3;
  useFrame(() => {
    const g = ref.current;
    if (!g) return;
    const t = clock.current * speed;
    const ex = 1 + lab.explode * 1.4;
    g.position.set(base[0] * ex, base[1] * ex, base[2] * ex);
    g.rotation.set(0, 0, 0);
    g.scale.setScalar(1);
    if (anim === "rotate") g.rotation.y = t;
    else if (anim === "orbit") g.position.set(Math.cos(t * 0.6 + phase) * orbitR * ex, base[1] * ex, Math.sin(t * 0.6 + phase) * orbitR * ex);
    else if (anim === "pulse") g.scale.setScalar(1 + 0.12 * Math.sin(t * 3 + phase));
    else if (anim === "bounce") g.position.y = base[1] * ex + Math.abs(Math.sin(t * 2 + phase)) * 0.8;
    else if (anim === "float") g.position.y = base[1] * ex + Math.sin(t * 1.2 + phase) * 0.25;
  });
  const color = obj.color && /^#?[0-9a-f]{3,8}$/i.test(obj.color) ? (obj.color.startsWith("#") ? obj.color : `#${obj.color}`) : HOLO;
  const active = lab.activeStep === index;
  const shape = (obj.shape ?? "sphere").toLowerCase();
  if (shape === "arrow") {
    return (
      <group ref={ref}>
        <Line points={[[0, 0, 0], [0, size[1], 0]]} color={color} lineWidth={3} />
        <mesh position={[0, size[1], 0]}>
          <coneGeometry args={[0.15, 0.4, 12]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1} />
        </mesh>
        {obj.label && <Label position={[0, size[1] + 0.5, 0]} small active={active}>{obj.label}</Label>}
      </group>
    );
  }
  return (
    <group ref={ref}>
      {obj.wire ? (
        <mesh>
          <Geometry shape={shape} size={size} />
          <meshBasicMaterial color={active ? "#ffffff" : color} wireframe transparent opacity={num(obj.opacity, 0.6)} />
        </mesh>
      ) : (
        <Holo
          color={color}
          opacity={num(obj.opacity, 0.35)}
          active={active}
          edges={shape !== "sphere" && shape !== "capsule" && shape !== "torus"}
          onClick={obj.label ? () => lab.select({ title: obj.label!.toUpperCase(), lines: obj.info ? [obj.info] : [`Shape: ${shape}`, obj.animation && obj.animation !== "none" ? `Animation: ${obj.animation}` : "Static element"] }) : undefined}
        >
          <Geometry shape={shape} size={size} />
        </Holo>
      )}
      {obj.label && (
        <Label position={[0, size[1] / 2 + 0.45, 0]} small active={active}>
          {obj.label}
        </Label>
      )}
    </group>
  );
}

export function CustomScene({ params, title }: { params: Record<string, unknown>; title: string }) {
  const objects = (Array.isArray(params.objects) ? (params.objects as CustomObject[]) : []).slice(0, 24);
  return (
    <group>
      {objects.map((o, i) => (
        <Item key={i} obj={o} index={i} />
      ))}
      {objects.length === 0 && <Label position={[0, 2, 0]}>{title || "Hologram"}</Label>}
      <Floor y={-3} size={24} />
    </group>
  );
}

/** Lab centerpiece: code-built red holographic arc reactor — counter-rotating rings, segmented plates, pulsing triangular core,
 * orbiting energy particles and a projected light beam from beneath. Core pulse follows the live voice level. */
export function HologramCore() {
  const outer = useRef<Group>(null);
  const mid = useRef<Group>(null);
  const inner = useRef<Group>(null);
  const core = useRef<Group>(null);
  const particles = useRef<Group>(null);
  const clock = useLabClock();
  useFrame(() => {
    const t = clock.current;
    const level = getVoiceLevel();
    if (outer.current) outer.current.rotation.z = t * 0.25;
    if (mid.current) mid.current.rotation.z = -t * 0.45;
    if (inner.current) inner.current.rotation.z = t * 0.9;
    if (core.current) core.current.scale.setScalar(1 + 0.08 * Math.sin(t * 2.4) + level * 0.3);
    if (particles.current) {
      particles.current.rotation.y = t * 0.6;
      particles.current.rotation.x = Math.sin(t * 0.3) * 0.4;
    }
  });
  const plates = Array.from({ length: 8 }, (_v, i) => (i / 8) * Math.PI * 2);
  const ticks = Array.from({ length: 12 }, (_v, i) => (i / 12) * Math.PI * 2);
  const orbiters = Array.from({ length: 14 }, (_v, i) => ({ r: 3.2 + (i % 3) * 0.35, a: (i / 14) * Math.PI * 2, y: ((i % 5) - 2) * 0.25 }));
  return (
    <group>
      {/* outer ring with tick marks */}
      <group ref={outer}>
        <mesh>
          <torusGeometry args={[3, 0.035, 8, 140]} />
          <meshBasicMaterial color={HOLO} transparent opacity={0.9} />
        </mesh>
        <mesh>
          <ringGeometry args={[2.72, 2.9, 96, 1, 0, Math.PI * 1.5]} />
          <meshBasicMaterial color={HOLO} transparent opacity={0.35} side={2} />
        </mesh>
        {ticks.map((a) => (
          <mesh key={a} position={[Math.cos(a) * 2.6, Math.sin(a) * 2.6, 0]} rotation={[0, 0, a]}>
            <boxGeometry args={[0.22, 0.04, 0.04]} />
            <meshBasicMaterial color="#ffffff" transparent opacity={0.8} />
          </mesh>
        ))}
      </group>
      {/* segmented plates — counter-rotating */}
      <group ref={mid}>
        {plates.map((a) => (
          <mesh key={a} position={[Math.cos(a) * 2.1, Math.sin(a) * 2.1, 0]} rotation={[0, 0, a + Math.PI / 2]}>
            <boxGeometry args={[0.55, 0.3, 0.08]} />
            <meshStandardMaterial color={HOLO} emissive={HOLO} emissiveIntensity={1.2} transparent opacity={0.45} wireframe={false} />
          </mesh>
        ))}
        <mesh>
          <torusGeometry args={[2.1, 0.02, 6, 120]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.4} />
        </mesh>
      </group>
      {/* inner ring */}
      <group ref={inner}>
        <mesh>
          <ringGeometry args={[1.45, 1.6, 64, 1, 0, Math.PI * 1.2]} />
          <meshBasicMaterial color={HOLO} transparent opacity={0.8} side={2} />
        </mesh>
        <mesh>
          <ringGeometry args={[1.45, 1.6, 64, 1, Math.PI * 1.4, Math.PI * 0.4]} />
          <meshBasicMaterial color={HOLO} transparent opacity={0.8} side={2} />
        </mesh>
      </group>
      {/* triangular core */}
      <group ref={core}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[1.15, 1.15, 0.12, 3]} />
          <meshBasicMaterial color={HOLO} wireframe />
        </mesh>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.8, 0.8, 0.1, 3]} />
          <meshStandardMaterial color="#ffd0d6" emissive={HOLO} emissiveIntensity={2.5} transparent opacity={0.85} />
        </mesh>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.4, 0.4, 0.14, 3]} />
          <meshBasicMaterial color="#ffffff" />
        </mesh>
        <pointLight intensity={60} color={HOLO} distance={12} />
      </group>
      {/* orbiting energy particles */}
      <group ref={particles}>
        {orbiters.map((o, i) => (
          <mesh key={i} position={[Math.cos(o.a) * o.r, o.y, Math.sin(o.a) * o.r]}>
            <sphereGeometry args={[0.05, 8, 8]} />
            <meshBasicMaterial color={i % 3 === 0 ? "#ffffff" : HOLO} />
          </mesh>
        ))}
      </group>
      {/* projected light beam from beneath */}
      <mesh position={[0, -2.4, 0]}>
        <coneGeometry args={[3.2, 3.6, 48, 1, true]} />
        <meshBasicMaterial color={HOLO} transparent opacity={0.07} side={2} depthWrite={false} />
      </mesh>
      <mesh position={[0, -4.2, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.2, 1.4, 48]} />
        <meshBasicMaterial color={HOLO} transparent opacity={0.35} side={2} />
      </mesh>
      <Label position={[0, 3.9, 0]}>PANDI CORE · AWAITING QUERY</Label>
      <Floor y={-4.2} size={24} />
    </group>
  );
}
