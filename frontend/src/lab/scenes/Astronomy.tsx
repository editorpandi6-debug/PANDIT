import { Line } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  AdditiveBlending, BackSide, BufferGeometry, CanvasTexture, ClampToEdgeWrapping, Color, DoubleSide,
  Float32BufferAttribute, LinearFilter, RingGeometry, SRGBColorSpace, ShaderMaterial, Vector3,
} from "three";
import type { Group, Mesh, Points as PointsObject } from "three";
import { Floor, HOLO, HOT, Holo, Label, Spin, WARM, str, useLab, useLabClock } from "../holo";
import { SOLAR_SYSTEM_BODIES } from "./solarSystemData";

const PLANETS = SOLAR_SYSTEM_BODIES.slice(1).map((body) => ({
  ...body,
  r: body.radius,
  orbit: body.orbitRadius,
  period: body.periodDays / 365.25,
}));

// Atmosphere glow per planet (fresnel shader, additive).
/* ------------------------------------------------------------------ */
/* Procedural noise + textures                                         */
/* ------------------------------------------------------------------ */

function seededRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function hashNoise(x: number, y: number, z: number) {
  let value = Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(z, 2147483647);
  value = Math.imul(value ^ (value >>> 13), 1274126177);
  return ((value ^ (value >>> 16)) >>> 0) / 4294967295;
}

function valueNoise(x: number, y: number, z: number) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const iz = Math.floor(z);
  const smooth = (value: number) => value * value * (3 - 2 * value);
  const tx = smooth(x - ix);
  const ty = smooth(y - iy);
  const tz = smooth(z - iz);
  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
  const plane = (dz: number) => lerp(
    lerp(hashNoise(ix, iy, iz + dz), hashNoise(ix + 1, iy, iz + dz), tx),
    lerp(hashNoise(ix, iy + 1, iz + dz), hashNoise(ix + 1, iy + 1, iz + dz), tx),
    ty,
  );
  return lerp(plane(0), plane(1), tz);
}

function fractalNoise(x: number, y: number, z: number, octaves = 5) {
  let total = 0;
  let amplitude = 0.5;
  let frequency = 1;
  for (let octave = 0; octave < octaves; octave += 1) {
    total += amplitude * valueNoise(x * frequency, y * frequency, z * frequency);
    frequency *= 2;
    amplitude *= 0.5;
  }
  return total / 0.97;
}

function blendColor(from: number[], to: number[], amount: number) {
  const t = Math.max(0, Math.min(1, amount));
  return [
    from[0] + (to[0] - from[0]) * t,
    from[1] + (to[1] - from[1]) * t,
    from[2] + (to[2] - from[2]) * t,
  ];
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

function defaultSize(name: string): [number, number] {
  if (name === "Earth") return [1024, 512];
  if (name === "Moon") return [256, 128];
  return [512, 256];
}

function createPlanetTexture(name: string, width = defaultSize(name)[0], height = defaultSize(name)[1]) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Could not create a planet texture.");

  const palettes: Record<string, [number[], number[]]> = {
    Sun: [[220, 57, 8], [255, 219, 92]],
    Mercury: [[52, 48, 47], [185, 176, 163]],
    Venus: [[185, 137, 79], [249, 229, 178]],
    Earth: [[4, 17, 58], [37, 112, 177]],
    Mars: [[107, 43, 26], [221, 139, 84]],
    Jupiter: [[127, 79, 53], [235, 213, 181]],
    Saturn: [[164, 135, 91], [242, 225, 184]],
    Uranus: [[91, 156, 169], [190, 233, 232]],
    Neptune: [[15, 35, 112], [78, 132, 235]],
    Moon: [[77, 74, 71], [197, 194, 187]],
  };
  const [dark, light] = palettes[name] ?? palettes.Earth;
  const image = context.createImageData(canvas.width, canvas.height);
  const bandNoise = (lat: number, x: number, y: number, z: number, frequency: number, warp: number) =>
    Math.sin(lat * frequency + fractalNoise(x * 3, y * 6, z * 3, 4) * warp);

  for (let row = 0; row < height; row += 1) {
    const lat = (0.5 - (row + 0.5) / height) * Math.PI;
    const y = Math.sin(lat);
    const horizontal = Math.cos(lat);
    for (let col = 0; col < width; col += 1) {
      const lon = (col / width) * Math.PI * 2;
      const x = horizontal * Math.cos(lon);
      const z = horizontal * Math.sin(lon);
      let color: number[];

      switch (name) {
        case "Sun": {
          const broad = fractalNoise(x * 7, y * 7, z * 7, 5);
          const fine = fractalNoise(x * 22, y * 22, z * 22, 3);
          color = blendColor(dark, light, broad * 1.15 + fine * 0.35 - 0.15);
          break;
        }
        case "Mercury": {
          const broad = fractalNoise(x * 6, y * 6, z * 6, 6);
          const crater = Math.abs(fractalNoise(x * 18, y * 18, z * 18, 3) - 0.5);
          color = blendColor(dark, light, broad * 1.25 - crater * 0.55 + valueNoise(x * 14, y * 14, z * 14) * 0.18);
          break;
        }
        case "Venus": {
          const warp = fractalNoise(x * 4, y * 4, z * 4, 3);
          const clouds = fractalNoise(x * 2.2 + warp * 1.2, y * 3.5, z * 2.2, 5);
          color = blendColor(dark, light, clouds * 1.3 - 0.1 + Math.sin(lat * 8) * 0.05);
          break;
        }
        case "Earth": {
          const continent = fractalNoise(x * 2.1 + 3, y * 2.1, z * 2.1, 6);
          const absLat = Math.abs(lat);
          if (absLat > 1.25 || (absLat > 1.1 && fractalNoise(x * 9, y * 9, z * 9, 3) > 0.5 + (1.25 - absLat) * 2)) {
            color = [235, 240, 244];
          } else if (continent < 0.5) {
            color = blendColor([5, 23, 68], [24, 112, 178], (continent - 0.3) / 0.2);
          } else {
            const dryness = fractalNoise(x * 3 + 9, y * 3, z * 3, 4);
            const elevation = (continent - 0.5) / 0.15;
            color = blendColor([34, 96, 43], [172, 143, 88], dryness * 1.5 - 0.35 + (Math.abs(absLat - 0.45) < 0.2 ? 0.35 : 0));
            color = blendColor(color, [112, 103, 91], elevation - 0.6);
            if (absLat > 1) color = blendColor(color, [238, 240, 244], (absLat - 1) * 3);
          }
          const shade = (fractalNoise(x * 8, y * 8, z * 8, 4) - 0.5) * 18;
          color = color.map((channel) => Math.max(0, Math.min(255, channel + shade)));
          break;
        }
        case "Mars": {
          const broad = fractalNoise(x * 3, y * 3, z * 3, 6);
          color = blendColor(dark, light, broad * 1.3 - 0.1);
          const darkRegion = fractalNoise(x * 1.5 + 5, y * 1.5, z * 1.5, 4);
          if (darkRegion > 0.54) color = blendColor(color, [77, 38, 29], (darkRegion - 0.54) * 5);
          if (Math.abs(lat) > 1.38) color = blendColor(color, [245, 245, 250], (Math.abs(lat) - 1.38) * 12);
          break;
        }
        case "Jupiter": {
          const t = (bandNoise(lat, x, y, z, 16, 2.4) + 1) / 2;
          color = blendColor(blendColor([132, 88, 58], [214, 176, 134], t * 2), [240, 226, 200], t * t * 1.2 - 0.3);
          const longitude = Math.atan2(z, x);
          const dLon = Math.atan2(Math.sin(longitude - 2.2), Math.cos(longitude - 2.2));
          const spot = (dLon * dLon) / 0.045 + ((lat + 0.38) ** 2) / 0.012; // Great Red Spot
          if (spot < 1) color = blendColor(color, [176, 74, 46], (1 - spot) * 1.6);
          const detail = fractalNoise(x * 8, y * 8, z * 8, 4);
          color = blendColor(color, [255, 233, 207], Math.min(0.15, (detail - 0.5) * 0.3));
          break;
        }
        case "Saturn": {
          const bands = bandNoise(lat, x, y, z, 22, 1);
          const detail = valueNoise(x * 8, y * 8, z * 8);
          color = blendColor([176, 146, 98], [238, 222, 176], ((bands + 1) / 2) * 1.15 + (detail - 0.5) * 0.18);
          break;
        }
        case "Uranus": {
          const bands = (Math.sin(lat * 10 + fractalNoise(x * 2, y * 4, z * 2, 3) * 1.5) + 1) / 2;
          color = blendColor([132, 206, 214], [176, 232, 236], bands * 0.6 + 0.2);
          break;
        }
        case "Neptune": {
          const bands = (Math.sin(lat * 12 + fractalNoise(x * 3, y * 5, z * 3, 4) * 2.5) + 1) / 2;
          const broad = fractalNoise(x * 2, y * 2, z * 2, 5);
          color = blendColor([28, 58, 170], [70, 120, 236], bands * 0.8 + broad * 0.3);
          const longitude = Math.atan2(z, x);
          const dLon = Math.atan2(Math.sin(longitude - 1), Math.cos(longitude - 1));
          const storm = (dLon * dLon) / 0.04 + ((lat + 0.4) ** 2) / 0.02; // Great Dark Spot
          if (storm < 1) color = blendColor(color, [14, 30, 110], 1 - storm);
          break;
        }
        case "Moon": {
          const maria = fractalNoise(x * 1.6 + 9, y * 1.6, z * 1.6, 4);
          const craters = Math.abs(fractalNoise(x * 18, y * 18, z * 18, 3) - 0.5);
          const broad = fractalNoise(x * 8, y * 8, z * 8, 6);
          color = blendColor(dark, light, broad - craters * 0.5 + 0.15);
          if (maria > 0.56) color = blendColor(color, [58, 58, 60], (maria - 0.56) * 8);
          break;
        }
        default:
          color = blendColor(dark, light, fractalNoise(x * 2, y * 2, z * 2, 5));
      }

      const index = (row * width + col) * 4;
      image.data[index] = color[0];
      image.data[index + 1] = color[1];
      image.data[index + 2] = color[2];
      image.data[index + 3] = 255;
    }
  }
  context.putImageData(image, 0, 0);

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 8;
  texture.wrapS = ClampToEdgeWrapping;
  texture.wrapT = ClampToEdgeWrapping;
  texture.minFilter = LinearFilter;
  return texture;
}

function createCloudTexture() {
  const width = 256;
  const height = 128;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Could not create Earth's cloud texture.");
  const image = context.createImageData(width, height);
  for (let row = 0; row < height; row += 1) {
    const lat = (0.5 - (row + 0.5) / height) * Math.PI;
    const y = Math.sin(lat);
    const horizontal = Math.cos(lat);
    for (let col = 0; col < width; col += 1) {
      const lon = (col / width) * Math.PI * 2;
      const x = horizontal * Math.cos(lon);
      const z = horizontal * Math.sin(lon);
      const cloud = fractalNoise(x * 3.2 + 20, y * 5, z * 3.2, 6);
      const index = (row * width + col) * 4;
      image.data[index] = 255;
      image.data[index + 1] = 255;
      image.data[index + 2] = 255;
      image.data[index + 3] = Math.max(0, Math.min(235, (cloud - 0.5) * 900));
    }
  }
  context.putImageData(image, 0, 0);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.minFilter = LinearFilter;
  return texture;
}

function createGlowTexture(stops: [number, string][]) {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Could not create a glow texture.");
  const gradient = context.createRadialGradient(128, 128, 0, 128, 128, 128);
  stops.forEach(([at, color]) => gradient.addColorStop(at, color));
  context.fillStyle = gradient;
  context.fillRect(0, 0, 256, 256);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

/** One-pixel-tall strip: C ring, B ring, Cassini division, A ring, fade-out. Mapped radially onto a ring geometry. */
function createRingTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 2;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Could not create Saturn's ring texture.");
  for (let k = 0; k < 1024; k += 1) {
    const t = k / 1024;
    let a = t < 0.12 ? 0.15 + t * 2
      : t < 0.56 ? 0.7 + 0.2 * Math.sin(t * 140)
      : t < 0.63 ? 0.04
      : t < 0.94 ? 0.6 + 0.12 * Math.sin(t * 210)
      : Math.max(0, (1 - t) * 8) * 0.5;
    a *= 0.85 + 0.15 * Math.sin(t * 620);
    const shade = 200 + Math.sin(t * 90) * 25;
    context.fillStyle = `rgba(${shade},${shade - 22},${shade - 62},${clamp01(a)})`;
    context.fillRect(k, 0, 1, 2);
  }
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

/* ------------------------------------------------------------------ */
/* Small building blocks                                               */
/* ------------------------------------------------------------------ */

function usePlanetTexture(name: string, width?: number, height?: number) {
  const texture = useMemo(() => createPlanetTexture(name, width, height), [name, width, height]);
  useEffect(() => () => texture.dispose(), [texture]);
  return texture;
}

const ATMOSPHERE_VERTEX = "varying vec3 vN;void main(){vN=normalize(normalMatrix*normal);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}";
const ATMOSPHERE_FRAGMENT = "varying vec3 vN;uniform vec3 glow;void main(){float i=pow(max(0.72-dot(vN,vec3(0.0,0.0,1.0)),0.0),3.0);gl_FragColor=vec4(glow*i*1.8,i);}";

function Atmosphere({ radius, color }: { radius: number; color: string }) {
  const material = useMemo(() => new ShaderMaterial({
    uniforms: { glow: { value: new Color(color) } },
    vertexShader: ATMOSPHERE_VERTEX,
    fragmentShader: ATMOSPHERE_FRAGMENT,
    side: BackSide,
    blending: AdditiveBlending,
    transparent: true,
    depthWrite: false,
  }), [color]);
  useEffect(() => () => material.dispose(), [material]);
  return (
    <mesh scale={1.13}>
      <sphereGeometry args={[radius, 48, 32]} />
      <primitive object={material} attach="material" />
    </mesh>
  );
}

function SaturnRings({ radius }: { radius: number }) {
  const { geometry, texture } = useMemo(() => {
    const inner = radius * 1.3;
    const outer = radius * 2.35;
    const geo = new RingGeometry(inner, outer, 128, 1);
    const pos = geo.attributes.position;
    const uv = geo.attributes.uv;
    const v = new Vector3();
    for (let i = 0; i < pos.count; i += 1) {
      v.fromBufferAttribute(pos, i);
      uv.setXY(i, (v.length() - inner) / (outer - inner), 0.5);
    }
    return { geometry: geo, texture: createRingTexture() };
  }, [radius]);
  useEffect(() => () => {
    geometry.dispose();
    texture.dispose();
  }, [geometry, texture]);
  return (
    <mesh geometry={geometry} rotation={[-Math.PI / 2, 0, 0]}>
      <meshStandardMaterial map={texture} transparent side={DoubleSide} roughness={1} depthWrite={false} />
    </mesh>
  );
}

function OrbitRing({ radius, active, visible }: { radius: number; active?: boolean; visible: boolean }) {
  const points = useMemo(() => {
    const pts: [number, number, number][] = [];
    for (let i = 0; i <= 192; i += 1) {
      const a = (i / 192) * Math.PI * 2;
      pts.push([Math.cos(a) * radius, 0, Math.sin(a) * radius]);
    }
    return pts;
  }, [radius]);
  return <Line points={points} color={active ? "#ffffff" : HOLO} transparent opacity={active ? 0.9 : 0.28} lineWidth={1} visible={visible} />;
}

/* ------------------------------------------------------------------ */
/* Planets                                                             */
/* ------------------------------------------------------------------ */

function Planet({ index, selected, showLabel, onSelect }: { index: number; selected: boolean; showLabel: boolean; onSelect: (i: number) => void }) {
  const p = PLANETS[index];
  const lab = useLab();
  const group = useRef<Group>(null);
  const body = useRef<Mesh>(null);
  const clouds = useRef<Mesh>(null);
  const clock = useLabClock();
  const texture = usePlanetTexture(p.name);
  const cloudTexture = useMemo(() => (p.name === "Earth" ? createCloudTexture() : null), [p.name]);
  useEffect(() => () => cloudTexture?.dispose(), [cloudTexture]);
  const phase = (index * 0.9) % (Math.PI * 2);
  const active = selected || lab.activeStep - 1 === index;
  useFrame(() => {
    if (!group.current) return;
    const elapsedDays = clock.current * 16;
    const angle = phase + (elapsedDays * (Math.PI * 2)) / (p.period * 365.25);
    group.current.position.set(Math.cos(angle) * p.orbit, 0, Math.sin(angle) * p.orbit);
    if (body.current) body.current.rotation.y = clock.current * p.spin;
    if (clouds.current) clouds.current.rotation.y = -clock.current * 0.24;
  });
  const labelY = p.r * 1.1 + 0.1;
  const atmosphere = p.atmosphere;
  return (
    <group ref={group} name={`solar-body-${p.name}`}>
      <group rotation={[0, 0, (p.tilt * Math.PI) / 180]}>
        <mesh
          ref={body}
          onClick={(e) => {
            e.stopPropagation();
            onSelect(index);
          }}
          onPointerOver={() => (document.body.style.cursor = "pointer")}
          onPointerOut={() => (document.body.style.cursor = "auto")}
        >
          <sphereGeometry args={[p.r, 64, 48]} />
          {/* Texture carries the real color; emissive only adds a subtle highlight when selected. */}
          <meshStandardMaterial map={texture} emissive={p.color} emissiveIntensity={active ? 0.08 : 0} roughness={p.name === "Earth" ? 0.7 : 0.9} metalness={0} />
        </mesh>
        {p.name === "Earth" && cloudTexture && (
          <mesh ref={clouds} scale={1.015}>
            <sphereGeometry args={[p.r, 64, 48]} />
            <meshStandardMaterial map={cloudTexture} transparent opacity={0.85} depthWrite={false} roughness={1} />
          </mesh>
        )}
        {atmosphere && <Atmosphere radius={p.r} color={atmosphere} />}
        {p.name === "Saturn" && <SaturnRings radius={p.r} />}
        {p.name === "Earth" && <Moon clock={clock} />}
      </group>
      {showLabel && (
        <Label position={[0, labelY, 0]} active={active} compact onClick={() => onSelect(index)}>
          {p.name}
        </Label>
      )}
    </group>
  );
}

function Moon({ clock }: { clock: { current: number } }) {
  const ref = useRef<Mesh>(null);
  const texture = usePlanetTexture("Moon", 256, 128);
  useFrame(() => {
    if (!ref.current) return;
    const a = clock.current * 0.23;
    ref.current.position.set(Math.cos(a) * 0.39, 0.035, Math.sin(a) * 0.39);
  });
  return (
    <mesh ref={ref}>
      <sphereGeometry args={[0.08, 24, 18]} />
      <meshStandardMaterial map={texture} roughness={1} />
    </mesh>
  );
}

/* ------------------------------------------------------------------ */
/* Sky: stars, Milky Way band, asteroid belt                           */
/* ------------------------------------------------------------------ */

function Stars() {
  const points = useRef<PointsObject>(null);
  const lab = useLab();
  const geometry = useMemo(() => {
    const random = seededRandom(2026);
    const total = 7000;
    const positions = new Float32Array(total * 3);
    const colors = new Float32Array(total * 3);
    const tilt = Math.cos(1.1);
    const tiltSin = Math.sin(1.1);
    for (let i = 0; i < total; i += 1) {
      let x: number;
      let y: number;
      let z: number;
      let dim = 1;
      if (i < 3500) {
        // uniform stars on a sphere
        const theta = random() * Math.PI * 2;
        const u = random() * 2 - 1;
        const horizontal = Math.sqrt(1 - u * u);
        x = horizontal * Math.cos(theta);
        y = u;
        z = horizontal * Math.sin(theta);
      } else {
        // dense, dimmer band = Milky Way
        const theta = random() * Math.PI * 2;
        const spread = (random() + random() + random() - 1.5) * 0.35;
        const bx = Math.cos(theta);
        const by = spread * 2;
        const bz = Math.sin(theta);
        const length = Math.hypot(bx, by, bz);
        x = bx / length;
        y = (by / length) * tilt - (bz / length) * tiltSin;
        z = (by / length) * tiltSin + (bz / length) * tilt;
        dim = 0.5;
      }
      const radius = 150 + random() * 50;
      positions.set([x * radius, y * radius, z * radius], i * 3);
      const kind = random();
      const tint = kind < 0.25 ? [0.7, 0.8, 1] : kind > 0.8 ? [1, 0.85, 0.7] : [1, 1, 1];
      const brightness = (0.35 + random() * 0.65) * dim;
      colors.set([tint[0] * brightness, tint[1] * brightness, tint[2] * brightness], i * 3);
    }
    const result = new BufferGeometry();
    result.setAttribute("position", new Float32BufferAttribute(positions, 3));
    result.setAttribute("color", new Float32BufferAttribute(colors, 3));
    return result;
  }, []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  useFrame((_state, delta) => {
    if (points.current && lab.playing) points.current.rotation.y += delta * 0.003 * lab.speed;
  });
  return (
    <points ref={points} geometry={geometry}>
      <pointsMaterial vertexColors size={1.6} transparent opacity={0.85} sizeAttenuation={false} depthWrite={false} />
    </points>
  );
}

function AsteroidBelt() {
  const points = useRef<PointsObject>(null);
  const lab = useLab();
  const geometry = useMemo(() => {
    const random = seededRandom(4500);
    const count = 4500;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i += 1) {
      const angle = random() * Math.PI * 2;
      const radius = 4.25 + (random() + random() - 1) * 0.5;
      positions[i * 3] = Math.cos(angle) * radius;
      positions[i * 3 + 1] = (random() - 0.5) * 0.14;
      positions[i * 3 + 2] = Math.sin(angle) * radius;
    }
    const result = new BufferGeometry();
    result.setAttribute("position", new Float32BufferAttribute(positions, 3));
    return result;
  }, []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  useFrame((_state, delta) => {
    if (points.current && lab.playing) points.current.rotation.y += delta * 0.0256 * lab.speed;
  });
  return (
    <points ref={points} geometry={geometry}>
      <pointsMaterial color="#9a9288" size={1.4} transparent opacity={0.8} sizeAttenuation={false} depthWrite={false} />
    </points>
  );
}

/* ------------------------------------------------------------------ */
/* Scenes                                                              */
/* ------------------------------------------------------------------ */

export function SolarSystem({
  params,
  selectedBody,
  onSelectBody,
  showOrbits,
  showLabels,
}: {
  params: Record<string, unknown>;
  selectedBody: number;
  onSelectBody: (index: number) => void;
  showOrbits: boolean;
  showLabels: boolean;
}) {
  const lab = useLab();
  const focus = str(params.focus, "").toLowerCase();
  useEffect(() => {
    const focusedIndex = SOLAR_SYSTEM_BODIES.findIndex((body) => body.name.toLowerCase() === focus);
    if (focusedIndex >= 0) onSelectBody(focusedIndex);
  }, [focus, onSelectBody]);
  const select = (index: number) => {
    onSelectBody(index);
    const body = SOLAR_SYSTEM_BODIES[index];
    lab.select({ title: body.name.toUpperCase(), lines: body.facts });
  };
  const sunActive = selectedBody === 0 || lab.activeStep === 0;
  const sunTexture = usePlanetTexture("Sun");
  const sunRef = useRef<Mesh>(null);
  const innerGlow = useMemo(() => createGlowTexture([[0, "rgba(255,240,200,1)"], [0.18, "rgba(255,190,90,0.65)"], [0.5, "rgba(255,120,30,0.14)"], [1, "rgba(255,100,0,0)"]]), []);
  const outerGlow = useMemo(() => createGlowTexture([[0, "rgba(255,170,80,0.22)"], [0.4, "rgba(255,120,40,0.06)"], [1, "rgba(255,100,0,0)"]]), []);
  useEffect(() => () => {
    innerGlow.dispose();
    outerGlow.dispose();
  }, [innerGlow, outerGlow]);
  useFrame((_state, delta) => {
    if (sunRef.current && lab.playing) sunRef.current.rotation.y += delta * 0.05 * lab.speed;
  });
  return (
    <group>
      <Stars />
      <AsteroidBelt />
      <ambientLight intensity={0.9} color="#2a3042" />
      <mesh
        name="solar-body-Sun"
        ref={sunRef}
        onClick={(e) => {
          e.stopPropagation();
          select(0);
        }}
      >
        <sphereGeometry args={[0.8, 64, 48]} />
        <meshBasicMaterial map={sunTexture} />
      </mesh>
      <sprite scale={[5.2, 5.2, 1]}>
        <spriteMaterial map={innerGlow} transparent blending={AdditiveBlending} depthWrite={false} />
      </sprite>
      <sprite scale={[15, 15, 1]}>
        <spriteMaterial map={outerGlow} transparent blending={AdditiveBlending} depthWrite={false} />
      </sprite>
      <pointLight intensity={24} color="#fff0dc" />
      {showLabels && <Label position={[0, 1.01, 0]} active={sunActive} compact onClick={() => select(0)}>Sun</Label>}
      {PLANETS.map((p, i) => (
        <OrbitRing key={p.name} radius={p.orbit} active={selectedBody === i + 1} visible={showOrbits} />
      ))}
      {PLANETS.map((p, i) => (
        <Planet key={p.name} index={i} selected={selectedBody === i + 1} showLabel={showLabels} onSelect={() => select(i + 1)} />
      ))}
    </group>
  );
}

export function EarthSeasons() {
  const clock = useLabClock();
  const earth = useRef<Group>(null);
  const globe = useRef<Mesh>(null);
  const lab = useLab();
  const earthTexture = usePlanetTexture("Earth", 512, 256);
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
        <sphereGeometry args={[1.2, 48, 32]} />
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
            <sphereGeometry args={[0.6, 48, 32]} />
            <meshStandardMaterial map={earthTexture} roughness={0.7} />
          </mesh>
          <Atmosphere radius={0.6} color="#5aa0ff" />
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
  const earthTexture = usePlanetTexture("Earth", 512, 256);
  const moonTexture = usePlanetTexture("Moon", 256, 128);
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
        <sphereGeometry args={[1, 48, 32]} />
        <meshStandardMaterial map={earthTexture} roughness={0.7} />
      </mesh>
      <Label position={[0, 1.6, 0]}>Earth</Label>
      {phases.map((name, i) => {
        const a = Math.PI + (i / 8) * Math.PI * 2; // new moon is on the Sun side (+X)
        return (
          <group key={name} position={[Math.cos(-a) * R, 0, Math.sin(-a) * R]}>
            <mesh>
              <sphereGeometry args={[0.32, 32, 24]} />
              <meshStandardMaterial map={moonTexture} roughness={1} />
            </mesh>
            <Label position={[0, 0.75, 0]} small active={lab.activeStep === i}>
              {name}
            </Label>
          </group>
        );
      })}
      <group ref={moon}>
        <mesh>
          <sphereGeometry args={[0.36, 32, 24]} />
          <meshStandardMaterial map={moonTexture} emissive="#ffffff" emissiveIntensity={0.12} roughness={1} />
        </mesh>
      </group>
      <Floor y={-2} size={20} />
    </group>
  );
}

export function Eclipse({ params }: { params: Record<string, unknown> }) {
  const type = str(params.type, "solar");
  const solar = type !== "lunar";
  const earthTexture = usePlanetTexture("Earth", 512, 256);
  const moonTexture = usePlanetTexture("Moon", 256, 128);
  const sunX = -10;
  const earthX = 4;
  const moonX = solar ? 1.2 : 7.2;
  const shadowEnd = solar ? earthX - 1 : moonX + 0.6;
  return (
    <group>
      <mesh position={[sunX, 0, 0]}>
        <sphereGeometry args={[2.2, 48, 48]} />
        <meshStandardMaterial color={WARM} emissive="#ff9a1f" emissiveIntensity={1.6} />
      </mesh>
      <pointLight position={[sunX, 0, 0]} intensity={200} color="#ffd9a0" />
      <Label position={[sunX, 3, 0]}>Sun</Label>
      <mesh position={[earthX, 0, 0]}>
        <sphereGeometry args={[1, 48, 32]} />
        <meshStandardMaterial map={earthTexture} roughness={0.7} />
      </mesh>
      <Label position={[earthX, 1.6, 0]}>Earth</Label>
      <mesh position={[moonX, 0, 0]}>
        <sphereGeometry args={[0.32, 32, 24]} />
        <meshStandardMaterial map={moonTexture} roughness={1} />
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