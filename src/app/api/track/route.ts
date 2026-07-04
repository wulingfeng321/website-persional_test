import { NextRequest, NextResponse } from "next/server";
import { readFile, writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import { join } from "path";
import crypto from "crypto";
import { parseUserAgent } from "@/lib/tracker";

const DATA_DIR = join(process.cwd(), "data");
const DATA_FILE = join(DATA_DIR, "visits.json");

interface VisitRecord {
  id: string;
  ip: string;
  path: string;
  userAgent: string;
  browser: string;
  os: string;
  referrer: string;
  screen: string;
  language: string;
  timestamp: string;
}

async function readVisits(): Promise<VisitRecord[]> {
  try {
    if (!existsSync(DATA_FILE)) return [];
    const raw = await readFile(DATA_FILE, "utf-8");
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

async function writeVisits(visits: VisitRecord[]): Promise<void> {
  if (!existsSync(DATA_DIR)) {
    await mkdir(DATA_DIR, { recursive: true });
  }
  await writeFile(DATA_FILE, JSON.stringify(visits, null, 2));
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { path, referrer, screen, language } = body;

    const ip = request.headers.get("x-visitor-ip") || "unknown";
    const userAgent = request.headers.get("user-agent") || "";
    const { browser, os } = parseUserAgent(userAgent);

    const record: VisitRecord = {
      id: crypto.randomUUID(),
      ip,
      path: path || "/",
      userAgent,
      browser,
      os,
      referrer: referrer || "",
      screen: screen || "",
      language: language || "",
      timestamp: new Date().toISOString(),
    };

    const visits = await readVisits();
    visits.push(record);

    // Keep max 10000 records to prevent file from growing too large
    if (visits.length > 10000) {
      visits.splice(0, visits.length - 10000);
    }

    await writeVisits(visits);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[Track] Error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
