// src/app/portfolio/page.tsx
"use client";

import React from "react";
import Link from "next/link";
import { ArrowLeft, Wallet, History, BarChart3 } from "lucide-react";
import { useTradingStore } from "@/stores/useTradingStore";
import { formatCurrency } from "@/utils/format";

export default function PortfolioPage() {
  const balance = useTradingStore((state) => state.balance);
  const positions = useTradingStore((state) => state.positions);
  const tradeHistory = useTradingStore((state) => state.tradeHistory);
  const profile = useTradingStore((state) => state.profile);

  return (
    <div className="min-h-screen bg-[#131722] text-[#d1d4dc] p-6 select-none">
      {/* Navigation Header */}
      <div className="max-w-6xl mx-auto flex items-center justify-between mb-8">
        <Link href="/trade" className="flex items-center gap-2 text-sm font-semibold text-[#2962ff] hover:text-[#1e53e5] transition-colors">
          <ArrowLeft className="h-4 w-4" /> Back to Trading Room
        </Link>
        <div className="text-right">
          <h1 className="text-lg font-bold text-white">{profile.name}</h1>
          <p className="text-xs text-[#787b86]">{profile.email}</p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {/* Card 1: Total Equity */}
        <div className="bg-[#1c2030] p-5 rounded-lg border border-[#2a2e39] flex items-center gap-4">
          <div className="p-3 bg-[#2962ff]/10 rounded-full text-[#2962ff]">
            <BarChart3 className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs text-[#787b86] font-medium uppercase tracking-wider">Net Equity</p>
            <p className="text-xl font-bold text-white tabular-nums">{formatCurrency(balance.equity)}</p>
          </div>
        </div>

        {/* Card 2: Cash Balance */}
        <div className="bg-[#1c2030] p-5 rounded-lg border border-[#2a2e39] flex items-center gap-4">
          <div className="p-3 bg-[#26a69a]/10 rounded-full text-[#26a69a]">
            <Wallet className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs text-[#787b86] font-medium uppercase tracking-wider">Available Cash</p>
            <p className="text-xl font-bold text-white tabular-nums">{formatCurrency(balance.cash)}</p>
          </div>
        </div>

        {/* Card 3: Active Assets Count */}
        <div className="bg-[#1c2030] p-5 rounded-lg border border-[#2a2e39] flex items-center gap-4">
          <div className="p-3 bg-[#ef5350]/10 rounded-full text-[#ef5350]">
            <History className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs text-[#787b86] font-medium uppercase tracking-wider">Active Positions</p>
            <p className="text-xl font-bold text-white tabular-nums">{positions.length} Coins</p>
          </div>
        </div>
      </div>

      {/* Transaction History */}
      <div className="max-w-6xl mx-auto bg-[#1c2030] rounded-lg border border-[#2a2e39] p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-white mb-4 flex items-center gap-2">
          <History className="h-4 w-4 text-[#787b86]" /> Trade History Log
        </h2>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-[#2a2e39] text-[#787b86]">
                <th className="pb-2 font-normal">Timestamp</th>
                <th className="pb-2 font-normal">Symbol</th>
                <th className="pb-2 font-normal">Side</th>
                <th className="pb-2 text-right font-normal">Quantity</th>
                <th className="pb-2 text-right font-normal">Execution Price</th>
                <th className="pb-2 text-right font-normal">Total Value</th>
              </tr>
            </thead>
            <tbody>
              {tradeHistory.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-[#434651]">
                    No transaction history on this new device. Start trading to fill the log!
                  </td>
                </tr>
              ) : (
                tradeHistory.map((log) => (
                  <tr key={log.id} className="border-b border-[#2a2e39]/40 hover:bg-[#131722]/40 transition-colors">
                    <td className="py-3 text-[#787b86] tabular-nums">{new Date(log.timestamp).toLocaleString()}</td>
                    <td className="py-3 font-bold text-white">{log.symbol}</td>
                    <td className="py-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        log.side === "BUY" ? "bg-[#2962ff]/10 text-[#2962ff]" : "bg-[#ef5350]/10 text-[#ef5350]"
                      }`}>
                        {log.side}
                      </span>
                    </td>
                    <td className="py-3 text-right tabular-nums text-[#d1d4dc]">{log.quantity}</td>
                    <td className="py-3 text-right tabular-nums text-[#d1d4dc]">{formatCurrency(log.price)}</td>
                    <td className="py-3 text-right tabular-nums text-white font-medium">
                      {formatCurrency(log.quantity * log.price)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}