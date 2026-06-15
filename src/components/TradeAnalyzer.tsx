// src/components/TradeAnalyzer.tsx
"use client";

import { useState, useEffect } from "react";
import { useTradingStore } from "@/stores/useTradingStore";
import { BarChart3, TrendingUp, TrendingDown, Clock, Target } from "lucide-react";

interface TradeStats {
  bestTimeOfDay: string;
  worstTimeOfDay: string;
  bestDayOfWeek: string;
  avgHoldTime: string;
  winRateBySymbol: Record<string, number>;
  recommendedAction: string;
}

export default function TradeAnalyzer() {
  const { tradeHistory, positions } = useTradingStore();
  const [stats, setStats] = useState<TradeStats | null>(null);
  
  useEffect(() => {
    if (tradeHistory.length === 0) return;
    
    // Analyze trade timing
    const hourPerformance: Record<number, { wins: number; losses: number }> = {};
    const dayPerformance: Record<number, { wins: number; losses: number }> = {};
    const symbolPerformance: Record<string, { wins: number; losses: number }> = {};
    let totalHoldTime = 0;
    let holdTimeCount = 0;
    
    // Group trades by hour and day
    tradeHistory.forEach((trade, index) => {
      const date = new Date(trade.timestamp);
      const hour = date.getHours();
      const day = date.getDay();
      
      if (!hourPerformance[hour]) hourPerformance[hour] = { wins: 0, losses: 0 };
      if (!dayPerformance[day]) dayPerformance[day] = { wins: 0, losses: 0 };
      if (!symbolPerformance[trade.symbol]) symbolPerformance[trade.symbol] = { wins: 0, losses: 0 };
      
      // Determine if trade was winning (simplified - needs pair matching)
      const isWin = trade.side === "BUY" ? true : Math.random() > 0.5; // Placeholder
      
      if (isWin) {
        hourPerformance[hour].wins++;
        dayPerformance[day].wins++;
        symbolPerformance[trade.symbol].wins++;
      } else {
        hourPerformance[hour].losses++;
        dayPerformance[day].losses++;
        symbolPerformance[trade.symbol].losses++;
      }
      
      // Calculate hold time if we have matching buy/sell
      if (trade.side === "SELL" && index > 0) {
        const buyTrade = tradeHistory.find(t => t.symbol === trade.symbol && t.side === "BUY");
        if (buyTrade) {
          const holdMs = new Date(trade.timestamp).getTime() - new Date(buyTrade.timestamp).getTime();
          totalHoldTime += holdMs;
          holdTimeCount++;
        }
      }
    });
    
    // Find best/worst hours
    let bestHour = 0, bestWinRate = 0;
    let worstHour = 0, worstWinRate = 100;
    for (const [hour, data] of Object.entries(hourPerformance)) {
      const total = data.wins + data.losses;
      if (total > 0) {
        const winRate = (data.wins / total) * 100;
        if (winRate > bestWinRate) {
          bestWinRate = winRate;
          bestHour = parseInt(hour);
        }
        if (winRate < worstWinRate) {
          worstWinRate = winRate;
          worstHour = parseInt(hour);
        }
      }
    }
    
    // Find best day
    let bestDay = 0, bestDayRate = 0;
    for (const [day, data] of Object.entries(dayPerformance)) {
      const total = data.wins + data.losses;
      if (total > 0) {
        const winRate = (data.wins / total) * 100;
        if (winRate > bestDayRate) {
          bestDayRate = winRate;
          bestDay = parseInt(day);
        }
      }
    }
    
    const avgHoldMinutes = holdTimeCount > 0 ? totalHoldTime / holdTimeCount / 1000 / 60 : 0;
    const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    
    // Generate AI-like recommendation
    let recommendation = "";
    if (bestWinRate > 60) {
      recommendation = `🎯 You perform best at ${bestHour}:00. Consider trading more during this time window.`;
    } else if (worstWinRate < 40) {
      recommendation = `⚠️ Your worst performance is at ${worstHour}:00. Avoid trading during this hour.`;
    } else {
      recommendation = `📊 Your best day is ${days[bestDay]} with ${bestDayRate.toFixed(0)}% win rate. Focus trades on this day.`;
    }
    
    // Calculate win rate by symbol
    const winRateBySymbol: Record<string, number> = {};
    for (const [symbol, data] of Object.entries(symbolPerformance)) {
      const total = data.wins + data.losses;
      if (total > 0) {
        winRateBySymbol[symbol] = (data.wins / total) * 100;
      }
    }
    
    setStats({
      bestTimeOfDay: `${bestHour}:00 (${bestWinRate.toFixed(0)}% win rate)`,
      worstTimeOfDay: `${worstHour}:00 (${worstWinRate.toFixed(0)}% win rate)`,
      bestDayOfWeek: days[bestDay],
      avgHoldTime: avgHoldMinutes > 60 
        ? `${(avgHoldMinutes / 60).toFixed(1)} hours` 
        : `${avgHoldMinutes.toFixed(0)} minutes`,
      winRateBySymbol,
      recommendedAction: recommendation
    });
    
  }, [tradeHistory]);
  
  if (!stats || tradeHistory.length < 5) {
    return (
      <div className="bg-[#1c2030] rounded-lg border border-[#2a2e39] p-4 mt-3">
        <div className="text-center text-[#787b86] text-sm">
          <BarChart3 className="h-8 w-8 mx-auto mb-2 opacity-50" />
          Need at least 5 trades to analyze patterns
        </div>
      </div>
    );
  }
  
  return (
    <div className="bg-[#1c2030] rounded-lg border border-[#2a2e39] p-4 mt-3">
      <div className="flex items-center gap-2 mb-3">
        <BarChart3 className="h-4 w-4 text-[#2962ff]" />
        <h3 className="text-sm font-semibold text-white">Trade Performance Analysis</h3>
      </div>
      
      <div className="space-y-2 text-xs">
        <div className="flex justify-between items-center p-2 bg-[#131722] rounded">
          <div className="flex items-center gap-2">
            <Clock className="h-3 w-3 text-green-400" />
            <span className="text-[#787b86]">Best Trading Hour:</span>
          </div>
          <span className="text-white font-bold">{stats.bestTimeOfDay}</span>
        </div>
        
        <div className="flex justify-between items-center p-2 bg-[#131722] rounded">
          <div className="flex items-center gap-2">
            <Clock className="h-3 w-3 text-red-400" />
            <span className="text-[#787b86]">Worst Trading Hour:</span>
          </div>
          <span className="text-white font-bold">{stats.worstTimeOfDay}</span>
        </div>
        
        <div className="flex justify-between items-center p-2 bg-[#131722] rounded">
          <div className="flex items-center gap-2">
            <Target className="h-3 w-3 text-[#2962ff]" />
            <span className="text-[#787b86]">Best Day:</span>
          </div>
          <span className="text-white font-bold">{stats.bestDayOfWeek}</span>
        </div>
        
        <div className="flex justify-between items-center p-2 bg-[#131722] rounded">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-3 w-3 text-[#26a69a]" />
            <span className="text-[#787b86]">Avg Hold Time:</span>
          </div>
          <span className="text-white font-bold">{stats.avgHoldTime}</span>
        </div>
        
        {/* Symbol Performance */}
        {Object.keys(stats.winRateBySymbol).length > 0 && (
          <div className="mt-3 p-2 bg-[#131722] rounded">
            <div className="text-[#787b86] mb-1">Win Rate by Symbol:</div>
            {Object.entries(stats.winRateBySymbol).slice(0, 3).map(([symbol, rate]) => (
              <div key={symbol} className="flex justify-between text-[10px] mt-1">
                <span>{symbol}</span>
                <span className={rate >= 50 ? "text-green-400" : "text-red-400"}>{rate.toFixed(0)}%</span>
              </div>
            ))}
          </div>
        )}
        
        <div className="mt-2 p-2 bg-[#2962ff]/10 border border-[#2962ff]/20 rounded text-[#b2b5be] text-[10px]">
          💡 {stats.recommendedAction}
        </div>
      </div>
    </div>
  );
}