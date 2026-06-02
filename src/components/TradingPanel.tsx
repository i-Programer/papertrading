// src/components/TradingPanel.tsx
"use client";

import { ChevronDown, ChevronUp } from "lucide-react";
import { useTradingStore } from "@/stores/useTradingStore";
import { formatCurrency, pnlColorClass } from "@/utils/format";

interface TradingPanelProps {
  isOpen: boolean;
  onToggle: () => void;
}

export default function TradingPanel({ isOpen, onToggle }: TradingPanelProps) {
  const balance = useTradingStore((state) => state.balance);
  const positions = useTradingStore((state) => state.positions);

  return (
    <div className="relative shrink-0 select-none">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        className="absolute -top-6 left-1/2 z-10 flex h-6 -translate-x-1/2 items-center justify-center rounded-t border border-b-0 border-[#2a2e39] bg-[#131722] px-4 text-[#787b86] hover:text-[#b2b5be]"
      >
        {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
      </button>

      <footer
        className={`overflow-hidden border-t border-[#2a2e39] bg-[#131722] transition-all duration-300 ease-in-out ${
          isOpen ? "h-64 opacity-100" : "h-0 border-t-transparent opacity-0"
        }`}
      >
        <div className="flex h-full flex-col">
          {/* Baris Info Ringkasan Finansial */}
          <div className="flex shrink-0 flex-wrap items-center gap-6 border-b border-[#2a2e39] px-4 py-3 text-xs">
            <div>
              <span className="text-[#787b86]">Balance </span>
              <span className="font-semibold tabular-nums text-[#d1d4dc]">
                {formatCurrency(balance.cash)}
              </span>
            </div>
            <div>
              <span className="text-[#787b86]">Equity </span>
              <span className="font-semibold tabular-nums text-[#d1d4dc]">
                {formatCurrency(balance.equity)}
              </span>
            </div>
            <div>
              <span className="text-[#787b86]">Real-time P&amp;L </span>
              <span className={`font-semibold tabular-nums ${pnlColorClass(balance.dayPnl)}`}>
                {formatCurrency(balance.dayPnl)} ({balance.dayPnlPercent.toFixed(2)}%)
              </span>
            </div>
          </div>

          {/* Daftar Tabel Posisi */}
          <div className="min-h-0 flex-1 overflow-auto p-3">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[#2a2e39] text-[#787b86]">
                  <th className="pb-2 pr-4 font-normal">Symbol</th>
                  <th className="pb-2 pr-4 font-normal">Side</th>
                  <th className="pb-2 pr-4 font-normal">Qty</th>
                  <th className="pb-2 pr-4 font-normal">Entry Price</th>
                  <th className="pb-2 pr-4 font-normal">Current Price</th>
                  <th className="pb-2 font-normal">P&amp;L</th>
                </tr>
              </thead>
              <tbody>
                {positions.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-[#434651]">
                      No active positions. Click BUY above to open a trade!
                    </td>
                  </tr>
                ) : (
                  positions.map((pos) => (
                    <tr key={pos.id} className="border-b border-[#2a2e39]/40 hover:bg-[#1e222d]/40 transition-colors">
                      <td className="py-2.5 font-bold text-white">{pos.symbol}</td>
                      <td className={`py-2.5 font-bold ${pos.side === 'BUY' ? 'text-[#2962ff]' : 'text-[#ef5350]'}`}>
                        {pos.side}
                      </td>
                      <td className="py-2.5 tabular-nums text-[#d1d4dc]">{pos.quantity}</td>
                      <td className="py-2.5 tabular-nums text-[#d1d4dc]">{formatCurrency(pos.entryPrice)}</td>
                      <td className="py-2.5 tabular-nums text-[#d1d4dc]">{formatCurrency(pos.currentPrice)}</td>
                      <td className={`py-2.5 font-semibold tabular-nums ${pnlColorClass(pos.pnl)}`}>
                        {formatCurrency(pos.pnl)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </footer>
    </div>
  );
}