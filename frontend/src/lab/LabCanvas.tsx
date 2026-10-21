// Lazy-loaded WebGL canvas for the Virtual Lab. Imported via React.lazy from VirtualLab.tsx so Three.js
// only downloads when a message actually carries a scene.
import { OrbitControls } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { LabContext, Lights } from "./holo";
import type { RenderMode, SelectInfo } from "./holo";
import { Eclipse, EarthSeasons, GenericHolo, MoonPhases, SolarSystem } from "./scenes/Astronomy";
import { Cell, DNA, Heart } from "./scenes/Biology";
import { Atom, Molecule, StatesOfMatter } from "./scenes/Chemistry";
import { CustomScene, HologramCore } from "./scenes/Custom";
import { GeometryScene } from "./scenes/Geometry";
import { EquationScene, GraphScene } from "./scenes/Graph";
import { Circuit, Optics, Pendulum, Projectile, Wave } from "./scenes/Physics";
import type { SceneSpec } from "@/lib/types";

export interface LabCanvasProps {
  spec: SceneSpec;
  playing: boolean;
  speed: number;
  autoRotate: boolean;
  toggle: boolean;
  renderMode: RenderMode;
  explode: number;
  activeStep: number;
  resetSignal: number;
  onSelect: (info: SelectInfo | null) => void;
  onError: (message: string) => void;
}

const CAMERA: Record<string, [number, number, number]> = {
  "solar-system": [0, 14, 22],
  "earth-seasons": [0, 8, 12],
  "moon-phases": [0, 7, 9],
  eclipse: [0, 6, 16],
  atom: [0, 3, 9],
  molecule: [0, 2, 7],
  "states-of-matter": [0, 3, 12],
  geometry: [5, 4, 7],
  graph: [0, 0, 14],
  equation: [0, 0, 14],
  projectile: [0, 2, 12],
  pendulum: [0, 0, 11],
  wave: [0, 2, 14],
  circuit: [0, 0, 11],
  optics: [0, 0, 12],
  cell: [0, 2, 9],
  dna: [6, 1, 8],
  heart: [0, 0, 8],
  generic: [0, 2, 7],
  custom: [6, 4, 9],
  core: [0, 2, 9],
};

export function cameraFor(scene: string): [number, number, number] {
  return CAMERA[scene] ?? CAMERA.generic;
}

function SceneRouter({ spec }: { spec: SceneSpec }) {
  const p = spec.params ?? {};
  switch (spec.scene) {
    case "solar-system":
      return <SolarSystem params={p} />;
    case "earth-seasons":
      return <EarthSeasons />;
    case "moon-phases":
      return <MoonPhases />;
    case "eclipse":
      return <Eclipse params={p} />;
    case "atom":
      return <Atom params={p} />;
    case "molecule":
      return <Molecule params={p} />;
    case "states-of-matter":
      return <StatesOfMatter params={p} />;
    case "geometry":
      return <GeometryScene params={p} />;
    case "graph":
      return <GraphScene params={p} />;
    case "equation":
      return <EquationScene params={p} />;
    case "projectile":
      return <Projectile params={p} />;
    case "pendulum":
      return <Pendulum params={p} />;
    case "wave":
      return <Wave params={p} />;
    case "circuit":
      return <Circuit params={p} />;
    case "optics":
      return <Optics params={p} />;
    case "cell":
      return <Cell params={p} />;
    case "dna":
      return <DNA />;
    case "heart":
      return <Heart />;
    case "custom":
      return <CustomScene params={p} title={spec.title} />;
    case "core":
      return <HologramCore />;
    default:
      return <GenericHolo params={p} title={spec.title} />;
  }
}

function Controls({ autoRotate, resetSignal, scene }: { autoRotate: boolean; resetSignal: number; scene: string }) {
  const ref = useRef<OrbitControlsImpl>(null);
  useEffect(() => {
    if (resetSignal > 0) ref.current?.reset();
  }, [resetSignal]);
  const is2D = scene === "graph" || scene === "equation" || scene === "optics";
  return <OrbitControls ref={ref} makeDefault enableDamping dampingFactor={0.08} autoRotate={autoRotate && !is2D} autoRotateSpeed={0.8} minDistance={2} maxDistance={60} />;
}

export default function LabCanvas({ spec, playing, speed, autoRotate, toggle, renderMode, explode, activeStep, resetSignal, onSelect, onError }: LabCanvasProps) {
  const ctx = useMemo(() => ({ playing, speed, activeStep, toggle, renderMode, explode, select: onSelect }), [playing, speed, activeStep, toggle, renderMode, explode, onSelect]);
  const camera = cameraFor(spec.scene);
  return (
    <Canvas
      dpr={[1, 1.5]}
      camera={{ position: camera, fov: 45, near: 0.1, far: 500 }}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      onCreated={({ gl }) => {
        gl.setClearColor("#000000", 0);
        gl.domElement.addEventListener("webglcontextlost", (e) => {
          e.preventDefault();
          onError("The 3D graphics context was lost. The text explanation is still available.");
        });
      }}
      onPointerMissed={() => onSelect(null)}
      data-testid="lab-canvas"
    >
      <LabContext.Provider value={ctx}>
        <Lights />
        <SceneRouter spec={spec} />
        <Controls autoRotate={autoRotate} resetSignal={resetSignal} scene={spec.scene} />
      </LabContext.Provider>
    </Canvas>
  );
}
