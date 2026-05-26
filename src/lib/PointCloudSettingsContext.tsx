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

export function PointCloudSettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<PointCloudSettings>(defaultSettings);
  const [isLoaded, setIsLoaded] = useState(false);

  // 从 localStorage 加载设置
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        setSettings({ ...defaultSettings, ...parsed });
      }
    } catch (e) {
      console.warn("Failed to load settings from localStorage:", e);
    }
    setIsLoaded(true);
  }, []);

  // 保存设置到 localStorage
  const updateSettings = (newSettings: PointCloudSettings) => {
    setSettings(newSettings);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newSettings));
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
