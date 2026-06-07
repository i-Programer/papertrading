// src/components/TradingPanel.tsx
"use client";

import { useState, useEffect } from "react";
import { ChevronDown, ChevronUp, TrendingUp, TrendingDown, DollarSign, PieChart, XCircle } from "lucide-react";
import { useTradingStore } from "@/stores/useTradingStore";
import { formatCurrency, pnlColorClass } from "@/utils/format";

interface TradingPanelProps {
  isOpen: boolean;
  onToggle: () => void;
}

export default function TradingPanel({ isOpen, onToggle }: TradingPanelProps) {
  const balance = useTradingStore((state) => state.balance);
  const positions = useTradingStore((state) => state.positions);
  const resetAccount = useTradingStore((state) => state.resetAccount);
  const [isMounted, setIsMounted] = useState(false);
  const [selectedPosition, setSelectedPosition] = useState<string | null>(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  // Handle hydration
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Calculate portfolio statistics
  const totalInvested = positions.reduce((sum, pos) => sum + (pos.entryPrice * pos.quantity), 0);
  const totalCurrentValue = positions.reduce((sum, pos) => sum + (pos.currentPrice * pos.quantity), 0);
  const totalPnL = positions.reduce((sum, pos) => sum + pos.pnl, 0);
  const winRate = (() => {
    const closedTrades = positions.filter(p => p.pnl !== 0);
    if (closedTrades.length === 0) return 0;
    const winners = closedTrades.filter(p => p.pnl > 0).length;
    return (winners / closedTrades.length) * 100;
  })();
  const bestPerformer = positions.reduce((best, pos) => 
    pos.pnl > best.pnl ? pos : best, 
    positions[0] || { pnl: -Infinity, symbol: "" }
  );
  const worstPerformer = positions.reduce((worst, pos) => 
    pos.pnl < worst.pnl ? pos : worst, 
    positions[0] || { pnl: Infinity, symbol: "" }
  );

  const handleResetAccount = () => {
    if (showResetConfirm) {
      resetAccount();
      setShowResetConfirm(false);
      // Optional: Show success message
      alert("Account has been reset to $100,000 virtual cash");
    } else {
      setShowResetConfirm(true);
      // Auto-hide confirmation after 5 seconds
      setTimeout(() => setShowResetConfirm(false), 5000);
    }
  };

  // Don't render until mounted
  if (!isMounted) {
    return (
      <div className="relative shrink-0 select-none">
        <div className="h-16 border-t border-[#2a2e39] bg-[#131722] animate-pulse" />
      </div>
    );
  }

  return (
    <div className="relative shrink-0 select-none">
      {/* Toggle Button */}
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        className="absolute -top-6 left-1/2 z-20 flex h-6 -translate-x-1/2 items-center justify-center rounded-t-lg border border-b-0 border-[#2a2e39] bg-[#131722] px-6 text-[#787b86] hover:text-[#b2b5be] transition-all hover:scale-105"
      >
        {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
        <span className="ml-2 text-[10px] font-medium hidden sm:inline">
          {isOpen ? "Hide Panel" : "Show Panel"}
        </span>
      </button>

      {/* Main Panel */}
      <div
        className={`overflow-hidden border-t border-[#2a2e39] bg-[#131722] transition-all duration-300 ease-in-out ${
          isOpen ? "max-h-[400px] opacity-100" : "max-h-0 border-t-transparent opacity-0"
        }`}
      >
        <div className="flex h-full flex-col">
          {/* Stats Bar - Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 p-4 border-b border-[#2a2e39] bg-gradient-to-r from-[#131722] to-[#1c2030]/30">
            {/* Cash Balance */}
            <div className="bg-[#1c2030]/50 rounded-lg p-3 border border-[#2a2e39] hover:border-[#2962ff]/30 transition-all">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-[#787b86]">
                  Cash Balance
                </span>
                <DollarSign className="h-3 w-3 text-[#26a69a]" />
              </div>
              <div className="text-lg font-bold text-white tabular-nums">
                {formatCurrency(balance.cash)}
              </div>
              <div className="text-[9px] text-[#787b86] mt-1">
                Available for trading
              </div>
            </div>

            {/* Total Equity */}
            <div className="bg-[#1c2030]/50 rounded-lg p-3 border border-[#2a2e39] hover:border-[#2962ff]/30 transition-all">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-[#787b86]">
                  Total Equity
                </span>
                <PieChart className="h-3 w-3 text-[#2962ff]" />
              </div>
              <div className="text-lg font-bold text-white tabular-nums">
                {formatCurrency(balance.equity)}
              </div>
              <div className="text-[9px] text-[#787b86] mt-1">
                Cash + Unrealized P&L
              </div>
            </div>

            {/* Total P&L */}
            <div className="bg-[#1c2030]/50 rounded-lg p-3 border border-[#2a2e39] hover:border-[#2962ff]/30 transition-all">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-[#787b86]">
                  Total P&L
                </span>
                {totalPnL >= 0 ? (
                  <TrendingUp className="h-3 w-3 text-[#26a69a]" />
                ) : (
                  <TrendingDown className="h-3 w-3 text-[#ef5350]" />
                )}
              </div>
              <div className={`text-lg font-bold tabular-nums ${pnlColorClass(totalPnL)}`}>
                {formatCurrency(totalPnL)}
              </div>
              <div className="text-[9px] text-[#787b86] mt-1">
                {balance.dayPnlPercent >= 0 ? "+" : ""}{balance.dayPnlPercent.toFixed(2)}% today
              </div>
            </div>

            {/* Win Rate */}
            <div className="bg-[#1c2030]/50 rounded-lg p-3 border border-[#2a2e39] hover:border-[#2962ff]/30 transition-all">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-[#787b86]">
                  Win Rate
                </span>
                <span className="text-[11px] font-bold text-white">{winRate.toFixed(1)}%</span>
              </div>
              <div className="w-full bg-[#2a2e39] rounded-full h-1.5 mt-2">
                <div 
                  className="bg-[#26a69a] h-1.5 rounded-full transition-all duration-500"
                  style={{ width: `${winRate}%` }}
                />
              </div>
              <div className="text-[9px] text-[#787b86] mt-2">
                {positions.length} active position{positions.length !== 1 ? 's' : ''}
              </div>
            </div>

            {/* Reset Button */}
            <div className="bg-[#1c2030]/50 rounded-lg p-3 border border-[#2a2e39] hover:border-[#ef5350]/30 transition-all">
              <button
                onClick={handleResetAccount}
                className="w-full h-full flex flex-col items-center justify-center gap-1 group"
              >
                <XCircle className={`h-5 w-5 transition-colors ${showResetConfirm ? 'text-[#ef5350]' : 'text-[#787b86] group-hover:text-[#ef5350]'}`} />
                <span className={`text-[10px] font-semibold uppercase tracking-wider ${showResetConfirm ? 'text-[#ef5350]' : 'text-[#787b86] group-hover:text-[#ef5350]'}`}>
                  {showResetConfirm ? "Click again to confirm" : "Reset Account"}
                </span>
              </button>
            </div>
          </div>

          {/* Positions Table */}
          <div className="flex-1 overflow-auto">
            <div className="min-w-full">
              {/* Table Header */}
              <div className="grid grid-cols-7 gap-2 px-4 py-2 border-b border-[#2a2e39] bg-[#1c2030]/30 text-[10px] font-semibold uppercase tracking-wider text-[#787b86] sticky top-0">
                <div className="col-span-1">Symbol</div>
                <div className="col-span-1">Side</div>
                <div className="col-span-1 text-right">Quantity</div>
                <div className="col-span-1 text-right">Entry Price</div>
                <div className="col-span-1 text-right">Current Price</div>
                <div className="col-span-1 text-right">P&L</div>
                <div className="col-span-1 text-right">P&L %</div>
              </div>

              {/* Table Body */}
              <div className="divide-y divide-[#2a2e39]/30">
                {positions.length === 0 ? (
                  <div className="py-12 text-center">
                    <div className="text-[#434651] text-sm mb-2">📊 No Active Positions</div>
                    <div className="text-[#787b86] text-xs">
                      Click "BUY" in the order panel to open your first trade
                    </div>
                  </div>
                ) : (
                  positions.map((pos) => {
                    const pnlPercent = ((pos.currentPrice - pos.entryPrice) / pos.entryPrice) * 100;
                    const isExpanded = selectedPosition === pos.id;
                    
                    return (
                      <div
                        key={pos.id}
                        className={`transition-all duration-200 ${
                          isExpanded ? 'bg-[#1e222d]/30' : 'hover:bg-[#1e222d]/20'
                        }`}
                      >
                        {/* Main Row */}
                        <div 
                          onClick={() => setSelectedPosition(isExpanded ? null : pos.id)}
                          className="grid grid-cols-7 gap-2 px-4 py-3 cursor-pointer"
                        >
                          <div className="col-span-1">
                            <div className="font-bold text-white text-sm">{pos.symbol}</div>
                            <div className="text-[9px] text-[#787b86] font-mono">
                              {pos.symbol.split('-')[0]}/USD
                            </div>
                          </div>
                          
                          <div className="col-span-1">
                            <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold ${
                              pos.side === 'BUY' 
                                ? 'bg-[#2962ff]/10 text-[#2962ff]' 
                                : 'bg-[#ef5350]/10 text-[#ef5350]'
                            }`}>
                              {pos.side}
                            </span>
                          </div>
                          
                          <div className="col-span-1 text-right">
                            <div className="font-mono text-sm text-white">
                              {pos.quantity.toFixed(4)}
                            </div>
                            <div className="text-[9px] text-[#787b86]">
                              { (pos.quantity * pos.entryPrice).toFixed(2) } USD
                            </div>
                          </div>
                          
                          <div className="col-span-1 text-right">
                            <div className="font-mono text-sm text-white">
                              {formatCurrency(pos.entryPrice)}
                            </div>
                          </div>
                          
                          <div className="col-span-1 text-right">
                            <div className="font-mono text-sm text-white">
                              {formatCurrency(pos.currentPrice)}
                            </div>
                            <div className={`text-[9px] ${pos.currentPrice >= pos.entryPrice ? 'text-[#26a69a]' : 'text-[#ef5350]'}`}>
                              {pos.currentPrice >= pos.entryPrice ? '↑' : '↓'} 
                              {Math.abs(((pos.currentPrice - pos.entryPrice) / pos.entryPrice) * 100).toFixed(2)}%
                            </div>
                          </div>
                          
                          <div className={`col-span-1 text-right font-bold tabular-nums ${pnlColorClass(pos.pnl)}`}>
                            {formatCurrency(pos.pnl)}
                          </div>
                          
                          <div className={`col-span-1 text-right font-bold tabular-nums ${pnlColorClass(pos.pnl)}`}>
                            {pnlPercent >= 0 ? '+' : ''}{pnlPercent.toFixed(2)}%
                          </div>
                        </div>

                        {/* Expanded Details Row */}
                        {isExpanded && (
                          <div className="grid grid-cols-12 gap-2 px-4 py-3 bg-[#131722]/50 border-t border-[#2a2e39]/30 text-xs">
                            <div className="col-span-3">
                              <div className="text-[#787b86] mb-1">Position Size</div>
                              <div className="text-white font-mono">
                                { (pos.quantity * pos.entryPrice).toFixed(2) } USD
                              </div>
                            </div>
                            <div className="col-span-3">
                              <div className="text-[#787b86] mb-1">Current Value</div>
                              <div className="text-white font-mono">
                                { (pos.quantity * pos.currentPrice).toFixed(2) } USD
                              </div>
                            </div>
                            <div className="col-span-3">
                              <div className="text-[#787b86] mb-1">Break-even Price</div>
                              <div className="text-white font-mono">
                                {formatCurrency(pos.entryPrice)}
                              </div>
                            </div>
                            <div className="col-span-3">
                              <div className="text-[#787b86] mb-1">Est. Exit Value</div>
                              <div className="text-white font-mono">
                                {formatCurrency(pos.quantity * pos.currentPrice)}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>

              {/* Portfolio Summary Footer (only when positions exist) */}
              {positions.length > 0 && (
                <div className="border-t border-[#2a2e39] bg-[#1c2030]/40 px-4 py-3 mt-2">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                    <div>
                      <div className="text-[#787b86] mb-1">Best Performer</div>
                      <div className="font-bold text-[#26a69a]">
                        {bestPerformer.symbol || '—'}
                        {bestPerformer.pnl > -Infinity && (
                          <span className="ml-2 text-[11px]">
                            {formatCurrency(bestPerformer.pnl)}
                          </span>
                        )}
                      </div>
                    </div>
                    <div>
                      <div className="text-[#787b86] mb-1">Worst Performer</div>
                      <div className="font-bold text-[#ef5350]">
                        {worstPerformer.symbol || '—'}
                        {worstPerformer.pnl < Infinity && (
                          <span className="ml-2 text-[11px]">
                            {formatCurrency(worstPerformer.pnl)}
                          </span>
                        )}
                      </div>
                    </div>
                    <div>
                      <div className="text-[#787b86] mb-1">Total Invested</div>
                      <div className="font-bold text-white">
                        {formatCurrency(totalInvested)}
                      </div>
                    </div>
                    <div>
                      <div className="text-[#787b86] mb-1">Current Value</div>
                      <div className="font-bold text-white">
                        {formatCurrency(totalCurrentValue)}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}