import { Line } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import type { Group, Mesh } from "three";
import { CatmullRomCurve3, Vector3 } from "three";
import { Floor, GREEN, HOLO, HOT, Holo, Label, WARM, num, str, useLab, useLabClock } from "../holo";

const G = 9.81;

export function Projectile({ params }: { params: Record<string, unknown> }) {
  const lab = useLab();
  const v = Math.max(1, num(params.speed, 20));
  const angle = (Math.max(1, Math.min(89, num(params.angle, 45))) * Math.PI) / 180;
  const vx = v * Math.cos(angle);
  const vy = v * Math.sin(angle);
  const tFlight = (2 * vy) / G;
  const rangeM = vx * tFlight;
  const hMax = (vy * vy) / (2 * G);
  const scale = 10 / Math.max(rangeM, 1);
  const path = useMemo(() => Array.from({ length: 81 }, (_v, i) => {
    const t = (tFlight * i) / 80;
    return [(vx * t - rangeM / 2) * scale, (vy * t - 0.5 * G * t * t) * scale, 0] as [number, number, number];
  }), [vx, vy, tFlight, rangeM, scale]);
  const ball = useRef<Mesh>(null);
  const clock = useLabClock();
  useFrame(() => {
    if (!ball.current) return;
    const t = (clock.current * 0.6) % (tFlight + 0.6);
    const tt = Math.min(t, tFlight);
    ball.current.position.set((vx * tt - rangeM / 2) * scale, (vy * tt - 0.5 * G * tt * tt) * scale, 0);
  });
  return (
    <group position={[0, -2, 0]}>
      <Line points={path} color={HOLO} lineWidth={2} dashed dashSize={0.2} gapSize={0.1} />
      <Line points={[[-rangeM * scale * 0.5 - 1, 0, 0], [rangeM * scale * 0.5 + 1, 0, 0]]} color="#ffb0bc" />
      <Line points={[[-rangeM * scale * 0.5, 0, 0], [-rangeM * scale * 0.5 + Math.cos(angle) * 1.6, Math.sin(angle) * 1.6, 0]]} color={WARM} lineWidth={3} />
      <Label position={[-rangeM * scale * 0.5 + 1.2, 0.5, 0]} small active={lab.activeStep === 0}>
        v₀ = {v} m/s · θ = {Math.round((angle * 180) / Math.PI)}°
      </Label>
      <Line points={[[0, 0, 0], [0, hMax * scale, 0]]} color={GREEN} transparent opacity={0.6} />
      <Label position={[0, hMax * scale + 0.6, 0]} small active={lab.activeStep === 1}>
        h max = {hMax.toFixed(1)} m
      </Label>
      <Label position={[0, -0.6, 0]} small active={lab.activeStep === 2}>
        range = {rangeM.toFixed(1)} m · t = {tFlight.toFixed(2)} s
      </Label>
      <mesh ref={ball}>
        <sphereGeometry args={[0.22, 20, 20]} />
        <meshStandardMaterial color={HOT} emissive={HOT} emissiveIntensity={1.5} />
      </mesh>
      <Floor y={-0.01} size={24} />
    </group>
  );
}

export function Pendulum({ params }: { params: Record<string, unknown> }) {
  const lab = useLab();
  const L = Math.max(0.3, Math.min(10, num(params.length, 2)));
  const theta0 = (35 * Math.PI) / 180;
  const omega = Math.sqrt(G / L);
  const period = (2 * Math.PI) / omega;
  const arm = useRef<Group>(null);
  const clock = useLabClock();
  const vis = 4; // visual arm length
  useFrame(() => {
    if (arm.current) arm.current.rotation.z = theta0 * Math.cos(omega * clock.current);
  });
  const arc = useMemo(() => Array.from({ length: 41 }, (_v, i) => {
    const th = -theta0 + (2 * theta0 * i) / 40;
    return [Math.sin(th) * vis, -Math.cos(th) * vis, 0] as [number, number, number];
  }), [theta0]);
  return (
    <group position={[0, 2.5, 0]}>
      <Holo color={HOLO} opacity={0.4}>
        <boxGeometry args={[3, 0.15, 0.6]} />
      </Holo>
      <Line points={arc} color={HOLO} transparent opacity={0.35} dashed dashSize={0.15} gapSize={0.1} />
      <Line points={[[0, 0, 0], [0, -vis, 0]]} color="#ffffff" transparent opacity={0.2} dashed dashSize={0.1} gapSize={0.1} />
      <group ref={arm}>
        <Line points={[[0, 0, 0], [0, -vis, 0]]} color="#ffffff" lineWidth={1.5} />
        <mesh position={[0, -vis, 0]}>
          <sphereGeometry args={[0.35, 24, 24]} />
          <meshStandardMaterial color={WARM} emissive={WARM} emissiveIntensity={lab.activeStep === 1 ? 2 : 1} />
        </mesh>
      </group>
      <Label position={[1.4, -vis / 2, 0]} small active={lab.activeStep === 0}>
        L = {L} m
      </Label>
      <Label position={[0, 0.6, 0]} active={lab.activeStep === 2}>
        T = 2π√(L/g) = {period.toFixed(2)} s
      </Label>
      <Label position={[0, -vis - 0.9, 0]} small>
        amplitude {Math.round((theta0 * 180) / Math.PI)}° · g = 9.81 m/s²
      </Label>
      <Floor y={-vis - 1.4} size={20} />
    </group>
  );
}

export function Wave({ params }: { params: Record<string, unknown> }) {
  const lab = useLab();
  const A = Math.max(0.2, Math.min(3, num(params.amplitude, 1)));
  const lambda = Math.max(0.5, Math.min(10, num(params.wavelength, 3)));
  const f = Math.max(0.1, Math.min(5, num(params.frequency, 0.5)));
  const lineRef = useRef<{ geometry: { setPositions: (p: number[]) => void } } | null>(null);
  const clock = useLabClock();
  const n = 160;
  const base = useMemo(() => Array.from({ length: n + 1 }, (_v, i) => -8 + (16 * i) / n), []);
  useFrame(() => {
    const t = clock.current;
    const pts: number[] = [];
    for (const x of base) pts.push(x, A * Math.sin((2 * Math.PI * (x / lambda - f * t))), 0);
    lineRef.current?.geometry.setPositions(pts);
  });
  const particles = useRef<Group>(null);
  useFrame(() => {
    if (!particles.current) return;
    const t = clock.current;
    particles.current.children.forEach((child, i) => {
      const x = -7 + i * 2;
      child.position.set(x, A * Math.sin(2 * Math.PI * (x / lambda - f * t)), 0);
    });
  });
  return (
    <group>
      <Line ref={lineRef as never} points={base.map((x) => [x, 0, 0] as [number, number, number])} color={HOLO} lineWidth={3} />
      <Line points={[[-8.5, 0, 0], [8.5, 0, 0]]} color="#ffb0bc" transparent opacity={0.5} />
      <group ref={particles}>
        {Array.from({ length: 8 }, (_v, i) => (
          <mesh key={i}>
            <sphereGeometry args={[0.12, 12, 12]} />
            <meshStandardMaterial color={WARM} emissive={WARM} emissiveIntensity={1.5} />
          </mesh>
        ))}
      </group>
      <Line points={[[-8, 0, 0], [-8, A, 0]]} color={GREEN} lineWidth={2} />
      <Label position={[-8, A + 0.5, 0]} small active={lab.activeStep === 0}>
        amplitude A = {A}
      </Label>
      <Line points={[[0, -A - 0.6, 0], [lambda, -A - 0.6, 0]]} color={HOT} lineWidth={2} />
      <Label position={[lambda / 2, -A - 1.1, 0]} small active={lab.activeStep === 1}>
        wavelength λ = {lambda}
      </Label>
      <Label position={[0, A + 1.4, 0]} active={lab.activeStep === 2}>
        v = f · λ = {(f * lambda).toFixed(2)} units/s · f = {f} Hz
      </Label>
      <Floor y={-A - 2} size={24} />
    </group>
  );
}

export function Circuit({ params }: { params: Record<string, unknown> }) {
  const lab = useLab();
  const V = Math.max(0.1, num(params.voltage, 9));
  const R = Math.max(0.1, num(params.resistance, 3));
  const I = V / R;
  const curve = useMemo(() => new CatmullRomCurve3([new Vector3(-4, -2, 0), new Vector3(4, -2, 0), new Vector3(4, 2, 0), new Vector3(-4, 2, 0)], true, "catmullrom", 0.0), []);
  const loop = useMemo(() => curve.getPoints(200).map((p) => [p.x, p.y, p.z] as [number, number, number]), [curve]);
  const electrons = useRef<Group>(null);
  const clock = useLabClock();
  useFrame(() => {
    if (!electrons.current) return;
    const t = clock.current * 0.08 * Math.min(3, I);
    electrons.current.children.forEach((child, i) => {
      const u = (t + i / 12) % 1;
      const p = curve.getPointAt(u);
      child.position.copy(p);
    });
  });
  const zig = useMemo(() => Array.from({ length: 13 }, (_v, i) => [-1.2 + (2.4 * i) / 12, 2 + (i % 2 === 0 ? 0 : i % 4 === 1 ? 0.3 : -0.3), 0] as [number, number, number]), []);
  return (
    <group>
      <Line points={loop} color={HOLO} lineWidth={2} />
      {/* battery (bottom) */}
      <group position={[0, -2, 0]}>
        <Holo color={WARM} opacity={0.5}>
          <boxGeometry args={[0.15, 1, 0.3]} />
        </Holo>
        <Holo color={WARM} opacity={0.5} position={[0.4, 0, 0]}>
          <boxGeometry args={[0.15, 0.6, 0.3]} />
        </Holo>
        <Label position={[0.2, -0.9, 0]} small active={lab.activeStep === 0}>
          battery V = {V} V
        </Label>
      </group>
      {/* resistor (top) */}
      <Line points={zig} color={HOT} lineWidth={3} />
      <Label position={[0, 2.8, 0]} small active={lab.activeStep === 1}>
        resistor R = {R} Ω
      </Label>
      {/* bulb (right) */}
      <mesh position={[4, 0, 0]}>
        <sphereGeometry args={[0.45, 24, 24]} />
        <meshStandardMaterial color="#fff5c0" emissive="#ffd34d" emissiveIntensity={Math.min(3, 0.5 + I)} transparent opacity={0.85} />
      </mesh>
      <Label position={[4.9, 0.7, 0]} small>
        bulb
      </Label>
      <group ref={electrons}>
        {Array.from({ length: 12 }, (_v, i) => (
          <mesh key={i}>
            <sphereGeometry args={[0.1, 10, 10]} />
            <meshStandardMaterial color={HOLO} emissive={HOLO} emissiveIntensity={2} />
          </mesh>
        ))}
      </group>
      <Label position={[-4.6, 0, 0]} small active={lab.activeStep === 2}>
        I = V / R = {I.toFixed(2)} A
      </Label>
      <Label position={[0, 0, 0]}>Ohm's law: V = I · R</Label>
      <Floor y={-3.2} size={20} />
    </group>
  );
}

export function Optics({ params }: { params: Record<string, unknown> }) {
  const lab = useLab();
  const mode = str(params.mode, "reflection");
  const deg = Math.max(5, Math.min(85, num(params.angle, 40)));
  const n1 = Math.max(1, num(params.n1, 1));
  const n2 = Math.max(1, num(params.n2, 1.5));
  const i = (deg * Math.PI) / 180;
  const L = 4;
  const incident: [number, number, number][] = [[-Math.sin(i) * L, Math.cos(i) * L, 0], [0, 0, 0]];
  const reflected: [number, number, number][] = [[0, 0, 0], [Math.sin(i) * L, Math.cos(i) * L, 0]];
  const sinR = (n1 / n2) * Math.sin(i);
  const tir = sinR > 1;
  const rr = tir ? 0 : Math.asin(sinR);
  const refracted: [number, number, number][] = [[0, 0, 0], [Math.sin(rr) * L, -Math.cos(rr) * L, 0]];
  return (
    <group>
      {/* surface */}
      <Line points={[[-5, 0, 0], [5, 0, 0]]} color="#ffffff" lineWidth={2} />
      {mode === "refraction" && (
        <Holo color={HOLO} opacity={0.12} edges={false} position={[0, -2, 0]}>
          <boxGeometry args={[10, 4, 0.3]} />
        </Holo>
      )}
      {/* normal */}
      <Line points={[[0, 4.5, 0], [0, -4.5, 0]]} color="#ffb0bc" dashed dashSize={0.2} gapSize={0.15} transparent opacity={0.6} />
      <Label position={[0.6, 4.3, 0]} small>
        normal
      </Label>
      <Line points={incident} color={WARM} lineWidth={3} />
      <Label position={[-Math.sin(i) * L * 0.6, Math.cos(i) * L * 0.6 + 0.4, 0]} small active={lab.activeStep === 0}>
        incident · i = {deg}°
      </Label>
      {(mode === "reflection" || tir) && (
        <>
          <Line points={reflected} color={GREEN} lineWidth={3} />
          <Label position={[Math.sin(i) * L * 0.6, Math.cos(i) * L * 0.6 + 0.4, 0]} small active={lab.activeStep === 1}>
            {tir ? "total internal reflection" : `reflected · r = ${deg}°`}
          </Label>
        </>
      )}
      {mode === "refraction" && !tir && (
        <>
          <Line points={refracted} color={HOT} lineWidth={3} />
          <Label position={[Math.sin(rr) * L * 0.6 + 0.4, -Math.cos(rr) * L * 0.6, 0]} small active={lab.activeStep === 1}>
            refracted · r = {((rr * 180) / Math.PI).toFixed(1)}°
          </Label>
        </>
      )}
      <Label position={[-3.6, 1.2, 0]} small>
        {mode === "refraction" ? `n₁ = ${n1}` : "mirror"}
      </Label>
      {mode === "refraction" && (
        <Label position={[-3.6, -1.2, 0]} small>
          n₂ = {n2}
        </Label>
      )}
      <Label position={[0, 5.2, 0]} active={lab.activeStep === 2}>
        {mode === "refraction" ? "Snell's law: n₁ sin i = n₂ sin r" : "Law of reflection: i = r"}
      </Label>
      <Floor y={-4.6} size={20} />
    </group>
  );
}
