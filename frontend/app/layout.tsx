import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import PwaManager from "@/components/pwa/PwaManager";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "TalentPilot - Manager Copilot",
  description: "Transform talents into actionable insights with CliftonStrengths",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "TalentPilot",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#6366f1",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        {children}
        <PwaManager />
      </body>
    </html>
  );
}
