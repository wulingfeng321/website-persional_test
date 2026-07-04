"use client";

import { createContext, useContext, useEffect, useState, useRef, ReactNode } from "react";
import { loadBin, normalizePCDData } from "./pcdLoader";
import { PAGE_POINT_CLOUDS } from "./pointCloudPages";
import { resamplePCDData, POINT_COUNT, BASE_RADIUS } from "./scatterHelpers";

export interface ResampledPCDData {
  positions: Float32Array;
  colors: Float32Array;
  count: number;
}

interface PointCloudDataContextValue {
  cache: Map<string, ResampledPCDData>;
  loadingState: "idle" | "loading" | "complete" | "error";
  overallProgress: number;
}

const PointCloudDataContext = createContext<PointCloudDataContextValue>({
  cache: new Map(),
  loadingState: "idle",
  overallProgress: 0,
});

export function usePointCloudData() {
  return useContext(PointCloudDataContext);
}

function getUniquePcdUrls(): string[] {
  const seen = new Set<string>();
  for (const config of Object.values(PAGE_POINT_CLOUDS)) {
    seen.add(config.pcdUrl);
  }
  return Array.from(seen);
}

export function PointCloudDataProvider({ children }: { children: ReactNode }) {
  const [loadingState, setLoadingState] = useState<"idle" | "loading" | "complete" | "error">("idle");
  const [overallProgress, setOverallProgress] = useState(0);
  const cacheRef = useRef(new Map<string, ResampledPCDData>());

  useEffect(() => {
    const urls = getUniquePcdUrls();
    const controller = new AbortController();
    const progressMap = new Map<string, number>();

    console.log("[PointCloudData] Starting preload, urls:", urls);
    setLoadingState("loading");

    const loadOne = async (url: string, retries = 2) => {
      progressMap.set(url, 0);

      for (let attempt = 0; attempt <= retries; attempt++) {
        try {
          if (attempt > 0) {
            console.log(`[PointCloudData] Retry #${attempt} for:`, url);
            await new Promise(r => setTimeout(r, 1000));
          }
          if (controller.signal.aborted) return;

          console.log(`[PointCloudData] Fetching: ${url} (attempt ${attempt + 1})`);
          const data = await loadBin(url, (loaded, total) => {
            if (controller.signal.aborted) return;
            const estimatedTotal = total > 0 ? total : (url.includes("example") ? 6 * 1024 * 1024 : 600 * 1024);
            progressMap.set(url, Math.min(loaded / estimatedTotal, 0.99));
            let sum = 0;
            progressMap.forEach((v) => { sum += v; });
            setOverallProgress(Math.round((sum / urls.length) * 100));
          }, controller.signal);

          if (controller.signal.aborted) return;
          console.log("[PointCloudData] Downloaded:", url, "points:", data.count);

          const normalized = normalizePCDData(data, BASE_RADIUS);
          const resampled = resamplePCDData(normalized, POINT_COUNT);
          cacheRef.current.set(url, resampled);
          console.log("[PointCloudData] Cached:", url, "→", resampled.count, "points");
          return;
        } catch (err) {
          if (controller.signal.aborted) return;
          if (err instanceof DOMException && err.name === "AbortError") return;
          console.error(`[PointCloudData] Error loading ${url} (attempt ${attempt + 1}):`, err);
          if (attempt === retries) throw err;
        }
      }
    };

    const loadAll = async () => {
      try {
        await Promise.all(urls.map(loadOne));
        if (!controller.signal.aborted) {
          console.log("[PointCloudData] All files loaded");
          setOverallProgress(100);
          setLoadingState("complete");
        }
      } catch (err) {
        if (controller.signal.aborted) return;
        console.error("[PointCloudData] Failed to preload PCD files:", err);
        setLoadingState("error");
      }
    };

    loadAll();

    return () => {
      controller.abort();
    };
  }, []);

  return (
    <PointCloudDataContext.Provider
      value={{
        cache: cacheRef.current,
        loadingState,
        overallProgress,
      }}
    >
      {children}
    </PointCloudDataContext.Provider>
  );
}
