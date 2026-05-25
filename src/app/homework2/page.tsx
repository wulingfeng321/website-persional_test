"use client";

import { motion } from "framer-motion";
import BridgeGame from "@/components/BridgeGame";

export default function Homework2() {
  return (
    <div className="min-h-screen pt-24 px-6 pb-16">
      <div className="max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          {/* 页面标题 */}
          <div className="mb-8">
            <p className="font-mono text-sm text-primary mb-2">
              {"// homework_02/bridge.tsx"}
            </p>
            <h1 className="text-3xl md:text-4xl font-bold text-white font-mono">
              简化版桥牌
            </h1>
            <div className="h-px bg-gradient-to-r from-primary to-transparent mt-4 w-48" />
            <p className="mt-4 text-sm text-slate-400 font-mono">
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
