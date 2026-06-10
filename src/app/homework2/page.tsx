"use client";

import { motion } from "framer-motion";
import WhistGame from "@/components/WhistGame";

export default function Homework2() {
  return (
    <div style={{ minHeight: "100vh", paddingTop: "80px", paddingBottom: "40px", paddingLeft: "16px", paddingRight: "16px" }}>
      <div style={{ maxWidth: "900px", margin: "0 auto" }}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          {/* 页面标题 */}
          <div style={{ marginBottom: "20px" }}>
            <p style={{ fontFamily: "monospace", fontSize: "13px", color: "#00d4ff", marginBottom: "4px" }}>
              {"// homework_02/whist.tsx"}
            </p>
            <h1 style={{ fontSize: "28px", fontWeight: "bold", color: "#fff", fontFamily: "monospace", margin: 0 }}>
              Whist 桥牌
            </h1>
            <div style={{ height: "1px", background: "linear-gradient(to right, #00d4ff, transparent)", marginTop: "8px", width: "160px" }} />
            <p style={{ marginTop: "8px", fontSize: "13px", color: "#888", fontFamily: "monospace" }}>
              经典四人定约桥牌前身，南-北 vs 东-西，率先赢得7墩获胜。
            </p>
          </div>

          {/* 游戏组件 */}
          <WhistGame />
        </motion.div>
      </div>
    </div>
  );
}
