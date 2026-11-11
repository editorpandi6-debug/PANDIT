import { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { Environment, OrbitControls, useGLTF } from "@react-three/drei";

function GlbModel({ url }: { url: string }) {
  const { scene } = useGLTF(url);
  return <primitive object={scene} />;
}

/** Real Tripo-generated GLB, shown in the same dark-futuristic viewer frame as the procedural lab. */
export function GlbViewer({ url }: { url: string }) {
  return (
    <div className="h-full min-h-[320px] w-full overflow-hidden rounded-md border border-[#ff8a1f]/25 bg-black" data-testid="glb-viewer">
      <Canvas camera={{ position: [2.4, 1.6, 2.4], fov: 42 }} dpr={[1, 1.5]}>
        <color attach="background" args={["#050302"]} />
        <ambientLight intensity={1.1} />
        <directionalLight position={[4, 5, 3]} intensity={2.2} />
        <Suspense fallback={null}>
          <GlbModel url={url} />
          <Environment preset="city" />
        </Suspense>
        <OrbitControls autoRotate autoRotateSpeed={1.2} enableDamping />
      </Canvas>
    </div>
  );
}
