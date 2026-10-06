import { Line } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import type { Group, InstancedMesh, Object3D } from "three";
import { Object3D as ThreeObject3D } from "three";
import { Floor, GREEN, HOLO, HOT, Holo, Label, VIOLET, num, str, useLab, useLabClock } from "../holo";

const ELEMENTS = ["", "H", "He", "Li", "Be", "B", "C", "N", "O", "F", "Ne", "Na", "Mg", "Al", "Si", "P", "S", "Cl", "Ar", "K", "Ca", "Sc", "Ti", "V", "Cr", "Mn", "Fe", "Co", "Ni", "Cu", "Zn", "Ga", "Ge", "As", "Se", "Br", "Kr", "Rb", "Sr", "Y", "Zr", "Nb", "Mo", "Tc", "Ru", "Rh", "Pd", "Ag", "Cd", "In", "Sn", "Sb", "Te", "I", "Xe", "Cs", "Ba"];
const SHELL_CAPACITY = [2, 8, 8, 18, 18, 32, 32];

function shellsFor(z: number): number[] {
  const shells: number[] = [];
  let remaining = z;
  for (const cap of SHELL_CAPACITY) {
    if (remaining <= 0) break;
    const n = Math.min(cap, remaining);
    shells.push(n);
    remaining -= n;
  }
  return shells;
}

function Electrons({ count, radius, tilt, speed, active }: { count: number; radius: number; tilt: number; speed: number; active: boolean }) {
  const group = useRef<Group>(null);
  const clock = useLabClock();
  useFrame(() => {
    if (group.current) group.current.rotation.y = clock.current * speed;
  });
  const ring = useMemo(
    () => Array.from({ length: 97 }, (_v, i) => [Math.cos((i / 96) * Math.PI * 2) * radius, 0, Math.sin((i / 96) * Math.PI * 2) * radius] as [number, number, number]),
    [radius],
  );
  return (
    <group rotation={[tilt, 0, tilt * 0.6]}>
      <Line points={ring} color={active ? "#ffffff" : HOLO} transparent opacity={active ? 0.9 : 0.4} />
      <group ref={group}>
        {Array.from({ length: count }, (_v, i) => {
          const a = (i / count) * Math.PI * 2;
          return (
            <mesh key={i} position={[Math.cos(a) * radius, 0, Math.sin(a) * radius]}>
              <sphereGeometry args={[0.09, 12, 12]} />
              <meshStandardMaterial color={HOLO} emissive={HOLO} emissiveIntensity={2} />
            </mesh>
          );
        })}
      </group>
    </group>
  );
}

export function Atom({ params }: { params: Record<string, unknown> }) {
  const lab = useLab();
  const z = Math.max(1, Math.min(56, Math.round(num(params.atomicNumber, 6))));
  const symbol = str(params.symbol, ELEMENTS[z] ?? "?");
  const name = str(params.name, symbol);
  const shells = shellsFor(z);
  const neutrons = Math.max(0, Math.round(z * (z > 20 ? 1.25 : 1)) - (z === 1 ? 1 : 0));
  const nucleons = useMemo(() => {
    const total = z + neutrons;
    return Array.from({ length: Math.min(total, 60) }, (_v, i) => {
      const phi = Math.acos(1 - (2 * (i + 0.5)) / Math.min(total, 60));
      const theta = Math.PI * (1 + Math.sqrt(5)) * i;
      const r = 0.22 * Math.cbrt(Math.min(total, 60));
      return { pos: [r * Math.cos(theta) * Math.sin(phi), r * Math.sin(theta) * Math.sin(phi), r * Math.cos(phi)] as [number, number, number], proton: i % 2 === 0 ? i / 2 < z : false };
    });
  }, [z, neutrons]);
  return (
    <group>
      <group
        onClick={(e) => {
          e.stopPropagation();
          lab.select({ title: `${name.toUpperCase()} NUCLEUS`, lines: [`${z} protons`, `≈${neutrons} neutrons`, `Electron shells: ${shells.join(", ")}`] });
        }}
      >
        {nucleons.map((n, i) => (
          <mesh key={i} position={n.pos}>
            <sphereGeometry args={[0.16, 12, 12]} />
            <meshStandardMaterial color={n.proton ? HOT : "#7f8ea3"} emissive={n.proton ? HOT : "#4a5568"} emissiveIntensity={lab.activeStep === 0 ? 1.2 : 0.5} />
          </mesh>
        ))}
      </group>
      <Label position={[0, 1.1, 0]} active={lab.activeStep === 0}>
        {symbol} · Z = {z}
      </Label>
      {shells.map((count, i) => (
        <Electrons key={i} count={count} radius={1.6 + i * 0.9} tilt={(i * Math.PI) / 7} speed={1.4 / (i + 1)} active={lab.activeStep === i + 1} />
      ))}
      <Label position={[0, -(1.6 + shells.length * 0.9), 0]} small>
        {name}: {z} electrons in {shells.length} shell{shells.length > 1 ? "s" : ""} ({shells.join("-")})
      </Label>
      <Floor y={-(2.2 + shells.length * 0.9)} size={24} />
    </group>
  );
}

const ATOM_STYLE: Record<string, { color: string; r: number }> = {
  H: { color: "#ffffff", r: 0.28 },
  O: { color: HOT, r: 0.45 },
  C: { color: "#5b6b7f", r: 0.45 },
  N: { color: VIOLET, r: 0.44 },
  Cl: { color: GREEN, r: 0.5 },
  Na: { color: "#c9a0ff", r: 0.55 },
};

interface Mol {
  atoms: { el: string; pos: [number, number, number] }[];
  bonds: [number, number, number?][]; // a, b, order
  shape: string;
}

function tetra(center: string, outer: string, len: number): Mol {
  const s = len / Math.sqrt(3);
  return {
    atoms: [
      { el: center, pos: [0, 0, 0] },
      { el: outer, pos: [s, s, s] },
      { el: outer, pos: [-s, -s, s] },
      { el: outer, pos: [-s, s, -s] },
      { el: outer, pos: [s, -s, -s] },
    ],
    bonds: [[0, 1], [0, 2], [0, 3], [0, 4]],
    shape: "Tetrahedral · 109.5°",
  };
}

const MOLECULES: Record<string, Mol> = {
  H2O: (() => {
    const a = ((104.5 / 2) * Math.PI) / 180;
    return { atoms: [{ el: "O", pos: [0, 0, 0] }, { el: "H", pos: [Math.sin(a) * 1.5, -Math.cos(a) * 1.5, 0] }, { el: "H", pos: [-Math.sin(a) * 1.5, -Math.cos(a) * 1.5, 0] }], bonds: [[0, 1], [0, 2]], shape: "Bent · 104.5°" };
  })(),
  CO2: { atoms: [{ el: "C", pos: [0, 0, 0] }, { el: "O", pos: [1.8, 0, 0] }, { el: "O", pos: [-1.8, 0, 0] }], bonds: [[0, 1, 2], [0, 2, 2]], shape: "Linear · 180°" },
  CH4: tetra("C", "H", 1.6),
  NH3: { atoms: [{ el: "N", pos: [0, 0.3, 0] }, { el: "H", pos: [1.3, -0.4, 0] }, { el: "H", pos: [-0.65, -0.4, 1.13] }, { el: "H", pos: [-0.65, -0.4, -1.13] }], bonds: [[0, 1], [0, 2], [0, 3]], shape: "Trigonal pyramidal · 107°" },
  O2: { atoms: [{ el: "O", pos: [-0.8, 0, 0] }, { el: "O", pos: [0.8, 0, 0] }], bonds: [[0, 1, 2]], shape: "Diatomic · double bond" },
  N2: { atoms: [{ el: "N", pos: [-0.75, 0, 0] }, { el: "N", pos: [0.75, 0, 0] }], bonds: [[0, 1, 3]], shape: "Diatomic · triple bond" },
  HCl: { atoms: [{ el: "H", pos: [-1, 0, 0] }, { el: "Cl", pos: [0.6, 0, 0] }], bonds: [[0, 1]], shape: "Linear · polar covalent" },
  NaCl: { atoms: [{ el: "Na", pos: [-1.3, 0, 0] }, { el: "Cl", pos: [1.3, 0, 0] }], bonds: [], shape: "Ionic pair · Na⁺ Cl⁻" },
  C2H5OH: {
    atoms: [
      { el: "C", pos: [-1.3, 0, 0] }, { el: "C", pos: [0.2, 0, 0] }, { el: "O", pos: [1.2, 1.1, 0] }, { el: "H", pos: [2.1, 0.9, 0.3] },
      { el: "H", pos: [-1.8, 1, 0] }, { el: "H", pos: [-1.8, -0.6, 0.9] }, { el: "H", pos: [-1.8, -0.6, -0.9] }, { el: "H", pos: [0.6, -0.6, 0.9] }, { el: "H", pos: [0.6, -0.6, -0.9] },
    ],
    bonds: [[0, 1], [1, 2], [2, 3], [0, 4], [0, 5], [0, 6], [1, 7], [1, 8]],
    shape: "Ethanol · C₂H₅OH",
  },
  C6H6: (() => {
    const atoms: Mol["atoms"] = [];
    const bonds: Mol["bonds"] = [];
    for (let i = 0; i < 6; i += 1) {
      const a = (i / 6) * Math.PI * 2;
      atoms.push({ el: "C", pos: [Math.cos(a) * 1.4, Math.sin(a) * 1.4, 0] });
    }
    for (let i = 0; i < 6; i += 1) {
      const a = (i / 6) * Math.PI * 2;
      atoms.push({ el: "H", pos: [Math.cos(a) * 2.4, Math.sin(a) * 2.4, 0] });
      bonds.push([i, (i + 1) % 6, i % 2 === 0 ? 2 : 1]);
      bonds.push([i, 6 + i]);
    }
    return { atoms, bonds, shape: "Benzene ring · planar hexagon" };
  })(),
};

export function Molecule({ params }: { params: Record<string, unknown> }) {
  const lab = useLab();
  const formula = str(params.formula, "H2O").replace(/[^A-Za-z0-9]/g, "");
  const mol = MOLECULES[formula] ?? MOLECULES[formula.toUpperCase()] ?? MOLECULES.H2O;
  const known = Boolean(MOLECULES[formula] ?? MOLECULES[formula.toUpperCase()]);
  return (
    <group>
      {mol.bonds.map(([a, b, order = 1], i) => {
        const pa = mol.atoms[a].pos;
        const pb = mol.atoms[b].pos;
        return Array.from({ length: order }, (_v, k) => {
          const off = (k - (order - 1) / 2) * 0.14;
          return <Line key={`${i}-${k}`} points={[[pa[0], pa[1] + off, pa[2]], [pb[0], pb[1] + off, pb[2]]]} color={HOLO} lineWidth={2} transparent opacity={0.9} />;
        });
      })}
      {mol.atoms.map((atom, i) => {
        const style = ATOM_STYLE[atom.el] ?? { color: HOLO, r: 0.4 };
        const active = lab.activeStep === i;
        return (
          <group key={i} position={atom.pos}>
            <mesh
              onClick={(e) => {
                e.stopPropagation();
                lab.select({ title: `${atom.el} atom`, lines: [`Element: ${atom.el}`, `Part of ${known ? formula : "H2O"}`, mol.shape] });
              }}
            >
              <sphereGeometry args={[style.r, 24, 24]} />
              <meshStandardMaterial color={style.color} emissive={style.color} emissiveIntensity={active ? 1.2 : 0.35} roughness={0.4} />
            </mesh>
            <Label position={[0, style.r + 0.35, 0]} small active={active}>
              {atom.el}
            </Label>
          </group>
        );
      })}
      <Label position={[0, -2.6, 0]}>
        {known ? formula : `${formula} (preview: H₂O)`} · {mol.shape}
      </Label>
      <Floor y={-3.2} size={20} />
    </group>
  );
}

function Particles({ mode, x, color }: { mode: "solid" | "liquid" | "gas"; x: number; color: string }) {
  const ref = useRef<InstancedMesh>(null);
  const dummy = useMemo<Object3D>(() => new ThreeObject3D(), []);
  const clock = useLabClock();
  const count = 27;
  const seeds = useMemo(() => Array.from({ length: count }, () => [Math.random() * Math.PI * 2, Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1]), []);
  useFrame(() => {
    if (!ref.current) return;
    const t = clock.current;
    for (let i = 0; i < count; i += 1) {
      const [ph, sx, sy, sz] = seeds[i];
      const gx = (i % 3) - 1;
      const gy = Math.floor(i / 3) % 3 - 1;
      const gz = Math.floor(i / 9) - 1;
      if (mode === "solid") dummy.position.set(gx * 0.7 + Math.sin(t * 6 + ph) * 0.05, gy * 0.7 + Math.cos(t * 7 + ph) * 0.05, gz * 0.7);
      else if (mode === "liquid") dummy.position.set(gx * 0.65 + Math.sin(t * 1.5 + ph) * 0.35, -0.6 + ((gy + 1) * 0.5) + Math.cos(t * 1.8 + ph * 2) * 0.2, gz * 0.65 + Math.sin(t * 1.2 + ph * 3) * 0.35);
      else dummy.position.set(((sx + Math.sin(t * 0.9 + ph) * 1.4 + 10) % 2.8) - 1.4, ((sy + Math.cos(t * 1.1 + ph * 2) * 1.4 + 10) % 2.8) - 1.4, ((sz + Math.sin(t * 0.7 + ph * 3) * 1.4 + 10) % 2.8) - 1.4);
      dummy.updateMatrix();
      ref.current.setMatrixAt(i, dummy.matrix);
    }
    ref.current.instanceMatrix.needsUpdate = true;
  });
  return (
    <group position={[x, 0, 0]}>
      <instancedMesh ref={ref} args={[undefined, undefined, count]}>
        <sphereGeometry args={[0.16, 10, 10]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.8} />
      </instancedMesh>
      <Holo color={HOLO} opacity={0.04}>
        <boxGeometry args={[3, 3, 3]} />
      </Holo>
    </group>
  );
}

export function StatesOfMatter({ params }: { params: Record<string, unknown> }) {
  const lab = useLab();
  const state = str(params.state, "all");
  const items = (["solid", "liquid", "gas"] as const).filter((s) => state === "all" || s === state);
  const spacing = 4.2;
  return (
    <group>
      {items.map((mode, i) => {
        const x = (i - (items.length - 1) / 2) * spacing;
        const color = mode === "solid" ? HOLO : mode === "liquid" ? GREEN : HOT;
        return (
          <group key={mode}>
            <Particles mode={mode} x={x} color={color} />
            <Label position={[x, 2.1, 0]} active={lab.activeStep === i}>
              {mode.toUpperCase()}
            </Label>
            <Label position={[x, -2.1, 0]} small>
              {mode === "solid" ? "fixed lattice · vibrates" : mode === "liquid" ? "close · slides past" : "far apart · fast & random"}
            </Label>
          </group>
        );
      })}
      <Floor y={-2.8} size={24} />
    </group>
  );
}
