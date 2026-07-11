'use client';

import { useEffect, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { RoundedBox, Text3D, Center, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';

function FolioMesh({ hovered }: { hovered: boolean }) {
  const groupRef = useRef<THREE.Group>(null);
  const [rotation, setRotation] = useState(0);

  useFrame((_, delta) => {
    if (!hovered && groupRef.current) {
      groupRef.current.rotation.y += delta * 0.26; // ~24 seconds for full rotation
    }
  });

  return (
    <group ref={groupRef} rotation={[0.1, rotation, 0.05]}>
      {/* Main folio body */}
      <RoundedBox args={[1.7, 2.4, 0.35]} radius={0.05} smoothness={4}>
        <meshPhysicalMaterial
          color="#3d2817"
          roughness={0.85}
          sheen={0.3}
          clearcoat={0.1}
        />
      </RoundedBox>

      {/* Spine */}
      <mesh position={[-0.88, 0, 0]}>
        <boxGeometry args={[0.06, 2.38, 0.33]} />
        <meshPhysicalMaterial
          color="#2a1a0e"
          roughness={0.9}
          clearcoat={0.05}
        />
      </mesh>

      {/* Spine text */}
      <Center position={[-0.92, 0.4, 0]} rotation={[0, -Math.PI / 2, 0]}>
        <Text3D
          font="/fonts/helvetiker_regular.typeface.json"
          size={0.12}
          height={0.02}
          letterSpacing={0.02}
        >
          BizCompliance
          <meshStandardMaterial color="#faf8f3" />
        </Text3D>
      </Center>

      {/* Front cover wax seal */}
      <mesh position={[0.3, 0.5, 0.18]}>
        <cylinderGeometry args={[0.35, 0.35, 0.04, 32]} />
        <meshPhysicalMaterial
          color="#a37e3a"
          metalness={0.4}
          clearcoat={0.7}
          roughness={0.3}
        />
      </mesh>

      {/* Seal inner circle */}
      <mesh position={[0.3, 0.5, 0.21]}>
        <cylinderGeometry args={[0.22, 0.22, 0.02, 32]} />
        <meshPhysicalMaterial
          color="#8b6b2f"
          metalness={0.5}
          clearcoat={0.8}
          roughness={0.2}
        />
      </mesh>
    </group>
  );
}

function Scene() {
  const [hovered, setHovered] = useState(false);

  return (
    <>
      <ambientLight intensity={0.3} />
      <directionalLight position={[5, 5, 3]} intensity={1.2} color="#fff5e6" />
      <directionalLight position={[-3, -2, -2]} intensity={0.4} color="#e6eeff" />
      <pointLight position={[2, 4, 2]} intensity={0.5} color="#fff0d4" />

      <group
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
      >
        <FolioMesh hovered={hovered} />
      </group>

      <OrbitControls
        enableZoom={false}
        enablePan={false}
        autoRotate={false}
        maxPolarAngle={Math.PI / 2 + 0.3}
        minPolarAngle={Math.PI / 2 - 0.3}
      />
    </>
  );
}

export function HeroFolio() {
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const apply = () => setReducedMotion(mq.matches);

    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

  if (reducedMotion) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <svg viewBox="0 0 200 260" className="w-full max-w-[300px]" fill="none">
          <rect x="20" y="10" width="160" height="240" rx="8" fill="#3d2817" />
          <rect x="15" y="10" width="10" height="240" rx="2" fill="#2a1a0e" />
          <rect x="22" y="10" width="4" height="240" rx="1" fill="#1a1008" />
          <text x="18" y="120" fill="#faf8f3" fontSize="10" fontFamily="Georgia" transform="rotate(-90 18 120)">BizCompliance</text>
          <circle cx="130" cy="100" r="25" fill="#a37e3a" />
          <circle cx="130" cy="100" r="16" fill="#8b6b2f" />
        </svg>
      </div>
    );
  }

  return (
    <div className="w-full h-full min-h-[400px] md:min-h-[500px]">
      <Canvas
        camera={{ position: [0, 0, 5], fov: 35 }}
        frameloop="demand"
        dpr={[1, 2]}
      >
        <Scene />
      </Canvas>
    </div>
  );
}
