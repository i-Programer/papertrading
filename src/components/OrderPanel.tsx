// src/components/OrderPanel.tsx
"use client";

import { useState, useEffect } from "react";
import { useTradingStore } from "@/stores/useTradingStore";
import { formatCurrency, pnlColorClass } from "@/utils/format";

export default function OrderPanel() {
  const symbol = useTradingStore((state) => state.symbol);
  const tradeHistory = useTradingStore((state) => state.tradeHistory);
  const balance = useTradingStore((state) => state.balance);
  const executeTradeWithDB = useTradingStore((state) => state.executeTradeWithDB);
  const positions = useTradingStore((state) => state.positions);

  // State internal panel
  const [activeTab, setActiveTab] = useState<"BUY" | "SELL">("BUY");
  const [quantity, setQuantity] = useState<string>("0.1");
  const [livePrice, setLivePrice] = useState<number>(67000.0);

  // Sinkronisasi harga realtime dari WebSocket Coinbase
  useEffect(() => {
    const ws = new WebSocket("wss://ws-feed.exchange.coinbase.com");

    ws.onopen = () => {
      ws.send(
        JSON.stringify({
          type: "subscribe",
          product_ids: [symbol],
          channels: ["ticker"],
        })
      );
    };

    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      if (message.type === "ticker" && message.price) {
        setLivePrice(parseFloat(message.price));
      }
    };

    return () => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "unsubscribe", product_ids: [symbol], channels: ["ticker"] }));
      }
      ws.close();
    };
  }, [symbol]);

  const handleExecute = async () => {
    const qtyNum = parseFloat(quantity);
    if (qtyNum <= 0 || isNaN(qtyNum)) {
      alert("Masukkan kuantitas yang valid!");
      return;
    }

    const success = await executeTradeWithDB(activeTab, qtyNum, livePrice);
    if (success) {
      setQuantity("0.1"); // Reset input setelah sukses
    }
  };

  // Filter history log agar hanya menampilkan transaksi koin yang sedang aktif saat ini
  const filteredHistory = tradeHistory.filter((log) => log.symbol === symbol).slice(0, 5);

  const totalCost = parseFloat(quantity) * livePrice || 0;

  return (
    <aside className="flex w-64 shrink-0 flex-col border-l border-[#2a2e39] bg-[#131722] select-none">
      
      {/* TAB BUY / SELL */}
      <div className="flex h-10 shrink-0 border-b border-[#2a2e39]">
        <button
          onClick={() => setActiveTab("BUY")}
          className={`flex-1 text-xs font-bold uppercase tracking-wider transition-colors ${
            activeTab === "BUY"
              ? "border-b-2 border-[#2962ff] text-[#2962ff] bg-[#2962ff]/5"
              : "text-[#787b86] hover:text-[#d1d4dc]"
          }`}
        >
          Buy
        </button>
        <button
          onClick={() => setActiveTab("SELL")}
          className={`flex-1 text-xs font-bold uppercase tracking-wider transition-colors ${
            activeTab === "SELL"
              ? "border-b-2 border-[#ef5350] text-[#ef5350] bg-[#ef5350]/5"
              : "text-[#787b86] hover:text-[#d1d4dc]"
          }`}
        >
          Sell
        </button>
      </div>

      {/* FORM ORDER */}
      <div className="p-4 flex flex-col gap-4 border-b border-[#2a2e39]">
        {/* Info Saldo Berdasarkan Tab */}
        <div className="flex justify-between text-[11px]">
          <span className="text-[#787b86]">
            {activeTab === "BUY" ? "Available USD" : `Available ${symbol.split("-")[0]}`}
          </span>
          <span className="font-semibold text-[#d1d4dc] tabular-nums">
            {activeTab === "BUY" 
              ? formatCurrency(balance.cash)
              : (positions.find((p) => p.symbol === symbol)?.quantity || 0).toFixed(4)
            }
          </span>
        </div>

        {/* Input Harga (Market Price / Read-only) */}
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-semibold uppercase tracking-wider text-[#787b86]">Price (USD)</label>
          <div className="rounded border border-[#2a2e39] bg-[#1e222d] px-3 py-2 text-xs font-bold text-[#b2b5be] tabular-nums">
            {livePrice.toLocaleString("en-US", { minimumFractionDigits: 2 })}
            <span className="ml-2 text-[10px] font-normal text-[#787b86]">(Market)</span>
          </div>
        </div>

        {/* Input Kuantitas */}
        <div className="flex flex-col gap-1">
          <label htmlFor="order-qty" className="text-[10px] font-semibold uppercase tracking-wider text-[#787b86]">Amount</label>
          <div className="flex items-center rounded border border-[#2a2e39] bg-[#1e222d] px-3 py-1.5 focus-within:border-[#2962ff]">
            <input
              id="order-qty"
              type="number"
              step="0.01"
              min="0.0001"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="w-full bg-transparent text-xs font-bold text-white outline-none"
              placeholder="0.0"
            />
            <span className="text-[10px] font-bold text-[#787b86]">{symbol.split("-")[0]}</span>
          </div>
        </div>

        {/* Total Estimasi */}
        <div className="flex justify-between text-xs border-t border-[#2a2e39]/50 pt-2">
          <span className="text-[#787b86]">Total:</span>
          <span className="font-bold text-white tabular-nums">{formatCurrency(totalCost)}</span>
        </div>

        {/* Tombol Eksekusi Dinamis */}
        <button
          onClick={handleExecute}
          className={`w-full rounded py-2.5 text-xs font-bold uppercase tracking-wide text-white transition-all active:scale-95 ${
            activeTab === "BUY" 
              ? "bg-[#2962ff] hover:bg-[#1e53e5]" 
              : "bg-[#ef5350] hover:bg-[#e53935]"
          }`}
        >
          {activeTab} {symbol.split("-")[0]}
        </button>
      </div>

      {/* RECENT TRADES (ORDER LIST HISTORY PER KOIN) */}
      <div className="flex flex-1 flex-col min-h-0">
        <h3 className="px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-[#787b86]">
          Recent {symbol} Orders
        </h3>
        <div className="flex-1 overflow-y-auto px-4 pb-2">
          {filteredHistory.length === 0 ? (
            <div className="text-center py-8 text-[11px] text-[#434651]">
              No recent orders for this pair.
            </div>
          ) : (
            <div className="space-y-2">
              {filteredHistory.map((log) => (
                <div key={log.id} className="flex flex-col gap-0.5 rounded bg-[#1e222d]/30 p-2 text-[11px] border border-[#2a2e39]/30">
                  <div className="flex justify-between">
                    <span className={`font-bold ${log.side === "BUY" ? "text-[#26a69a]" : "text-[#ef5350]"}`}>
                      {log.side}
                    </span>
                    <span className="text-[#787b86] text-[10px]">{log.timestamp}</span>
                  </div>
                  <div className="flex justify-between text-[#b2b5be] tabular-nums">
                    <span>Qty: {log.quantity}</span>
                    <span>@{formatCurrency(log.price)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}