"use client";

import { useRef, useMemo, useEffect, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { loadPCD, normalizePCDData, PCDData } from "@/lib/pcdLoader";
import { PointCloudSettings, defaultSettings } from "./PointCloudControls";
import { usePointCloudSettings } from "@/lib/PointCloudSettingsContext";

/**
 * PCD 配置：修改此路径指向你的 .pcd 文件
 * 文件放在 public/models/ 目录下，例如：
 *   public/models/bunny.pcd   →  PCD_URL = "/models/bunny.pcd"
 * 设为 null 则使用程序化生成的点云
 */
const PCD_URL = "/models/example.pcd"; // ← 修改这里加载你的 PCD 文件

// 组件 Props
interface PointCloudBackgroundProps {
  settings?: PointCloudSettings;
}

/* 相机控制器 - 带入场动画 */
const INTRO_START_Z = 0.5; // 起始位置（点云内部）
const INTRO_DURATION = 3.0; // 动画持续时间（秒）
const INTRO_HOLD = 1.0; // 在内部停留时间（秒）

function CameraController({ settings }: { settings: PointCloudSettings }) {
  const { camera } = useThree();
  const introRef = useRef({
    startTime: -1,
    completed: false,
    initialZ: INTRO_START_Z,
  });

  useFrame((state) => {
    const elapsed = state.clock.getElapsedTime();

    // 记录动画开始时间
    if (introRef.current.startTime < 0) {
      introRef.current.startTime = elapsed;
      camera.position.z = INTRO_START_Z;
    }

    const timeSinceStart = elapsed - introRef.current.startTime;

    // 入场动画阶段
    if (!introRef.current.completed) {
      // 停留阶段
      if (timeSinceStart < INTRO_HOLD) {
        // 在内部轻微浮动
        camera.position.z = INTRO_START_Z + Math.sin(elapsed * 2) * 0.1;
        camera.position.x = Math.sin(elapsed * 0.5) * 0.3;
        camera.position.y = Math.cos(elapsed * 0.3) * 0.2;
      }
      // 拉远阶段
      else {
        const progress = Math.min((timeSinceStart - INTRO_HOLD) / INTRO_DURATION, 1);
        // 使用 easeOutExpo 缓动函数，让动画更流畅
        const eased = 1 - Math.pow(2, -10 * progress);

        // 从内部位置插值到目标位置
        camera.position.z = INTRO_START_Z + (settings.cameraDistance - INTRO_START_Z) * eased;
        camera.position.x = settings.cameraX * eased;
        camera.position.y = settings.cameraY * eased;

        // 动画完成
        if (progress >= 1) {
          introRef.current.completed = true;
        }
      }
    }
    // 正常控制阶段
    else {
      camera.position.x += (settings.cameraX - camera.position.x) * 0.05;
      camera.position.y += (settings.cameraY - camera.position.y) * 0.05;
      camera.position.z += (settings.cameraDistance - camera.position.z) * 0.05;
    }

    camera.lookAt(0, 0, 0);
  });

  return null;
}

/* 点云粒子系统 */
interface PointCloudProps {
  settings: PointCloudSettings;
  onLoadingStatusChange?: (status: "idle" | "loading" | "loaded" | "error") => void;
  onProgressChange?: (progress: number) => void;
  onPointCountChange?: (count: number) => void;
}

function PointCloud({ settings, onLoadingStatusChange, onProgressChange, onPointCountChange }: PointCloudProps) {
  const pointsRef = useRef<THREE.Points>(null);
  const materialRef = useRef<THREE.PointsMaterial>(null);
  const mouseRef = useRef({ x: 0, y: 0 });
  const settingsRef = useRef(settings);
  const [isMobile, setIsMobile] = useState(false);
  const [pcdData, setPcdData] = useState<PCDData | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const introAnimRef = useRef({
    startTime: -1,
    particleScale: 0, // 粒子初始大小为0
    opacity: 0, // 初始透明度为0
  });

  // 保持 settingsRef 最新
  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  useEffect(() => {
    setIsMobile(window.innerWidth < 768);
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // 加载 PCD 文件
  useEffect(() => {
    if (!PCD_URL) {
      console.log("[PointCloud] PCD_URL 为空，使用程序化点云");
      return;
    }

    console.log("[PointCloud] 开始加载 PCD:", PCD_URL);
    onLoadingStatusChange?.("loading");

    loadPCD(PCD_URL, (loaded, total) => {
      const progress = Math.round((loaded / total) * 100);
      onProgressChange?.(progress);
      if (progress % 20 === 0) {
        console.log(`[PointCloud] 加载进度: ${progress}%`);
      }
    })
      .then((data) => {
        console.log("[PointCloud] PCD 加载成功，开始归一化...");
        const normalized = normalizePCDData(data, 5);
        setPcdData(normalized);
        setIsLoaded(true);
        onLoadingStatusChange?.("loaded");
        onPointCountChange?.(normalized.count);
        console.log("[PointCloud] PCD 归一化完成，点数:", normalized.count);
      })
      .catch((err) => {
        console.error("[PointCloud] PCD 加载失败:", err);
        onLoadingStatusChange?.("error");
      });
  }, [onLoadingStatusChange, onProgressChange, onPointCountChange]);

  const count = pcdData ? pcdData.count : (isMobile ? 3000 : 8000);

  // 程序化生成点云（PCD 未加载时的 fallback）
  // 使用 key 来强制重新生成颜色
  const colorKey = settings.colorMode;
  const { positions, colors } = useMemo(() => {
    if (pcdData) {
      return {
        positions: pcdData.positions,
        colors: pcdData.colors || generateDefaultColors(pcdData.count, colorKey),
      };
    }
    return generateProceduralCloud(isMobile ? 3000 : 8000, colorKey);
  }, [pcdData, isMobile, colorKey]);

  // 鼠标交互
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      mouseRef.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      mouseRef.current.y = -(e.clientY / window.innerHeight) * 2 + 1;
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  // 动画循环
  useFrame((state) => {
    if (!pointsRef.current) return;
    const time = state.clock.getElapsedTime();
    const currentSettings = settingsRef.current;

    // 记录动画开始时间
    if (introAnimRef.current.startTime < 0) {
      introAnimRef.current.startTime = time;
    }

    const timeSinceStart = time - introAnimRef.current.startTime;

    // 粒子聚合动画（前 3 秒）
    if (timeSinceStart < 3) {
      const progress = Math.min(timeSinceStart / 2.5, 1);
      // 使用 easeOutQuart 缓动
      const eased = 1 - Math.pow(1 - progress, 4);

      introAnimRef.current.particleScale = eased;
      introAnimRef.current.opacity = eased * 0.9;
    } else {
      introAnimRef.current.particleScale = 1;
      introAnimRef.current.opacity = 0.9;
    }

    // 自动旋转 - 使用 rotationSpeed 作为每帧增量
    if (currentSettings.autoRotate) {
      pointsRef.current.rotation.y += currentSettings.rotationSpeed;
    }

    // 鼠标交互
    const targetRotX = mouseRef.current.y * currentSettings.mouseSensitivity;
    const targetRotY = mouseRef.current.x * currentSettings.mouseSensitivity;
    pointsRef.current.rotation.x += (targetRotX - pointsRef.current.rotation.x) * 0.02;

    // 如果没有自动旋转，才应用鼠标 Y 轴旋转
    if (!currentSettings.autoRotate) {
      pointsRef.current.rotation.y += (targetRotY - pointsRef.current.rotation.y) * 0.02;
    }

    // 浮动效果
    pointsRef.current.position.y = Math.sin(time * 0.5) * 0.1;

    // 更新材质属性
    if (materialRef.current) {
      // 点大小：入场时从 0 增长，然后使用设置值
      const targetSize = currentSettings.pointSize * introAnimRef.current.particleScale;
      materialRef.current.size = targetSize;
      materialRef.current.opacity = introAnimRef.current.opacity;
    }
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry key={`${isLoaded ? "pcd" : "procedural"}-${colorKey}`}>
        <bufferAttribute
          attach="attributes-position"
          count={count}
          array={positions}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-color"
          count={count}
          array={colors}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        ref={materialRef}
        size={settings.pointSize}
        vertexColors
        transparent
        opacity={0.9}
        sizeAttenuation
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

/* 根据颜色模式生成颜色 */
function getColorForMode(brightness: number, mode: string, index?: number): [number, number, number] {
  switch (mode) {
    case "blue":
      return [brightness * 0.2, brightness * 0.4, brightness];
    case "cyan":
      return [brightness * 0.2, brightness * 0.8, brightness];
    case "white":
      return [brightness, brightness, brightness];
    case "rainbow":
      if (index !== undefined) {
        const hue = (index * 0.001) % 1;
        return hslToRgb(hue, 0.8, brightness * 0.6);
      }
      return [brightness, brightness * 0.5, brightness * 0.5];
    default: // "default"
      const blueShift = Math.random() * 0.3;
      return [
        brightness * (1 - blueShift * 0.5),
        brightness * (1 - blueShift * 0.2),
        brightness,
      ];
  }
}

/* HSL 转 RGB */
function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  let r, g, b;
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

/* 生成程序化点云 */
function generateProceduralCloud(count: number, colorMode: string = "default") {
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);

  for (let i = 0; i < count; i++) {
    const i3 = i * 3;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    const r = 3 + Math.random() * 5;

    positions[i3] = r * Math.sin(phi) * Math.cos(theta);
    positions[i3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    positions[i3 + 2] = r * Math.cos(phi);

    const brightness = 0.3 + Math.random() * 0.7;
    const [cr, cg, cb] = getColorForMode(brightness, colorMode, i);
    colors[i3] = cr;
    colors[i3 + 1] = cg;
    colors[i3 + 2] = cb;
  }

  return { positions, colors };
}

/* 为没有颜色的 PCD 数据生成默认颜色 */
function generateDefaultColors(count: number, colorMode: string = "default"): Float32Array {
  const colors = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const i3 = i * 3;
    const brightness = 0.4 + Math.random() * 0.6;
    const [cr, cg, cb] = getColorForMode(brightness, colorMode, i);
    colors[i3] = cr;
    colors[i3 + 1] = cg;
    colors[i3 + 2] = cb;
  }
  return colors;
}

/* 额外的漂浮粒子层 */
function FloatingParticles() {
  const ref = useRef<THREE.Points>(null);
  const count = 500;

  const positions = useMemo(() => {
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      arr[i * 3] = (Math.random() - 0.5) * 20;
      arr[i * 3 + 1] = (Math.random() - 0.5) * 20;
      arr[i * 3 + 2] = (Math.random() - 0.5) * 20;
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
        <bufferAttribute
          attach="attributes-position"
          count={count}
          array={positions}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.015}
        color="#00d4ff"
        transparent
        opacity={0.4}
        sizeAttenuation
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

export default function PointCloudBackground({ settings: externalSettings }: PointCloudBackgroundProps = {}) {
  return (
    <PointCloudBackgroundInner settings={externalSettings} />
  );
}

function PointCloudBackgroundInner({ settings: externalSettings }: PointCloudBackgroundProps = {}) {
  const [loadingStatus, setLoadingStatus] = useState<"idle" | "loading" | "loaded" | "error">("idle");
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [pointCount, setPointCount] = useState(0);

  // 从 Context 获取设置
  const { settings: contextSettings } = usePointCloudSettings();

  // 优先使用外部传入的设置，否则使用 Context 中的设置
  const settings = externalSettings || contextSettings;

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <Canvas
        camera={{ position: [0, 0, 20], fov: 60, near: 0.1, far: 100 }}
        dpr={[1, 1.5]}
        style={{ background: "#0a0a0f" }}
        gl={{
          antialias: false,
          alpha: false,
          powerPreference: "high-performance",
        }}
      >
        <color attach="background" args={["#0a0a0f"]} />
        <fog attach="fog" args={["#0a0a0f", 20, 50]} />
        <CameraController settings={settings} />
        <PointCloud
          settings={settings}
          onLoadingStatusChange={setLoadingStatus}
          onProgressChange={setLoadingProgress}
          onPointCountChange={setPointCount}
        />
        <FloatingParticles />
      </Canvas>

      {/* 调试信息 */}
      {/* <div
        style={{
          position: "absolute",
          top: "10px",
          right: "10px",
          color: "#00d4ff",
          fontFamily: "monospace",
          fontSize: "11px",
          opacity: 0.7,
          zIndex: 10,
          background: "rgba(0,0,0,0.5)",
          padding: "8px",
          borderRadius: "4px",
        }}
      >
        <div>Status: {loadingStatus}</div>
        <div>Points: {pointCount}</div>
        {loadingStatus === "loading" && <div>Progress: {loadingProgress}%</div>}
      </div> */}

      {/* 加载状态指示器 */}
      {/* {loadingStatus === "loading" && (
        <div
          style={{
            position: "absolute",
            bottom: "20px",
            left: "20px",
            color: "#00d4ff",
            fontFamily: "monospace",
            fontSize: "12px",
            opacity: 0.8,
            zIndex: 10,
          }}
        >
          Loading PCD: {loadingProgress}%
        </div>
      )}

      {loadingStatus === "error" && (
        <div
          style={{
            position: "absolute",
            bottom: "20px",
            left: "20px",
            color: "#ff4444",
            fontFamily: "monospace",
            fontSize: "12px",
            opacity: 0.8,
            zIndex: 10,
          }}
        >
          PCD load failed, using procedural cloud
        </div>
      )} */}

      {/* {loadingStatus === "loaded" && (
        <div
          style={{
            position: "absolute",
            bottom: "20px",
            left: "20px",
            color: "#44ff44",
            fontFamily: "monospace",
            fontSize: "12px",
            opacity: 0.6,
            zIndex: 10,
          }}
        >
          PCD loaded: {pointCount} points
        </div>
      )} */}
    </div>
  );
}
