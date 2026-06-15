// src/app/trade/page.tsx
"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useUser } from "@clerk/nextjs";
import { useTradingStore } from "@/stores/useTradingStore";
import { syncUserProfileToDB, fetchUserPortfolioFromDB } from "@/utils/dbSync";
import Topbar from "@/components/Topbar";
import ChartArea from "@/components/ChartArea";
import SidebarRight from "@/components/SidebarRight";
import TradingPanel from "@/components/TradingPanel";
import OrderPanel from "@/components/OrderPanel";
import { Loader2 } from "lucide-react";
import AIPanel from "@/components/AIPanel";

export default function Home() {
  const [isPanelOpen, setIsPanelOpen] = useState(true);
  
  const { isSignedIn, user, isLoaded } = useUser();
  const syncProfile = useTradingStore((state) => state.syncProfile);
  const [isSyncing, setIsSyncing] = useState(true);
  const resetAccount = useTradingStore((state) => state.resetAccount);
  
  const setBalance = useTradingStore((state) => state.setBalance);
  const setPositions = useTradingStore((state) => state.setPositions);
  const setTradeHistory = useTradingStore((state) => state.setTradeHistory);
  
  // 🔥 ADD REFS to track sync state
  const hasSyncedRef = useRef(false);
  const lastUserIdRef = useRef<string | null>(null);
  const lastSyncTimeRef = useRef<number>(0);

  // 🔥 CREATE STABLE CALLBACKS
  const handleSync = useCallback(async () => {
    const now = Date.now();
    
    // Prevent sync if already synced in last 5 seconds
    if (now - lastSyncTimeRef.current < 5000) {
      console.log("Sync skipped - too frequent");
      return;
    }
    
    // Prevent duplicate sync for same user
    if (isSignedIn && user && lastUserIdRef.current === user.id && hasSyncedRef.current) {
      console.log("Sync skipped - already synced for this user");
      setIsSyncing(false);
      return;
    }
    
    try {
      setIsSyncing(true);
      
      if (isSignedIn && user) {
        const fullName = user.fullName || user.username || "Authenticated User";
        const emailAddress = user.primaryEmailAddress?.emailAddress || "no-email@clerk.com";
        
        console.log("Syncing user:", user.id);
        lastUserIdRef.current = user.id;
        
        // 1. Sync profile to Supabase
        await syncUserProfileToDB(user.id, fullName, emailAddress);
        
        // 2. Fetch portfolio from DB
        const dbData = await fetchUserPortfolioFromDB(user.id);
        
        // 3. Update Zustand store
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
        
        hasSyncedRef.current = true;
        lastSyncTimeRef.current = now;
        
      } else if (!isSignedIn) {
        // Guest mode
        if (!hasSyncedRef.current || lastUserIdRef.current === null) {
          console.log("Setting up guest account");
          resetAccount();
          syncProfile("Guest User", "guest@papertrading.local");
          lastUserIdRef.current = "guest";
          hasSyncedRef.current = true;
        }
      }
    } catch (error) {
      console.error("Sync error:", error);
    } finally {
      setIsSyncing(false);
    }
  }, [isSignedIn, user, syncProfile, resetAccount, setBalance, setPositions, setTradeHistory]);

  // 🔥 FIXED useEffect - only run on mount and when user changes significantly
  useEffect(() => {
    if (!isLoaded) return;
    
    // Only sync if user ID actually changed or not synced yet
    const currentUserId = isSignedIn ? user?.id : "guest";
    
    if (currentUserId !== lastUserIdRef.current || !hasSyncedRef.current) {
      console.log("User changed or first load, syncing...");
      handleSync();
    } else {
      console.log("Same user, skipping sync");
      setIsSyncing(false);
    }
  }, [isLoaded, isSignedIn, user?.id, handleSync]); // ← Only depend on user?.id, not full user object

  if (isSyncing) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[#131722]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-12 w-12 animate-spin text-[#2962ff]" />
          <p className="text-[#787b86]">Syncing your portfolio...</p>
        </div>
      </div>
    );
  }

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

        <OrderPanel />
        <SidebarRight />
      </div>
      <AIPanel/>
    </div>
  );
}