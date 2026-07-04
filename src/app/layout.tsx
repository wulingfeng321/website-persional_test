import type { Metadata } from "next";
import "./globals.css";
import Navbar from "@/components/Navbar";
import PointCloudBackground from "@/components/PointCloudBackground";
import VisitTracker from "@/components/VisitTracker";
import { PointCloudSettingsProvider } from "@/lib/PointCloudSettingsContext";
import { PointCloudDataProvider } from "@/lib/PointCloudDataContext";

export const metadata: Metadata = {
  title: "game-center-3D",
  description: "A futuristic personal blog with 3D point cloud visualization",
  openGraph: {
    title: "game-center-3D",
    description: "A futuristic personal blog with 3D point cloud visualization",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body className="relative min-h-screen">
        <VisitTracker />
        <PointCloudDataProvider>
          <PointCloudSettingsProvider>
            <div className="fixed inset-0 z-0">
              <PointCloudBackground />
            </div>
            <div className="relative z-10">
              <Navbar />
              <main>{children}</main>
            </div>
          </PointCloudSettingsProvider>
        </PointCloudDataProvider>
      </body>
    </html>
  );
}
