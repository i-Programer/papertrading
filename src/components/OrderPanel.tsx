// src/components/OrderPanel.tsx
"use client";

import { useState, useEffect } from "react";
import { useTradingStore } from "@/stores/useTradingStore";
import { formatCurrency } from "@/utils/format";
import { wsManager, type TickerMessage } from "@/lib/websocket-manager";

export default function OrderPanel() {
  const symbol = useTradingStore((state) => state.symbol);
  const tradeHistory = useTradingStore((state) => state.tradeHistory);
  const balance = useTradingStore((state) => state.balance);
  const executeTradeWithDB = useTradingStore((state) => state.executeTradeWithDB);
  const positions = useTradingStore((state) => state.positions);
  const updateLivePrices = useTradingStore((state) => state.updateLivePrices);
  
  // Local state
  const [activeTab, setActiveTab] = useState<"BUY" | "SELL">("BUY");
  const [quantity, setQuantity] = useState<string>("0.1");
  const [livePrice, setLivePrice] = useState<number>(67000);
  const [isMounted, setIsMounted] = useState(false);
  const [orderType, setOrderType] = useState<"MARKET" | "LIMIT">("MARKET");
  const [limitPrice, setLimitPrice] = useState<string>("");

  // Handle hydration
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Subscribe to WebSocket for real-time price updates
  useEffect(() => {
    if (!isMounted) return;

    // Subscribe to ticker updates
    const unsubscribe = wsManager.subscribe("ticker", (data: TickerMessage) => {
      if (data.product_id === symbol && data.price) {
        const price = parseFloat(data.price);
        setLivePrice(price);
        updateLivePrices(price);
        
        // Update limit price default if not set
        if (orderType === "LIMIT" && !limitPrice) {
          setLimitPrice(price.toFixed(2));
        }
      }
    });

    // Ensure WebSocket is connected to current symbol
    wsManager.connect(symbol);

    return () => unsubscribe();
  }, [symbol, isMounted, orderType, limitPrice, updateLivePrices]);

  const handleExecute = async () => {
    const qtyNum = parseFloat(quantity);
    if (qtyNum <= 0 || isNaN(qtyNum)) {
      alert("Please enter a valid quantity!");
      return;
    }

    // Get the actual execution price based on order type
    let executionPrice: number;
    let priceDisplay: string;
    
    if (orderType === "MARKET") {
      executionPrice = livePrice;
      priceDisplay = `Market Price: ${formatCurrency(executionPrice)}`;
    } else {
      executionPrice = parseFloat(limitPrice);
      if (isNaN(executionPrice) || executionPrice <= 0) {
        alert("Please enter a valid limit price!");
        return;
      }
      priceDisplay = `Limit Price: ${formatCurrency(executionPrice)}`;
      
      // For limit orders, check if price is realistic
      const priceDiff = Math.abs(executionPrice - livePrice) / livePrice;
      if (priceDiff > 0.1) {
        // More than 10% away from market price
        const confirmed = confirm(
          `⚠️ Warning: Your limit price is ${(priceDiff * 100).toFixed(1)}% away from market price.\n\n` +
          `Market price: ${formatCurrency(livePrice)}\n` +
          `Limit price: ${formatCurrency(executionPrice)}\n\n` +
          `Are you sure you want to place this order?`
        );
        if (!confirmed) return;
      }
    }

    const totalValue = qtyNum * executionPrice;
    
    // Enhanced confirmation dialog
    const confirmation = confirm(
      `📊 CONFIRM ${activeTab} ORDER\n\n` +
      `Symbol: ${symbol}\n` +
      `Order Type: ${orderType}\n` +
      `Side: ${activeTab}\n` +
      `Quantity: ${qtyNum} ${symbol.split('-')[0]}\n` +
      `${priceDisplay}\n` +
      `Total Value: ${formatCurrency(totalValue)}\n\n` +
      `Click OK to execute this trade.`
    );
    
    if (!confirmation) return;

    const success = await executeTradeWithDB(activeTab, qtyNum, executionPrice);
    if (success) {
      setQuantity("0.1");
      if (orderType === "LIMIT") {
        setLimitPrice("");
      }
    }
  };

  // Filter history log for current symbol
  const filteredHistory = tradeHistory.filter((log) => log.symbol === symbol).slice(0, 5);
  const totalCost = (orderType === "MARKET" ? parseFloat(quantity) * livePrice : parseFloat(quantity) * parseFloat(limitPrice || "0")) || 0;
  const currentPosition = positions.find((p) => p.symbol === symbol);
  const availableQty = activeTab === "BUY" 
    ? balance.cash / livePrice 
    : (currentPosition?.quantity || 0);

  // Quick amount buttons
  const quickAmounts = [0.1, 0.5, 1.0, 2.0, 5.0];

  // Calculate price impact for large orders
  const priceImpact = (): number => {
    const qty = parseFloat(quantity);
    if (isNaN(qty) || qty <= 0) return 0;
    const totalValue = qty * livePrice;
    const percentOfBalance = (totalValue / balance.cash) * 100;
    if (percentOfBalance > 50) return (percentOfBalance / 100) * 0.5; // Simulate 0.5% slippage for large orders
    return 0;
  };

  const impact = priceImpact();
  const estimatedPrice = activeTab === "BUY" ? livePrice * (1 + impact) : livePrice * (1 - impact);

  // Don't render until mounted to avoid hydration mismatch
  if (!isMounted) {
    return (
      <aside className="flex w-80 shrink-0 flex-col border-l border-[#2a2e39] bg-[#131722] select-none">
        <div className="flex items-center justify-center h-full p-8">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#2962ff] mx-auto mb-2"></div>
            <p className="text-xs text-[#787b86]">Loading order panel...</p>
          </div>
        </div>
      </aside>
    );
  }

  return (
    <aside className="flex w-80 shrink-0 flex-col border-l border-[#2a2e39] bg-[#131722] select-none">
      
      {/* TAB BUY / SELL */}
      <div className="flex h-12 shrink-0 border-b border-[#2a2e39]">
        <button
          onClick={() => setActiveTab("BUY")}
          className={`flex-1 text-sm font-bold uppercase tracking-wider transition-all duration-200 ${
            activeTab === "BUY"
              ? "border-b-2 border-[#2962ff] text-[#2962ff] bg-[#2962ff]/5"
              : "text-[#787b86] hover:text-[#d1d4dc] hover:bg-[#1e222d]/50"
          }`}
        >
          Buy
        </button>
        <button
          onClick={() => setActiveTab("SELL")}
          className={`flex-1 text-sm font-bold uppercase tracking-wider transition-all duration-200 ${
            activeTab === "SELL"
              ? "border-b-2 border-[#ef5350] text-[#ef5350] bg-[#ef5350]/5"
              : "text-[#787b86] hover:text-[#d1d4dc] hover:bg-[#1e222d]/50"
          }`}
        >
          Sell
        </button>
      </div>

      {/* ORDER TYPE SELECTOR */}
      <div className="flex gap-2 p-4 border-b border-[#2a2e39] bg-[#1c2030]/30">
        <button
          onClick={() => setOrderType("MARKET")}
          className={`flex-1 py-1.5 text-xs font-semibold rounded transition-all ${
            orderType === "MARKET"
              ? "bg-[#2962ff] text-white"
              : "bg-[#1e222d] text-[#787b86] hover:text-white"
          }`}
        >
          MARKET
        </button>
        <button
          onClick={() => setOrderType("LIMIT")}
          className={`flex-1 py-1.5 text-xs font-semibold rounded transition-all ${
            orderType === "LIMIT"
              ? "bg-[#2962ff] text-white"
              : "bg-[#1e222d] text-[#787b86] hover:text-white"
          }`}
        >
          LIMIT
        </button>
      </div>

      {/* FORM ORDER */}
      <div className="p-4 flex flex-col gap-4 border-b border-[#2a2e39]">
        {/* Info Balance */}
        <div className="flex justify-between items-center text-xs">
          <span className="text-[#787b86]">
            {activeTab === "BUY" ? "Available USD" : `Available ${symbol.split("-")[0]}`}
          </span>
          <div className="text-right">
            <span className="font-bold text-[#d1d4dc] tabular-nums">
              {activeTab === "BUY" 
                ? formatCurrency(balance.cash)
                : `${(currentPosition?.quantity || 0).toFixed(4)} ${symbol.split("-")[0]}`
              }
            </span>
            {activeTab === "BUY" && (
              <button
                onClick={() => {
                  const maxQty = Math.floor((balance.cash / livePrice) * 1000) / 1000;
                  setQuantity(maxQty.toString());
                }}
                className="ml-2 text-[10px] text-[#2962ff] hover:text-[#1e53e5] transition-colors"
              >
                Max
              </button>
            )}
            {activeTab === "SELL" && currentPosition && (
              <button
                onClick={() => setQuantity(currentPosition.quantity.toString())}
                className="ml-2 text-[10px] text-[#ef5350] hover:text-[#e53935] transition-colors"
              >
                Max
              </button>
            )}
          </div>
        </div>

        {/* Price Input (for Limit Orders) */}
        {orderType === "LIMIT" && (
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-semibold uppercase tracking-wider text-[#787b86]">
              Limit Price (USD)
            </label>
            <div className="flex items-center rounded border border-[#2a2e39] bg-[#1e222d] px-3 py-2 focus-within:border-[#2962ff] transition-colors">
              <span className="text-[#787b86] mr-2">$</span>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={limitPrice}
                onChange={(e) => setLimitPrice(e.target.value)}
                placeholder={livePrice.toFixed(2)}
                className="w-full bg-transparent text-sm font-bold text-white outline-none"
              />
            </div>
            <div className="text-[10px] text-[#787b86]">
              Market price: ${livePrice.toLocaleString()}
            </div>
          </div>
        )}

        {/* Market Price Display */}
        {orderType === "MARKET" && (
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-semibold uppercase tracking-wider text-[#787b86]">
              Market Price (USD)
            </label>
            <div className="rounded border border-[#2a2e39] bg-[#1e222d] px-3 py-2.5 text-sm font-bold text-[#b2b5be] tabular-nums">
              ${livePrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              <span className="ml-2 text-[10px] font-normal text-[#787b86]">(Real-time)</span>
            </div>
          </div>
        )}

        {/* Quantity Input */}
        <div className="flex flex-col gap-1">
          <label htmlFor="order-qty" className="text-[10px] font-semibold uppercase tracking-wider text-[#787b86]">
            Quantity ({symbol.split("-")[0]})
          </label>
          <div className="flex items-center rounded border border-[#2a2e39] bg-[#1e222d] px-3 py-2 focus-within:border-[#2962ff] transition-colors">
            <input
              id="order-qty"
              type="number"
              step="0.01"
              min="0.0001"
              max={availableQty}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="w-full bg-transparent text-sm font-bold text-white outline-none"
              placeholder="0.0"
            />
            <span className="text-xs font-bold text-[#787b86]">{symbol.split("-")[0]}</span>
          </div>
          
          {/* Quick amount buttons */}
          <div className="flex gap-2 mt-2">
            {quickAmounts.map(amt => (
              <button
                key={amt}
                onClick={() => {
                  const maxAllowed = activeTab === "BUY" ? balance.cash / livePrice : (currentPosition?.quantity || 0);
                  const newQty = Math.min(amt, maxAllowed);
                  if (newQty > 0) setQuantity(newQty.toFixed(4));
                }}
                className="flex-1 text-[10px] py-1 rounded bg-[#1e222d] text-[#787b86] hover:bg-[#2a2e39] hover:text-white transition-colors"
              >
                {amt}
              </button>
            ))}
          </div>
        </div>

        {/* Price Impact Warning for large orders */}
        {impact > 0 && (
          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded p-2 text-xs">
            <div className="text-yellow-500 font-semibold mb-1">⚠️ Price Impact Warning</div>
            <div className="text-[#787b86] text-[10px]">
              Large order detected. Estimated execution price: ${estimatedPrice.toFixed(2)}
              <br />
              Impact: {(impact * 100).toFixed(2)}% slippage expected.
            </div>
          </div>
        )}

        {/* Total Estimasi */}
        <div className="flex justify-between items-center text-sm border-t border-[#2a2e39]/50 pt-3">
          <span className="text-[#787b86] font-medium">Total:</span>
          <div className="text-right">
            <span className="font-bold text-white tabular-nums text-base">
              {formatCurrency(totalCost)}
            </span>
            {orderType === "LIMIT" && (
              <div className="text-[10px] text-[#787b86]">
                + fees (0.1%)
              </div>
            )}
          </div>
        </div>

        {/* Execute Button */}
        <button
          onClick={handleExecute}
          disabled={
            parseFloat(quantity) <= 0 || 
            isNaN(parseFloat(quantity)) || 
            parseFloat(quantity) > availableQty ||
            (orderType === "LIMIT" && (!limitPrice || parseFloat(limitPrice) <= 0))
          }
          className={`w-full rounded-lg py-3 text-sm font-bold uppercase tracking-wide text-white transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 shadow-lg ${
            activeTab === "BUY" 
              ? "bg-[#2962ff] hover:bg-[#1e53e5] shadow-[#2962ff]/20" 
              : "bg-[#ef5350] hover:bg-[#e53935] shadow-[#ef5350]/20"
          }`}
        >
          {activeTab} {symbol.split("-")[0]}
          {orderType === "LIMIT" && " @ Limit"}
        </button>

        {/* Estimated Fee */}
        <div className="text-[10px] text-center text-[#787b86]">
          Estimated fee: {formatCurrency(totalCost * 0.001)} (0.1%)
        </div>
      </div>

      {/* RECENT TRADES */}
      <div className="flex flex-1 flex-col min-h-0">
        <div className="px-4 py-3 border-b border-[#2a2e39]/50 bg-[#1c2030]/20">
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-[#787b86]">
            Recent {symbol} Orders
          </h3>
        </div>
        <div className="flex-1 overflow-y-auto px-3 pb-3 custom-scrollbar">
          {filteredHistory.length === 0 ? (
            <div className="text-center py-8 text-xs text-[#434651]">
              No recent orders for this pair.
              <br />
              <span className="text-[10px]">Start trading above!</span>
            </div>
          ) : (
            <div className="space-y-2 mt-2">
              {filteredHistory.map((log, index) => (
                <div 
                  key={`${log.id}-${index}`} 
                  className="flex flex-col gap-1 rounded-lg bg-[#1e222d]/50 p-3 text-xs border border-[#2a2e39]/50 hover:bg-[#1e222d] transition-all hover:scale-[1.02] cursor-pointer"
                >
                  <div className="flex justify-between items-center">
                    <span className={`font-bold text-sm ${log.side === "BUY" ? "text-[#26a69a]" : "text-[#ef5350]"}`}>
                      {log.side}
                    </span>
                    <span className="text-[#787b86] text-[10px] tabular-nums">
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  <div className="flex justify-between text-[#b2b5be] tabular-nums">
                    <span>Qty: {log.quantity} {symbol.split("-")[0]}</span>
                    <span>@{formatCurrency(log.price)}</span>
                  </div>
                  <div className="flex justify-between text-[10px]">
                    <span className="text-[#787b86]">Total</span>
                    <span className="text-white font-medium">
                      {formatCurrency(log.quantity * log.price)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #1e222d;
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #2a2e39;
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #2962ff;
        }
      `}</style>
    </aside>
  );
}