// src/app/trade/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import { useTradingStore } from "@/stores/useTradingStore";
import { syncUserProfileToDB, fetchUserPortfolioFromDB } from "@/utils/dbSync"; // 🔥 Import helper sync DB
import Topbar from "@/components/Topbar";
import ChartArea from "@/components/ChartArea";
import SidebarRight from "@/components/SidebarRight";
import TradingPanel from "@/components/TradingPanel";

export default function Home() {
  const [isPanelOpen, setIsPanelOpen] = useState(true);
  
  const { isSignedIn, user, isLoaded } = useUser();
  const syncProfile = useTradingStore((state) => state.syncProfile);
  const resetAccount = useTradingStore((state) => state.resetAccount);
  
  // Ambil setter Zustand untuk menyuntikkan data dari cloud database
  const setBalance = useTradingStore((state) => state.setBalance);
  const setPositions = useTradingStore((state) => state.setPositions);
  const setTradeHistory = useTradingStore((state) => state.setTradeHistory);

  useEffect(() => {
    if (!isLoaded) return;

    const handleAuthAndDataSync = async () => {
      if (isSignedIn && user) {
        const fullName = user.fullName || user.username || "Authenticated User";
        const emailAddress = user.primaryEmailAddress?.emailAddress || "no-email@clerk.com";
        
        // 1. Sinkronkan profil dasar ke tabel `profiles` Supabase
        await syncUserProfileToDB(user.id, fullName, emailAddress);
        
        // 2. Ambil data aset asli milik user ini dari cloud Supabase
        const dbData = await fetchUserPortfolioFromDB(user.id);
        
        // 3. Suntikkan ke Zustand store lokal agar UI langsung ter-update otomatis
        syncProfile(fullName, emailAddress);
        setBalance({
          cash: dbData.cash,
          equity: dbData.equity,
          buyingPower: dbData.cash,
          dayPnl: 0,
          dayPnlPercent: 0,
        });
        setPositions(dbData.positions);
        setTradeHistory(dbData.tradeHistory);
        
      } else {
        // Jika statusnya logout / Guest, reset total ke setelan pabrik uang mainan lokal
        resetAccount();
        syncProfile("Guest User", "guest@papertrading.local");
      }
    };

    handleAuthAndDataSync();
  }, [isLoaded, isSignedIn, user, syncProfile, resetAccount, setBalance, setPositions, setTradeHistory]);

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-[#131722] text-[#d1d4dc]">
      <Topbar />

      <div className="flex min-h-0 flex-1 w-full flex-row">
        <div className="flex flex-1 flex-col min-w-0 relative h-full">
          <ChartArea />
          <TradingPanel 
            isOpen={isPanelOpen} 
            onToggle={() => setIsPanelOpen(!isPanelOpen)} 
          />
        </div>

        <SidebarRight />
      </div>
    </div>
  );
}