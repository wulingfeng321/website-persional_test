"use client";

import PointCloudControls from "@/components/PointCloudControls";
import { usePointCloudSettings } from "@/lib/PointCloudSettingsContext";
import { PAGE_POINT_CLOUDS, RoutePointCloudConfig } from "@/lib/pointCloudPages";

const MODEL_LIST = Object.entries(PAGE_POINT_CLOUDS).map(([path, config]) => ({
  path,
  ...config,
}));

export default function SettingsPage() {
  const { settings, updateSettings, overrideRouteConfig, setOverrideRouteConfig } = usePointCloudSettings();

  const activeLabel = overrideRouteConfig?.label ?? PAGE_POINT_CLOUDS["/settings"].label;

  const handleSelect = (config: RoutePointCloudConfig) => {
    setOverrideRouteConfig(config);
  };

  const handleReset = () => {
    setOverrideRouteConfig(null);
  };

  return (
    <div style={{ position: "relative", width: "100vw", height: "100vh", overflow: "hidden", background: "rgba(5, 10, 18, 0.18)" }}>
      {/* 返回首页 */}
      <a
        href="/"
        style={{
          position: "absolute",
          top: "20px",
          right: "20px",
          zIndex: 20,
          padding: "10px 16px",
          background: "rgba(100, 100, 100, 0.3)",
          border: "1px solid rgba(100, 100, 100, 0.5)",
          borderRadius: "8px",
          color: "#888",
          cursor: "pointer",
          fontFamily: "monospace",
          fontSize: "14px",
          textDecoration: "none",
        }}
      >
        返回首页
      </a>

      {/* 控制面板 */}
      <div
        style={{
          position: "absolute",
          top: "20px",
          left: "20px",
          zIndex: 10,
          maxHeight: "calc(100vh - 40px)",
          overflowY: "auto",
        }}
      >
        <PointCloudControls settings={settings} onSettingsChange={updateSettings} />

        {/* 点云切换面板 */}
        <div
          style={{
            marginTop: "16px",
            padding: "24px",
            background: "rgba(10, 10, 15, 0.95)",
            borderRadius: "12px",
            border: "1px solid rgba(0, 212, 255, 0.2)",
            color: "#e0e0e0",
            fontFamily: "monospace",
            maxWidth: "400px",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "16px",
              paddingBottom: "12px",
              borderBottom: "1px solid rgba(0, 212, 255, 0.3)",
            }}
          >
            <h2 style={{ margin: 0, color: "#00d4ff", fontSize: "18px" }}>
              点云切换
            </h2>
            <button
              onClick={handleReset}
              style={{
                padding: "6px 12px",
                background: overrideRouteConfig
                  ? "rgba(255, 68, 68, 0.2)"
                  : "rgba(100, 100, 100, 0.2)",
                border: `1px solid ${overrideRouteConfig ? "rgba(255, 68, 68, 0.5)" : "rgba(100, 100, 100, 0.3)"}`,
                borderRadius: "6px",
                color: overrideRouteConfig ? "#ff6666" : "#666",
                cursor: overrideRouteConfig ? "pointer" : "default",
                fontSize: "12px",
              }}
            >
              恢复默认
            </button>
          </div>

          <div style={{ fontSize: "11px", color: "#888", marginBottom: "12px" }}>
            当前: {activeLabel}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {MODEL_LIST.map((model) => {
              const isActive = activeLabel === model.label;
              return (
                <button
                  key={model.path}
                  onClick={() => handleSelect(model)}
                  style={{
                    padding: "10px 14px",
                    background: isActive
                      ? "rgba(0, 212, 255, 0.15)"
                      : "rgba(50, 50, 60, 0.3)",
                    border: `1px solid ${isActive ? "rgba(0, 212, 255, 0.5)" : "rgba(80, 80, 90, 0.3)"}`,
                    borderRadius: "8px",
                    color: isActive ? "#00d4ff" : "#aaa",
                    cursor: "pointer",
                    fontFamily: "monospace",
                    fontSize: "13px",
                    textAlign: "left",
                    transition: "all 0.2s",
                  }}
                >
                  <div style={{ marginBottom: "2px" }}>{model.label}</div>
                  <div style={{ fontSize: "10px", color: "#666" }}>{model.pcdUrl}</div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* 信息面板 */}
      <div
        style={{
          position: "absolute",
          bottom: "20px",
          right: "20px",
          zIndex: 10,
          padding: "12px 16px",
          background: "rgba(10, 10, 15, 0.9)",
          borderRadius: "8px",
          border: "1px solid rgba(0, 212, 255, 0.2)",
          color: "#888",
          fontFamily: "monospace",
          fontSize: "12px",
        }}
      >
        <div style={{ color: "#00d4ff", marginBottom: "4px" }}>当前设置</div>
        <div>相机距离: {settings.cameraDistance.toFixed(1)}</div>
        <div>旋转速度: {(settings.rotationSpeed * 1000).toFixed(1)} mrad</div>
        <div>点大小: {settings.pointSize.toFixed(3)}</div>
        <div>自动旋转: {settings.autoRotate ? "开" : "关"}</div>
      </div>
    </div>
  );
}
