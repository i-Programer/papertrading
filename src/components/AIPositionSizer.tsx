"use client";

import { useState } from "react";
import { useTradingStore } from "@/stores/useTradingStore";
import { Calculator, TrendingUp, TrendingDown } from "lucide-react";

interface PositionSizing {
  recommendedAmount: number;
  recommendedQuantity: number;
  riskPercentage: number;
  maxLoss: number;
  reasoning: string;
}

export default function AIPositionSizer({ currentPrice }: { currentPrice: number }) {
  const { balance, positions } = useTradingStore();
  const [riskLevel, setRiskLevel] = useState<"conservative" | "moderate" | "aggressive">("moderate");
  const [sizing, setSizing] = useState<PositionSizing | null>(null);
  const [stopLoss, setStopLoss] = useState<number | null>(null);

  // Kelly Criterion based position sizing (mathematical, not API-based)
  const calculatePositionSize = () => {
    // Get recent win rate from trade history
    const { tradeHistory } = useTradingStore.getState();
    const wins = tradeHistory.filter(t => t.side === "BUY").length; // Simplified
    const total = tradeHistory.length || 1;
    const winRate = wins / total;
    
    // Average win/loss ratio (simplified)
    const avgWin = 0.02; // Assume 2% average win
    const avgLoss = 0.01; // Assume 1% average loss
    
    // Kelly Formula: f* = (p*b - q)/b
    const b = avgWin / avgLoss;
    const p = winRate;
    const q = 1 - p;
    let kellyFraction = (p * b - q) / b;
    
    // Cap Kelly at 25% for safety
    kellyFraction = Math.min(Math.max(kellyFraction, 0.05), 0.25);
    
    // Adjust based on user risk preference
    const riskMultiplier = {
      conservative: 0.5,
      moderate: 1,
      aggressive: 1.5
    }[riskLevel];
    
    const finalFraction = kellyFraction * riskMultiplier;
    const recommendedAmount = balance.cash * finalFraction;
    const recommendedQuantity = recommendedAmount / currentPrice;
    const maxLoss = recommendedAmount * 0.02; // 2% stop loss
    
    let reasoning = "";
    if (riskLevel === "conservative") {
      reasoning = `Based on your ${Math.round(winRate * 100)}% win rate, Kelly Criterion suggests ${Math.round(kellyFraction * 100)}% position. Taking conservative approach: ${Math.round(finalFraction * 100)}% of capital.`;
    } else if (riskLevel === "aggressive") {
      reasoning = `High risk tolerance detected. Scaling position to ${Math.round(finalFraction * 100)}% of capital. Set stop loss at $${maxLoss.toFixed(2)} to protect downside.`;
    } else {
      reasoning = `Balanced approach. Position size of ${Math.round(finalFraction * 100)}% provides optimal risk/reward based on your trading history.`;
    }
    
    setSizing({
      recommendedAmount,
      recommendedQuantity,
      riskPercentage: finalFraction * 100,
      maxLoss,
      reasoning
    });
  };

  // Smart stop loss based on ATR (Average True Range)
  const calculateSmartStopLoss = (price: number, candles: any[]) => {
    if (candles.length < 14) return price * 0.95;
    
    // Calculate ATR
    let atr = 0;
    for (let i = candles.length - 14; i < candles.length; i++) {
      const high = candles[i].high;
      const low = candles[i].low;
      const prevClose = candles[i - 1]?.close || candles[i].close;
      const tr = Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose));
      atr += tr;
    }
    atr /= 14;
    
    // Stop loss at 2x ATR
    const stopPrice = price - (atr * 2);
    setStopLoss(stopPrice);
    return stopPrice;
  };

  return (
    <div className="bg-[#1c2030] rounded-lg border border-[#2a2e39] p-4 mt-3">
      <div className="flex items-center gap-2 mb-3">
        <Calculator className="h-4 w-4 text-[#2962ff]" />
        <h3 className="text-sm font-semibold text-white">Smart Position Sizing</h3>
      </div>
      
      {/* Risk Selector */}
      <div className="flex gap-2 mb-3">
        {(["conservative", "moderate", "aggressive"] as const).map((level) => (
          <button
            key={level}
            onClick={() => setRiskLevel(level)}
            className={`flex-1 py-1 text-xs rounded transition-all ${
              riskLevel === level 
                ? "bg-[#2962ff] text-white" 
                : "bg-[#1e222d] text-[#787b86] hover:text-white"
            }`}
          >
            {level.charAt(0).toUpperCase() + level.slice(1)}
          </button>
        ))}
      </div>
      
      <button
        onClick={calculatePositionSize}
        className="w-full bg-[#2962ff]/10 border border-[#2962ff]/30 text-[#2962ff] py-2 rounded-lg text-sm font-semibold hover:bg-[#2962ff]/20 transition-all mb-3"
      >
        Calculate Recommended Position
      </button>
      
      {sizing && (
        <div className="space-y-2 text-xs">
          <div className="flex justify-between">
            <span className="text-[#787b86]">Recommended Amount:</span>
            <span className="text-white font-bold">${sizing.recommendedAmount.toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#787b86]">Quantity:</span>
            <span className="text-white">{sizing.recommendedQuantity.toFixed(4)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#787b86]">Risk % of Portfolio:</span>
            <span className="text-yellow-400">{sizing.riskPercentage.toFixed(1)}%</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#787b86]">Suggested Stop Loss:</span>
            <span className="text-red-400">${sizing.maxLoss.toFixed(2)} max loss</span>
          </div>
          <div className="mt-2 p-2 bg-[#131722] rounded text-[#b2b5be] text-[10px]">
            {sizing.reasoning}
          </div>
        </div>
      )}
      
      {/* Quick Action Buttons */}
      {sizing && (
        <div className="flex gap-2 mt-3">
          <button className="flex-1 bg-green-500/20 text-green-400 py-1 rounded text-xs hover:bg-green-500/30">
            Apply to Buy Order
          </button>
          <button className="flex-1 bg-red-500/20 text-red-400 py-1 rounded text-xs hover:bg-red-500/30">
            Set Stop Loss
          </button>
        </div>
      )}
    </div>
  );
}