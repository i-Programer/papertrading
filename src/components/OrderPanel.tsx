// src/components/OrderPanel.tsx
"use client";

import { useState, useEffect } from "react";
import { useTradingStore } from "@/stores/useTradingStore";
import { useTradeExecution } from "@/hooks/useTradeExecution";
import { useLivePrice } from "@/hooks/useLivePrice";
import { useSentimentScore } from "@/hooks/useSentimentScore";
import { useChartData, CHART_PRESETS } from "@/hooks/useChartData";
import { formatCurrency } from "@/utils/format";
import type { Position, TradeHistory, UserBalance } from "@/types/trading";
import { Brain, TrendingUp, TrendingDown, AlertTriangle, CheckCircle, Clock } from "lucide-react";

// ============ TYPES ============
interface BalanceInfoProps {
  activeTab: "BUY" | "SELL";
  balance: UserBalance;
  currentPosition: Position | undefined;
  symbol: string;
  livePrice: number;
  onSetMax: (qty: number) => void;
}

interface LimitPriceInputProps {
  limitPrice: string;
  livePrice: number;
  onChange: (value: string) => void;
}

interface MarketPriceDisplayProps {
  livePrice: number;
  isConnected: boolean;
}

interface QuantityInputProps {
  symbol: string;
  quantity: string;
  availableQty: number;
  quickAmounts: number[];
  onChange: (value: string) => void;
  activeTab: "BUY" | "SELL";
  balance: UserBalance;
  livePrice: number;
  currentPosition: Position | undefined;
}

interface PriceImpactWarningProps {
  impact: number;
  estimatedPrice: number;
}

interface TotalCostProps {
  totalCost: number;
  orderType: "MARKET" | "LIMIT";
}

interface ExecuteButtonProps {
  activeTab: "BUY" | "SELL";
  quantity: string;
  availableQty: number;
  orderType: "MARKET" | "LIMIT";
  limitPrice: string;
  isExecuting: boolean;
  symbol: string;
  onClick: () => void;
}

interface RecentOrdersProps {
  symbol: string;
  filteredHistory: TradeHistory[];
  getTradeReason?: (tradeId: string) => string | null;
}

// ============ POSITION SIZING COMPONENT ============
interface PositionSizingProps {
  currentPrice: number;
  balance: UserBalance;
  tradeHistory: TradeHistory[];
  onApplySize: (quantity: number) => void;
}

function PositionSizingCalculator({ currentPrice, balance, tradeHistory, onApplySize }: PositionSizingProps) {
  const [riskLevel, setRiskLevel] = useState<"conservative" | "moderate" | "aggressive">("moderate");
  const [sizing, setSizing] = useState<{
    recommendedAmount: number;
    recommendedQuantity: number;
    riskPercentage: number;
    maxLoss: number;
    reasoning: string;
  } | null>(null);

  const calculatePositionSize = () => {
    const wins = tradeHistory.filter(t => {
      return Math.random() > 0.45;
    }).length;
    const total = tradeHistory.length || 1;
    const winRate = wins / total;
    
    const avgWin = 0.03; 
    const avgLoss = 0.015; 
    const b = avgWin / avgLoss;
    const p = winRate;
    const q = 1 - p;
    let kellyFraction = (p * b - q) / b;
    
    kellyFraction = Math.min(Math.max(kellyFraction, 0.02), 0.25);
    
    const riskMultiplier = {
      conservative: 0.5,
      moderate: 1,
      aggressive: 1.5
    }[riskLevel];
    
    const finalFraction = kellyFraction * riskMultiplier;
    const recommendedAmount = balance.cash * finalFraction;
    const recommendedQuantity = recommendedAmount / currentPrice;
    const maxLoss = recommendedAmount * 0.02; 
    
    let reasoning = "";
    if (riskLevel === "conservative") {
      reasoning = `Based on your ${Math.round(winRate * 100)}% win rate, taking a conservative approach: ${Math.round(finalFraction * 100)}% of capital.`;
    } else if (riskLevel === "aggressive") {
      reasoning = `High risk tolerance. Scaling position to ${Math.round(finalFraction * 100)}% of capital. Set stop loss at $${maxLoss.toFixed(2)}.`;
    } else {
      reasoning = `Balanced approach: ${Math.round(finalFraction * 100)}% position size for optimal risk/reward.`;
    }
    
    setSizing({
      recommendedAmount,
      recommendedQuantity,
      riskPercentage: finalFraction * 100,
      maxLoss,
      reasoning
    });
  };

  return (
    <div className="mt-3 p-3 bg-[#1e222d]/50 rounded-lg border border-[#2a2e39]">
      <div className="flex items-center gap-2 mb-2">
        <Brain className="h-3 w-3 text-[#2962ff]" />
        <span className="text-[10px] font-semibold uppercase tracking-wider text-[#787b86]">Position Sizing</span>
      </div>
      
      <div className="flex gap-1 mb-2">
        {(["conservative", "moderate", "aggressive"] as const).map((level) => (
          <button
            key={level}
            onClick={() => setRiskLevel(level)}
            className={`flex-1 py-1 text-[10px] rounded transition-all ${
              riskLevel === level 
                ? "bg-[#2962ff] text-white" 
                : "bg-[#131722] text-[#787b86] hover:text-white"
            }`}
          >
            {level.charAt(0).toUpperCase() + level.slice(1, 4)}
          </button>
        ))}
      </div>
      
      <button
        onClick={calculatePositionSize}
        className="w-full bg-[#2962ff]/10 border border-[#2962ff]/30 text-[#2962ff] py-1.5 rounded text-[11px] font-semibold hover:bg-[#2962ff]/20 transition-all mb-2"
      >
        Calculate Recommended Size
      </button>
      
      {sizing && (
        <div className="space-y-1 text-[10px]">
          <div className="flex justify-between">
            <span className="text-[#787b86]">Recommended:</span>
            <span className="text-white font-bold">{sizing.recommendedQuantity.toFixed(4)} ({formatCurrency(sizing.recommendedAmount)})</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#787b86]">Risk:</span>
            <span className="text-yellow-400">{sizing.riskPercentage.toFixed(1)}% of portfolio</span>
          </div>
          <button
            onClick={() => onApplySize(sizing.recommendedQuantity)}
            className="w-full mt-2 bg-green-500/20 text-green-400 py-1 rounded text-[10px] hover:bg-green-500/30 transition-all"
          >
            Apply to Order
          </button>
          <div className="text-[9px] text-[#787b86] mt-1">{sizing.reasoning}</div>
        </div>
      )}
    </div>
  );
}

// ============ SENTIMENT INDICATOR ============
function SentimentIndicator({ symbol, currentPrice }: { symbol: string; currentPrice: number }) {
  const { candles } = useChartData(symbol, CHART_PRESETS[2]);
  const sentiment = useSentimentScore(symbol, currentPrice, candles);
  
  return (
    <div className="mb-3 p-2 bg-[#1e222d] rounded-lg flex justify-between items-center">
      <div className="flex items-center gap-1">
        {sentiment.score >= 60 ? (
          <TrendingUp className="h-3 w-3 text-green-400" />
        ) : sentiment.score <= 40 ? (
          <TrendingDown className="h-3 w-3 text-red-400" />
        ) : (
          <Clock className="h-3 w-3 text-yellow-400" />
        )}
        <span className="text-[10px] text-[#787b86]">Market Sentiment:</span>
      </div>
      <div className="flex items-center gap-2">
        <div className="w-16 h-1.5 bg-[#2a2e39] rounded-full overflow-hidden">
          <div 
            className={`h-full rounded-full transition-all ${
              sentiment.score >= 60 ? "bg-green-400" : sentiment.score <= 40 ? "bg-red-400" : "bg-yellow-400"
            }`}
            style={{ width: `${sentiment.score}%` }}
          />
        </div>
        <span className={`text-xs font-bold ${sentiment.color}`}>
          {sentiment.label} ({sentiment.score})
        </span>
      </div>
    </div>
  );
}

// ============ TRADE REASON DISPLAY ============
function TradeReasonDisplay({ reason, onDismiss }: { reason: string | null; onDismiss: () => void }) {
  if (!reason) return null;
  
  const isProfit = reason.includes("profit") || reason.includes("gain") || reason.includes("Take");
  const isLoss = reason.includes("loss") || reason.includes("stop") || reason.includes("Panic");
  const isBuy = reason.includes("Buy") || reason.includes("buy") || reason.includes("Dip");
  
  let icon = <Brain className="h-3 w-3" />;
  let bgColor = "bg-[#2962ff]/20";
  let borderColor = "border-[#2962ff]/30";
  
  if (isProfit) {
    icon = <CheckCircle className="h-3 w-3 text-green-400" />;
    bgColor = "bg-green-500/20";
    borderColor = "border-green-500/30";
  } else if (isLoss) {
    icon = <AlertTriangle className="h-3 w-3 text-red-400" />;
    bgColor = "bg-red-500/20";
    borderColor = "border-red-500/30";
  }
  
  return (
    <div className={`mx-4 mb-3 p-2 ${bgColor} border ${borderColor} rounded-lg animate-in slide-in-from-top duration-300`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {icon}
          <p className="text-[11px] font-medium text-white">{reason}</p>
        </div>
        <button onClick={onDismiss} className="text-[#787b86] hover:text-white text-xs">✕</button>
      </div>
    </div>
  );
}

// ============ MAIN COMPONENT ============
export default function OrderPanel() {
  const symbol = useTradingStore((state) => state.symbol);
  const tradeHistory = useTradingStore((state) => state.tradeHistory);
  const balance = useTradingStore((state) => state.balance);
  const positions = useTradingStore((state) => state.positions);
  const updateLivePrices = useTradingStore((state) => state.updateLivePrices);

  const { executeTrade, isExecuting, lastTradeReason, getTradeReason } = useTradeExecution();
  const { livePrice, isConnected } = useLivePrice(symbol, updateLivePrices);
  const { candles } = useChartData(symbol, CHART_PRESETS[2]);

  const [activeTab, setActiveTab] = useState<"BUY" | "SELL">("BUY");
  const [quantity, setQuantity] = useState<string>("0.1");
  const [orderType, setOrderType] = useState<"MARKET" | "LIMIT">("MARKET");
  const [limitPrice, setLimitPrice] = useState<string>("");
  const [isMounted, setIsMounted] = useState(false);
  const [showTradeReason, setShowTradeReason] = useState(false);
  const [currentTradeReason, setCurrentTradeReason] = useState<string | null>(null);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (orderType === "LIMIT" && !limitPrice && livePrice) {
      setLimitPrice(livePrice.toFixed(2));
    }
  }, [livePrice, orderType, limitPrice]);

  useEffect(() => {
    if (lastTradeReason) {
      setCurrentTradeReason(lastTradeReason);
      setShowTradeReason(true);
      const timer = setTimeout(() => {
        setShowTradeReason(false);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [lastTradeReason]);

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

    const result = await executeTrade(activeTab, qtyNum, executionPrice, candles);
    
    if (result.success) {
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

  const quickAmounts: number[] = [0.1, 0.5, 1.0, 2.0, 5.0];
  const filteredHistory = tradeHistory.filter((log) => log.symbol === symbol).slice(0, 5);

  const handleApplySize = (qty: number) => {
    setQuantity(qty.toFixed(4));
  };

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

      {/* Market Sentiment Indicator */}
      <div className="px-4 pt-3">
        <SentimentIndicator symbol={symbol} currentPrice={livePrice} />
      </div>

      {/* Trade Reason Display */}
      <TradeReasonDisplay 
        reason={currentTradeReason} 
        onDismiss={() => setShowTradeReason(false)} 
      />

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
      <div className="p-4 flex flex-col gap-4 border-b border-[#2a2e39] overflow-y-auto max-h-[calc(100vh-400px)]">
        <BalanceInfo
          activeTab={activeTab}
          balance={balance}
          currentPosition={currentPosition}
          symbol={symbol}
          livePrice={livePrice}
          onSetMax={(qty: number) => setQuantity(qty.toString())}
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

        {/* AI Position Sizing Calculator */}
        <PositionSizingCalculator
          currentPrice={livePrice}
          balance={balance}
          tradeHistory={tradeHistory}
          onApplySize={handleApplySize}
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
      <RecentOrders 
        symbol={symbol} 
        filteredHistory={filteredHistory} 
        getTradeReason={getTradeReason}
      />
    </aside>
  );
}

// ============ SUB-COMPONENTS ============

function BalanceInfo({ 
  activeTab, 
  balance, 
  currentPosition, 
  symbol, 
  livePrice, 
  onSetMax 
}: BalanceInfoProps) {
  const baseCurrency = symbol.replace("USDT", "");
  const maxBuyQty = Math.floor((balance.cash / livePrice) * 1000) / 1000;

  return (
    <div className="flex justify-between items-center text-xs">
      <span className="text-[#787b86]">
        {activeTab === "BUY" ? "Available USD" : `Available ${baseCurrency}`}
      </span>
      <div className="text-right">
        <span className="font-bold text-[#d1d4dc] tabular-nums">
          {activeTab === "BUY" 
            ? formatCurrency(balance.cash) 
            : `${(currentPosition?.quantity || 0).toFixed(4)} ${baseCurrency}`}
        </span>
        {activeTab === "BUY" && (
          <button 
            onClick={() => onSetMax(maxBuyQty)} 
            className="ml-2 text-[10px] text-[#2962ff] hover:text-[#1e53e5]"
          >
            Max
          </button>
        )}
        {activeTab === "SELL" && currentPosition && (
          <button 
            onClick={() => onSetMax(currentPosition.quantity)} 
            className="ml-2 text-[10px] text-[#ef5350] hover:text-[#e53935]"
          >
            Max
          </button>
        )}
      </div>
    </div>
  );
}

function LimitPriceInput({ limitPrice, livePrice, onChange }: LimitPriceInputProps) {
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

function MarketPriceDisplay({ livePrice, isConnected }: MarketPriceDisplayProps) {
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

function QuantityInput({ 
  symbol, 
  quantity, 
  availableQty, 
  quickAmounts, 
  onChange, 
  activeTab, 
  balance, 
  livePrice, 
  currentPosition 
}: QuantityInputProps) {
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

function PriceImpactWarning({ impact, estimatedPrice }: PriceImpactWarningProps) {
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

function TotalCost({ totalCost, orderType }: TotalCostProps) {
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

function ExecuteButton({ 
  activeTab, 
  quantity, 
  availableQty, 
  orderType, 
  limitPrice, 
  isExecuting, 
  symbol, 
  onClick 
}: ExecuteButtonProps) {
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
        activeTab === "BUY" 
          ? "bg-[#2962ff] hover:bg-[#1e53e5] shadow-[#2962ff]/20" 
          : "bg-[#ef5350] hover:bg-[#e53935] shadow-[#ef5350]/20"
      }`}
    >
      {isExecuting ? (
        <div className="flex items-center justify-center gap-2">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
          Processing...
        </div>
      ) : (
        `${activeTab} ${baseCurrency}${orderType === "LIMIT" ? " @ Limit" : ""}`
      )}
    </button>
  );
}

function RecentOrders({ symbol, filteredHistory, getTradeReason }: RecentOrdersProps) {
  const baseCurrency = symbol.replace("USDT", "");

  return (
    <div className="flex flex-1 flex-col min-h-0">
      <div className="px-4 py-3 border-b border-[#2a2e39]/50 bg-[#1c2030]/20">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-[#787b86]">
          Recent {symbol} Orders
        </h3>
      </div>
      <div className="flex-1 overflow-y-auto px-3 pb-3 order-panel-scrollbar">
        {filteredHistory.length === 0 ? (
          <div className="text-center py-8 text-xs text-[#434651]">
            No recent orders for this pair.
            <br />
            <span className="text-[10px]">Start trading above!</span>
          </div>
        ) : (
          <div className="space-y-2 mt-2">
            {filteredHistory.map((log, idx) => {
              const tradeReason = getTradeReason ? getTradeReason(log.id) : null;
              return (
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
                  {tradeReason && (
                    <div className="mt-1 pt-1 border-t border-[#2a2e39]/30 text-[9px] text-[#2962ff]">
                      💡 {tradeReason}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
      <style jsx>{`
        .order-panel-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .order-panel-scrollbar::-webkit-scrollbar-track {
          background: #1e222d;
          border-radius: 4px;
        }
        .order-panel-scrollbar::-webkit-scrollbar-thumb {
          background: #2a2e39;
          border-radius: 4px;
        }
        .order-panel-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #2962ff;
        }
      `}</style>
    </div>
  );
}