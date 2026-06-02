// src/app/page.tsx
"use client";

import { useState } from "react";
import Topbar from "@/components/Topbar";
import ChartArea from "@/components/ChartArea";
import SidebarRight from "@/components/SidebarRight";
import TradingPanel from "@/components/TradingPanel";

export default function Home() {
  const [isPanelOpen, setIsPanelOpen] = useState(true);

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-[#131722] text-[#d1d4dc]">
      {/* Bagian Atas Dashboard */}
      <Topbar />

      {/* Bagian Tengah Utama */}
      <div className="flex min-h-0 flex-1 w-full flex-row">
        {/* Kolom Kiri: Menggabungkan Grafik dan Panel Bawah */}
        <div className="flex flex-1 flex-col min-w-0 relative h-full">
          <ChartArea />
          <TradingPanel 
            isOpen={isPanelOpen} 
            onToggle={() => setIsPanelOpen(!isPanelOpen)} 
          />
        </div>

        {/* Kolom Kanan: Watchlist */}
        <SidebarRight />
      </div>
    </div>
  );
}