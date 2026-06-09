// src/components/TradingPanel.tsx
"use client";

import { useState, useEffect, useRef } from "react";
import { ChevronDown, ChevronUp, TrendingUp, TrendingDown, DollarSign, PieChart, XCircle, Loader2 } from "lucide-react";
import { useTradingStore } from "@/stores/useTradingStore";
import { formatCurrency, pnlColorClass } from "@/utils/format";
import { useUser } from "@clerk/nextjs";

interface TradingPanelProps {
  isOpen: boolean;
  onToggle: () => void;
}

export default function TradingPanel({ isOpen, onToggle }: TradingPanelProps) {
  const balance = useTradingStore((state) => state.balance);
  const positions = useTradingStore((state) => state.positions);
  const resetAccount = useTradingStore((state) => state.resetAccount);
  const setBalance = useTradingStore((state) => state.setBalance);
  const setPositions = useTradingStore((state) => state.setPositions);
  const setTradeHistory = useTradingStore((state) => state.setTradeHistory);
  const profile = useTradingStore((state) => state.profile);
  
  const { isSignedIn, user } = useUser();
  
  const [isMounted, setIsMounted] = useState(false);
  const [selectedPosition, setSelectedPosition] = useState<string | null>(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Replace these calculations in TradingPanel component
  const totalInvested = positions.reduce((sum, pos) => {
    const entryPrice = pos.entryPrice || 0;
    const quantity = pos.quantity || 0;
    return sum + (entryPrice * quantity);
  }, 0);

  const totalCurrentValue = positions.reduce((sum, pos) => {
    const currentPrice = pos.currentPrice || pos.currentPrice || pos.entryPrice || pos.entryPrice || 0;
    const quantity = pos.quantity || 0;
    return sum + (currentPrice * quantity);
  }, 0);

  const totalPnL = positions.reduce((sum, pos) => {
    if (pos.pnl !== undefined && pos.pnl !== null) return sum + pos.pnl;
    const entryPrice = pos.entryPrice || pos.entryPrice || 0;
    const currentPrice = pos.currentPrice || pos.currentPrice || entryPrice;
    const quantity = pos.quantity || 0;
    return sum + ((currentPrice - entryPrice) * quantity);
  }, 0);
  
  const winRate = (() => {
    const closedTrades = positions.filter((p) => p.pnl !== 0);
    if (closedTrades.length === 0) return 0;
    const winners = closedTrades.filter((p) => p.pnl > 0).length;
    return (winners / closedTrades.length) * 100;
  })();
  
  const bestPerformer = positions.reduce(
    (best, pos) => (pos.pnl > best.pnl ? pos : best),
    positions[0] || { pnl: -Infinity, symbol: "" }
  );
  
  const worstPerformer = positions.reduce(
    (worst, pos) => (pos.pnl < worst.pnl ? pos : worst),
    positions[0] || { pnl: Infinity, symbol: "" }
  );

  const handleResetAccount = async () => {
    if (!showResetConfirm) {
      setShowResetConfirm(true);
      setTimeout(() => setShowResetConfirm(false), 5000);
      return;
    }
    
    setIsResetting(true);
    
    try {
      const isGuest = profile.id === "demo-user";
      
      if (isGuest) {
        // Guest mode: just reset local state
        resetAccount();
        alert("Account has been reset to $100,000 virtual cash");
      } else if (isSignedIn && user) {
        // Authenticated mode: call backend API
        const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
        
        const response = await fetch(`${API_BASE}/api/reset-account`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Clerk-User-Id": user.id,
          },
        });
        
        const data = await response.json();
        
        if (!response.ok) {
          throw new Error(data.error || "Failed to reset account");
        }
        
        if (data.success) {
          // Reset local state
          resetAccount();
          
          // Also refresh portfolio data from backend to ensure consistency
          const { fetchUserPortfolioFromDB } = await import("@/utils/dbSync");
          const dbData = await fetchUserPortfolioFromDB(user.id);
          
          setBalance({
            cash: dbData.cash,
            equity: dbData.equity,
            buyingPower: dbData.cash,
            dayPnl: 0,
            dayPnlPercent: 0,
          });
          setPositions(dbData.positions);
          setTradeHistory(dbData.tradeHistory);
          
          alert("Account has been reset to $100,000 virtual cash");
        } else {
          throw new Error(data.error || "Reset failed");
        }
      }
    } catch (error) {
      console.error("Reset account error:", error);
      alert(error instanceof Error ? error.message : "Failed to reset account. Please try again.");
    } finally {
      setIsResetting(false);
      setShowResetConfirm(false);
    }
  };

  if (!isMounted) {
    return (
      <div className="relative shrink-0 select-none">
        <div className="h-16 border-t border-[#2a2e39] bg-[#131722] animate-pulse" />
      </div>
    );
  }

  return (
    <div className="relative shrink-0 select-none">
      <button
        type="button"
        onClick={onToggle}
        className="absolute -top-6 left-1/2 z-20 flex h-6 -translate-x-1/2 items-center justify-center rounded-t-lg border border-b-0 border-[#2a2e39] bg-[#131722] px-6 text-[#787b86] hover:text-[#b2b5be] transition-all hover:scale-105"
      >
        {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
        <span className="ml-2 text-[10px] font-medium hidden sm:inline">
          {isOpen ? "Hide Panel" : "Show Panel"}
        </span>
      </button>

      {/* Changed overflow-scroll to overflow-y-auto to only show vertical scrollbar */}
      <div
        className={`overflow-y-auto border-t border-[#2a2e39] bg-[#131722] transition-all duration-300 ease-in-out custom-scrollbar ${
          isOpen ? "max-h-[400px] opacity-100" : "max-h-0 border-t-transparent opacity-0"
        }`}
        style={{ scrollbarWidth: 'thin', overflowX: 'hidden' }}
      >
        <div className="flex h-full flex-col">
          {/* Stats Cards - Fixed height, no scroll */}
          <div className="shrink-0 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 p-4 border-b border-[#2a2e39] bg-gradient-to-r from-[#131722] to-[#1c2030]/30">
            <StatCard
              title="Cash Balance"
              value={formatCurrency(balance.cash)}
              subtitle="Available for trading"
              icon={<DollarSign className="h-3 w-3 text-[#26a69a]" />}
            />
            <StatCard
              title="Total Equity"
              value={formatCurrency(balance.equity)}
              subtitle="Cash + Unrealized P&L"
              icon={<PieChart className="h-3 w-3 text-[#2962ff]" />}
            />
            <StatCard
              title="Total P&L"
              value={formatCurrency(totalPnL)}
              subtitle={`${totalPnL >= 0 ? "+" : ""}${balance.dayPnlPercent.toFixed(2)}% today`}
              icon={
                totalPnL >= 0 ? (
                  <TrendingUp className="h-3 w-3 text-[#26a69a]" />
                ) : (
                  <TrendingDown className="h-3 w-3 text-[#ef5350]" />
                )
              }
              valueClassName={pnlColorClass(totalPnL)}
            />
            <StatCard
              title="Win Rate"
              value={`${winRate.toFixed(1)}%`}
              subtitle={`${positions.length} active position${positions.length !== 1 ? "s" : ""}`}
              progress={winRate}
            />
            <ResetButton showResetConfirm={showResetConfirm} onReset={handleResetAccount} />
          </div>

          {/* Positions Table */}
          <div className="min-w-full">
            {/* Sticky header */}
            <div className="sticky top-0 z-10 grid grid-cols-7 gap-2 px-4 py-2 border-b border-[#2a2e39] bg-[#1c2030] text-[10px] font-semibold uppercase tracking-wider text-[#787b86]">
              <div className="col-span-1">Symbol</div>
              <div className="col-span-1">Side</div>
              <div className="col-span-1 text-right">Quantity</div>
              <div className="col-span-1 text-right">Entry Price</div>
              <div className="col-span-1 text-right">Current Price</div>
              <div className="col-span-1 text-right">P&L</div>
              <div className="col-span-1 text-right">P&L %</div>
            </div>

            <div className="divide-y divide-[#2a2e39]/30">
              {positions.length === 0 ? (
                <EmptyPositionsState />
              ) : (
                positions.map((pos) => (
                  <PositionRow
                    key={pos.id}
                    position={pos}
                    isExpanded={selectedPosition === pos.id}
                    onToggle={() => setSelectedPosition(selectedPosition === pos.id ? null : pos.id)}
                  />
                ))
              )}
            </div>

            {positions.length > 0 && (
              <PortfolioSummary
                bestPerformer={bestPerformer}
                worstPerformer={worstPerformer}
                totalInvested={totalInvested}
                totalCurrentValue={totalCurrentValue}
              />
            )}
          </div>
        </div>
      </div>
      
      {/* Global styles for custom scrollbar */}
      <style jsx global>{`
        .custom-scrollbar {
          scrollbar-width: thin;
          scrollbar-color: #2962ff #1c2030;
          overflow-x: hidden !important;
        }
        
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
          height: 0px; /* Hide horizontal scrollbar */
        }
        
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #1c2030;
          border-radius: 3px;
        }
        
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #2a2e39;
          border-radius: 3px;
          transition: background 0.2s ease;
        }
        
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #2962ff;
        }
        
        /* Hide horizontal scrollbar completely */
        .custom-scrollbar::-webkit-scrollbar-corner {
          background: transparent;
        }
      `}</style>
    </div>
  );
}

// Sub-components (StatCard, ResetButton, EmptyPositionsState, PositionRow, PortfolioSummary remain the same)
function StatCard({ title, value, subtitle, icon, valueClassName, progress }: any) {
  return (
    <div className="bg-[#1c2030]/50 rounded-lg p-3 border border-[#2a2e39] hover:border-[#2962ff]/30 transition-all">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-[#787b86]">{title}</span>
        {icon}
      </div>
      <div className={`text-lg font-bold tabular-nums ${valueClassName || "text-white"}`}>{value}</div>
      <div className="text-[9px] text-[#787b86] mt-1">{subtitle}</div>
      {progress !== undefined && (
        <div className="w-full bg-[#2a2e39] rounded-full h-1.5 mt-2">
          <div className="bg-[#26a69a] h-1.5 rounded-full transition-all" style={{ width: `${progress}%` }} />
        </div>
      )}
    </div>
  );
}

// Update ResetButton component
function ResetButton({ showResetConfirm, onReset, isResetting }: any) {
  return (
    <div className="bg-[#1c2030]/50 rounded-lg p-3 border border-[#2a2e39] hover:border-[#ef5350]/30 transition-all">
      <button 
        onClick={onReset} 
        disabled={isResetting}
        className="w-full h-full flex flex-col items-center justify-center gap-1 group disabled:opacity-50"
      >
        {isResetting ? (
          <Loader2 className="h-5 w-5 animate-spin text-[#ef5350]" />
        ) : (
          <XCircle className={`h-5 w-5 transition-colors ${showResetConfirm ? "text-[#ef5350]" : "text-[#787b86] group-hover:text-[#ef5350]"}`} />
        )}
        <span className={`text-[10px] font-semibold uppercase tracking-wider ${showResetConfirm ? "text-[#ef5350]" : "text-[#787b86] group-hover:text-[#ef5350]"}`}>
          {isResetting ? "Resetting..." : (showResetConfirm ? "Click again to confirm" : "Reset Account")}
        </span>
      </button>
    </div>
  );
}

function EmptyPositionsState() {
  return (
    <div className="py-12 text-center">
      <div className="text-[#434651] text-sm mb-2">📊 No Active Positions</div>
      <div className="text-[#787b86] text-xs">Click "BUY" in the order panel to open your first trade</div>
    </div>
  );
}

function PositionRow({ position, isExpanded, onToggle }: any) {
  const pnlPercent = ((position.currentPrice - position.entryPrice) / position.entryPrice) * 100;
  const baseCurrency = position.symbol.replace("USDT", "");
  
  return (
    <div className={`transition-all duration-200 ${isExpanded ? "bg-[#1e222d]/30" : "hover:bg-[#1e222d]/20"}`}>
      <div onClick={onToggle} className="grid grid-cols-7 gap-2 px-4 py-3 cursor-pointer">
        <div className="col-span-1">
          <div className="font-bold text-white text-sm">{position.symbol}</div>
          <div className="text-[9px] text-[#787b86] font-mono">{baseCurrency}</div>
        </div>
        <div className="col-span-1">
          <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold ${
            position.side === "BUY" ? "bg-[#2962ff]/10 text-[#2962ff]" : "bg-[#ef5350]/10 text-[#ef5350]"
          }`}>
            {position.side}
          </span>
        </div>
        <div className="col-span-1 text-right">
          <div className="font-mono text-sm text-white">{position.quantity.toFixed(4)}</div>
          <div className="text-[9px] text-[#787b86]">{(position.quantity * position.entryPrice).toFixed(2)} USD</div>
        </div>
        <div className="col-span-1 text-right">
          <div className="font-mono text-sm text-white">{formatCurrency(position.entryPrice)}</div>
        </div>
        <div className="col-span-1 text-right">
          <div className="font-mono text-sm text-white">{formatCurrency(position.currentPrice)}</div>
          <div className={`text-[9px] ${position.currentPrice >= position.entryPrice ? "text-[#26a69a]" : "text-[#ef5350]"}`}>
            {position.currentPrice >= position.entryPrice ? "↑" : "↓"}
            {Math.abs(((position.currentPrice - position.entryPrice) / position.entryPrice) * 100).toFixed(2)}%
          </div>
        </div>
        <div className={`col-span-1 text-right font-bold tabular-nums ${pnlColorClass(position.pnl)}`}>
          {formatCurrency(position.pnl)}
        </div>
        <div className={`col-span-1 text-right font-bold tabular-nums ${pnlColorClass(position.pnl)}`}>
          {pnlPercent >= 0 ? "+" : ""}
          {pnlPercent.toFixed(2)}%
        </div>
      </div>

      {isExpanded && (
        <div className="grid grid-cols-12 gap-2 px-4 py-3 bg-[#131722]/50 border-t border-[#2a2e39]/30 text-xs">
          <div className="col-span-3">
            <div className="text-[#787b86] mb-1">Position Size</div>
            <div className="text-white font-mono">{(position.quantity * position.entryPrice).toFixed(2)} USD</div>
          </div>
          <div className="col-span-3">
            <div className="text-[#787b86] mb-1">Current Value</div>
            <div className="text-white font-mono">{(position.quantity * position.currentPrice).toFixed(2)} USD</div>
          </div>
          <div className="col-span-3">
            <div className="text-[#787b86] mb-1">Break-even Price</div>
            <div className="text-white font-mono">{formatCurrency(position.entryPrice)}</div>
          </div>
          <div className="col-span-3">
            <div className="text-[#787b86] mb-1">Est. Exit Value</div>
            <div className="text-white font-mono">{formatCurrency(position.quantity * position.currentPrice)}</div>
          </div>
        </div>
      )}
    </div>
  );
}

function PortfolioSummary({ bestPerformer, worstPerformer, totalInvested, totalCurrentValue }: any) {
  return (
    <div className="sticky bottom-0 border-t border-[#2a2e39] bg-[#1c2030]/95 backdrop-blur-sm px-4 py-3 mt-2">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
        <div>
          <div className="text-[#787b86] mb-1">Best Performer</div>
          <div className="font-bold text-[#26a69a]">
            {bestPerformer.symbol || "—"}
            {bestPerformer.pnl > -Infinity && <span className="ml-2 text-[11px]">{formatCurrency(bestPerformer.pnl)}</span>}
          </div>
        </div>
        <div>
          <div className="text-[#787b86] mb-1">Worst Performer</div>
          <div className="font-bold text-[#ef5350]">
            {worstPerformer.symbol || "—"}
            {worstPerformer.pnl < Infinity && <span className="ml-2 text-[11px]">{formatCurrency(worstPerformer.pnl)}</span>}
          </div>
        </div>
        <div>
          <div className="text-[#787b86] mb-1">Total Invested</div>
          <div className="font-bold text-white">{formatCurrency(totalInvested)}</div>
        </div>
        <div>
          <div className="text-[#787b86] mb-1">Current Value</div>
          <div className="font-bold text-white">{formatCurrency(totalCurrentValue)}</div>
        </div>
      </div>
    </div>
  );
}