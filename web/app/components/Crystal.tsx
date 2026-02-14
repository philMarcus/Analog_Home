"use client";

import { useRef, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";

function Gem() {
  const meshRef = useRef<THREE.Mesh>(null!);

  // Icosahedron already has vertices at +Y and -Y poles, so apex points north by default
  const geometry = useMemo(() => new THREE.IcosahedronGeometry(1.4, 0), []);

  useFrame((_, delta) => {
    meshRef.current.rotation.y += delta * 0.075;
  });

  return (
    <mesh ref={meshRef} geometry={geometry}>
      <meshBasicMaterial
        color="#39ff14"
        wireframe
        transparent
        opacity={0.8}
      />
    </mesh>
  );
}

export default function Crystal() {
  return (
    <div style={{ width: 220, height: 220 }}>
      <Canvas
        camera={{ position: [0, 0, 3.5], fov: 45 }}
        style={{ background: "transparent" }}
        gl={{ alpha: true }}
      >
        <Gem />
        <OrbitControls
          enableZoom={false}
          enablePan={false}
          autoRotate={false}
          minPolarAngle={Math.PI / 3}
          maxPolarAngle={Math.PI * 2 / 3}
        />
      </Canvas>
    </div>
  );
}
