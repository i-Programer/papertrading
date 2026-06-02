// src/app/layout.tsx
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ClerkProvider } from "@clerk/nextjs"; // 🔥 Import Provider

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "PaperTrade Terminal",
  description: "Simulasi trading cryptocurrency real-time",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider> {/* 🔥 Bungkus di sini */}
      <html lang="en">
        <body className={inter.className}>{children}</body>
      </html>
    </ClerkProvider>
  );
}