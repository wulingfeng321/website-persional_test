"use client";

import { useRef, useMemo, useEffect, useState, useCallback } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { loadPCD, normalizePCDData, PCDData } from "@/lib/pcdLoader";

/**
 * PCD 配置：修改此路径指向你的 .pcd 文件
 * 文件放在 public/models/ 目录下，例如：
 *   public/models/bunny.pcd   →  PCD_URL = "/models/bunny.pcd"
 * 设为 null 则使用程序化生成的点云
 */
const PCD_URL: string | null = null; // ← 修改这里加载你的 PCD 文件

/* 点云粒子系统 */
function PointCloud() {
  const pointsRef = useRef<THREE.Points>(null);
  const mouseRef = useRef({ x: 0, y: 0 });
  const [isMobile, setIsMobile] = useState(false);
  const [pcdData, setPcdData] = useState<PCDData | null>(null);

  useEffect(() => {
    setIsMobile(window.innerWidth < 768);
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // 加载 PCD 文件
  useEffect(() => {
    if (!PCD_URL) return;
    loadPCD(PCD_URL)
      .then((data) => {
        const normalized = normalizePCDData(data, 5);
        setPcdData(normalized);
      })
      .catch((err) => {
        console.warn("PCD 加载失败，使用默认点云:", err);
      });
  }, []);

  const count = pcdData ? pcdData.count : (isMobile ? 3000 : 8000);

  // 程序化生成点云（PCD 未加载时的 fallback）
  const { positions, colors } = useMemo(() => {
    if (pcdData) {
      return {
        positions: pcdData.positions,
        colors: pcdData.colors || generateDefaultColors(pcdData.count),
      };
    }
    return generateProceduralCloud(isMobile ? 3000 : 8000);
  }, [pcdData, isMobile]);

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

    pointsRef.current.rotation.y = time * 0.03;
    pointsRef.current.rotation.x = Math.sin(time * 0.02) * 0.1;

    const targetRotX = mouseRef.current.y * 0.15;
    const targetRotY = mouseRef.current.x * 0.15;
    pointsRef.current.rotation.x += (targetRotX - pointsRef.current.rotation.x) * 0.02;
    pointsRef.current.rotation.y += (targetRotY - pointsRef.current.rotation.y) * 0.02;

    pointsRef.current.position.y = Math.sin(time * 0.5) * 0.1;
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
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
        size={0.03}
        vertexColors
        transparent
        opacity={0.8}
        sizeAttenuation
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

/* 生成程序化点云 */
function generateProceduralCloud(count: number) {
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
    const blueShift = Math.random() * 0.4;
    colors[i3] = brightness * (1 - blueShift * 0.5);
    colors[i3 + 1] = brightness * (1 - blueShift * 0.2);
    colors[i3 + 2] = brightness;
  }

  return { positions, colors };
}

/* 为没有颜色的 PCD 数据生成默认颜色 */
function generateDefaultColors(count: number): Float32Array {
  const colors = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const i3 = i * 3;
    const brightness = 0.4 + Math.random() * 0.6;
    const blueShift = Math.random() * 0.3;
    colors[i3] = brightness * (1 - blueShift * 0.5);
    colors[i3 + 1] = brightness * (1 - blueShift * 0.2);
    colors[i3 + 2] = brightness;
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

export default function PointCloudBackground() {
  return (
    <Canvas
      camera={{ position: [0, 0, 8], fov: 60 }}
      dpr={[1, 1.5]}
      style={{ background: "#0a0a0f" }}
      gl={{
        antialias: false,
        alpha: false,
        powerPreference: "high-performance",
      }}
    >
      <color attach="background" args={["#0a0a0f"]} />
      <fog attach="fog" args={["#0a0a0f", 8, 25]} />
      <PointCloud />
      <FloatingParticles />
    </Canvas>
  );
}
