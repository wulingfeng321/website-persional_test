import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { existsSync } from "fs";
import { join } from "path";

export const dynamic = "force-dynamic";

const DATA_FILE = join(process.cwd(), "data", "visits.json");

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

export async function GET() {
  try {
    if (!existsSync(DATA_FILE)) {
      return NextResponse.json({
        visits: [],
        summary: {
          totalVisits: 0,
          uniqueIPs: 0,
          todayVisits: 0,
          avgDaily: 0,
          pageCounts: {},
          browserCounts: {},
          osCounts: {},
          dailyVisits: {},
        },
      });
    }

    const raw = await readFile(DATA_FILE, "utf-8");
    const visits: VisitRecord[] = JSON.parse(raw);

    const today = new Date().toISOString().slice(0, 10);
    const uniqueIPs = new Set(visits.map((v) => v.ip)).size;
    const todayVisits = visits.filter((v) => v.timestamp.slice(0, 10) === today).length;

    // Page counts
    const pageCounts: Record<string, number> = {};
    for (const v of visits) {
      pageCounts[v.path] = (pageCounts[v.path] || 0) + 1;
    }

    // Browser counts
    const browserCounts: Record<string, number> = {};
    for (const v of visits) {
      browserCounts[v.browser] = (browserCounts[v.browser] || 0) + 1;
    }

    // OS counts
    const osCounts: Record<string, number> = {};
    for (const v of visits) {
      osCounts[v.os] = (osCounts[v.os] || 0) + 1;
    }

    // Daily visits (last 7 days)
    const dailyVisits: Record<string, number> = {};
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      dailyVisits[key] = 0;
    }
    for (const v of visits) {
      const day = v.timestamp.slice(0, 10);
      if (day in dailyVisits) {
        dailyVisits[day]++;
      }
    }

    // Average daily visits
    const uniqueDays = new Set(visits.map((v) => v.timestamp.slice(0, 10))).size;
    const avgDaily = uniqueDays > 0 ? Math.round(visits.length / uniqueDays) : 0;

    // Recent 200 visits (newest first)
    const recent = visits.slice(-200).reverse();

    return NextResponse.json({
      visits: recent,
      summary: {
        totalVisits: visits.length,
        uniqueIPs,
        todayVisits,
        avgDaily,
        pageCounts,
        browserCounts,
        osCounts,
        dailyVisits,
      },
    });
  } catch (err) {
    console.error("[Stats] Error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
