"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";

interface VisitRecord {
  id: string;
  ip: string;
  path: string;
  browser: string;
  os: string;
  referrer: string;
  screen: string;
  language: string;
  timestamp: string;
}

interface StatsData {
  visits: VisitRecord[];
  summary: {
    totalVisits: number;
    uniqueIPs: number;
    todayVisits: number;
    avgDaily: number;
    pageCounts: Record<string, number>;
    browserCounts: Record<string, number>;
    osCounts: Record<string, number>;
    dailyVisits: Record<string, number>;
  };
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="card-cyber p-4">
      <p className="font-mono text-xs text-slate-500 uppercase tracking-wider mb-1">
        {label}
      </p>
      <p className="text-2xl font-mono font-bold text-primary">{value}</p>
    </div>
  );
}

function BarChart({
  data,
  label,
}: {
  data: Record<string, number>;
  label: string;
}) {
  const entries = Object.entries(data).sort((a, b) => b[1] - a[1]);
  const max = Math.max(...entries.map((e) => e[1]), 1);

  return (
    <div className="card-cyber p-4">
      <p className="font-mono text-xs text-slate-500 uppercase tracking-wider mb-4">
        {label}
      </p>
      <div className="space-y-2">
        {entries.map(([key, val]) => (
          <div key={key} className="flex items-center gap-3">
            <span className="font-mono text-xs text-slate-400 w-24 truncate shrink-0">
              {key}
            </span>
            <div className="flex-1 h-4 bg-white/5 rounded overflow-hidden">
              <div
                className="h-full bg-primary/60 rounded transition-all duration-500"
                style={{ width: `${(val / max) * 100}%` }}
              />
            </div>
            <span className="font-mono text-xs text-slate-500 w-10 text-right">
              {val}
            </span>
          </div>
        ))}
        {entries.length === 0 && (
          <p className="font-mono text-xs text-slate-600">No data</p>
        )}
      </div>
    </div>
  );
}

function DailyChart({ data }: { data: Record<string, number> }) {
  const entries = Object.entries(data).sort((a, b) => a[0].localeCompare(b[0]));
  const max = Math.max(...entries.map((e) => e[1]), 1);

  return (
    <div className="card-cyber p-4">
      <p className="font-mono text-xs text-slate-500 uppercase tracking-wider mb-4">
        Last 7 Days
      </p>
      <div className="flex items-end gap-2 h-32">
        {entries.map(([day, val]) => (
          <div key={day} className="flex-1 flex flex-col items-center gap-1">
            <span className="font-mono text-[10px] text-slate-500">{val}</span>
            <div
              className="w-full bg-primary/50 rounded-t transition-all duration-500"
              style={{ height: `${(val / max) * 100}%`, minHeight: val > 0 ? "4px" : "0" }}
            />
            <span className="font-mono text-[10px] text-slate-600">
              {day.slice(5)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export default function AdminPage() {
  const [data, setData] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch("/api/stats");
      if (res.ok) {
        setData(await res.json());
      }
    } catch (e) {
      console.error("Failed to fetch stats:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, [fetchStats]);

  if (loading) {
    return (
      <div className="min-h-screen pt-24 px-6 pb-16">
        <div className="max-w-4xl mx-auto">
          <p className="font-mono text-slate-500 animate-pulse">
            Loading statistics...
          </p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen pt-24 px-6 pb-16">
        <div className="max-w-4xl mx-auto">
          <p className="font-mono text-red-400">Failed to load statistics.</p>
        </div>
      </div>
    );
  }

  const { visits, summary } = data;

  return (
    <div className="min-h-screen pt-24 px-6 pb-16">
      <div className="max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          {/* Title */}
          <div className="mb-8">
            <p className="font-mono text-sm text-primary mb-2">
              {"// admin.tsx"}
            </p>
            <h1 className="text-3xl font-bold text-white font-mono">
              Visit Statistics
            </h1>
            <div className="h-px bg-gradient-to-r from-primary to-transparent mt-4 w-48" />
          </div>

          {/* Overview cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <StatCard label="Total Visits" value={summary.totalVisits} />
            <StatCard label="Unique IPs" value={summary.uniqueIPs} />
            <StatCard label="Today" value={summary.todayVisits} />
            <StatCard label="Avg / Day" value={summary.avgDaily} />
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <BarChart data={summary.pageCounts} label="Page Views" />
            <DailyChart data={summary.dailyVisits} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <BarChart data={summary.browserCounts} label="Browsers" />
            <BarChart data={summary.osCounts} label="Operating Systems" />
          </div>

          {/* Recent visits table */}
          <div className="card-cyber p-4">
            <p className="font-mono text-xs text-slate-500 uppercase tracking-wider mb-4">
              Recent Visits ({visits.length})
            </p>
            <div className="overflow-x-auto">
              <table className="w-full font-mono text-xs">
                <thead>
                  <tr className="text-slate-500 border-b border-white/10">
                    <th className="text-left py-2 pr-4">Time</th>
                    <th className="text-left py-2 pr-4">IP</th>
                    <th className="text-left py-2 pr-4">Path</th>
                    <th className="text-left py-2 pr-4">Browser</th>
                    <th className="text-left py-2">OS</th>
                  </tr>
                </thead>
                <tbody>
                  {visits.slice(0, 50).map((v) => (
                    <tr
                      key={v.id}
                      className="border-b border-white/5 hover:bg-white/5 transition-colors"
                    >
                      <td className="py-2 pr-4 text-slate-500">
                        {formatTime(v.timestamp)}
                      </td>
                      <td className="py-2 pr-4 text-slate-400">{v.ip}</td>
                      <td className="py-2 pr-4 text-primary">{v.path}</td>
                      <td className="py-2 pr-4 text-slate-400">{v.browser}</td>
                      <td className="py-2 text-slate-400">{v.os}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {visits.length === 0 && (
                <p className="text-slate-600 py-4 text-center">
                  No visits recorded yet.
                </p>
              )}
            </div>
          </div>

          {/* Refresh hint */}
          <p className="font-mono text-[10px] text-slate-600 text-center mt-4">
            Auto-refreshes every 30s
          </p>
        </motion.div>
      </div>
    </div>
  );
}
