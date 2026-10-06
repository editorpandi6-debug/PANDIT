import { Line } from "@react-three/drei";
import { useMemo } from "react";
import { BufferAttribute, BufferGeometry, Color, DoubleSide } from "three";
import { Floor, GREEN, HOLO, HOT, Label, WARM, VIOLET, num, str, useLab } from "../holo";
import { compileExpression, prettyExpression } from "../mathParser";

const COLORS = [HOLO, WARM, GREEN, VIOLET, HOT];

function Axes2D({ range }: { range: number }) {
  const ticks = useMemo(() => {
    const out: number[] = [];
    const step = range > 12 ? 5 : range > 6 ? 2 : 1;
    for (let v = -range; v <= range; v += step) if (v !== 0) out.push(v);
    return out;
  }, [range]);
  return (
    <group>
      <Line points={[[-range - 0.5, 0, 0], [range + 0.5, 0, 0]]} color="#ffb0bc" lineWidth={1.5} />
      <Line points={[[0, -range - 0.5, 0], [0, range + 0.5, 0]]} color="#ffb0bc" lineWidth={1.5} />
      {ticks.map((v) => (
        <group key={v}>
          <Line points={[[v, -0.12, 0], [v, 0.12, 0]]} color="#ffb0bc" />
          <Line points={[[-0.12, v, 0], [0.12, v, 0]]} color="#ffb0bc" />
          <Label position={[v, -0.5, 0]} small>
            {v}
          </Label>
          <Label position={[-0.5, v, 0]} small>
            {v}
          </Label>
        </group>
      ))}
      <Label position={[range + 1, 0, 0]} small>
        x
      </Label>
      <Label position={[0, range + 1, 0]} small>
        y
      </Label>
      <gridHelper args={[range * 2, range * 2, "#5a1020", "#3a0a12"]} rotation={[Math.PI / 2, 0, 0]} />
    </group>
  );
}

function Curve2D({ expr, color, range, active }: { expr: string; color: string; range: number; active: boolean }) {
  const points = useMemo(() => {
    const fn = compileExpression(expr);
    if (!fn) return [];
    const segs: [number, number, number][][] = [[]];
    const n = 400;
    for (let i = 0; i <= n; i += 1) {
      const x = -range + (2 * range * i) / n;
      const y = fn(x, 0);
      if (!Number.isFinite(y) || Math.abs(y) > range * 2) {
        if (segs[segs.length - 1].length) segs.push([]);
        continue;
      }
      segs[segs.length - 1].push([x, y, 0]);
    }
    return segs.filter((s) => s.length > 1);
  }, [expr, range]);
  return (
    <>
      {points.map((seg, i) => (
        <Line key={i} points={seg} color={active ? "#ffffff" : color} lineWidth={active ? 3 : 2} />
      ))}
    </>
  );
}

export function GraphScene({ params }: { params: Record<string, unknown> }) {
  const lab = useLab();
  const mode = str(params.mode, "2d");
  const exprs = (Array.isArray(params.expressions) ? params.expressions : [params.expression ?? "x^2"]).map((e) => String(e)).slice(0, 5);
  const rangeArr = Array.isArray(params.xRange) ? params.xRange : [-5, 5];
  const range = Math.max(2, Math.min(20, Math.abs(num(rangeArr[1], 5))));
  if (mode === "3d") return <Surface3D expr={exprs[0]} range={range} />;
  const invalid = exprs.filter((e) => !compileExpression(e));
  return (
    <group>
      <Axes2D range={range} />
      {exprs.map((e, i) => (
        <Curve2D key={e + i} expr={e} color={COLORS[i % COLORS.length]} range={range} active={lab.activeStep === i} />
      ))}
      {exprs.map((e, i) => (
        <Label key={`l${i}`} position={[-range + 0.6, range - 0.6 - i * 0.7, 0]} small active={lab.activeStep === i}>
          <span style={{ color: COLORS[i % COLORS.length] }}>■</span> y = {prettyExpression(e)}
        </Label>
      ))}
      {invalid.length > 0 && (
        <Label position={[0, -range - 1.2, 0]} small>
          Could not plot: {invalid.join(", ")}
        </Label>
      )}
    </group>
  );
}

function Surface3D({ expr, range }: { expr: string; range: number }) {
  const geometry = useMemo(() => {
    const fn = compileExpression(expr);
    const n = 60;
    const geo = new BufferGeometry();
    const positions: number[] = [];
    const colors: number[] = [];
    const indices: number[] = [];
    const lo = new Color("#8a1020");
    const hi = new Color("#ffffff");
    let minZ = Infinity;
    let maxZ = -Infinity;
    const zs: number[] = [];
    for (let i = 0; i <= n; i += 1) {
      for (let j = 0; j <= n; j += 1) {
        const x = -range + (2 * range * i) / n;
        const y = -range + (2 * range * j) / n;
        let z = fn ? fn(x, y) : 0;
        if (!Number.isFinite(z)) z = 0;
        z = Math.max(-range, Math.min(range, z));
        zs.push(z);
        minZ = Math.min(minZ, z);
        maxZ = Math.max(maxZ, z);
        positions.push(x, z, y);
      }
    }
    const span = maxZ - minZ || 1;
    for (const z of zs) {
      const c = lo.clone().lerp(hi, (z - minZ) / span);
      colors.push(c.r, c.g, c.b);
    }
    for (let i = 0; i < n; i += 1) {
      for (let j = 0; j < n; j += 1) {
        const a = i * (n + 1) + j;
        const b = a + n + 1;
        indices.push(a, b, a + 1, b, b + 1, a + 1);
      }
    }
    geo.setAttribute("position", new BufferAttribute(new Float32Array(positions), 3));
    geo.setAttribute("color", new BufferAttribute(new Float32Array(colors), 3));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    return geo;
  }, [expr, range]);
  return (
    <group>
      <mesh geometry={geometry}>
        <meshStandardMaterial vertexColors side={DoubleSide} transparent opacity={0.85} emissive={HOLO} emissiveIntensity={0.15} />
      </mesh>
      <mesh geometry={geometry}>
        <meshBasicMaterial color={HOLO} wireframe transparent opacity={0.12} />
      </mesh>
      <Line points={[[-range, 0, 0], [range, 0, 0]]} color="#ffb0bc" />
      <Line points={[[0, 0, -range], [0, 0, range]]} color="#ffb0bc" />
      <Line points={[[0, -range / 2, 0], [0, range / 2, 0]]} color="#ffb0bc" />
      <Label position={[range + 0.6, 0, 0]} small>
        x
      </Label>
      <Label position={[0, 0, range + 0.6]} small>
        y
      </Label>
      <Label position={[0, range / 2 + 0.6, 0]} small>
        z
      </Label>
      <Label position={[0, range / 2 + 1.4, 0]}>z = {prettyExpression(expr)}</Label>
      <Floor y={-range / 2 - 0.5} size={range * 2 + 4} />
    </group>
  );
}

/** Equation solving: plot f(x) with its roots marked; the steps panel (outside the canvas) highlights as PANDI speaks. */
export function EquationScene({ params }: { params: Record<string, unknown> }) {
  const lab = useLab();
  const expr = str(params.expression, "3*x^2 - 12");
  const roots = (Array.isArray(params.roots) ? params.roots : []).map((r) => num(r, NaN)).filter((r) => Number.isFinite(r));
  const fn = compileExpression(expr);
  const range = Math.max(4, Math.min(20, Math.ceil(Math.max(3, ...roots.map((r) => Math.abs(r) + 1.5)))));
  return (
    <group>
      <Axes2D range={range} />
      <Curve2D expr={expr} color={HOLO} range={range} active={lab.activeStep >= 0} />
      <Label position={[-range + 0.6, range - 0.6, 0]} small>
        f(x) = {prettyExpression(expr)}
      </Label>
      {roots.map((r, i) => (
        <group key={i} position={[r, 0, 0]}>
          <mesh>
            <sphereGeometry args={[0.16, 16, 16]} />
            <meshStandardMaterial color={WARM} emissive={WARM} emissiveIntensity={2} />
          </mesh>
          <Label position={[0, 0.7 + (i % 2) * 0.5, 0]} small active>
            x = {r}
          </Label>
        </group>
      ))}
      {fn && roots.length === 0 && (
        <Label position={[0, -range - 1.2, 0]} small>
          Roots are where the curve crosses the x-axis
        </Label>
      )}
    </group>
  );
}
