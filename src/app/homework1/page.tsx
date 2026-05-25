"use client";

import { motion } from "framer-motion";
import BlackJackGame from "@/components/BlackJackGame";

export default function Homework1() {
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
              {"// homework_01/blackjack.tsx"}
            </p>
            <h1 className="text-3xl md:text-4xl font-bold text-white font-mono">
              欧式 Blackjack
            </h1>
            <div className="h-px bg-gradient-to-r from-primary to-transparent mt-4 w-48" />
            <p className="mt-4 text-sm text-slate-400 font-mono">
              欧式规则：庄家起始只发一张明牌，无暗牌。玩家先完成操作，庄家再抽第二张牌。
            </p>
          </div>

          {/* 游戏组件 */}
          <BlackJackGame />
        </motion.div>
      </div>
    </div>
  );
}
