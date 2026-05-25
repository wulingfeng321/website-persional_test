"use client";

import { motion } from "framer-motion";
import Link from "next/link";

export default function Home() {
  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center px-6">
      {/* Hero 区域 */}
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="text-center max-w-3xl"
      >
        {/* 动态标题 */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1, delay: 0.2 }}
          className="mb-8"
        >
          <h1 className="text-5xl md:text-7xl font-bold text-glow font-mono tracking-wider">
            <span className="text-primary">3D</span>{" "}
            <span className="text-white">Point Cloud</span>
          </h1>
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: "100%" }}
            transition={{ duration: 1.5, delay: 0.5 }}
            className="h-px bg-gradient-to-r from-transparent via-primary to-transparent mx-auto mt-4"
          />
        </motion.div>

        {/* 一句话介绍 */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.6 }}
          className="text-lg md:text-xl text-slate-400 font-mono mb-12 leading-relaxed"
        >
          漂浮在数字空间中的 3D 科幻个人终端
          <br />
          <span className="text-sm text-slate-500">
            {"// exploring the frontier of code & creativity"}
          </span>
        </motion.p>

        {/* 进入博客按钮 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.9 }}
          className="flex flex-col sm:flex-row gap-4 justify-center items-center"
        >
          <Link href="/personal-info">
            <button className="btn-cyber group">
              <span className="relative z-10 flex items-center gap-2">
                <span>ENTER TERMINAL</span>
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  fill="none"
                  className="transition-transform group-hover:translate-x-1"
                >
                  <path
                    d="M3 8h10M9 4l4 4-4 4"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
            </button>
          </Link>

          <Link href="/contact">
            <button className="px-6 py-3 text-sm font-mono text-slate-500 hover:text-primary transition-colors duration-200">
              CONTACT →
            </button>
          </Link>
        </motion.div>

        {/* 终端风格装饰 */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 1.2 }}
          className="mt-16 font-mono text-xs text-slate-600 space-y-1"
        >
          <p>{"> system.status: ONLINE"}</p>
          <p>{"> render.engine: Three.js + R3F"}</p>
          <p>{"> point_cloud: 8000 particles"}</p>
          <p>{"> fps.target: 60"}</p>
        </motion.div>
      </motion.div>

      {/* 底部滚动提示 */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1, delay: 1.5 }}
        className="absolute bottom-8 left-1/2 -translate-x-1/2"
      >
        <motion.div
          animate={{ y: [0, 8, 0] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          className="w-5 h-8 rounded-full border border-slate-600 flex items-start justify-center p-1"
        >
          <div className="w-1 h-2 rounded-full bg-primary" />
        </motion.div>
      </motion.div>
    </div>
  );
}
