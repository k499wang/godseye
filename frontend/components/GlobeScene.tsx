"use client";

import {
  useRef,
  useState,
  useEffect,
  Suspense,
  forwardRef,
  useImperativeHandle,
} from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Stars, OrbitControls, Html, useTexture } from "@react-three/drei";
import * as THREE from "three";
import type { GlobeEvent } from "@/lib/globeData";
import { CATEGORY_COLOR } from "@/lib/globeData";

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

/** Convert lat/lng degrees to a 3D unit-sphere point.
 *  Three.js Y-up convention, sphere facing +Z at lng=0,lat=0.
 */
export function latLngToVec3(
  lat: number,
  lng: number,
  radius: number
): THREE.Vector3 {
  const phi = (90 - lat) * (Math.PI / 180); // colatitude
  const theta = (lng + 180) * (Math.PI / 180); // azimuth
  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta)
  );
}

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

// ---------------------------------------------------------------------------
// Shaders
// ---------------------------------------------------------------------------

const atmosphereVertexShader = /* glsl */ `
  varying vec3 vNormal;
  void main() {
    vNormal = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const atmosphereFragmentShader = /* glsl */ `
  varying vec3 vNormal;
  void main() {
    float intensity = pow(0.72 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 2.2);
    gl_FragColor = vec4(0.18, 0.52, 1.0, 1.0) * intensity * 1.8;
  }
`;

// ---------------------------------------------------------------------------
// Atmosphere glow
// ---------------------------------------------------------------------------

function Atmosphere() {
  return (
    <mesh scale={1.16}>
      <sphereGeometry args={[1, 64, 64]} />
      <shaderMaterial
        vertexShader={atmosphereVertexShader}
        fragmentShader={atmosphereFragmentShader}
        blending={THREE.AdditiveBlending}
        side={THREE.BackSide}
        transparent
        depthWrite={false}
      />
    </mesh>
  );
}

// ---------------------------------------------------------------------------
// Earth mesh (with texture)
// ---------------------------------------------------------------------------

function EarthMesh({ earthRef }: { earthRef: React.RefObject<THREE.Mesh | null> }) {
  const texture = useTexture(
    "https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg"
  );

  // idle rotation — very slow
  useFrame((_, delta) => {
    if (earthRef.current) {
      earthRef.current.rotation.y += delta * 0.04;
    }
  });

  return (
    <mesh ref={earthRef} rotation={[0, Math.PI, 0]}>
      <sphereGeometry args={[1, 96, 96]} />
      <meshPhongMaterial
        map={texture}
        specular={new THREE.Color(0x333333)}
        shininess={8}
      />
    </mesh>
  );
}

// ---------------------------------------------------------------------------
// Single globe marker
// ---------------------------------------------------------------------------

interface MarkerProps {
  event: GlobeEvent;
  isActive: boolean;
  onSelect: (event: GlobeEvent) => void;
  earthRef: React.RefObject<THREE.Mesh | null>;
}

function GlobeMarker({ event, isActive, onSelect, earthRef }: MarkerProps) {
  const { camera } = useThree();
  const [visible, setVisible] = useState(true);
  const [hovered, setHovered] = useState(false);

  // World-space position of this marker (on the unit sphere surface)
  const basePos = latLngToVec3(event.lat, event.lng, 1.015);

  useFrame(() => {
    if (!earthRef.current) return;

    // Transform base position by earth mesh's rotation
    const worldPos = basePos.clone().applyQuaternion(earthRef.current.quaternion);

    // Dot product: positive = facing camera, negative = behind globe
    const toCamera = camera.position.clone().normalize();
    const markerDir = worldPos.clone().normalize();
    setVisible(toCamera.dot(markerDir) > 0.05);
  });

  const color = CATEGORY_COLOR[event.category] ?? "#F59E0B";

  if (!visible) return null;

  // Get current world-space position for <Html> placement
  const worldPos = earthRef.current
    ? basePos.clone().applyQuaternion(earthRef.current.quaternion)
    : basePos;

  return (
    <Html
      position={[worldPos.x, worldPos.y, worldPos.z]}
      zIndexRange={[60, 0]}
      style={{ pointerEvents: "auto" }}
      distanceFactor={2.5}
    >
      <div
        onPointerEnter={() => setHovered(true)}
        onPointerLeave={() => setHovered(false)}
        onClick={() => onSelect(event)}
        style={{
          position: "relative",
          width: isActive || hovered ? 20 : 14,
          height: isActive || hovered ? 20 : 14,
          cursor: "pointer",
          transform: "translate(-50%, -50%)",
          transition: "width 0.2s ease, height 0.2s ease",
        }}
      >
        {/* Pulse rings */}
        <div
          style={{
            position: "absolute",
            inset: -8,
            borderRadius: "50%",
            border: `1px solid ${color}`,
            opacity: isActive ? 0.6 : 0.3,
            animation: "globePulse 2s ease-out infinite",
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: -4,
            borderRadius: "50%",
            border: `1px solid ${color}`,
            opacity: isActive ? 0.4 : 0.2,
            animation: "globePulse 2s ease-out infinite 0.7s",
          }}
        />
        {/* Core dot */}
        <div
          style={{
            width: "100%",
            height: "100%",
            borderRadius: "50%",
            background: color,
            boxShadow: `0 0 ${isActive ? 12 : 6}px ${color}`,
            opacity: hovered || isActive ? 1 : 0.85,
            transition: "box-shadow 0.2s ease, opacity 0.2s ease",
          }}
        />
        {/* Label on hover */}
        {hovered && !isActive && (
          <div
            style={{
              position: "absolute",
              top: "calc(100% + 8px)",
              left: "50%",
              transform: "translateX(-50%)",
              whiteSpace: "nowrap",
              fontFamily: "var(--font-mono, monospace)",
              fontSize: 10,
              letterSpacing: "0.1em",
              color: "#e5e7eb",
              background: "rgba(10,10,15,0.9)",
              border: `1px solid ${color}40`,
              padding: "3px 7px",
              pointerEvents: "none",
            }}
          >
            {event.title}
          </div>
        )}
      </div>
    </Html>
  );
}

// ---------------------------------------------------------------------------
// Camera fly-to controller
// ---------------------------------------------------------------------------

interface CameraControllerProps {
  targetEvent: GlobeEvent | null;
  onFlyComplete: () => void;
  orbitRef: React.RefObject<any>;
}

function CameraController({
  targetEvent,
  onFlyComplete,
  orbitRef,
}: CameraControllerProps) {
  const { camera } = useThree();
  const flyRef = useRef<{
    startPos: THREE.Vector3;
    endPos: THREE.Vector3;
    t: number;
    done: boolean;
  } | null>(null);
  const prevEventId = useRef<string | null>(null);

  // Trigger fly when targetEvent changes
  useEffect(() => {
    if (!targetEvent) {
      // Fly back to default view
      if (prevEventId.current !== null) {
        flyRef.current = {
          startPos: camera.position.clone(),
          endPos: new THREE.Vector3(0, 0.4, 3.2),
          t: 0,
          done: false,
        };
        if (orbitRef.current) orbitRef.current.enabled = false;
      }
      prevEventId.current = null;
      return;
    }

    if (targetEvent.id === prevEventId.current) return;
    prevEventId.current = targetEvent.id;

    const markerPos = latLngToVec3(targetEvent.lat, targetEvent.lng, 1);
    const camDist = 2.0;
    const endPos = markerPos.normalize().multiplyScalar(camDist);
    endPos.y += 0.15; // slight elevation

    flyRef.current = {
      startPos: camera.position.clone(),
      endPos,
      t: 0,
      done: false,
    };
    if (orbitRef.current) orbitRef.current.enabled = false;
  }, [targetEvent, camera, orbitRef]);

  useFrame((_, delta) => {
    if (!flyRef.current || flyRef.current.done) return;

    flyRef.current.t = Math.min(1, flyRef.current.t + delta * 0.65);
    const ease = easeInOutCubic(flyRef.current.t);

    camera.position.lerpVectors(
      flyRef.current.startPos,
      flyRef.current.endPos,
      ease
    );
    camera.lookAt(0, 0, 0);

    if (flyRef.current.t >= 1) {
      flyRef.current.done = true;
      onFlyComplete();
      if (!targetEvent && orbitRef.current) {
        orbitRef.current.enabled = true;
      }
    }
  });

  return null;
}

// ---------------------------------------------------------------------------
// Scene interior (needs to be inside <Canvas>)
// ---------------------------------------------------------------------------

interface SceneProps {
  events: GlobeEvent[];
  activeEvent: GlobeEvent | null;
  onEventSelect: (event: GlobeEvent) => void;
  onFlyComplete: () => void;
}

function Scene({
  events,
  activeEvent,
  onEventSelect,
  onFlyComplete,
}: SceneProps) {
  const earthRef = useRef<THREE.Mesh>(null);
  const orbitRef = useRef<any>(null);

  return (
    <>
      {/* Lighting */}
      <ambientLight intensity={0.35} />
      <directionalLight
        position={[5, 3, 5]}
        intensity={1.1}
        color="#fff5e0"
      />
      <directionalLight
        position={[-8, -2, -4]}
        intensity={0.12}
        color="#3060ff"
      />

      {/* Stars */}
      <Stars
        radius={90}
        depth={60}
        count={6000}
        factor={3.5}
        saturation={0}
        fade
        speed={0.4}
      />

      {/* Earth */}
      <Suspense fallback={null}>
        <EarthMesh earthRef={earthRef} />
        <Atmosphere />

        {/* Markers */}
        {events.map((evt) => (
          <GlobeMarker
            key={evt.id}
            event={evt}
            isActive={activeEvent?.id === evt.id}
            onSelect={onEventSelect}
            earthRef={earthRef}
          />
        ))}
      </Suspense>

      {/* Camera fly-to */}
      <CameraController
        targetEvent={activeEvent}
        onFlyComplete={onFlyComplete}
        orbitRef={orbitRef}
      />

      {/* Orbit controls */}
      <OrbitControls
        ref={orbitRef}
        enableZoom={false}
        enablePan={false}
        autoRotate={!activeEvent}
        autoRotateSpeed={0.25}
        enableDamping
        dampingFactor={0.06}
        minPolarAngle={Math.PI * 0.2}
        maxPolarAngle={Math.PI * 0.8}
      />
    </>
  );
}

// ---------------------------------------------------------------------------
// Public export: full Canvas wrapper
// ---------------------------------------------------------------------------

interface GlobeSceneProps {
  events: GlobeEvent[];
  activeEvent: GlobeEvent | null;
  onEventSelect: (event: GlobeEvent) => void;
  onFlyComplete: () => void;
}

export default function GlobeScene({
  events,
  activeEvent,
  onEventSelect,
  onFlyComplete,
}: GlobeSceneProps) {
  return (
    <Canvas
      camera={{ position: [0, 0.4, 3.2], fov: 42, near: 0.1, far: 1000 }}
      style={{ background: "transparent" }}
      gl={{ antialias: true, alpha: true }}
    >
      <Scene
        events={events}
        activeEvent={activeEvent}
        onEventSelect={onEventSelect}
        onFlyComplete={onFlyComplete}
      />
    </Canvas>
  );
}
