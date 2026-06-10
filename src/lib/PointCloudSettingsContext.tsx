"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { PointCloudSettings, defaultSettings } from "@/components/PointCloudControls";

interface PointCloudSettingsContextType {
  settings: PointCloudSettings;
  updateSettings: (settings: PointCloudSettings) => void;
  resetSettings: () => void;
}

const PointCloudSettingsContext = createContext<PointCloudSettingsContextType | undefined>(undefined);

const STORAGE_KEY = "pointcloud-settings";

function sanitizeSettings(value: Partial<PointCloudSettings>): PointCloudSettings {
  return {
    ...defaultSettings,
    ...value,
    rotationSpeed: Math.min(Math.max(value.rotationSpeed ?? defaultSettings.rotationSpeed, 0), 0.02),
    pointSize: Math.min(Math.max(value.pointSize ?? defaultSettings.pointSize, 0.01), 0.2),
    mouseSensitivity: Math.min(Math.max(value.mouseSensitivity ?? defaultSettings.mouseSensitivity, 0), 0.5),
    rotationX: Math.min(Math.max(value.rotationX ?? defaultSettings.rotationX, -Math.PI), Math.PI),
    rotationY: Math.min(Math.max(value.rotationY ?? defaultSettings.rotationY, -Math.PI), Math.PI),
  };
}

export function PointCloudSettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<PointCloudSettings>(defaultSettings);
  const [isLoaded, setIsLoaded] = useState(false);

  // 从 localStorage 加载设置
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        setSettings(sanitizeSettings(parsed));
      }
    } catch (e) {
      console.warn("Failed to load settings from localStorage:", e);
    }
    setIsLoaded(true);
  }, []);

  // 保存设置到 localStorage
  const updateSettings = (newSettings: PointCloudSettings) => {
    const sanitized = sanitizeSettings(newSettings);
    setSettings(sanitized);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(sanitized));
    } catch (e) {
      console.warn("Failed to save settings to localStorage:", e);
    }
  };

  // 重置为默认设置
  const resetSettings = () => {
    setSettings(defaultSettings);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (e) {
      console.warn("Failed to clear settings from localStorage:", e);
    }
  };

  return (
    <PointCloudSettingsContext.Provider value={{ settings, updateSettings, resetSettings }}>
      {children}
    </PointCloudSettingsContext.Provider>
  );
}

export function usePointCloudSettings() {
  const context = useContext(PointCloudSettingsContext);
  if (!context) {
    throw new Error("usePointCloudSettings must be used within PointCloudSettingsProvider");
  }
  return context;
}
