"use client";

import { useRef, useMemo, useEffect, useState, useCallback } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { usePathname } from "next/navigation";
import * as THREE from "three";
import { PointCloudSettings } from "./PointCloudControls";
import { usePointCloudSettings } from "@/lib/PointCloudSettingsContext";
import { getPointCloudConfig, RoutePointCloudConfig } from "@/lib/pointCloudPages";
import { usePointCloudData } from "@/lib/PointCloudDataContext";
import { SCATTER_VERTEX, SCATTER_FRAGMENT } from "@/lib/scatterShaders";
import {
  POINT_COUNT,
  SCATTER_OUT_MS,
  SCATTER_IN_MS,
  SCATTER_TOTAL_MS,
  INIT_FLY_IN_MS,
  generateScatterPositions,
  buildPointData,
  applyPerRouteTransform,
} from "@/lib/scatterHelpers";

interface PointCloudBackgroundProps {
  settings?: PointCloudSettings;
}

const INTRO_START_Z = 1.2;
const INTRO_DURATION = 2.8;
const INTRO_HOLD = 0.4;

function easeOutCubic(t: number) {
  return 1 - Math.pow(1 - t, 3);
}

function CameraController({ settings }: { settings: PointCloudSettings }) {
  const { camera } = useThree();
  const introRef = useRef({ startTime: -1, completed: false });

  useFrame((state) => {
    const elapsed = state.clock.getElapsedTime();

    if (introRef.current.startTime < 0) {
      introRef.current.startTime = elapsed;
      camera.position.z = INTRO_START_Z;
    }

    const timeSinceStart = elapsed - introRef.current.startTime;

    if (!introRef.current.completed) {
      if (timeSinceStart < INTRO_HOLD) {
        camera.position.z = INTRO_START_Z + Math.sin(elapsed * 2) * 0.08;
        camera.position.x = Math.sin(elapsed * 0.5) * 0.18;
        camera.position.y = Math.cos(elapsed * 0.3) * 0.12;
      } else {
        const progress = Math.min((timeSinceStart - INTRO_HOLD) / INTRO_DURATION, 1);
        const eased = easeOutCubic(progress);
        camera.position.z = INTRO_START_Z + (settings.cameraDistance - INTRO_START_Z) * eased;
        camera.position.x = settings.cameraX * eased;
        camera.position.y = settings.cameraY * eased;

        if (progress >= 1) {
          introRef.current.completed = true;
        }
      }
    } else {
      camera.position.x += (settings.cameraX - camera.position.x) * 0.05;
      camera.position.y += (settings.cameraY - camera.position.y) * 0.05;
      camera.position.z += (settings.cameraDistance - camera.position.z) * 0.05;

      // Camera drift for subtle micro-motion
      const driftT = elapsed * 0.15;
      camera.position.x += Math.sin(driftT) * 0.03;
      camera.position.y += Math.cos(driftT * 1.37) * 0.02;
      camera.position.z += Math.sin(driftT * 0.93) * 0.015;
    }

    camera.lookAt(0, 0, 0);
  });

  return null;
}

interface PointCloudProps {
  settings: PointCloudSettings;
  routeConfig: RoutePointCloudConfig;
  onPointCountChange?: (count: number) => void;
}

function PointCloud({ settings, routeConfig, onPointCountChange }: PointCloudProps) {
  const pointsRef = useRef<THREE.Points | null>(null);
  const geometryRef = useRef<THREE.BufferGeometry | null>(null);
  const settingsRef = useRef(settings);
  const routeConfigRef = useRef(routeConfig);
  const prevRouteRef = useRef(routeConfig.label);
  const isInitRef = useRef(true);

  // Transition state: two-phase scatter-reform
  // phase 1 (scatter-out): old model → scatter, duration SCATTER_OUT_MS
  // phase 2 (reform-in): scatter → new model, duration SCATTER_IN_MS
  const transitionRef = useRef({
    startTime: -1,
    phase: 0 as 0 | 1 | 2, // 0=idle, 1=scatter-out, 2=reform-in
    pendingRoute: null as RoutePointCloudConfig | null,
  });
  // Rotation burst (two bursts: one at scatter start, one at reform start)
  const rotationBurstRef = useRef({ startTime: -1, originalSpeed: 0 });
  // Inner glow pulse
  const glowPulseRef = useRef({ startTime: -1 });
  // Auto-rotation spin accumulator
  const spinRef = useRef(0);

  // Mouse
  const mouseRef = useRef({ x: 0, y: 0 });

  // PCD preloaded data
  const { cache, loadingState } = usePointCloudData();

  // Uniforms ref
  const uniformsRef = useRef({
    progress: { value: 1.0 },
    pointSizeScale: { value: 4.5 },
    cameraFadeStart: { value: 8.0 },
    cameraFadeDistance: { value: 25.0 },
    coreRadius: { value: 0.08 },
    innerGlowStrength: { value: 0.3 },
    compressStrength: { value: 0.5 },
  });

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  // DON'T update routeConfigRef here — it's updated at phase 2 boundary in useFrame
  // This ensures rotation/position stay on old config during scatter-out

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      mouseRef.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      mouseRef.current.y = -(e.clientY / window.innerHeight) * 2 + 1;
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  // Initialize geometry buffers on mount
  const initGeometry = useCallback((geometry: THREE.BufferGeometry) => {
    geometryRef.current = geometry;

    const positions = new Float32Array(POINT_COUNT * 3);
    const posFrom = new Float32Array(POINT_COUNT * 3);
    const scatterPos = generateScatterPositions(POINT_COUNT);
    const pointData = buildPointData(POINT_COUNT);

    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("posFrom", new THREE.BufferAttribute(posFrom, 3));
    geometry.setAttribute("scatterPos", new THREE.BufferAttribute(scatterPos, 3));
    geometry.setAttribute("pointData", new THREE.BufferAttribute(pointData, 3));
    // Color attribute
    const colors = new Float32Array(POINT_COUNT * 3);
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  }, []);

  // Load initial data when cache is ready (ONLY on first load, not on route changes)
  useEffect(() => {
    if (loadingState !== "complete" || !geometryRef.current) return;
    if (!isInitRef.current) return; // Already initialized — route changes handled by transition logic
    const geometry = geometryRef.current;
    const posAttr = geometry.getAttribute("position") as THREE.BufferAttribute;
    const colorAttr = geometry.getAttribute("color") as THREE.BufferAttribute;

    const cached = cache.get(routeConfig.pcdUrl);
    if (!cached) return;

    console.log("[Init] Loading initial data for:", routeConfig.label);

    const transformed = applyPerRouteTransform(cached.positions, routeConfig);
    posAttr.array.set(transformed);
    posAttr.needsUpdate = true;

    // Bake colors
    const colorKey = settings.colorMode === "default" ? routeConfig.colorMode : settings.colorMode;
    const colors = cached.colors || generateDefaultColors(POINT_COUNT, colorKey, routeConfig.transitionSeed);
    colorAttr.array.set(colors);
    colorAttr.needsUpdate = true;

    // Fly-in: posFrom = scatter positions, progress 0→1
    const fromAttr = geometry.getAttribute("posFrom") as THREE.BufferAttribute;
    const scatterAttr = geometry.getAttribute("scatterPos") as THREE.BufferAttribute;
    fromAttr.array.set(scatterAttr.array);
    fromAttr.needsUpdate = true;

    uniformsRef.current.progress.value = 0;
    transitionRef.current = {
      startTime: performance.now(),
      phase: 0, // init fly-in
      pendingRoute: null,
    };
    isInitRef.current = false;

    onPointCountChange?.(POINT_COUNT);
  }, [loadingState, cache]);

  // Route change: start phase 1 (scatter-out only)
  useEffect(() => {
    if (isInitRef.current) return;
    if (prevRouteRef.current === routeConfig.label) return;
    if (loadingState !== "complete") return;
    console.log("[Transition] Route change detected:", prevRouteRef.current, "→", routeConfig.label);

    const geometry = geometryRef.current;
    if (!geometry) return;

    const fromAttr = geometry.getAttribute("posFrom") as THREE.BufferAttribute;
    const posAttr = geometry.getAttribute("position") as THREE.BufferAttribute;
    const scatterAttr = geometry.getAttribute("scatterPos") as THREE.BufferAttribute;
    const pdAttr = geometry.getAttribute("pointData") as THREE.BufferAttribute;

    // 1. Save current positions as "from" (for scatter-out: posFrom → scatterPos)
    fromAttr.array.set(posAttr.array);
    fromAttr.needsUpdate = true;

    // 2. New scatter positions
    const newScatter = generateScatterPositions(POINT_COUNT);
    scatterAttr.array.set(newScatter);
    scatterAttr.needsUpdate = true;

    // 3. New point data (delays for stagger)
    const newPD = buildPointData(POINT_COUNT);
    pdAttr.array.set(newPD);
    pdAttr.needsUpdate = true;

    // 4. Store pending route — data swap deferred to phase 2
    transitionRef.current = {
      startTime: performance.now(),
      phase: 1,
      pendingRoute: routeConfig,
    };
    uniformsRef.current.progress.value = 0;
    console.log("[Transition] Phase 1 started (scatter-out), pending:", routeConfig.label);

    // 5. Rotation burst at scatter-out start
    const currentSpeed = settingsRef.current.rotationSpeed;
    rotationBurstRef.current = {
      startTime: performance.now(),
      originalSpeed: currentSpeed,
    };

    // 6. Don't update prevRoute yet — label stays on old route until reform
    // prevRouteRef is updated in phase 2
  }, [routeConfig, loadingState, cache]);

  // Animation loop
  useFrame((state) => {
    if (!pointsRef.current) return;

    const time = state.clock.getElapsedTime();
    const now = performance.now();
    const currentSettings = settingsRef.current;
    const currentRoute = routeConfigRef.current;

    // Animate transition progress (two-phase scatter-reform)
    const t = transitionRef.current;
    if (t.startTime >= 0) {
      const elapsed = now - t.startTime;

      if (t.phase === 0) {
        // Init fly-in: linear 0→1
        const rawT = Math.min(1, elapsed / INIT_FLY_IN_MS);
        uniformsRef.current.progress.value = rawT;
        if (rawT >= 1) {
          transitionRef.current = { startTime: -1, phase: 0, pendingRoute: null };
        }
      } else if (t.phase === 1) {
        // Phase 1: scatter-out (progress 0→0.5)
        const rawT = Math.min(1, elapsed / SCATTER_OUT_MS);
        const st = rawT;
        const progress = st * st * 0.5; // quadratic ease-in, 0→0.5
        uniformsRef.current.progress.value = progress;

        if (rawT >= 1) {
          // Scatter-out complete → swap data and start phase 2
          const pending = t.pendingRoute;
          if (pending && geometryRef.current) {
            const geometry = geometryRef.current;
            const posAttr = geometry.getAttribute("position") as THREE.BufferAttribute;
            const fromAttr = geometry.getAttribute("posFrom") as THREE.BufferAttribute;
            const scatterAttr = geometry.getAttribute("scatterPos") as THREE.BufferAttribute;
            const colorAttr = geometry.getAttribute("color") as THREE.BufferAttribute;

            // Save current scatter positions as "from" for reform (scatterPos → position)
            fromAttr.array.set(scatterAttr.array);
            fromAttr.needsUpdate = true;

            // Write new target positions
            const cached = cache.get(pending.pcdUrl);
            if (cached) {
              const transformed = applyPerRouteTransform(cached.positions, pending);
              posAttr.array.set(transformed);
              posAttr.needsUpdate = true;

              // Re-bake colors
              const colorKey = settingsRef.current.colorMode === "default" ? pending.colorMode : settingsRef.current.colorMode;
              const colors = cached.colors || generateDefaultColors(POINT_COUNT, colorKey, pending.transitionSeed);
              colorAttr.array.set(colors);
              colorAttr.needsUpdate = true;
            }

            // New scatter positions for reform animation
            const newScatter = generateScatterPositions(POINT_COUNT);
            scatterAttr.array.set(newScatter);
            scatterAttr.needsUpdate = true;

            // New point data
            const pdAttr = geometry.getAttribute("pointData") as THREE.BufferAttribute;
            const newPD = buildPointData(POINT_COUNT);
            pdAttr.array.set(newPD);
            pdAttr.needsUpdate = true;

            // Update label now
            console.log("[Transition] Phase 1→2: swapping data, new route:", pending.label);
            prevRouteRef.current = pending.label;
            routeConfigRef.current = pending;

            // Rotation burst at reform start
            const currentSpeed = settingsRef.current.rotationSpeed;
            rotationBurstRef.current = {
              startTime: now,
              originalSpeed: currentSpeed,
            };

            // Start phase 2
            transitionRef.current = {
              startTime: now,
              phase: 2,
              pendingRoute: null,
            };
          }
        }
      } else if (t.phase === 2) {
        // Phase 2: reform-in (progress 0.5→1.0)
        const rawT = Math.min(1, elapsed / SCATTER_IN_MS);
        const st = rawT;
        const progress = 0.5 + (1 - (1 - st) * (1 - st)) * 0.5; // quadratic ease-out, 0.5→1.0
        uniformsRef.current.progress.value = progress;

        if (rawT >= 1) {
          console.log("[Transition] Phase 2 complete (reform done)");
          transitionRef.current = { startTime: -1, phase: 0, pendingRoute: null };
          uniformsRef.current.progress.value = 1.0;

          // Glow pulse at reform complete
          glowPulseRef.current = { startTime: now };
        }
      }
    }

    // Inner glow pulse
    const glow = glowPulseRef.current;
    if (glow.startTime >= 0) {
      const elapsed = now - glow.startTime;
      if (elapsed < 0) {
        // Waiting for reform to complete
      } else if (elapsed < 300) {
        const pulseT = elapsed / 300;
        const pulse = Math.sin(pulseT * Math.PI);
        uniformsRef.current.innerGlowStrength.value = 0.3 + pulse * 0.5;
      } else {
        uniformsRef.current.innerGlowStrength.value = 0.3;
        glowPulseRef.current.startTime = -1;
      }
    }

    // Rotation burst
    let rotSpeed = currentSettings.rotationSpeed;
    const burst = rotationBurstRef.current;
    if (burst.startTime >= 0) {
      const elapsed = now - burst.startTime;
      if (elapsed < 300) {
        rotSpeed = burst.originalSpeed * 8;
      } else if (elapsed < 1300) {
        const bt = (elapsed - 300) / 1000;
        rotSpeed = burst.originalSpeed * (8 - 7 * easeOutCubic(bt));
      } else {
        rotSpeed = burst.originalSpeed;
        rotationBurstRef.current.startTime = -1;
      }
    }

    // Auto-rotate
    if (currentSettings.autoRotate) {
      spinRef.current += rotSpeed;
    }

    const mouseRotX = mouseRef.current.y * currentSettings.mouseSensitivity;
    const mouseRotY = mouseRef.current.x * currentSettings.mouseSensitivity;
    const baseX = currentRoute.preRotation[0] + currentSettings.rotationX + mouseRotX;
    const baseY = currentRoute.preRotation[1] + currentSettings.rotationY + spinRef.current + (currentSettings.autoRotate ? 0 : mouseRotY);
    const baseZ = currentRoute.preRotation[2];

    pointsRef.current.rotation.x += (baseX - pointsRef.current.rotation.x) * 0.06;
    pointsRef.current.rotation.y += (baseY - pointsRef.current.rotation.y) * 0.06;
    pointsRef.current.rotation.z += (baseZ - pointsRef.current.rotation.z) * 0.06;

    pointsRef.current.position.x = currentRoute.positionOffset[0];
    pointsRef.current.position.y = currentRoute.positionOffset[1] + Math.sin(time * 0.5) * 0.1;
    pointsRef.current.position.z = currentRoute.positionOffset[2];

    // Update uniforms from settings (pointSize is in world-space units ~0.02,
    // shader needs pixel-space scale, so multiply by a large factor)
    uniformsRef.current.pointSizeScale.value = currentSettings.pointSize * 200;
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry ref={initGeometry} />
      <shaderMaterial
        vertexShader={SCATTER_VERTEX}
        fragmentShader={SCATTER_FRAGMENT}
        uniforms={uniformsRef.current}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        vertexColors
      />
    </points>
  );
}

function getColorForMode(brightness: number, colorMode: string, index: number = 0): [number, number, number] {
  switch (colorMode) {
    case "blue":
      return [0.08 * brightness, 0.35 * brightness, brightness];
    case "cyan":
      return [0.1 * brightness, brightness, brightness];
    case "white":
      return [brightness, brightness, brightness];
    case "rainbow": {
      const hue = (index * 0.618033988749895) % 1;
      return hslToRgb(hue, 0.85, brightness * 0.56);
    }
    default:
      return [0.25 * brightness, 0.58 * brightness, brightness];
  }
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  let r: number, g: number, b: number;
  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }
  return [r, g, b];
}

function seededNoise(index: number, seed: number) {
  const x = Math.sin(index * 12.9898 + seed * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

function generateDefaultColors(count: number, colorMode: string = "default", seed: number = 0): Float32Array {
  const colors = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const i3 = i * 3;
    const brightness = 0.4 + seededNoise(i, seed + 5) * 0.6;
    const [cr, cg, cb] = getColorForMode(brightness, colorMode, i + seed * 1000);
    colors[i3] = cr;
    colors[i3 + 1] = cg;
    colors[i3 + 2] = cb;
  }
  return colors;
}

function generateProceduralCloud(count: number, colorMode: string = "default", seed: number = 0) {
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);

  for (let i = 0; i < count; i++) {
    const i3 = i * 3;
    const theta = seededNoise(i, seed + 1) * Math.PI * 2;
    const phi = Math.acos(2 * seededNoise(i, seed + 2) - 1);
    const r = 3 + seededNoise(i, seed + 3) * 5;

    positions[i3] = r * Math.sin(phi) * Math.cos(theta);
    positions[i3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    positions[i3 + 2] = r * Math.cos(phi);

    const brightness = 0.35 + seededNoise(i, seed + 4) * 0.65;
    const [cr, cg, cb] = getColorForMode(brightness, colorMode, i + seed * 1000);
    colors[i3] = cr;
    colors[i3 + 1] = cg;
    colors[i3 + 2] = cb;
  }

  return { positions, colors };
}

function FloatingParticles() {
  const ref = useRef<THREE.Points>(null);
  const count = 500;

  const positions = useMemo(() => {
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      arr[i * 3] = (seededNoise(i, 11) - 0.5) * 20;
      arr[i * 3 + 1] = (seededNoise(i, 12) - 0.5) * 20;
      arr[i * 3 + 2] = (seededNoise(i, 13) - 0.5) * 20;
    }
    return arr;
  }, []);

  useFrame((state) => {
    if (!ref.current) return;
    const time = state.clock.getElapsedTime();
    ref.current.rotation.y = time * 0.01;
    ref.current.rotation.x = time * 0.005;
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={count} array={positions} itemSize={3} />
      </bufferGeometry>
      <pointsMaterial
        size={0.015}
        color="#00d4ff"
        transparent
        opacity={0.28}
        sizeAttenuation
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

function LoadingOverlay() {
  const { loadingState, overallProgress } = usePointCloudData();
  const [visible, setVisible] = useState(true);
  const [opacity, setOpacity] = useState(1);

  useEffect(() => {
    if (loadingState === "complete") {
      // Fade out
      setOpacity(0);
      const timer = setTimeout(() => setVisible(false), 400);
      return () => clearTimeout(timer);
    }
  }, [loadingState]);

  if (!visible) return null;

  return (
    <div
      className="pointer-events-none absolute inset-0 z-20 flex flex-col items-center justify-center"
      style={{ opacity, transition: "opacity 0.4s ease-out" }}
    >
      <div className="text-cyan-100/60 font-mono text-sm uppercase tracking-[0.3em] mb-4">
        Loading point clouds...
      </div>
      <div className="w-48 h-1 rounded-full bg-slate-800/60 overflow-hidden">
        <div
          className="h-full bg-cyan-400/60 rounded-full transition-all duration-300"
          style={{ width: `${overallProgress}%` }}
        />
      </div>
      <div className="text-cyan-100/40 font-mono text-xs mt-2 tracking-wider">
        {overallProgress}%
      </div>
    </div>
  );
}

export default function PointCloudBackground({ settings: externalSettings }: PointCloudBackgroundProps = {}) {
  return <PointCloudBackgroundInner settings={externalSettings} />;
}

function PointCloudBackgroundInner({ settings: externalSettings }: PointCloudBackgroundProps = {}) {
  const [pointCount, setPointCount] = useState(0);
  const pathname = usePathname();
  const defaultConfig = useMemo(() => getPointCloudConfig(pathname), [pathname]);
  const { settings: contextSettings, overrideRouteConfig } = usePointCloudSettings();
  const settings = externalSettings || contextSettings;
  const routeConfig = overrideRouteConfig ?? defaultConfig;

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <Canvas
        camera={{ position: [0, 0, 20], fov: 60, near: 0.1, far: 100 }}
        dpr={[1, 1.5]}
        style={{ background: "#0a0a0f" }}
        gl={{ antialias: false, alpha: false, powerPreference: "high-performance" }}
      >
        <color attach="background" args={["#0a0a0f"]} />
        <fog attach="fog" args={["#0a0a0f", 20, 50]} />
        <CameraController settings={settings} />
        <PointCloud
          settings={settings}
          routeConfig={routeConfig}
          onPointCountChange={setPointCount}
        />
        <FloatingParticles />
      </Canvas>

      <LoadingOverlay />

      <div className="pointer-events-none absolute bottom-4 left-4 z-10 rounded-md border border-cyan-400/10 bg-slate-950/35 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.2em] text-cyan-100/45 backdrop-blur-sm">
        <div>{routeConfig.label}</div>
        <div>{`${pointCount} pts`}</div>
      </div>
    </div>
  );
}
