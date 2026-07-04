"use client";

import { motion } from "framer-motion";
import { useState, useEffect } from "react";

interface PingLine {
  text: string;
  color: string;
}

function PingTerminal() {
  const [lines, setLines] = useState<PingLine[]>([]);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const allLines: PingLine[] = [];

    const push = (line: PingLine) => {
      if (cancelled) return;
      allLines.push(line);
      setLines([...allLines]);
    };

    const run = async () => {
      // Measure real RTT via fetch
      let rtt = 0;
      try {
        const t0 = performance.now();
        await fetch(window.location.origin, { method: "HEAD", mode: "no-cors" });
        rtt = performance.now() - t0;
      } catch {
        rtt = -1;
      }

      // Network info
      const conn = (navigator as unknown as Record<string, unknown>).connection as
        | { effectiveType?: string; downlink?: number; rtt?: number }
        | undefined;

      const effectiveType = conn?.effectiveType ?? "N/A";
      const downlink = conn?.downlink ? `${conn.downlink} Mbps` : "N/A";
      const netRtt = conn?.rtt ? `${conn.rtt}ms` : "N/A";

      const timestamp = new Date().toLocaleString("zh-CN");

      // Build output lines
      const outputLines: PingLine[] = [
        { text: "> ping project --verbose", color: "text-slate-600" },
        {
          text: `PING project (wulingfeng321/website-persional_test): 56 data bytes`,
          color: "text-slate-400",
        },
        {
          text: `64 bytes from project: icmp_seq=0 ttl=64 time=${rtt >= 0 ? rtt.toFixed(1) : "???"}ms`,
          color: rtt >= 0 ? "text-green-400" : "text-red-400",
        },
        { text: "--- network info ---", color: "text-slate-400" },
        {
          text: `connection: ${effectiveType} | downlink: ${downlink} | rtt: ${netRtt}`,
          color: "text-slate-400",
        },
        { text: `timestamp: ${timestamp}`, color: "text-slate-400" },
        { text: "> _", color: "text-slate-600" },
      ];

      // Reveal lines one by one
      for (let i = 0; i < outputLines.length; i++) {
        await new Promise((r) => setTimeout(r, 120 + Math.random() * 80));
        if (cancelled) return;
        push(outputLines[i]);
      }

      if (!cancelled) setDone(true);
    };

    run();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.6, delay: 0.6 }}
      className="mt-12 font-mono text-xs space-y-1 p-4 rounded-lg bg-black/30 border border-white/5"
    >
      {lines.map((line, i) => (
        <p key={i} className={line.color}>
          {line.text}
        </p>
      ))}
      {!done && (
        <p className="text-slate-600 animate-pulse">
          {lines.length === 0 ? "> ping project --verbose" : " "}
        </p>
      )}
    </motion.div>
  );
}

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

            {/* 项目地址 */}
            <motion.a
              href="https://github.com/wulingfeng321/website-persional_test.git"
              target="_blank"
              rel="noopener noreferrer"
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.5 }}
              className="card-cyber block group cursor-pointer"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
                  <svg
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="text-white group-hover:text-primary transition-colors"
                  >
                    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                  </svg>
                </div>
                <div>
                  <p className="font-mono text-xs text-slate-500 uppercase tracking-wider">
                    Repository
                  </p>
                  <p className="text-lg text-white font-mono mt-1 group-hover:text-primary transition-colors">
                    website-persional_test
                  </p>
                </div>
              </div>
            </motion.a>
          </div>

          {/* 终端风格输出 */}
          <PingTerminal />
        </motion.div>
      </div>
    </div>
  );
}
