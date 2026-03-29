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
    float intensity = pow(0.72 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 3.5);
    gl_FragColor = vec4(0.18, 0.52, 1.0, 1.0) * intensity * 0.45;
  }
`;

function Atmosphere() {
  return (
    <mesh scale={1.10}>
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
        transition: "width 0.2s cubic-bezier(0.4,0,0.2,1), height 0.2s cubic-bezier(0.4,0,0.2,1)",
      }}
    >
      {/* Pulse ring — only shown when active */}
      {isActive && (
        <div
          style={{
            position: "absolute",
            inset: -9,
            borderRadius: "50%",
            border: `1px solid ${color}`,
            opacity: 0.55,
            animation: "globePulse 2.2s ease-out infinite",
          }}
        />
      )}
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
// Country border lines — loaded from local GeoJSON so borders are always available
// ---------------------------------------------------------------------------

function CountryBorders() {
  const [geo, setGeo] = useState<THREE.BufferGeometry | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/countries.geojson")
      .then((response) => response.json())
      .then((featureCollection) => {
        if (cancelled) return;

        const positions: number[] = [];
        const pushRing = (ring: [number, number][]) => {
          if (ring.length < 2) return;

          for (let index = 0; index < ring.length - 1; index++) {
            const [lng1, lat1] = ring[index];
            const [lng2, lat2] = ring[index + 1];
            const v1 = latLngToVec3(lat1, lng1, 1.003);
            const v2 = latLngToVec3(lat2, lng2, 1.003);
            positions.push(v1.x, v1.y, v1.z, v2.x, v2.y, v2.z);
          }
        };

        for (const feature of featureCollection.features as Array<{
          geometry?: {
            type: "Polygon" | "MultiPolygon";
            coordinates: [number, number][][] | [number, number][][][];
          };
        }>) {
          if (!feature.geometry) continue;

          if (feature.geometry.type === "Polygon") {
            for (const ring of feature.geometry.coordinates as [number, number][][]) {
              pushRing(ring);
            }
          } else if (feature.geometry.type === "MultiPolygon") {
            for (const polygon of feature.geometry.coordinates as [number, number][][][]) {
              for (const ring of polygon) {
                pushRing(ring);
              }
            }
          }
        }

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute(
          "position",
          new THREE.Float32BufferAttribute(positions, 3)
        );
        geometry.computeBoundingSphere();
        if (!cancelled) setGeo(geometry);
      })
      .catch(console.error);

    return () => {
      cancelled = true;
    };
  }, []);

  if (!geo) return null;

  return (
    <group renderOrder={3}>
      <lineSegments geometry={geo} scale={1.0015}>
        <lineBasicMaterial
          color="#7cb4e8"
          opacity={0.08}
          transparent
          depthWrite={false}
        />
      </lineSegments>
      <lineSegments geometry={geo}>
        <lineBasicMaterial
          color="#bfd4ea"
          opacity={0.42}
          transparent
          depthWrite={false}
        />
      </lineSegments>
    </group>
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
  showCountryBorders: boolean;
  /** Exposes the rotating group so GlobeSpinner and CameraController can use it */
  groupRef: React.RefObject<THREE.Group | null>;
}

function EarthSystem({
  events,
  visibleIds,
  activeEvent,
  onEventSelect,
  showCountryBorders,
  groupRef,
}: EarthSystemProps) {
  const meshRef = useRef<THREE.Object3D>(null);
  const { gl } = useThree();

  // 4K clean natural-earth texture — no clouds, soft land/ocean palette
  const texture = useTexture(
    "https://raw.githubusercontent.com/turban/webgl-earth/master/images/2_no_clouds_4k.jpg"
  );

  // Apply texture quality settings synchronously at render time.
  // Doing this in useEffect fires *after* the first draw, which shows graininess
  // for one frame. Setting directly here ensures it's applied before any render.
  const max = gl.capabilities.getMaxAnisotropy();
  texture.anisotropy = max;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;

  return (
    // NO initial rotation — texture and coordinates aligned from the start
    <group ref={groupRef}>
      {/* Earth sphere */}
      <mesh ref={meshRef}>
        <sphereGeometry args={[1, 128, 128]} />
        <meshPhongMaterial
          map={texture}
          emissive={new THREE.Color(0x0d1520)}
          emissiveIntensity={0.22}
          specular={new THREE.Color(0x1a2a3a)}
          shininess={6}
        />
      </mesh>

      {/* Country borders — sits just above the surface */}
      {showCountryBorders ? <CountryBorders /> : null}

      {/* Markers as children — inherit group rotation automatically */}
      {events.map((evt) => {
        const pos = latLngToVec3(evt.lat, evt.lng, 1.018);
        return (
          <Html
            key={evt.id}
            position={[pos.x, pos.y, pos.z]}
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
// Globe spinner — lives OUTSIDE <Suspense> so it always runs,
// even while EarthSystem is loading/suspended.
// ---------------------------------------------------------------------------

function GlobeSpinner({
  groupRef,
  isAutoSpinning,
}: {
  groupRef: React.RefObject<THREE.Group | null>;
  isAutoSpinning: boolean;
}) {
  // Ref pattern: useFrame captures a stale closure at mount.
  // Storing the prop in a ref ensures the frame loop always reads the latest value.
  const spinRef = useRef(isAutoSpinning);
  useEffect(() => {
    spinRef.current = isAutoSpinning;
  }, [isAutoSpinning]);

  useFrame(({ camera }, delta) => {
    // Never spin if camera is zoomed in past the threshold
    const dist = camera.position.length();
    if (spinRef.current && dist >= 2.6 && groupRef.current) {
      groupRef.current.rotation.y += delta * 0.16;
    }
  });

  return null;
}

// ---------------------------------------------------------------------------
// Zoom tracker — fires onZoomChange when camera crosses the zoom threshold.
// Also lives OUTSIDE <Suspense> so it tracks zoom from the very first frame.
// ---------------------------------------------------------------------------

const ZOOM_THRESHOLD = 2.6;

function ZoomTracker({ onZoomChange }: { onZoomChange: (zoomed: boolean) => void }) {
  const wasZoomedRef = useRef(false);

  useFrame(({ camera }) => {
    const isZoomed = camera.position.length() < ZOOM_THRESHOLD;
    if (isZoomed !== wasZoomedRef.current) {
      wasZoomedRef.current = isZoomed;
      onZoomChange(isZoomed);
    }
  });

  return null;
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
    flyRef.current.t = Math.min(1, flyRef.current.t + delta * 0.5);
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
  showCountryBorders,
  onFlyComplete,
  onInteraction,
  onZoomChange,
  isAutoSpinning,
}: {
  events: GlobeEvent[];
  visibleIds: Set<string>;
  activeEvent: GlobeEvent | null;
  onEventSelect: (e: GlobeEvent) => void;
  showCountryBorders: boolean;
  onFlyComplete: () => void;
  onInteraction: () => void;
  onZoomChange: (zoomed: boolean) => void;
  isAutoSpinning: boolean;
}) {
  const earthGroupRef = useRef<THREE.Group>(null);
  const orbitRef = useRef<any>(null);

  return (
    <>
      <ambientLight intensity={1.8} />
      <directionalLight position={[5, 3, 5]} intensity={2.8} color="#fff8f0" />
      <directionalLight position={[-8, -2, -4]} intensity={0.6} color="#4080ff" />
      <directionalLight position={[0, 5, -5]} intensity={1.0} color="#ffffff" />

      <Stars radius={120} depth={60} count={10000} factor={3} saturation={0.15} fade speed={0.1} />

      {/* GlobeSpinner and ZoomTracker are OUTSIDE Suspense so they always run */}
      <GlobeSpinner groupRef={earthGroupRef} isAutoSpinning={isAutoSpinning} />
      <ZoomTracker onZoomChange={onZoomChange} />

      <Suspense fallback={null}>
        <EarthSystem
          events={events}
          visibleIds={visibleIds}
          activeEvent={activeEvent}
          onEventSelect={onEventSelect}
          showCountryBorders={showCountryBorders}
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
        enableZoom
        enablePan={false}
        zoomSpeed={0.6}
        minDistance={2.0}
        maxDistance={4.5}
        enableDamping
        dampingFactor={0.04}
        minPolarAngle={Math.PI * 0.15}
        maxPolarAngle={Math.PI * 0.85}
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
  showCountryBorders,
  onFlyComplete,
  onInteraction,
  onZoomChange,
  isAutoSpinning,
}: {
  events: GlobeEvent[];
  visibleIds: Set<string>;
  activeEvent: GlobeEvent | null;
  onEventSelect: (e: GlobeEvent) => void;
  showCountryBorders: boolean;
  onFlyComplete: () => void;
  onInteraction: () => void;
  onZoomChange: (zoomed: boolean) => void;
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
        showCountryBorders={showCountryBorders}
        onFlyComplete={onFlyComplete}
        onInteraction={onInteraction}
        onZoomChange={onZoomChange}
        isAutoSpinning={isAutoSpinning}
      />
    </Canvas>
  );
}
