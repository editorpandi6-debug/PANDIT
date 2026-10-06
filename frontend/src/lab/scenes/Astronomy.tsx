import { Line } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef, useState } from "react";
import type { Group, Mesh } from "three";
import { Floor, HOLO, HOT, Holo, Label, Spin, WARM, str, useLab, useLabClock } from "../holo";

// Educational (not physical) scale — stated in the UI. Radii/distances are compressed so everything fits on screen.
export const PLANETS = [
  { name: "Mercury", color: "#b8b8b8", r: 0.18, orbit: 3.0, period: 0.24, facts: ["1st planet from the Sun", "No moons", "Day longer than its year"] },
  { name: "Venus", color: "#e8c27a", r: 0.28, orbit: 4.0, period: 0.62, facts: ["2nd planet", "Hottest planet (~465 °C)", "Rotates backwards"] },
  { name: "Earth", color: "#3d8bff", r: 0.3, orbit: 5.2, period: 1.0, facts: ["3rd planet from the Sun", "Has one natural satellite", "Supports known life"] },
  { name: "Mars", color: "#ff6b47", r: 0.22, orbit: 6.4, period: 1.88, facts: ["4th planet", "2 moons: Phobos & Deimos", "Home of Olympus Mons"] },
  { name: "Jupiter", color: "#e0b07a", r: 0.8, orbit: 8.6, period: 11.86, facts: ["5th planet", "Largest planet", "95 known moons"] },
  { name: "Saturn", color: "#f0d9a0", r: 0.68, orbit: 11.0, period: 29.4, facts: ["6th planet", "Iconic ring system", "Least dense planet"] },
  { name: "Uranus", color: "#8be3f5", r: 0.48, orbit: 13.0, period: 84, facts: ["7th planet", "Rotates on its side (98°)", "Ice giant"] },
  { name: "Neptune", color: "#4d6cff", r: 0.46, orbit: 14.8, period: 164.8, facts: ["8th planet", "Fastest winds in the Solar System", "Ice giant"] },
];

function OrbitRing({ radius, active }: { radius: number; active?: boolean }) {
  const points = useMemo(() => {
    const pts: [number, number, number][] = [];
    for (let i = 0; i <= 128; i += 1) {
      const a = (i / 128) * Math.PI * 2;
      pts.push([Math.cos(a) * radius, 0, Math.sin(a) * radius]);
    }
    return pts;
  }, [radius]);
  return <Line points={points} color={active ? "#ffffff" : HOLO} transparent opacity={active ? 0.9 : 0.35} lineWidth={1} />;
}

function Planet({ index, selected, onSelect }: { index: number; selected: boolean; onSelect: (i: number) => void }) {
  const p = PLANETS[index];
  const lab = useLab();
  const group = useRef<Group>(null);
  const body = useRef<Mesh>(null);
  const clock = useLabClock();
  const phase = (index * 0.9) % (Math.PI * 2);
  const active = selected || lab.activeStep - 1 === index;
  useFrame(() => {
    if (!group.current) return;
    const angle = phase + (clock.current * 0.25) / Math.sqrt(p.period);
    group.current.position.set(Math.cos(angle) * p.orbit, 0, Math.sin(angle) * p.orbit);
    if (body.current) body.current.rotation.y = clock.current * 0.8;
  });
  const labelY = p.r + 0.45 + (index % 2) * 0.35;
  return (
    <group ref={group}>
      <mesh
        ref={body}
        onClick={(e) => {
          e.stopPropagation();
          onSelect(index);
        }}
        onPointerOver={() => (document.body.style.cursor = "pointer")}
        onPointerOut={() => (document.body.style.cursor = "auto")}
      >
        <sphereGeometry args={[p.r, 32, 32]} />
        <meshStandardMaterial color={p.color} emissive={p.color} emissiveIntensity={active ? 0.9 : 0.25} roughness={0.6} />
      </mesh>
      {active && (
        <mesh>
          <sphereGeometry args={[p.r * 1.35, 24, 24]} />
          <meshBasicMaterial color="#ffffff" wireframe transparent opacity={0.35} />
        </mesh>
      )}
      {p.name === "Saturn" && (
        <mesh rotation={[Math.PI / 2 - 0.45, 0, 0]}>
          <ringGeometry args={[p.r * 1.3, p.r * 2.1, 64]} />
          <meshBasicMaterial color="#e6d3a3" transparent opacity={0.55} side={2} />
        </mesh>
      )}
      {p.name === "Earth" && <Moon clock={clock} />}
      <Label position={[0, labelY, 0]} active={active} onClick={() => onSelect(index)}>
        {p.name}
      </Label>
    </group>
  );
}

function Moon({ clock }: { clock: { current: number } }) {
  const ref = useRef<Mesh>(null);
  useFrame(() => {
    if (!ref.current) return;
    const a = clock.current * 3;
    ref.current.position.set(Math.cos(a) * 0.6, 0.05, Math.sin(a) * 0.6);
  });
  return (
    <mesh ref={ref}>
      <sphereGeometry args={[0.08, 16, 16]} />
      <meshStandardMaterial color="#cfcfcf" emissive="#888" emissiveIntensity={0.3} />
    </mesh>
  );
}

export function SolarSystem({ params }: { params: Record<string, unknown> }) {
  const lab = useLab();
  const focus = str(params.focus, "").toLowerCase();
  const [selected, setSelected] = useState<number>(() => PLANETS.findIndex((p) => p.name.toLowerCase() === focus));
  const select = (i: number) => {
    setSelected(i);
    const p = PLANETS[i];
    lab.select({ title: p.name.toUpperCase(), lines: p.facts });
  };
  const sunActive = lab.activeStep === 0;
  return (
    <group>
      <mesh
        onClick={(e) => {
          e.stopPropagation();
          setSelected(-1);
          lab.select({ title: "SUN", lines: ["G-type main-sequence star", "99.8% of the Solar System's mass", "Surface ≈ 5,500 °C"] });
        }}
      >
        <sphereGeometry args={[1.4, 48, 48]} />
        <meshStandardMaterial color={WARM} emissive="#ff9a1f" emissiveIntensity={sunActive ? 2.4 : 1.4} />
      </mesh>
      <pointLight intensity={120} color="#ffd9a0" distance={60} />
      <Label position={[0, 2.1, 0]} active={sunActive}>
        Sun
      </Label>
      {PLANETS.map((p, i) => (
        <OrbitRing key={p.name} radius={p.orbit} active={selected === i} />
      ))}
      {PLANETS.map((p, i) => (
        <Planet key={p.name} index={i} selected={selected === i} onSelect={select} />
      ))}
      <Floor y={-3} size={40} />
    </group>
  );
}

export function EarthSeasons() {
  const clock = useLabClock();
  const earth = useRef<Group>(null);
  const globe = useRef<Mesh>(null);
  const lab = useLab();
  const R = 6;
  useFrame(() => {
    if (!earth.current) return;
    const a = clock.current * 0.3;
    earth.current.position.set(Math.cos(a) * R, 0, Math.sin(a) * R);
    if (globe.current) globe.current.rotation.y = clock.current * 2;
  });
  const seasons = [
    { name: "June solstice (N. summer)", a: 0 },
    { name: "September equinox", a: Math.PI / 2 },
    { name: "December solstice (N. winter)", a: Math.PI },
    { name: "March equinox", a: (3 * Math.PI) / 2 },
  ];
  return (
    <group>
      <mesh>
        <sphereGeometry args={[1.2, 32, 32]} />
        <meshStandardMaterial color={WARM} emissive="#ff9a1f" emissiveIntensity={1.4} />
      </mesh>
      <pointLight intensity={100} color="#ffd9a0" />
      <Label position={[0, 1.8, 0]}>Sun</Label>
      {seasons.map((s, i) => (
        <Label key={s.name} position={[Math.cos(s.a) * (R + 1.6), 0.9, Math.sin(s.a) * (R + 1.6)]} small active={lab.activeStep === i}>
          {s.name}
        </Label>
      ))}
      <Line points={Array.from({ length: 129 }, (_v, i) => [Math.cos((i / 128) * Math.PI * 2) * R, 0, Math.sin((i / 128) * Math.PI * 2) * R] as [number, number, number])} color={HOLO} transparent opacity={0.4} />
      <group ref={earth}>
        {/* axis tilt stays fixed in space (23.5°) — that is what causes seasons */}
        <group rotation={[0, 0, (23.5 * Math.PI) / 180]}>
          <mesh ref={globe}>
            <sphereGeometry args={[0.6, 32, 32]} />
            <meshStandardMaterial color="#3d8bff" emissive="#1b4fa8" emissiveIntensity={0.4} />
          </mesh>
          <Line points={[[0, -1.1, 0], [0, 1.1, 0]]} color={HOT} lineWidth={2} />
          <Label position={[0, 1.4, 0]} small>
            axis 23.5°
          </Label>
        </group>
      </group>
      <Floor y={-2.5} size={24} />
    </group>
  );
}

export function MoonPhases() {
  const clock = useLabClock();
  const moon = useRef<Group>(null);
  const lab = useLab();
  const R = 4;
  useFrame(() => {
    if (!moon.current) return;
    const a = clock.current * 0.5;
    moon.current.position.set(Math.cos(a) * R, 0, Math.sin(a) * R);
  });
  const phases = ["New Moon", "Waxing Crescent", "First Quarter", "Waxing Gibbous", "Full Moon", "Waning Gibbous", "Third Quarter", "Waning Crescent"];
  return (
    <group>
      {/* sunlight arrives from +X */}
      <directionalLight position={[20, 0, 0]} intensity={4} color="#fff2d6" />
      <ambientLight intensity={0.08} />
      <Label position={[7, 1.2, 0]}>☀ Sunlight →</Label>
      <mesh>
        <sphereGeometry args={[1, 32, 32]} />
        <meshStandardMaterial color="#3d8bff" />
      </mesh>
      <Label position={[0, 1.6, 0]}>Earth</Label>
      {phases.map((name, i) => {
        const a = Math.PI + (i / 8) * Math.PI * 2; // new moon is on the Sun side (+X)
        return (
          <group key={name} position={[Math.cos(-a) * R, 0, Math.sin(-a) * R]}>
            <mesh>
              <sphereGeometry args={[0.32, 24, 24]} />
              <meshStandardMaterial color="#d8d8d8" />
            </mesh>
            <Label position={[0, 0.75, 0]} small active={lab.activeStep === i}>
              {name}
            </Label>
          </group>
        );
      })}
      <group ref={moon}>
        <mesh>
          <sphereGeometry args={[0.36, 24, 24]} />
          <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={0.15} />
        </mesh>
      </group>
      <Floor y={-2} size={20} />
    </group>
  );
}

export function Eclipse({ params }: { params: Record<string, unknown> }) {
  const type = str(params.type, "solar");
  const solar = type !== "lunar";
  const sunX = -10;
  const earthX = 4;
  const moonX = solar ? 1.2 : 7.2;
  const shadowEnd = solar ? earthX - 1 : moonX + 0.6;
  return (
    <group>
      <mesh position={[sunX, 0, 0]}>
        <sphereGeometry args={[2.2, 40, 40]} />
        <meshStandardMaterial color={WARM} emissive="#ff9a1f" emissiveIntensity={1.6} />
      </mesh>
      <pointLight position={[sunX, 0, 0]} intensity={200} color="#ffd9a0" />
      <Label position={[sunX, 3, 0]}>Sun</Label>
      <mesh position={[earthX, 0, 0]}>
        <sphereGeometry args={[1, 32, 32]} />
        <meshStandardMaterial color="#3d8bff" />
      </mesh>
      <Label position={[earthX, 1.6, 0]}>Earth</Label>
      <mesh position={[moonX, 0, 0]}>
        <sphereGeometry args={[0.32, 24, 24]} />
        <meshStandardMaterial color="#cfcfcf" />
      </mesh>
      <Label position={[moonX, 0.9, 0]}>Moon</Label>
      {/* shadow cone (umbra) */}
      <Line points={[[solar ? moonX : earthX, solar ? 0.32 : 1, 0], [shadowEnd, 0, 0]]} color={HOT} transparent opacity={0.8} />
      <Line points={[[solar ? moonX : earthX, solar ? -0.32 : -1, 0], [shadowEnd, 0, 0]]} color={HOT} transparent opacity={0.8} />
      <Label position={[(solar ? moonX : earthX) + 1.5, -1.4, 0]} small>
        {solar ? "Moon's shadow falls on Earth" : "Earth's shadow falls on the Moon"}
      </Label>
      <Floor y={-3} size={30} />
    </group>
  );
}

export function GenericHolo({ params, title }: { params: Record<string, unknown>; title: string }) {
  const label = str(params.label, title || "Concept");
  return (
    <group>
      <Spin speed={0.4}>
        <Holo color={HOLO} opacity={0.15}>
          <icosahedronGeometry args={[1.8, 1]} />
        </Holo>
        <Spin speed={-0.3} axis="x">
          <Holo color="#9d7cff" opacity={0.1}>
            <torusGeometry args={[2.6, 0.03, 8, 96]} />
          </Holo>
        </Spin>
      </Spin>
      <Label position={[0, 2.6, 0]}>{label}</Label>
      <Floor y={-2.5} size={20} />
    </group>
  );
}
