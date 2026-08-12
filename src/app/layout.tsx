import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Brown Orientation Scavenger Hunt",
  description: "Snap a photo at each gem, earn points, climb the leaderboard.",
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  themeColor: "#4E3629",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
