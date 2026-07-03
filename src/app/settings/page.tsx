"use client";

import PointCloudControls from "@/components/PointCloudControls";
import { usePointCloudSettings } from "@/lib/PointCloudSettingsContext";

export default function SettingsPage() {
  const { settings, updateSettings } = usePointCloudSettings();

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
