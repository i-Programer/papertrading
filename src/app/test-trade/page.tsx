// src/app/test-trade/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useTradingStore } from "@/stores/useTradingStore";
import { wsManager } from "@/lib/websocket-manager";

export default function TestTradePage() {
  const {
    symbol,
    balance,
    positions,
    tradeHistory,
    executeTradeWithDB,
    updateLivePrices,
    isLoading
  } = useTradingStore();

  const [testPrice, setTestPrice] = useState<number>(50000);
  const [testQuantity, setTestQuantity] = useState<string>("0.1");

  useEffect(() => {
    // Subscribe to WebSocket for real price updates
    const unsubscribe = wsManager.subscribe("ticker", (data) => {
      if (data.product_id === symbol) {
        const price = parseFloat(data.price);
        setTestPrice(price);
        updateLivePrices(price);
      }
    });

    wsManager.connect(symbol);

    return () => unsubscribe();
  }, [symbol, updateLivePrices]);

  const handleBuy = async () => {
    const qty = parseFloat(testQuantity);
    if (isNaN(qty) || qty <= 0) {
      alert("Please enter valid quantity");
      return;
    }
    await executeTradeWithDB("BUY", qty, testPrice);
  };

  const handleSell = async () => {
    const qty = parseFloat(testQuantity);
    if (isNaN(qty) || qty <= 0) {
      alert("Please enter valid quantity");
      return;
    }
    await executeTradeWithDB("SELL", qty, testPrice);
  };

  return (
    <div className="min-h-screen bg-[#131722] text-white p-8">
      <h1 className="text-2xl font-bold mb-6">Trading Store Test</h1>
      
      {/* Balance Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-[#1c2030] rounded-lg p-4">
          <div className="text-sm text-[#787b86]">Cash Balance</div>
          <div className="text-2xl font-bold text-green-400">
            ${balance.cash.toLocaleString()}
          </div>
        </div>
        <div className="bg-[#1c2030] rounded-lg p-4">
          <div className="text-sm text-[#787b86]">Total Equity</div>
          <div className="text-2xl font-bold text-blue-400">
            ${balance.equity.toLocaleString()}
          </div>
        </div>
        <div className="bg-[#1c2030] rounded-lg p-4">
          <div className="text-sm text-[#787b86]">Day P&L</div>
          <div className={`text-2xl font-bold ${balance.dayPnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            ${balance.dayPnl.toLocaleString()} ({balance.dayPnlPercent.toFixed(2)}%)
          </div>
        </div>
      </div>

      {/* Trading Interface */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div className="bg-[#1c2030] rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-4">Trade {symbol}</h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-[#787b86] mb-1">Current Price</label>
              <div className="text-2xl font-bold text-yellow-400">
                ${testPrice.toLocaleString()}
              </div>
            </div>

            <div>
              <label className="block text-sm text-[#787b86] mb-1">Quantity ({symbol.split('-')[0]})</label>
              <input
                type="number"
                step="0.01"
                value={testQuantity}
                onChange={(e) => setTestQuantity(e.target.value)}
                className="w-full bg-[#131722] border border-[#2a2e39] rounded-lg px-3 py-2 text-white"
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleBuy}
                disabled={isLoading}
                className="flex-1 bg-green-600 hover:bg-green-700 disabled:opacity-50 py-2 rounded-lg font-semibold transition-colors"
              >
                {isLoading ? "Processing..." : `BUY ${symbol.split('-')[0]}`}
              </button>
              <button
                onClick={handleSell}
                disabled={isLoading}
                className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-50 py-2 rounded-lg font-semibold transition-colors"
              >
                {isLoading ? "Processing..." : `SELL ${symbol.split('-')[0]}`}
              </button>
            </div>
          </div>
        </div>

        {/* Active Positions */}
        <div className="bg-[#1c2030] rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-4">Active Positions</h2>
          {positions.length === 0 ? (
            <p className="text-[#787b86] text-center py-8">No active positions</p>
          ) : (
            <div className="space-y-3">
              {positions.map((pos) => (
                <div key={pos.id} className="border-b border-[#2a2e39] pb-2">
                  <div className="flex justify-between">
                    <span className="font-bold">{pos.symbol}</span>
                    <span className={pos.side === "BUY" ? "text-green-400" : "text-red-400"}>
                      {pos.side}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Qty: {pos.quantity}</span>
                    <span>Entry: ${pos.entryPrice.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Current: ${pos.currentPrice.toLocaleString()}</span>
                    <span className={pos.pnl >= 0 ? "text-green-400" : "text-red-400"}>
                      P&L: ${pos.pnl.toLocaleString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recent Trades */}
      <div className="bg-[#1c2030] rounded-lg p-6">
        <h2 className="text-lg font-semibold mb-4">Recent Trades</h2>
        {tradeHistory.length === 0 ? (
          <p className="text-[#787b86] text-center py-8">No trades yet</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#2a2e39]">
                  <th className="text-left py-2">Time</th>
                  <th className="text-left py-2">Symbol</th>
                  <th className="text-left py-2">Side</th>
                  <th className="text-right py-2">Quantity</th>
                  <th className="text-right py-2">Price</th>
                  <th className="text-right py-2">Total</th>
                </tr>
              </thead>
              <tbody>
                {tradeHistory.slice(0, 10).map((trade) => (
                  <tr key={trade.id} className="border-b border-[#2a2e39]/50">
                    <td className="py-2 text-xs">{new Date(trade.timestamp).toLocaleTimeString()}</td>
                    <td className="py-2">{trade.symbol}</td>
                    <td className="py-2">
                      <span className={`px-2 py-1 rounded text-xs font-bold ${
                        trade.side === "BUY" ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"
                      }`}>
                        {trade.side}
                      </span>
                    </td>
                    <td className="py-2 text-right">{trade.quantity}</td>
                    <td className="py-2 text-right">${trade.price.toLocaleString()}</td>
                    <td className="py-2 text-right">${(trade.quantity * trade.price).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="mt-6 text-xs text-[#787b86]">
        <p>✅ Rate limiting active (1 second between trades)</p>
        <p>✅ Database transactions are atomic (all or nothing)</p>
        <p>✅ Real-time price updates from WebSocket</p>
        <p>✅ Guest mode works without login</p>
      </div>
    </div>
  );
}