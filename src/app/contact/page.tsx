"use client";

import { motion } from "framer-motion";

export default function Contact() {
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
              {"// contact.tsx"}
            </p>
            <h1 className="text-3xl md:text-4xl font-bold text-white font-mono">
              Contact
            </h1>
            <div className="h-px bg-gradient-to-r from-primary to-transparent mt-4 w-48" />
          </div>

          {/* 联系信息 */}
          <div className="space-y-6">
            {/* 邮箱 */}
            <motion.a
              href="mailto:23211203@bjtu.edu.cn"
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="card-cyber block group cursor-pointer"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-xl">
                  ✉
                </div>
                <div>
                  <p className="font-mono text-xs text-slate-500 uppercase tracking-wider">
                    Email
                  </p>
                  <p className="text-lg text-white font-mono mt-1 group-hover:text-primary transition-colors">
                    23211203@bjtu.edu.cn
                  </p>
                </div>
              </div>
            </motion.a>

            {/* GitHub */}
            <motion.a
              href="https://github.com/wulingfeng321"
              target="_blank"
              rel="noopener noreferrer"
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.35 }}
              className="card-cyber block group cursor-pointer"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
                  <svg
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    className="text-white group-hover:text-primary transition-colors"
                  >
                    <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
                  </svg>
                </div>
                <div>
                  <p className="font-mono text-xs text-slate-500 uppercase tracking-wider">
                    GitHub
                  </p>
                  <p className="text-lg text-white font-mono mt-1 group-hover:text-primary transition-colors">
                    github.com/wulingfeng321
                  </p>
                </div>
              </div>
            </motion.a>
          </div>

          {/* 终端风格输出 */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.6 }}
            className="mt-12 font-mono text-xs text-slate-600 space-y-1 p-4 rounded-lg bg-black/30 border border-white/5"
          >
            <p>{"> ping contact"}</p>
            <p className="text-slate-400">PING contact (23211203@bjtu.edu.cn): 56 data bytes</p>
            <p className="text-green-400">64 bytes from contact: icmp_seq=0 ttl=64 time=0.042ms</p>
            <p className="text-slate-400">--- contact ping statistics ---</p>
            <p className="text-slate-400">1 packets transmitted, 1 received, 0% packet loss</p>
            <p>{"> _"}</p>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}
