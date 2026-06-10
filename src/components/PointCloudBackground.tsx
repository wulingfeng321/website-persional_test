"use client";

import { useRef, useMemo, useEffect, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { usePathname } from "next/navigation";
import * as THREE from "three";
import { loadPCD, normalizePCDData, PCDData } from "@/lib/pcdLoader";
import { PointCloudSettings } from "./PointCloudControls";
import { usePointCloudSettings } from "@/lib/PointCloudSettingsContext";
import { getPointCloudConfig, RoutePointCloudConfig } from "@/lib/pointCloudPages";

interface PointCloudBackgroundProps {
  settings?: PointCloudSettings;
}

const INTRO_START_Z = 1.2;
const INTRO_DURATION = 2.8;
const INTRO_HOLD = 0.4;
const PAGE_TRANSITION_DURATION = 1.35;

function easeOutCubic(t: number) {
  return 1 - Math.pow(1 - t, 3);
}

function easeInOutCubic(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
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
    }

    camera.lookAt(0, 0, 0);
  });

  return null;
}

interface PointCloudProps {
  settings: PointCloudSettings;
  routeConfig: RoutePointCloudConfig;
  onLoadingStatusChange?: (status: "idle" | "loading" | "loaded" | "error") => void;
  onProgressChange?: (progress: number) => void;
  onPointCountChange?: (count: number) => void;
}

function PointCloud({ settings, routeConfig, onLoadingStatusChange, onProgressChange, onPointCountChange }: PointCloudProps) {
  const pointsRef = useRef<THREE.Points>(null);
  const materialRef = useRef<THREE.PointsMaterial>(null);
  const mouseRef = useRef({ x: 0, y: 0 });
  const settingsRef = useRef(settings);
  const routeConfigRef = useRef(routeConfig);
  const transitionRef = useRef({ key: routeConfig.label, startTime: -1, spin: 0 });
  const [isMobile, setIsMobile] = useState(false);
  const [pcdData, setPcdData] = useState<PCDData | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  useEffect(() => {
    routeConfigRef.current = routeConfig;
    transitionRef.current = {
      key: routeConfig.label,
      startTime: performance.now() / 1000,
      spin: transitionRef.current.spin,
    };
    setIsLoaded(false);
  }, [routeConfig]);

  useEffect(() => {
    setIsMobile(window.innerWidth < 768);
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    console.log("[PointCloud] 开始加载 PCD:", routeConfig.pcdUrl, routeConfig.label);
    onLoadingStatusChange?.("loading");
    onProgressChange?.(0);

    loadPCD(routeConfig.pcdUrl, (loaded, total) => {
      const progress = total > 0 ? Math.round((loaded / total) * 100) : 0;
      onProgressChange?.(progress);
    }, controller.signal)
      .then((data) => {
        if (controller.signal.aborted) return;
        const normalized = normalizePCDData(data, routeConfig.targetRadius);
        setPcdData(normalized);
        setIsLoaded(true);
        onLoadingStatusChange?.("loaded");
        onProgressChange?.(100);
        onPointCountChange?.(normalized.count);
        console.log("[PointCloud] PCD 归一化完成，点数:", normalized.count);
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        console.error("[PointCloud] PCD 加载失败:", err);
        setPcdData(null);
        setIsLoaded(false);
        onLoadingStatusChange?.("error");
      });

    return () => controller.abort();
  }, [routeConfig, onLoadingStatusChange, onProgressChange, onPointCountChange]);

  const count = pcdData ? pcdData.count : (isMobile ? 3000 : 8000);
  const colorKey = settings.colorMode === "default" ? routeConfig.colorMode : settings.colorMode;

  const { positions, colors } = useMemo(() => {
    if (pcdData) {
      return {
        positions: pcdData.positions,
        colors: pcdData.colors || generateDefaultColors(pcdData.count, colorKey, routeConfig.transitionSeed),
      };
    }
    return generateProceduralCloud(isMobile ? 3000 : 8000, colorKey, routeConfig.transitionSeed);
  }, [pcdData, isMobile, colorKey, routeConfig.transitionSeed]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      mouseRef.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      mouseRef.current.y = -(e.clientY / window.innerHeight) * 2 + 1;
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  useFrame((state) => {
    if (!pointsRef.current) return;

    const time = state.clock.getElapsedTime();
    const now = performance.now() / 1000;
    const currentSettings = settingsRef.current;
    const currentRoute = routeConfigRef.current;
    const transitionProgress = transitionRef.current.startTime < 0
      ? 1
      : Math.min((now - transitionRef.current.startTime) / PAGE_TRANSITION_DURATION, 1);
    const easedTransition = easeInOutCubic(transitionProgress);
    const burst = Math.sin(easedTransition * Math.PI);
    const loadFade = isLoaded ? 1 : 0.42;

    if (currentSettings.autoRotate) {
      transitionRef.current.spin += currentSettings.rotationSpeed;
    }

    const mouseRotX = mouseRef.current.y * currentSettings.mouseSensitivity;
    const mouseRotY = mouseRef.current.x * currentSettings.mouseSensitivity;
    const baseX = currentRoute.preRotation[0] + currentSettings.rotationX + mouseRotX;
    const baseY = currentRoute.preRotation[1] + currentSettings.rotationY + transitionRef.current.spin + (currentSettings.autoRotate ? 0 : mouseRotY);
    const baseZ = currentRoute.preRotation[2];

    pointsRef.current.rotation.x += (baseX - pointsRef.current.rotation.x) * 0.06;
    pointsRef.current.rotation.y += (baseY - pointsRef.current.rotation.y) * 0.06;
    pointsRef.current.rotation.z += (baseZ - pointsRef.current.rotation.z) * 0.06;

    const targetScale = (0.72 + easedTransition * 0.28 + burst * 1.05) * loadFade;
    pointsRef.current.scale.setScalar(targetScale);
    pointsRef.current.position.x = currentRoute.positionOffset[0];
    pointsRef.current.position.y = currentRoute.positionOffset[1] + Math.sin(time * 0.5) * 0.1;
    pointsRef.current.position.z = currentRoute.positionOffset[2];

    if (materialRef.current) {
      materialRef.current.size = currentSettings.pointSize * (1 + burst * 0.85);
      materialRef.current.opacity = Math.min(0.92, 0.36 + easedTransition * 0.48 + burst * 0.28);
    }
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry key={`${routeConfig.label}-${isLoaded ? "pcd" : "procedural"}-${colorKey}`}>
        <bufferAttribute attach="attributes-position" count={count} array={positions} itemSize={3} />
        <bufferAttribute attach="attributes-color" count={count} array={colors} itemSize={3} />
      </bufferGeometry>
      <pointsMaterial
        ref={materialRef}
        size={settings.pointSize}
        vertexColors
        transparent
        opacity={0.5}
        sizeAttenuation
        depthWrite={false}
        blending={THREE.AdditiveBlending}
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

export default function PointCloudBackground({ settings: externalSettings }: PointCloudBackgroundProps = {}) {
  return <PointCloudBackgroundInner settings={externalSettings} />;
}

function PointCloudBackgroundInner({ settings: externalSettings }: PointCloudBackgroundProps = {}) {
  const [loadingStatus, setLoadingStatus] = useState<"idle" | "loading" | "loaded" | "error">("idle");
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [pointCount, setPointCount] = useState(0);
  const pathname = usePathname();
  const routeConfig = useMemo(() => getPointCloudConfig(pathname), [pathname]);
  const { settings: contextSettings } = usePointCloudSettings();
  const settings = externalSettings || contextSettings;

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
          onLoadingStatusChange={setLoadingStatus}
          onProgressChange={setLoadingProgress}
          onPointCountChange={setPointCount}
        />
        <FloatingParticles />
      </Canvas>

      <div className="pointer-events-none absolute bottom-4 left-4 z-10 rounded-md border border-cyan-400/10 bg-slate-950/35 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.2em] text-cyan-100/45 backdrop-blur-sm">
        <div>{routeConfig.label}</div>
        <div>{loadingStatus === "loading" ? `Loading ${loadingProgress}%` : `${loadingStatus} · ${pointCount} pts`}</div>
      </div>
    </div>
  );
}
