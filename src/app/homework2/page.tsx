"use client";

import { motion } from "framer-motion";
import BridgeGame from "@/components/BridgeGame";

export default function Homework2() {
  return (
    <div style={{ minHeight: "100vh", paddingTop: "80px", paddingBottom: "40px", paddingLeft: "16px", paddingRight: "16px" }}>
      <div style={{ maxWidth: "800px", margin: "0 auto" }}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          {/* 页面标题 */}
          <div style={{ marginBottom: "20px" }}>
            <p style={{ fontFamily: "monospace", fontSize: "13px", color: "#00d4ff", marginBottom: "4px" }}>
              {"// homework_02/bridge.tsx"}
            </p>
            <h1 style={{ fontSize: "28px", fontWeight: "bold", color: "#fff", fontFamily: "monospace", margin: 0 }}>
              简化版桥牌
            </h1>
            <div style={{ height: "1px", background: "linear-gradient(to right, #00d4ff, transparent)", marginTop: "8px", width: "160px" }} />
            <p style={{ marginTop: "8px", fontSize: "13px", color: "#888", fontFamily: "monospace" }}>
              简化版桥牌：无叫牌阶段，南家由你控制，系统自动处理其他三家。
            </p>
          </div>

          {/* 游戏组件 */}
          <BridgeGame />
        </motion.div>
      </div>
    </div>
  );
}
