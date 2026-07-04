"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

export default function VisitTracker() {
  const pathname = usePathname();
  const lastTrackRef = useRef<{ path: string; time: number }>({ path: "", time: 0 });

  useEffect(() => {
    const now = Date.now();
    const { path, time } = lastTrackRef.current;

    // Skip if same path tracked within 5 seconds
    if (path === pathname && now - time < 5000) return;
    lastTrackRef.current = { path: pathname, time: now };

    const payload = {
      path: pathname,
      referrer: document.referrer || "",
      screen: `${window.screen.width}x${window.screen.height}`,
      language: navigator.language || "",
    };

    // Use sendBeacon for reliability, fallback to fetch
    const blob = new Blob([JSON.stringify(payload)], { type: "application/json" });
    const sent = navigator.sendBeacon?.("/api/track", blob);

    if (!sent) {
      fetch("/api/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        keepalive: true,
      }).catch(() => {});
    }
  }, [pathname]);

  return null;
}
