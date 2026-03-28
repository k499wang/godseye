"use client";

import { useRef, useState, useEffect, Suspense } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Stars, OrbitControls, Html, useTexture } from "@react-three/drei";
import * as THREE from "three";
import type { GlobeEvent } from "@/lib/globeData";
import { CATEGORY_COLOR } from "@/lib/globeData";

// ---------------------------------------------------------------------------
// Coordinate utility
// ---------------------------------------------------------------------------

/**
 * Converts geographic lat/lng to a Three.js Vector3 on a sphere of given radius.
 * Matches Three.js SphereGeometry UV convention exactly:
 *   phi  = (lng + 180) * π/180   [azimuth, wraps texture left→right]
 *   theta = (90 - lat) * π/180   [polar, 0 = north pole]
 *   x = -cos(phi) * sin(theta) * r
 *   y =  cos(theta)             * r
 *   z =  sin(phi) * sin(theta)  * r
 * At lng ≈ -90 the Americas face +Z (toward a camera sitting on +Z). ✓
 */
export function latLngToVec3(lat: number, lng: number, r: number): THREE.Vector3 {
  const phi = (lng + 180) * (Math.PI / 180);
  const theta = (90 - lat) * (Math.PI / 180);
  return new THREE.Vector3(
    -Math.cos(phi) * Math.sin(theta) * r,
    Math.cos(theta) * r,
    Math.sin(phi) * Math.sin(theta) * r
  );
}

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

// ---------------------------------------------------------------------------
// Shaders — atmospheric rim glow
// ---------------------------------------------------------------------------

const atmVert = /* glsl */ `
  varying vec3 vNormal;
  void main() {
    vNormal = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const atmFrag = /* glsl */ `
  varying vec3 vNormal;
  void main() {
    float intensity = pow(0.72 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 2.2);
    gl_FragColor = vec4(0.18, 0.52, 1.0, 1.0) * intensity * 1.8;
  }
`;

function Atmosphere() {
  return (
    <mesh scale={1.16}>
      <sphereGeometry args={[1, 64, 64]} />
      <shaderMaterial
        vertexShader={atmVert}
        fragmentShader={atmFrag}
        blending={THREE.AdditiveBlending}
        side={THREE.BackSide}
        transparent
        depthWrite={false}
      />
    </mesh>
  );
}

// ---------------------------------------------------------------------------
// Marker HTML content (pure DOM — rendered via drei <Html>)
// ---------------------------------------------------------------------------

function MarkerContent({
  event,
  isActive,
  isVisible,
  onSelect,
}: {
  event: GlobeEvent;
  isActive: boolean;
  isVisible: boolean;
  onSelect: (e: GlobeEvent) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const color = CATEGORY_COLOR[event.category] ?? "#F59E0B";
  const size = isActive || hovered ? 20 : 14;

  if (!isVisible) return null;

  return (
    <div
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
      onClick={() => onSelect(event)}
      style={{
        position: "relative",
        width: size,
        height: size,
        cursor: "pointer",
        transform: "translate(-50%, -50%)",
        transition: "width 0.15s, height 0.15s",
      }}
    >
      {/* Outer pulse */}
      <div
        style={{
          position: "absolute",
          inset: -9,
          borderRadius: "50%",
          border: `1px solid ${color}`,
          opacity: isActive ? 0.55 : 0.28,
          animation: "globePulse 2.2s ease-out infinite",
        }}
      />
      {/* Inner pulse */}
      <div
        style={{
          position: "absolute",
          inset: -4,
          borderRadius: "50%",
          border: `1px solid ${color}`,
          opacity: isActive ? 0.35 : 0.18,
          animation: "globePulse 2.2s ease-out infinite 0.8s",
        }}
      />
      {/* Core */}
      <div
        style={{
          width: "100%",
          height: "100%",
          borderRadius: "50%",
          background: color,
          boxShadow: `0 0 ${isActive ? 14 : 7}px ${color}`,
          opacity: hovered || isActive ? 1 : 0.82,
          transition: "box-shadow 0.15s, opacity 0.15s",
        }}
      />
      {/* Hover label */}
      {hovered && !isActive && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 9px)",
            left: "50%",
            transform: "translateX(-50%)",
            whiteSpace: "nowrap",
            fontFamily: "var(--font-mono, monospace)",
            fontSize: 10,
            letterSpacing: "0.12em",
            color: "#e5e7eb",
            background: "rgba(8,8,14,0.92)",
            border: `1px solid ${color}45`,
            padding: "3px 8px",
            pointerEvents: "none",
          }}
        >
          {event.title}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Earth + markers together in one group so markers track rotation for free
// ---------------------------------------------------------------------------

interface EarthSystemProps {
  events: GlobeEvent[];
  visibleIds: Set<string>;
  activeEvent: GlobeEvent | null;
  onEventSelect: (e: GlobeEvent) => void;
  isAutoSpinning: boolean;
  /** Exposes the rotating group so CameraController can read its world matrix */
  groupRef: React.RefObject<THREE.Group | null>;
}

function EarthSystem({ events, visibleIds, activeEvent, onEventSelect, isAutoSpinning, groupRef }: EarthSystemProps) {
  const meshRef = useRef<THREE.Object3D>(null);
  const texture = useTexture(
    "https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg"
  );

  // Idle spin — rotate the GROUP so markers stay in sync automatically
  useFrame((_, delta) => {
    if (isAutoSpinning && groupRef.current) groupRef.current.rotation.y += delta * 0.04;
  });

  return (
    // NO initial rotation — texture and coordinates aligned from the start
    <group ref={groupRef}>
      {/* Earth sphere */}
      <mesh ref={meshRef}>
        <sphereGeometry args={[1, 96, 96]} />
        <meshPhongMaterial
          map={texture}
          specular={new THREE.Color(0x222222)}
          shininess={6}
        />
      </mesh>

      {/* Markers as children — inherit group rotation automatically */}
      {events.map((evt) => {
        const pos = latLngToVec3(evt.lat, evt.lng, 1.018);
        return (
          <Html
            key={evt.id}
            position={[pos.x, pos.y, pos.z]}
            // occlude against the Earth mesh so back-side markers disappear
            occlude={[meshRef] as any}
            zIndexRange={[60, 0]}
            style={{ pointerEvents: "auto" }}
          >
            <MarkerContent
              event={evt}
              isActive={activeEvent?.id === evt.id}
              isVisible={visibleIds.has(evt.id)}
              onSelect={onEventSelect}
            />
          </Html>
        );
      })}
    </group>
  );
}

// ---------------------------------------------------------------------------
// Camera fly-to
// ---------------------------------------------------------------------------

interface CameraControllerProps {
  targetEvent: GlobeEvent | null;
  onFlyComplete: () => void;
  orbitRef: React.RefObject<any>;
  earthGroupRef: React.RefObject<THREE.Group | null>;
}

function CameraController({
  targetEvent,
  onFlyComplete,
  orbitRef,
  earthGroupRef,
}: CameraControllerProps) {
  const { camera } = useThree();
  const flyRef = useRef<{
    start: THREE.Vector3;
    end: THREE.Vector3;
    t: number;
    done: boolean;
  } | null>(null);
  const prevId = useRef<string | null>(null);

  useEffect(() => {
    if (!targetEvent) {
      if (prevId.current !== null) {
        flyRef.current = {
          start: camera.position.clone(),
          end: new THREE.Vector3(0, 0.4, 3.2),
          t: 0,
          done: false,
        };
        if (orbitRef.current) orbitRef.current.enabled = false;
      }
      prevId.current = null;
      return;
    }
    if (targetEvent.id === prevId.current) return;
    prevId.current = targetEvent.id;

    // Compute current world position of the marker, accounting for globe rotation
    const localPos = latLngToVec3(targetEvent.lat, targetEvent.lng, 1);
    let worldDir = localPos.clone();
    if (earthGroupRef.current) {
      earthGroupRef.current.updateMatrixWorld();
      worldDir = localPos.clone().applyMatrix4(earthGroupRef.current.matrixWorld);
    }

    // Camera sits 2.1 units from center, slightly elevated, facing the event
    const end = worldDir.clone().normalize().multiplyScalar(2.1);
    end.y += 0.1;

    flyRef.current = {
      start: camera.position.clone(),
      end,
      t: 0,
      done: false,
    };
    if (orbitRef.current) orbitRef.current.enabled = false;
  }, [targetEvent, camera, orbitRef, earthGroupRef]);

  useFrame((_, delta) => {
    if (!flyRef.current || flyRef.current.done) return;
    flyRef.current.t = Math.min(1, flyRef.current.t + delta * 0.65);
    const ease = easeInOutCubic(flyRef.current.t);
    camera.position.lerpVectors(flyRef.current.start, flyRef.current.end, ease);
    camera.lookAt(0, 0, 0);
    if (flyRef.current.t >= 1) {
      flyRef.current.done = true;
      onFlyComplete();
      if (!targetEvent && orbitRef.current) orbitRef.current.enabled = true;
    }
  });

  return null;
}

// ---------------------------------------------------------------------------
// Scene (inside <Canvas>)
// ---------------------------------------------------------------------------

function Scene({
  events,
  visibleIds,
  activeEvent,
  onEventSelect,
  onFlyComplete,
  onInteraction,
  isAutoSpinning,
}: {
  events: GlobeEvent[];
  visibleIds: Set<string>;
  activeEvent: GlobeEvent | null;
  onEventSelect: (e: GlobeEvent) => void;
  onFlyComplete: () => void;
  onInteraction: () => void;
  isAutoSpinning: boolean;
}) {
  const earthGroupRef = useRef<THREE.Group>(null);
  const orbitRef = useRef<any>(null);

  return (
    <>
      <ambientLight intensity={0.3} />
      <directionalLight position={[5, 3, 5]} intensity={1.1} color="#fff5e0" />
      <directionalLight position={[-8, -2, -4]} intensity={0.1} color="#3060ff" />

      <Stars radius={90} depth={60} count={6000} factor={3.5} saturation={0} fade speed={0.4} />

      <Suspense fallback={null}>
        <EarthSystem
          events={events}
          visibleIds={visibleIds}
          activeEvent={activeEvent}
          onEventSelect={onEventSelect}
          isAutoSpinning={isAutoSpinning}
          groupRef={earthGroupRef}
        />
        <Atmosphere />
      </Suspense>

      <CameraController
        targetEvent={activeEvent}
        onFlyComplete={onFlyComplete}
        orbitRef={orbitRef}
        earthGroupRef={earthGroupRef}
      />

      <OrbitControls
        ref={orbitRef}
        enableZoom={false}
        enablePan={false}
        enableDamping
        dampingFactor={0.06}
        minPolarAngle={Math.PI * 0.2}
        maxPolarAngle={Math.PI * 0.8}
        onStart={onInteraction}
      />
    </>
  );
}

// ---------------------------------------------------------------------------
// Public export
// ---------------------------------------------------------------------------

export default function GlobeScene({
  events,
  visibleIds,
  activeEvent,
  onEventSelect,
  onFlyComplete,
  onInteraction,
  isAutoSpinning,
}: {
  events: GlobeEvent[];
  visibleIds: Set<string>;
  activeEvent: GlobeEvent | null;
  onEventSelect: (e: GlobeEvent) => void;
  onFlyComplete: () => void;
  onInteraction: () => void;
  isAutoSpinning: boolean;
}) {
  return (
    <Canvas
      camera={{ position: [0, 0.4, 3.2], fov: 42, near: 0.1, far: 1000 }}
      style={{ background: "transparent" }}
      gl={{ antialias: true, alpha: true }}
    >
      <Scene
        events={events}
        visibleIds={visibleIds}
        activeEvent={activeEvent}
        onEventSelect={onEventSelect}
        onFlyComplete={onFlyComplete}
        onInteraction={onInteraction}
        isAutoSpinning={isAutoSpinning}
      />
    </Canvas>
  );
}
