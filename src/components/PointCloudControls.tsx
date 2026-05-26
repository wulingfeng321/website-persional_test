"use client";

import { useState, useEffect, useCallback } from "react";

// 控制参数接口
export interface PointCloudSettings {
  // 相机距离
  cameraDistance: number;
  // 相机位置偏移
  cameraX: number;
  cameraY: number;
  cameraZ: number;
  // 旋转角度
  rotationX: number;
  rotationY: number;
  // 旋转速度
  rotationSpeed: number;
  // 点大小
  pointSize: number;
  // 颜色模式
  colorMode: "default" | "blue" | "cyan" | "white" | "rainbow";
  // 是否自动旋转
  autoRotate: boolean;
  // 鼠标交互强度
  mouseSensitivity: number;
}

// 默认设置
export const defaultSettings: PointCloudSettings = {
  cameraDistance: 5.5,
  cameraX: 0,
  cameraY: 0,
  cameraZ: 10,
  rotationX: 0,
  rotationY: 0,
  rotationSpeed: 0.5,
  pointSize: 0.02,
  colorMode: "default",
  autoRotate: false,
  mouseSensitivity: 0.5,
};

// 颜色预设
const colorPresets = {
  default: { label: "默认蓝白", color: "#4488ff" },
  blue: { label: "纯蓝", color: "#0066ff" },
  cyan: { label: "青色", color: "#00d4ff" },
  white: { label: "白色", color: "#ffffff" },
  rainbow: { label: "彩虹", color: "linear-gradient(90deg, red, orange, yellow, green, blue, purple)" },
};

interface PointCloudControlsProps {
  settings: PointCloudSettings;
  onSettingsChange: (settings: PointCloudSettings) => void;
}

export default function PointCloudControls({ settings, onSettingsChange }: PointCloudControlsProps) {
  const [localSettings, setLocalSettings] = useState<PointCloudSettings>(settings);

  useEffect(() => {
    setLocalSettings(settings);
  }, [settings]);

  const updateSetting = <K extends keyof PointCloudSettings>(
    key: K,
    value: PointCloudSettings[K]
  ) => {
    const newSettings = { ...localSettings, [key]: value };
    setLocalSettings(newSettings);
    onSettingsChange(newSettings);
  };

  // 重置为默认值
  const resetToDefault = () => {
    setLocalSettings(defaultSettings);
    onSettingsChange(defaultSettings);
  };

  return (
    <div
      style={{
        padding: "24px",
        background: "rgba(10, 10, 15, 0.95)",
        borderRadius: "12px",
        border: "1px solid rgba(0, 212, 255, 0.2)",
        color: "#e0e0e0",
        fontFamily: "monospace",
        maxWidth: "400px",
        margin: "0 auto",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "20px",
          paddingBottom: "12px",
          borderBottom: "1px solid rgba(0, 212, 255, 0.3)",
        }}
      >
        <h2 style={{ margin: 0, color: "#00d4ff", fontSize: "18px" }}>
          点云视角控制
        </h2>
        <button
          onClick={resetToDefault}
          style={{
            padding: "6px 12px",
            background: "rgba(255, 68, 68, 0.2)",
            border: "1px solid rgba(255, 68, 68, 0.5)",
            borderRadius: "6px",
            color: "#ff6666",
            cursor: "pointer",
            fontSize: "12px",
          }}
        >
          重置
        </button>
      </div>

      {/* 相机距离 */}
      <div style={{ marginBottom: "16px" }}>
        <label style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
          <span>相机距离</span>
          <span style={{ color: "#00d4ff" }}>{localSettings.cameraDistance.toFixed(1)}</span>
        </label>
        <input
          type="range"
          min="5"
          max="50"
          step="0.5"
          value={localSettings.cameraDistance}
          onChange={(e) => updateSetting("cameraDistance", parseFloat(e.target.value))}
          style={{ width: "100%" }}
        />
      </div>

      {/* 相机位置 X */}
      <div style={{ marginBottom: "16px" }}>
        <label style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
          <span>相机 X 位置</span>
          <span style={{ color: "#00d4ff" }}>{localSettings.cameraX.toFixed(1)}</span>
        </label>
        <input
          type="range"
          min="-20"
          max="20"
          step="0.5"
          value={localSettings.cameraX}
          onChange={(e) => updateSetting("cameraX", parseFloat(e.target.value))}
          style={{ width: "100%" }}
        />
      </div>

      {/* 相机位置 Y */}
      <div style={{ marginBottom: "16px" }}>
        <label style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
          <span>相机 Y 位置</span>
          <span style={{ color: "#00d4ff" }}>{localSettings.cameraY.toFixed(1)}</span>
        </label>
        <input
          type="range"
          min="-20"
          max="20"
          step="0.5"
          value={localSettings.cameraY}
          onChange={(e) => updateSetting("cameraY", parseFloat(e.target.value))}
          style={{ width: "100%" }}
        />
      </div>

      {/* 旋转速度 */}
      <div style={{ marginBottom: "16px" }}>
        <label style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
          <span>旋转速度 (每帧)</span>
          <span style={{ color: "#00d4ff" }}>{(localSettings.rotationSpeed * 1000).toFixed(1)} mrad</span>
        </label>
        <input
          type="range"
          min="0"
          max="0.02"
          step="0.0005"
          value={localSettings.rotationSpeed}
          onChange={(e) => updateSetting("rotationSpeed", parseFloat(e.target.value))}
          style={{ width: "100%" }}
        />
      </div>

      {/* 点大小 */}
      <div style={{ marginBottom: "16px" }}>
        <label style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
          <span>点大小</span>
          <span style={{ color: "#00d4ff" }}>{localSettings.pointSize.toFixed(3)}</span>
        </label>
        <input
          type="range"
          min="0.01"
          max="0.2"
          step="0.005"
          value={localSettings.pointSize}
          onChange={(e) => updateSetting("pointSize", parseFloat(e.target.value))}
          style={{ width: "100%" }}
        />
      </div>

      {/* 鼠标灵敏度 */}
      <div style={{ marginBottom: "16px" }}>
        <label style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
          <span>鼠标灵敏度</span>
          <span style={{ color: "#00d4ff" }}>{localSettings.mouseSensitivity.toFixed(2)}</span>
        </label>
        <input
          type="range"
          min="0"
          max="0.5"
          step="0.01"
          value={localSettings.mouseSensitivity}
          onChange={(e) => updateSetting("mouseSensitivity", parseFloat(e.target.value))}
          style={{ width: "100%" }}
        />
      </div>

      {/* 自动旋转开关 */}
      <div
        style={{
          marginBottom: "16px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <span>自动旋转</span>
        <button
          onClick={() => updateSetting("autoRotate", !localSettings.autoRotate)}
          style={{
            padding: "6px 16px",
            background: localSettings.autoRotate
              ? "rgba(0, 212, 255, 0.3)"
              : "rgba(100, 100, 100, 0.3)",
            border: `1px solid ${localSettings.autoRotate ? "#00d4ff" : "#666"}`,
            borderRadius: "6px",
            color: localSettings.autoRotate ? "#00d4ff" : "#888",
            cursor: "pointer",
          }}
        >
          {localSettings.autoRotate ? "开启" : "关闭"}
        </button>
      </div>

      {/* 颜色模式 */}
      <div style={{ marginBottom: "16px" }}>
        <label style={{ display: "block", marginBottom: "8px" }}>颜色模式</label>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
          {Object.entries(colorPresets).map(([key, preset]) => (
            <button
              key={key}
              onClick={() => updateSetting("colorMode", key as PointCloudSettings["colorMode"])}
              style={{
                padding: "8px",
                background:
                  localSettings.colorMode === key
                    ? "rgba(0, 212, 255, 0.3)"
                    : "rgba(50, 50, 50, 0.5)",
                border: `1px solid ${
                  localSettings.colorMode === key ? "#00d4ff" : "rgba(100, 100, 100, 0.5)"
                }`,
                borderRadius: "6px",
                color: localSettings.colorMode === key ? "#00d4ff" : "#888",
                cursor: "pointer",
                fontSize: "12px",
              }}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      {/* 重置旋转 */}
      <div style={{ marginBottom: "16px" }}>
        <button
          onClick={() => {
            updateSetting("rotationX", 0);
            updateSetting("rotationY", 0);
          }}
          style={{
            width: "100%",
            padding: "10px",
            background: "rgba(0, 212, 255, 0.1)",
            border: "1px solid rgba(0, 212, 255, 0.3)",
            borderRadius: "6px",
            color: "#00d4ff",
            cursor: "pointer",
          }}
        >
          重置旋转角度
        </button>
      </div>

      {/* 快捷键说明 */}
      <div
        style={{
          marginTop: "20px",
          padding: "12px",
          background: "rgba(0, 0, 0, 0.3)",
          borderRadius: "8px",
          fontSize: "11px",
          color: "#888",
        }}
      >
        <div style={{ marginBottom: "4px", color: "#aaa" }}>快捷操作:</div>
        <div>• 拖动滑块实时预览效果</div>
        <div>• 鼠标移动控制视差效果</div>
        <div>• 点击&quot;重置&quot;恢复默认设置</div>
      </div>
    </div>
  );
}
