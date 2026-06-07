// src/components/OrderPanel.tsx
"use client";

import { useState, useEffect } from "react";
import { useTradingStore } from "@/stores/useTradingStore";
import { useTradeExecution } from "@/hooks/useTradeExecution";
import { useLivePrice } from "@/hooks/useLivePrice";
import { formatCurrency } from "@/utils/format";

export default function OrderPanel() {
  const symbol = useTradingStore((state) => state.symbol);
  const tradeHistory = useTradingStore((state) => state.tradeHistory);
  const balance = useTradingStore((state) => state.balance);
  const positions = useTradingStore((state) => state.positions);
  const updateLivePrices = useTradingStore((state) => state.updateLivePrices);

  const { executeTrade, isExecuting } = useTradeExecution();
  const { livePrice, isConnected } = useLivePrice(symbol, updateLivePrices);

  const [activeTab, setActiveTab] = useState<"BUY" | "SELL">("BUY");
  const [quantity, setQuantity] = useState<string>("0.1");
  const [orderType, setOrderType] = useState<"MARKET" | "LIMIT">("MARKET");
  const [limitPrice, setLimitPrice] = useState<string>("");
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Auto-set limit price when live price changes
  useEffect(() => {
    if (orderType === "LIMIT" && !limitPrice && livePrice) {
      setLimitPrice(livePrice.toFixed(2));
    }
  }, [livePrice, orderType, limitPrice]);

  const handleExecute = async () => {
    const qtyNum = parseFloat(quantity);
    if (qtyNum <= 0 || isNaN(qtyNum)) {
      alert("Please enter a valid quantity!");
      return;
    }

    let executionPrice: number;
    if (orderType === "MARKET") {
      executionPrice = livePrice;
    } else {
      executionPrice = parseFloat(limitPrice);
      if (isNaN(executionPrice) || executionPrice <= 0) {
        alert("Please enter a valid limit price!");
        return;
      }
      // Warn if limit price is far from market
      const priceDiff = Math.abs(executionPrice - livePrice) / livePrice;
      if (priceDiff > 0.1) {
        const confirmed = confirm(
          `⚠️ Warning: Your limit price is ${(priceDiff * 100).toFixed(1)}% away from market price.\n\n` +
            `Market price: ${formatCurrency(livePrice)}\n` +
            `Limit price: ${formatCurrency(executionPrice)}\n\nAre you sure?`
        );
        if (!confirmed) return;
      }
    }

    const totalValue = qtyNum * executionPrice;
    const confirmed = confirm(
      `📊 CONFIRM ${activeTab} ORDER\n\n` +
        `Symbol: ${symbol}\n` +
        `Order Type: ${orderType}\n` +
        `Side: ${activeTab}\n` +
        `Quantity: ${qtyNum} ${symbol.replace("USDT", "")}\n` +
        `${orderType === "MARKET" ? `Market Price: ${formatCurrency(executionPrice)}` : `Limit Price: ${formatCurrency(executionPrice)}`}\n` +
        `Total Value: ${formatCurrency(totalValue)}\n\nClick OK to execute.`
    );

    if (!confirmed) return;

    const success = await executeTrade(activeTab, qtyNum, executionPrice);
    if (success) {
      setQuantity("0.1");
      if (orderType === "LIMIT") setLimitPrice("");
    }
  };

  const currentPosition = positions.find((p) => p.symbol === symbol);
  const availableQty =
    activeTab === "BUY" ? balance.cash / livePrice : currentPosition?.quantity || 0;
  const totalCost =
    (orderType === "MARKET"
      ? parseFloat(quantity) * livePrice
      : parseFloat(quantity) * parseFloat(limitPrice || "0")) || 0;

  const quickAmounts = [0.1, 0.5, 1.0, 2.0, 5.0];
  const filteredHistory = tradeHistory.filter((log) => log.symbol === symbol).slice(0, 5);

  // Price impact calculation
  const priceImpact = (): number => {
    const qty = parseFloat(quantity);
    if (isNaN(qty) || qty <= 0) return 0;
    const percentOfBalance = (qty * livePrice / balance.cash) * 100;
    if (percentOfBalance > 50) return (percentOfBalance / 100) * 0.5;
    return 0;
  };
  const impact = priceImpact();
  const estimatedPrice = activeTab === "BUY" ? livePrice * (1 + impact) : livePrice * (1 - impact);

  if (!isMounted) {
    return (
      <aside className="flex w-80 shrink-0 flex-col border-l border-[#2a2e39] bg-[#131722] select-none">
        <div className="flex items-center justify-center h-full p-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#2962ff]" />
        </div>
      </aside>
    );
  }

  return (
    <aside className="flex w-80 shrink-0 flex-col border-l border-[#2a2e39] bg-[#131722] select-none">
      {/* Tabs */}
      <div className="flex h-12 shrink-0 border-b border-[#2a2e39]">
        <button
          onClick={() => setActiveTab("BUY")}
          className={`flex-1 text-sm font-bold uppercase tracking-wider transition-all ${
            activeTab === "BUY"
              ? "border-b-2 border-[#2962ff] text-[#2962ff] bg-[#2962ff]/5"
              : "text-[#787b86] hover:text-[#d1d4dc] hover:bg-[#1e222d]/50"
          }`}
        >
          Buy
        </button>
        <button
          onClick={() => setActiveTab("SELL")}
          className={`flex-1 text-sm font-bold uppercase tracking-wider transition-all ${
            activeTab === "SELL"
              ? "border-b-2 border-[#ef5350] text-[#ef5350] bg-[#ef5350]/5"
              : "text-[#787b86] hover:text-[#d1d4dc] hover:bg-[#1e222d]/50"
          }`}
        >
          Sell
        </button>
      </div>

      {/* Order Type */}
      <div className="flex gap-2 p-4 border-b border-[#2a2e39] bg-[#1c2030]/30">
        <button
          onClick={() => setOrderType("MARKET")}
          className={`flex-1 py-1.5 text-xs font-semibold rounded transition-all ${
            orderType === "MARKET" ? "bg-[#2962ff] text-white" : "bg-[#1e222d] text-[#787b86] hover:text-white"
          }`}
        >
          MARKET
        </button>
        <button
          onClick={() => setOrderType("LIMIT")}
          className={`flex-1 py-1.5 text-xs font-semibold rounded transition-all ${
            orderType === "LIMIT" ? "bg-[#2962ff] text-white" : "bg-[#1e222d] text-[#787b86] hover:text-white"
          }`}
        >
          LIMIT
        </button>
      </div>

      {/* Form */}
      <div className="p-4 flex flex-col gap-4 border-b border-[#2a2e39]">
        <BalanceInfo
          activeTab={activeTab}
          balance={balance}
          currentPosition={currentPosition}
          symbol={symbol}
          livePrice={livePrice}
          onSetMax={(qty) => setQuantity(qty.toString())}
        />

        {orderType === "LIMIT" && (
          <LimitPriceInput
            limitPrice={limitPrice}
            livePrice={livePrice}
            onChange={setLimitPrice}
          />
        )}

        {orderType === "MARKET" && <MarketPriceDisplay livePrice={livePrice} isConnected={isConnected} />}

        <QuantityInput
          symbol={symbol}
          quantity={quantity}
          availableQty={availableQty}
          quickAmounts={quickAmounts}
          onChange={setQuantity}
          activeTab={activeTab}
          balance={balance}
          livePrice={livePrice}
          currentPosition={currentPosition}
        />

        {impact > 0 && <PriceImpactWarning impact={impact} estimatedPrice={estimatedPrice} />}

        <TotalCost totalCost={totalCost} orderType={orderType} />

        <ExecuteButton
          activeTab={activeTab}
          quantity={quantity}
          availableQty={availableQty}
          orderType={orderType}
          limitPrice={limitPrice}
          isExecuting={isExecuting}
          symbol={symbol}
          onClick={handleExecute}
        />

        <div className="text-[10px] text-center text-[#787b86]">
          Estimated fee: {formatCurrency(totalCost * 0.001)} (0.1%)
        </div>
      </div>

      {/* Recent Trades */}
      <RecentOrders symbol={symbol} filteredHistory={filteredHistory} />
    </aside>
  );
}

// Sub-components
function BalanceInfo({ activeTab, balance, currentPosition, symbol, livePrice, onSetMax }: any) {
  const baseCurrency = symbol.replace("USDT", "");
  const maxBuyQty = Math.floor((balance.cash / livePrice) * 1000) / 1000;

  return (
    <div className="flex justify-between items-center text-xs">
      <span className="text-[#787b86]">
        {activeTab === "BUY" ? "Available USD" : `Available ${baseCurrency}`}
      </span>
      <div className="text-right">
        <span className="font-bold text-[#d1d4dc] tabular-nums">
          {activeTab === "BUY" ? formatCurrency(balance.cash) : `${(currentPosition?.quantity || 0).toFixed(4)} ${baseCurrency}`}
        </span>
        {activeTab === "BUY" && (
          <button onClick={() => onSetMax(maxBuyQty)} className="ml-2 text-[10px] text-[#2962ff] hover:text-[#1e53e5]">
            Max
          </button>
        )}
        {activeTab === "SELL" && currentPosition && (
          <button onClick={() => onSetMax(currentPosition.quantity)} className="ml-2 text-[10px] text-[#ef5350] hover:text-[#e53935]">
            Max
          </button>
        )}
      </div>
    </div>
  );
}

function LimitPriceInput({ limitPrice, livePrice, onChange }: any) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[10px] font-semibold uppercase tracking-wider text-[#787b86]">Limit Price (USD)</label>
      <div className="flex items-center rounded border border-[#2a2e39] bg-[#1e222d] px-3 py-2 focus-within:border-[#2962ff]">
        <span className="text-[#787b86] mr-2">$</span>
        <input
          type="number"
          step="0.01"
          min="0.01"
          value={limitPrice}
          onChange={(e) => onChange(e.target.value)}
          placeholder={livePrice.toFixed(2)}
          className="w-full bg-transparent text-sm font-bold text-white outline-none"
        />
      </div>
      <div className="text-[10px] text-[#787b86]">Market price: ${livePrice.toLocaleString()}</div>
    </div>
  );
}

function MarketPriceDisplay({ livePrice, isConnected }: any) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[10px] font-semibold uppercase tracking-wider text-[#787b86]">Market Price (USD)</label>
      <div className="rounded border border-[#2a2e39] bg-[#1e222d] px-3 py-2.5 text-sm font-bold text-[#b2b5be] tabular-nums">
        ${livePrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        <span className="ml-2 text-[10px] font-normal text-[#787b86]">
          {isConnected ? "(Real-time)" : "(Connecting...)"}
        </span>
      </div>
    </div>
  );
}

function QuantityInput({ symbol, quantity, availableQty, quickAmounts, onChange, activeTab, balance, livePrice, currentPosition }: any) {
  const baseCurrency = symbol.replace("USDT", "");
  const maxAllowed = activeTab === "BUY" ? balance.cash / livePrice : currentPosition?.quantity || 0;

  return (
    <div className="flex flex-col gap-1">
      <label className="text-[10px] font-semibold uppercase tracking-wider text-[#787b86]">
        Quantity ({baseCurrency})
      </label>
      <div className="flex items-center rounded border border-[#2a2e39] bg-[#1e222d] px-3 py-2 focus-within:border-[#2962ff]">
        <input
          type="number"
          step="0.01"
          min="0.0001"
          max={availableQty}
          value={quantity}
          onChange={(e) => onChange(e.target.value)}
          className="w-full bg-transparent text-sm font-bold text-white outline-none"
        />
        <span className="text-xs font-bold text-[#787b86]">{baseCurrency}</span>
      </div>
      <div className="flex gap-2 mt-2">
        {quickAmounts.map((amt) => (
          <button
            key={amt}
            onClick={() => {
              const newQty = Math.min(amt, maxAllowed);
              if (newQty > 0) onChange(newQty.toFixed(4));
            }}
            className="flex-1 text-[10px] py-1 rounded bg-[#1e222d] text-[#787b86] hover:bg-[#2a2e39] hover:text-white"
          >
            {amt}
          </button>
        ))}
      </div>
    </div>
  );
}

function PriceImpactWarning({ impact, estimatedPrice }: any) {
  return (
    <div className="bg-yellow-500/10 border border-yellow-500/30 rounded p-2 text-xs">
      <div className="text-yellow-500 font-semibold mb-1">⚠️ Price Impact Warning</div>
      <div className="text-[#787b86] text-[10px]">
        Estimated execution price: ${estimatedPrice.toFixed(2)}
        <br />
        Impact: {(impact * 100).toFixed(2)}% slippage expected.
      </div>
    </div>
  );
}

function TotalCost({ totalCost, orderType }: any) {
  return (
    <div className="flex justify-between items-center text-sm border-t border-[#2a2e39]/50 pt-3">
      <span className="text-[#787b86] font-medium">Total:</span>
      <div className="text-right">
        <span className="font-bold text-white tabular-nums text-base">{formatCurrency(totalCost)}</span>
        {orderType === "LIMIT" && <div className="text-[10px] text-[#787b86]">+ fees (0.1%)</div>}
      </div>
    </div>
  );
}

function ExecuteButton({ activeTab, quantity, availableQty, orderType, limitPrice, isExecuting, symbol, onClick }: any) {
  const disabled =
    parseFloat(quantity) <= 0 ||
    isNaN(parseFloat(quantity)) ||
    parseFloat(quantity) > availableQty ||
    (orderType === "LIMIT" && (!limitPrice || parseFloat(limitPrice) <= 0)) ||
    isExecuting;

  const baseCurrency = symbol.replace("USDT", "");

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`w-full rounded-lg py-3 text-sm font-bold uppercase tracking-wide text-white transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg ${
        activeTab === "BUY" ? "bg-[#2962ff] hover:bg-[#1e53e5] shadow-[#2962ff]/20" : "bg-[#ef5350] hover:bg-[#e53935] shadow-[#ef5350]/20"
      }`}
    >
      {isExecuting ? "Processing..." : `${activeTab} ${baseCurrency}${orderType === "LIMIT" ? " @ Limit" : ""}`}
    </button>
  );
}

function RecentOrders({ symbol, filteredHistory }: any) {
  const baseCurrency = symbol.replace("USDT", "");

  return (
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
            {filteredHistory.map((log: any, idx: number) => (
              <div
                key={`${log.id}-${idx}`}
                className="flex flex-col gap-1 rounded-lg bg-[#1e222d]/50 p-3 text-xs border border-[#2a2e39]/50 hover:bg-[#1e222d] transition-all"
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
                  <span>
                    Qty: {log.quantity} {baseCurrency}
                  </span>
                  <span>@{formatCurrency(log.price)}</span>
                </div>
                <div className="flex justify-between text-[10px]">
                  <span className="text-[#787b86]">Total</span>
                  <span className="text-white font-medium">{formatCurrency(log.quantity * log.price)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
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
    </div>
  );
}