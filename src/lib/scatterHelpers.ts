import { PCDData } from "./pcdLoader";
import { RoutePointCloudConfig } from "./pointCloudPages";

export const POINT_COUNT = 57682;
export const BASE_RADIUS = 5.0;
export const SCATTER_OUT_MS = 1000;
export const SCATTER_IN_MS = 1800;
export const SCATTER_TOTAL_MS = SCATTER_OUT_MS + SCATTER_IN_MS;
export const INIT_FLY_IN_MS = 1800;
const SCATTER_RADIUS_MIN = 10;
const SCATTER_RADIUS_MAX = 15;

export function generateScatterPositions(count: number): Float32Array {
  const arr = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    const r = SCATTER_RADIUS_MIN + Math.random() * (SCATTER_RADIUS_MAX - SCATTER_RADIUS_MIN);
    arr[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    arr[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    arr[i * 3 + 2] = r * Math.cos(phi);
  }
  return arr;
}

export function buildPointData(count: number): Float32Array {
  const arr = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    arr[i * 3] = 1.0;       // size (uniform)
    arr[i * 3 + 1] = Math.random(); // delay (0~1)
    arr[i * 3 + 2] = Math.random(); // random
  }
  return arr;
}

export function resamplePCDData(
  data: PCDData,
  targetCount: number
): { positions: Float32Array; colors: Float32Array; count: number } {
  const srcCount = data.count;
  const positions = new Float32Array(targetCount * 3);
  const colors = new Float32Array(targetCount * 3);
  const srcColors = data.colors || generateUniformColors(srcCount);

  if (srcCount === targetCount) {
    positions.set(data.positions);
    colors.set(srcColors);
  } else if (srcCount < targetCount) {
    // Duplicate points to fill
    for (let i = 0; i < targetCount; i++) {
      const srcIdx = i % srcCount;
      const i3 = i * 3;
      const s3 = srcIdx * 3;
      positions[i3] = data.positions[s3];
      positions[i3 + 1] = data.positions[s3 + 1];
      positions[i3 + 2] = data.positions[s3 + 2];
      // Add slight jitter to duplicates to avoid z-fighting
      if (i >= srcCount) {
        positions[i3] += (Math.random() - 0.5) * 0.002;
        positions[i3 + 1] += (Math.random() - 0.5) * 0.002;
        positions[i3 + 2] += (Math.random() - 0.5) * 0.002;
      }
      colors[i3] = srcColors[s3];
      colors[i3 + 1] = srcColors[s3 + 1];
      colors[i3 + 2] = srcColors[s3 + 2];
    }
  } else {
    // Stride-sample to reduce
    const step = srcCount / targetCount;
    for (let i = 0; i < targetCount; i++) {
      const srcIdx = Math.floor(i * step);
      const i3 = i * 3;
      const s3 = srcIdx * 3;
      positions[i3] = data.positions[s3];
      positions[i3 + 1] = data.positions[s3 + 1];
      positions[i3 + 2] = data.positions[s3 + 2];
      colors[i3] = srcColors[s3];
      colors[i3 + 1] = srcColors[s3 + 1];
      colors[i3 + 2] = srcColors[s3 + 2];
    }
  }

  return { positions, colors, count: targetCount };
}

function generateUniformColors(count: number): Float32Array {
  const colors = new Float32Array(count * 3);
  for (let i = 0; i < count * 3; i++) {
    colors[i] = 0.6 + Math.random() * 0.4;
  }
  return colors;
}

export function applyPerRouteTransform(
  basePositions: Float32Array,
  config: RoutePointCloudConfig
): Float32Array {
  const scale = config.targetRadius / BASE_RADIUS;
  if (scale === 1) return basePositions;
  const out = new Float32Array(basePositions.length);
  for (let i = 0; i < basePositions.length; i++) {
    out[i] = basePositions[i] * scale;
  }
  return out;
}
