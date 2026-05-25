"use client";

import { motion } from "framer-motion";

const infoItems = [
  { label: "姓名", value: "赫晨皓", icon: "👤" },
  { label: "学号", value: "23211203", icon: "🎓" },
  { label: "班级", value: "自动化2301", icon: "🏫" },
];

export default function PersonalInfo() {
  return (
    <div className="min-h-screen pt-24 px-6 pb-16">
      <div className="max-w-2xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          {/* 页面标题 */}
          <div className="mb-12">
            <p className="font-mono text-sm text-primary mb-2">
              {"// personal_info.tsx"}
            </p>
            <h1 className="text-3xl md:text-4xl font-bold text-white font-mono">
              Personal Info
            </h1>
            <div className="h-px bg-gradient-to-r from-primary to-transparent mt-4 w-48" />
          </div>

          {/* 信息卡片 */}
          <div className="space-y-6">
            {infoItems.map((item, index) => (
              <motion.div
                key={item.label}
                initial={{ opacity: 0, x: -30 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: 0.2 + index * 0.15 }}
                className="card-cyber group"
              >
                <div className="flex items-center gap-4">
                  <span className="text-2xl">{item.icon}</span>
                  <div>
                    <p className="font-mono text-xs text-slate-500 uppercase tracking-wider">
                      {item.label}
                    </p>
                    <p className="text-xl text-white font-mono mt-1 group-hover:text-primary transition-colors">
                      {item.value}
                    </p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          {/* 终端风格输出 */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.8 }}
            className="mt-12 font-mono text-xs text-slate-600 space-y-1 p-4 rounded-lg bg-black/30 border border-white/5"
          >
            <p>{"> cat /etc/student/profile"}</p>
            <p className="text-slate-400">name: 赫晨皓</p>
            <p className="text-slate-400">student_id: 23211203</p>
            <p className="text-slate-400">class: 自动化2301</p>
            <p className="text-slate-400">major: 自动化</p>
            <p>{"> _"}</p>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}
