export interface VisitPayload {
  path: string;
  referrer: string;
  screen: string;
  language: string;
}

export function parseUserAgent(ua: string): { browser: string; os: string } {
  let browser = "Unknown";
  let os = "Unknown";

  // Browser
  if (ua.includes("Edg/")) browser = "Edge";
  else if (ua.includes("OPR/") || ua.includes("Opera")) browser = "Opera";
  else if (ua.includes("Chrome") && !ua.includes("Chromium")) browser = "Chrome";
  else if (ua.includes("Firefox")) browser = "Firefox";
  else if (ua.includes("Safari") && !ua.includes("Chrome")) browser = "Safari";
  else if (ua.includes("Trident") || ua.includes("MSIE")) browser = "IE";

  // OS
  if (ua.includes("Windows NT 10")) os = "Windows 10/11";
  else if (ua.includes("Windows NT 6.3")) os = "Windows 8.1";
  else if (ua.includes("Windows NT 6.1")) os = "Windows 7";
  else if (ua.includes("Windows")) os = "Windows";
  else if (ua.includes("Mac OS X")) {
    const match = ua.match(/Mac OS X (\d+[._]\d+)/);
    os = match ? `macOS ${match[1].replace("_", ".")}` : "macOS";
  } else if (ua.includes("Android")) {
    const match = ua.match(/Android ([\d.]+)/);
    os = match ? `Android ${match[1]}` : "Android";
  } else if (ua.includes("iPhone") || ua.includes("iPad")) {
    const match = ua.match(/OS (\d+_\d+)/);
    os = match ? `iOS ${match[1].replace("_", ".")}` : "iOS";
  } else if (ua.includes("Linux")) os = "Linux";

  return { browser, os };
}
