import { Line } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import type { Group } from "three";
import { Floor, HOLO, Holo, Label, WARM, num, str, useLab } from "../holo";

type Shape = "cube" | "cuboid" | "sphere" | "cylinder" | "cone" | "pyramid" | "prism";

export interface GeometryFacts {
  shape: Shape;
  faces: number | string;
  edges: number | string;
  vertices: number | string;
  volume: string;
  volumeValue: number;
  surface: string;
  surfaceValue: number;
  dims: string;
}

export function geometryFacts(params: Record<string, unknown>): GeometryFacts {
  const shape = (str(params.shape, "cube").toLowerCase() as Shape) || "cube";
  const a = num(params.a, 3);
  const b = num(params.b, 2);
  const c = num(params.c, 1.5);
  const r = num(params.r, 1.5);
  const h = num(params.h, 3);
  const f = (v: number) => Number(v.toFixed(2));
  switch (shape) {
    case "cuboid":
      return { shape, faces: 6, edges: 12, vertices: 8, volume: "V = l · w · h", volumeValue: f(a * b * c), surface: "A = 2(lw + lh + wh)", surfaceValue: f(2 * (a * b + a * c + b * c)), dims: `l=${a}, w=${b}, h=${c}` };
    case "sphere":
      return { shape, faces: "1 curved", edges: 0, vertices: 0, volume: "V = 4/3 · π · r³", volumeValue: f((4 / 3) * Math.PI * r ** 3), surface: "A = 4 · π · r²", surfaceValue: f(4 * Math.PI * r * r), dims: `r=${r}` };
    case "cylinder":
      return { shape, faces: "3 (2 flat + 1 curved)", edges: 2, vertices: 0, volume: "V = π · r² · h", volumeValue: f(Math.PI * r * r * h), surface: "A = 2πr(r + h)", surfaceValue: f(2 * Math.PI * r * (r + h)), dims: `r=${r}, h=${h}` };
    case "cone": {
      const s = Math.sqrt(r * r + h * h);
      return { shape, faces: "2 (1 flat + 1 curved)", edges: 1, vertices: 1, volume: "V = 1/3 · π · r² · h", volumeValue: f((Math.PI * r * r * h) / 3), surface: "A = πr(r + s)", surfaceValue: f(Math.PI * r * (r + s)), dims: `r=${r}, h=${h}, s=${s.toFixed(2)}` };
    }
    case "pyramid": {
      const slant = Math.sqrt((a / 2) ** 2 + h * h);
      return { shape, faces: 5, edges: 8, vertices: 5, volume: "V = 1/3 · a² · h", volumeValue: f((a * a * h) / 3), surface: "A = a² + 2·a·s", surfaceValue: f(a * a + 2 * a * slant), dims: `a=${a}, h=${h}` };
    }
    case "prism": {
      const tri = (Math.sqrt(3) / 4) * a * a;
      return { shape, faces: 5, edges: 9, vertices: 6, volume: "V = (√3/4 · a²) · h", volumeValue: f(tri * h), surface: "A = 2·(√3/4·a²) + 3·a·h", surfaceValue: f(2 * tri + 3 * a * h), dims: `a=${a}, h=${h}` };
    }
    case "cube":
    default:
      return { shape: "cube", faces: 6, edges: 12, vertices: 8, volume: "V = a³", volumeValue: f(a ** 3), surface: "A = 6 · a²", surfaceValue: f(6 * a * a), dims: `a=${a}` };
  }
}

function Vertices({ points }: { points: [number, number, number][] }) {
  return (
    <>
      {points.map((p, i) => (
        <mesh key={i} position={p}>
          <sphereGeometry args={[0.07, 10, 10]} />
          <meshBasicMaterial color="#ffffff" />
        </mesh>
      ))}
    </>
  );
}

function DimLabel({ from, to, text }: { from: [number, number, number]; to: [number, number, number]; text: string }) {
  const mid: [number, number, number] = [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2, (from[2] + to[2]) / 2];
  return (
    <>
      <Line points={[from, to]} color={WARM} lineWidth={2} />
      <Label position={mid} small>
        {text}
      </Label>
    </>
  );
}

/** Cube/cuboid net: faces hinged on the base, folding flat as the lab "unfold" toggle turns on. */
function BoxNet({ w, h, d }: { w: number; h: number; d: number }) {
  const lab = useLab();
  const t = useRef(0);
  const root = useRef<Group>(null);
  const front = useRef<Group>(null);
  const back = useRef<Group>(null);
  const top = useRef<Group>(null);
  const right = useRef<Group>(null);
  const left = useRef<Group>(null);
  useFrame((_s, delta) => {
    const target = lab.toggle ? 1 : 0;
    t.current += (target - t.current) * Math.min(1, delta * 3);
    const fold = (Math.PI / 2) * (1 - t.current);
    if (root.current) root.current.visible = t.current > 0.02;
    if (front.current) front.current.rotation.x = fold;
    if (back.current) back.current.rotation.x = -fold;
    if (top.current) top.current.rotation.x = -fold;
    if (right.current) right.current.rotation.z = -fold;
    if (left.current) left.current.rotation.z = fold;
  });
  const hl = (i: number) => (lab.activeStep === i ? "#ffffff" : HOLO);
  const face = (fw: number, fh: number, color: string) => (
    <Holo color={color} opacity={0.3}>
      <boxGeometry args={[fw, 0.04, fh]} />
    </Holo>
  );
  return (
    <group ref={root} position={[0, -h / 2, 0]}>
      {face(w, d, hl(0))}
      <group ref={front} position={[0, 0, d / 2]}>
        <group position={[0, 0, h / 2]}>{face(w, h, hl(1))}</group>
      </group>
      <group ref={back} position={[0, 0, -d / 2]}>
        <group position={[0, 0, -h / 2]}>
          {face(w, h, hl(2))}
          <group ref={top} position={[0, 0, -h / 2]}>
            <group position={[0, 0, -d / 2]}>{face(w, d, hl(5))}</group>
          </group>
        </group>
      </group>
      <group ref={right} position={[w / 2, 0, 0]}>
        <group position={[h / 2, 0, 0]}>{face(h, d, hl(3))}</group>
      </group>
      <group ref={left} position={[-w / 2, 0, 0]}>
        <group position={[-h / 2, 0, 0]}>{face(h, d, hl(4))}</group>
      </group>
    </group>
  );
}

export function GeometryScene({ params }: { params: Record<string, unknown> }) {
  const lab = useLab();
  const facts = geometryFacts(params);
  const a = num(params.a, 3);
  const b = num(params.b, 2);
  const c = num(params.c, 1.5);
  const r = num(params.r, 1.5);
  const h = num(params.h, 3);
  const netT = useRef(0);
  const solidGroup = useRef<Group>(null);
  useFrame((_s, delta) => {
    const target = lab.toggle ? 1 : 0;
    netT.current += (target - netT.current) * Math.min(1, delta * 3);
    if (solidGroup.current) solidGroup.current.visible = netT.current < 0.5;
  });
  const [w, hh, d] = facts.shape === "cuboid" ? [a, c, b] : [a, a, a];
  const boxVerts = useMemo(() => {
    const out: [number, number, number][] = [];
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) out.push([(sx * w) / 2, (sy * hh) / 2, (sz * d) / 2]);
    return out;
  }, [w, hh, d]);
  const isBox = facts.shape === "cube" || facts.shape === "cuboid";
  const active = lab.activeStep >= 0;

  return (
    <group>
      <group ref={solidGroup}>
        {isBox && (
          <>
            <Holo color={HOLO} opacity={0.22} active={active}>
              <boxGeometry args={[w, hh, d]} />
            </Holo>
            <Vertices points={boxVerts} />
            <DimLabel from={[-w / 2, -hh / 2 - 0.25, d / 2]} to={[w / 2, -hh / 2 - 0.25, d / 2]} text={facts.shape === "cube" ? `a = ${a}` : `l = ${a}`} />
            {facts.shape === "cuboid" && (
              <>
                <DimLabel from={[w / 2 + 0.25, -hh / 2, d / 2]} to={[w / 2 + 0.25, hh / 2, d / 2]} text={`h = ${c}`} />
                <DimLabel from={[w / 2 + 0.25, -hh / 2, d / 2]} to={[w / 2 + 0.25, -hh / 2, -d / 2]} text={`w = ${b}`} />
              </>
            )}
          </>
        )}
        {facts.shape === "sphere" && (
          <>
            <Holo color={HOLO} opacity={0.18} edges={false} active={active}>
              <sphereGeometry args={[r, 32, 24]} />
            </Holo>
            <mesh>
              <sphereGeometry args={[r, 24, 16]} />
              <meshBasicMaterial color={HOLO} wireframe transparent opacity={0.25} />
            </mesh>
            <DimLabel from={[0, 0, 0]} to={[r, 0, 0]} text={`r = ${r}`} />
          </>
        )}
        {facts.shape === "cylinder" && (
          <>
            <Holo color={HOLO} opacity={0.2} active={active}>
              <cylinderGeometry args={[r, r, h, 48]} />
            </Holo>
            <DimLabel from={[0, h / 2, 0]} to={[r, h / 2, 0]} text={`r = ${r}`} />
            <DimLabel from={[r + 0.3, -h / 2, 0]} to={[r + 0.3, h / 2, 0]} text={`h = ${h}`} />
          </>
        )}
        {facts.shape === "cone" && (
          <>
            <Holo color={HOLO} opacity={0.2} active={active}>
              <coneGeometry args={[r, h, 48]} />
            </Holo>
            <Vertices points={[[0, h / 2, 0]]} />
            <DimLabel from={[0, -h / 2, 0]} to={[r, -h / 2, 0]} text={`r = ${r}`} />
            <DimLabel from={[r + 0.3, -h / 2, 0]} to={[r + 0.3, h / 2, 0]} text={`h = ${h}`} />
            <DimLabel from={[0, h / 2, 0]} to={[-r, -h / 2, 0]} text="s (slant)" />
          </>
        )}
        {facts.shape === "pyramid" && (
          <>
            <Holo color={HOLO} opacity={0.22} active={active} rotation={[0, Math.PI / 4, 0]}>
              <coneGeometry args={[(a / 2) * Math.SQRT2, h, 4]} />
            </Holo>
            <Vertices points={[[0, h / 2, 0], [a / 2, -h / 2, a / 2], [-a / 2, -h / 2, a / 2], [a / 2, -h / 2, -a / 2], [-a / 2, -h / 2, -a / 2]]} />
            <DimLabel from={[-a / 2, -h / 2 - 0.25, a / 2]} to={[a / 2, -h / 2 - 0.25, a / 2]} text={`a = ${a}`} />
            <DimLabel from={[0, -h / 2, 0]} to={[0, h / 2, 0]} text={`h = ${h}`} />
          </>
        )}
        {facts.shape === "prism" && (
          <>
            <Holo color={HOLO} opacity={0.22} active={active} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[a / Math.sqrt(3), a / Math.sqrt(3), h, 3]} />
            </Holo>
            <DimLabel from={[-a / 2, -a / (2 * Math.sqrt(3)) - 0.25, h / 2]} to={[a / 2, -a / (2 * Math.sqrt(3)) - 0.25, h / 2]} text={`a = ${a}`} />
            <DimLabel from={[a / 2 + 0.3, -a / (2 * Math.sqrt(3)), h / 2]} to={[a / 2 + 0.3, -a / (2 * Math.sqrt(3)), -h / 2]} text={`h = ${h}`} />
          </>
        )}
      </group>
      {isBox && <BoxNet w={w} h={hh} d={d} />}
      <Label position={[0, Math.max(hh, h, r * 2) / 2 + 1.1, 0]}>
        {facts.shape.toUpperCase()} · {facts.volume} = {facts.volumeValue}
      </Label>
      <Label position={[0, -Math.max(hh, h, r * 2) / 2 - 1.1, 0]} small>
        {facts.surface} = {facts.surfaceValue} · F {facts.faces} · E {facts.edges} · V {facts.vertices}
      </Label>
      <Floor y={-Math.max(hh, h, r * 2) / 2 - 1.8} size={20} />
    </group>
  );
}
