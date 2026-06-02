// src/components/Topbar.tsx
"use client";

import { useState } from "react";
import { TrendingUp } from "lucide-react";
import { useTradingStore } from "@/stores/useTradingStore";
import { UserButton } from "@clerk/nextjs";

function formatPrice(value: number): string {
  return value.toLocaleString("en-US", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
}

export default function Topbar() {
  const symbol = useTradingStore((state) => state.symbol);
  const positions = useTradingStore((state) => state.positions);
  const executeTradeWithDB = useTradingStore((state) => state.executeTradeWithDB);

  const [quantity, setQuantity] = useState<number>(0.1);

  const activePosition = positions.find((p) => p.symbol === symbol);
  const currentLivePrice = activePosition?.currentPrice || 67842.5; 

  const handleBuy = () => {
    if (quantity <= 0 || isNaN(quantity)) {
      alert("Masukkan jumlah kuantitas yang valid!");
      return;
    }
    executeTradeWithDB("BUY", quantity, currentLivePrice); // 🔥 Ubah di sini
  };

  const handleSell = () => {
    if (quantity <= 0 || isNaN(quantity)) {
      alert("Masukkan jumlah kuantitas yang valid!");
      return;
    }
    executeTradeWithDB("SELL", quantity, currentLivePrice); // 🔥 Ubah di sini
  };

  return (
    <header className="flex h-12 shrink-0 items-center justify-between border-b border-[#2a2e39] bg-[#131722] px-4 select-none">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 text-[#2962ff]">
          <TrendingUp className="h-5 w-5" aria-hidden />
          <span className="text-sm font-bold tracking-wide text-white">
            PaperTrade
          </span>
        </div>
        <span className="rounded border border-[#2a2e39] bg-[#1e222d] px-2.5 py-1 text-xs font-semibold text-white">
          {symbol}
        </span>
      </div>

      <div className="flex items-center gap-4">
        {/* INPUT BOX QUANTITY */}
        <div className="flex items-center gap-2 rounded border border-[#2a2e39] bg-[#1e222d] px-2 py-1">
          <label htmlFor="qty-input" className="text-[10px] font-medium uppercase tracking-wide text-[#787b86]">
            Qty:
          </label>
          <input
            id="qty-input"
            type="number"
            min="0.0001"
            step="0.01"
            value={quantity}
            onChange={(e) => setQuantity(parseFloat(e.target.value) || 0)}
            className="w-16 bg-transparent text-right text-xs font-semibold text-white outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          />
        </div>

        {/* Tombol Eksekusi */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleSell}
            className="flex min-w-[7.5rem] flex-col items-center rounded px-4 py-1.5 text-white bg-[#ef5350] hover:bg-[#e53935] transition-colors active:scale-95"
          >
            <span className="text-[10px] font-medium uppercase tracking-wide opacity-90">
              Sell
            </span>
            <span className="text-sm font-semibold tabular-nums">
              {formatPrice(currentLivePrice)}
            </span>
          </button>
          
          <button
            type="button"
            onClick={handleBuy}
            className="flex min-w-[7.5rem] flex-col items-center rounded px-4 py-1.5 text-white bg-[#2962ff] hover:bg-[#1e53e5] transition-colors active:scale-95"
          >
            <span className="text-[10px] font-medium uppercase tracking-wide opacity-90">
              Buy
            </span>
            <span className="text-sm font-semibold tabular-nums">
              {formatPrice(currentLivePrice + 15.5)}
            </span>
          </button>
          {/* Di dalam return Topbar, di bagian paling kanan dekat tombol */}
          <div className="flex items-center gap-2">
            {/* Tombol Sell & Buy kamu tetap di sini ... */}
            
            {/* 🔥 Avatar User & Menu Logout Otomatis dari Clerk */}
            <div className="ml-2 border-l border-[#2a2e39] pl-3 h-6 flex items-center">
              <UserButton />
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}