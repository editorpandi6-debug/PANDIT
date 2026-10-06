import { Line } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import type { Group } from "three";
import { Floor, GREEN, HOLO, HOT, Holo, Label, VIOLET, WARM, str, useLab, useLabClock } from "../holo";

export function Cell({ params }: { params: Record<string, unknown> }) {
  const lab = useLab();
  const plant = str(params.type, "animal") === "plant";
  const parts = [
    { name: "Nucleus", pos: [0, 0.3, 0] as [number, number, number], r: 0.8, color: VIOLET, info: ["Stores DNA", "Controls cell activity"] },
    { name: "Mitochondrion", pos: [1.6, 0.9, 0.6] as [number, number, number], r: 0.35, color: HOT, info: ["Powerhouse", "Makes ATP by respiration"] },
    { name: "Mitochondrion", pos: [-1.5, -0.9, 0.8] as [number, number, number], r: 0.35, color: HOT, info: ["Powerhouse", "Makes ATP by respiration"] },
    { name: "Ribosomes", pos: [0.9, -1.2, -0.6] as [number, number, number], r: 0.12, color: WARM, info: ["Build proteins"] },
    ...(plant
      ? [
          { name: "Chloroplast", pos: [-1.6, 1.0, -0.4] as [number, number, number], r: 0.4, color: GREEN, info: ["Photosynthesis", "Contains chlorophyll"] },
          { name: "Chloroplast", pos: [1.4, -0.4, -1.2] as [number, number, number], r: 0.4, color: GREEN, info: ["Photosynthesis", "Contains chlorophyll"] },
          { name: "Vacuole", pos: [-0.3, -1.1, -0.9] as [number, number, number], r: 0.9, color: HOLO, info: ["Large central vacuole", "Stores water · keeps cell turgid"] },
        ]
      : []),
  ];
  return (
    <group>
      {plant ? (
        <Holo color={GREEN} opacity={0.08} edges>
          <boxGeometry args={[5.6, 4.6, 4.2]} />
        </Holo>
      ) : null}
      <Holo color={HOLO} opacity={0.08} edges={false}>
        {plant ? <boxGeometry args={[5.2, 4.2, 3.8]} /> : <sphereGeometry args={[2.7, 32, 32]} />}
      </Holo>
      <Label position={[0, plant ? 2.9 : 3.3, 0]} active={lab.activeStep === 0}>
        {plant ? "Cell wall + membrane" : "Cell membrane"}
      </Label>
      {parts.map((p, i) => (
        <group key={`${p.name}-${i}`} position={p.pos}>
          <mesh
            scale={p.name === "Mitochondrion" || p.name === "Chloroplast" ? [1.8, 1, 1] : [1, 1, 1]}
            onClick={(e) => {
              e.stopPropagation();
              lab.select({ title: p.name.toUpperCase(), lines: p.info });
            }}
          >
            <sphereGeometry args={[p.r, 24, 24]} />
            <meshStandardMaterial color={p.color} emissive={p.color} emissiveIntensity={lab.activeStep === i + 1 ? 1.4 : 0.5} transparent opacity={0.85} />
          </mesh>
          <Label position={[0, p.r + 0.35, 0]} small active={lab.activeStep === i + 1}>
            {p.name}
          </Label>
        </group>
      ))}
      <Floor y={-3.2} size={20} />
    </group>
  );
}

const BASES: Record<string, { pair: string; color: string }> = { A: { pair: "T", color: HOLO }, T: { pair: "A", color: WARM }, G: { pair: "C", color: GREEN }, C: { pair: "G", color: HOT } };

export function DNA() {
  const lab = useLab();
  const group = useRef<Group>(null);
  const clock = useLabClock();
  useFrame(() => {
    if (group.current) group.current.rotation.y = clock.current * 0.4;
  });
  const rungs = 22;
  const radius = 1.2;
  const height = 7;
  const seq = useMemo(() => Array.from({ length: rungs }, (_v, i) => "ATGC"[(i * 7 + 3) % 4]), []);
  const strandA = useMemo(() => Array.from({ length: 120 }, (_v, i) => {
    const t = i / 119;
    const a = t * Math.PI * 4;
    return [Math.cos(a) * radius, -height / 2 + t * height, Math.sin(a) * radius] as [number, number, number];
  }), []);
  const strandB = useMemo(() => strandA.map(([x, y, z]) => [-x, y, -z] as [number, number, number]), [strandA]);
  return (
    <group>
      <group ref={group}>
        <Line points={strandA} color={HOLO} lineWidth={3} />
        <Line points={strandB} color={VIOLET} lineWidth={3} />
        {seq.map((b, i) => {
          const t = i / (rungs - 1);
          const a = t * Math.PI * 4;
          const y = -height / 2 + t * height;
          const x = Math.cos(a) * radius;
          const z = Math.sin(a) * radius;
          const active = lab.activeStep === 1 || lab.activeStep === 2;
          return (
            <group key={i}>
              <Line points={[[x, y, z], [0, y, 0]]} color={BASES[b].color} lineWidth={active ? 4 : 2} />
              <Line points={[[0, y, 0], [-x, y, -z]]} color={BASES[BASES[b].pair].color} lineWidth={active ? 4 : 2} />
              <mesh position={[x * 0.5, y, z * 0.5]}>
                <sphereGeometry args={[0.1, 8, 8]} />
                <meshBasicMaterial color={BASES[b].color} />
              </mesh>
              <mesh position={[-x * 0.5, y, -z * 0.5]}>
                <sphereGeometry args={[0.1, 8, 8]} />
                <meshBasicMaterial color={BASES[BASES[b].pair].color} />
              </mesh>
            </group>
          );
        })}
      </group>
      <Label position={[0, height / 2 + 0.7, 0]} active={lab.activeStep === 0}>
        DNA double helix · sugar-phosphate backbones
      </Label>
      <Label position={[0, -height / 2 - 0.7, 0]} small>
        <span style={{ color: HOLO }}>A</span>–<span style={{ color: WARM }}>T</span> · <span style={{ color: GREEN }}>G</span>–<span style={{ color: HOT }}>C</span> base pairs
      </Label>
      <Floor y={-height / 2 - 1.3} size={16} />
    </group>
  );
}

export function Heart() {
  const lab = useLab();
  const group = useRef<Group>(null);
  const clock = useLabClock();
  useFrame(() => {
    if (!group.current) return;
    const beat = 1 + 0.06 * Math.max(0, Math.sin(clock.current * 4.2)) ** 3;
    group.current.scale.setScalar(beat);
  });
  const chambers = [
    { name: "Right atrium", pos: [1.0, 1.0, 0] as [number, number, number], r: 0.85, color: HOLO, info: ["Receives deoxygenated blood from the body", "via the vena cavae"] },
    { name: "Left atrium", pos: [-1.0, 1.0, 0] as [number, number, number], r: 0.8, color: HOT, info: ["Receives oxygenated blood from the lungs", "via the pulmonary veins"] },
    { name: "Right ventricle", pos: [0.8, -0.6, 0.1] as [number, number, number], r: 1.05, color: HOLO, info: ["Pumps blood to the lungs", "through the pulmonary artery"] },
    { name: "Left ventricle", pos: [-0.9, -0.7, 0] as [number, number, number], r: 1.2, color: HOT, info: ["Thickest wall", "Pumps oxygenated blood to the body via the aorta"] },
  ];
  return (
    <group>
      <group ref={group}>
        {chambers.map((c, i) => (
          <group key={c.name} position={c.pos}>
            <mesh
              onClick={(e) => {
                e.stopPropagation();
                lab.select({ title: c.name.toUpperCase(), lines: c.info });
              }}
            >
              <sphereGeometry args={[c.r, 28, 28]} />
              <meshStandardMaterial color={c.color} emissive={c.color} emissiveIntensity={lab.activeStep === i ? 1.3 : 0.4} transparent opacity={0.55} roughness={0.4} />
            </mesh>
            <Label position={[c.pos[0] > 0 ? 1.2 : -1.2, c.r * 0.6, 0]} small active={lab.activeStep === i}>
              {c.name}
            </Label>
          </group>
        ))}
        {/* aorta */}
        <mesh position={[-0.6, 2.4, 0]} rotation={[0, 0, Math.PI / 2]}>
          <torusGeometry args={[0.7, 0.25, 12, 32, Math.PI]} />
          <meshStandardMaterial color={HOT} emissive={HOT} emissiveIntensity={0.5} transparent opacity={0.7} />
        </mesh>
        <Label position={[-0.6, 3.5, 0]} small active={lab.activeStep === 4}>
          Aorta → body
        </Label>
        {/* pulmonary artery */}
        <mesh position={[1.3, 2.2, 0]}>
          <cylinderGeometry args={[0.22, 0.22, 1.4, 16]} />
          <meshStandardMaterial color={HOLO} emissive={HOLO} emissiveIntensity={0.5} transparent opacity={0.7} />
        </mesh>
        <Label position={[1.3, 3.2, 0]} small>
          Pulmonary artery → lungs
        </Label>
      </group>
      <Label position={[0, -2.6, 0]} small>
        <span style={{ color: HOLO }}>■ deoxygenated</span> · <span style={{ color: HOT }}>■ oxygenated</span> · 4 chambers · ~72 bpm
      </Label>
      <Floor y={-3.2} size={16} />
    </group>
  );
}
