// src/hooks/useSentimentScore.ts
import { useState, useEffect } from "react";

export function useSentimentScore(symbol: string, currentPrice: number, candles: any[]) {
  const [sentiment, setSentiment] = useState({
    score: 50, // 0-100, 50 = neutral
    label: "NEUTRAL",
    color: "text-yellow-400",
    factors: [] as string[]
  });
  
  useEffect(() => {
    if (candles.length < 20) return;
    
    const recent = candles.slice(-20);
    const prices = recent.map(c => c.close);
    const volumes = recent.map(c => c.volume);
    
    let score = 50;
    const factors = [];
    
    // Price trend (40% weight)
    const priceChange = (prices[prices.length - 1] - prices[0]) / prices[0];
    if (priceChange > 0.05) {
      score += 15;
      factors.push(`📈 Strong uptrend: +${(priceChange * 100).toFixed(1)}%`);
    } else if (priceChange > 0.02) {
      score += 8;
      factors.push(`📈 Moderate uptrend: +${(priceChange * 100).toFixed(1)}%`);
    } else if (priceChange < -0.05) {
      score -= 15;
      factors.push(`📉 Strong downtrend: ${(priceChange * 100).toFixed(1)}%`);
    } else if (priceChange < -0.02) {
      score -= 8;
      factors.push(`📉 Moderate downtrend: ${(priceChange * 100).toFixed(1)}%`);
    } else {
      factors.push(`➡️ Sideways movement: ${(priceChange * 100).toFixed(1)}%`);
    }
    
    // Volume momentum (30% weight)
    const avgVolume = volumes.slice(0, -5).reduce((a, b) => a + b, 0) / 15;
    const recentVolume = volumes.slice(-5).reduce((a, b) => a + b, 0) / 5;
    const volumeRatio = recentVolume / avgVolume;
    
    if (volumeRatio > 1.5 && priceChange > 0) {
      score += 12;
      factors.push(`🔥 Bullish volume: ${volumeRatio.toFixed(1)}x average`);
    } else if (volumeRatio > 1.5 && priceChange < 0) {
      score -= 12;
      factors.push(`⚠️ Bearish volume: ${volumeRatio.toFixed(1)}x average`);
    } else if (volumeRatio > 1.2) {
      score += volumeRatio > 1 ? 5 : -5;
      factors.push(`📊 Above average volume: ${volumeRatio.toFixed(1)}x`);
    }
    
    // Volatility (15% weight)
    const volatility = calculateVolatility(prices);
    if (volatility > 0.03) {
      score -= 8;
      factors.push(`⚡ High volatility: ${(volatility * 100).toFixed(1)}% swings`);
    }
    
    // Momentum (15% weight)
    const rsi = calculateRSI(prices);
    if (rsi > 70) {
      score -= 10;
      factors.push(`📊 RSI overbought: ${rsi.toFixed(0)} (potential reversal)`);
    } else if (rsi < 30) {
      score += 10;
      factors.push(`📊 RSI oversold: ${rsi.toFixed(0)} (potential bounce)`);
    }
    
    // Clamp score
    score = Math.min(Math.max(score, 0), 100);
    
    let label = "NEUTRAL";
    let color = "text-yellow-400";
    if (score >= 70) {
      label = "BULLISH";
      color = "text-green-400";
    } else if (score >= 60) {
      label = "SLIGHTLY BULLISH";
      color = "text-green-300";
    } else if (score <= 30) {
      label = "BEARISH";
      color = "text-red-400";
    } else if (score <= 40) {
      label = "SLIGHTLY BEARISH";
      color = "text-red-300";
    }
    
    setSentiment({ score, label, color, factors });
    
  }, [currentPrice, candles, symbol]);
  
  return sentiment;
}

function calculateVolatility(prices: number[]): number {
  const returns = [];
  for (let i = 1; i < prices.length; i++) {
    returns.push((prices[i] - prices[i-1]) / prices[i-1]);
  }
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
  return Math.sqrt(variance);
}

function calculateRSI(prices: number[], period = 14): number {
  if (prices.length < period + 1) return 50;
  
  let gains = 0, losses = 0;
  for (let i = prices.length - period; i < prices.length; i++) {
    const change = prices[i] - prices[i-1];
    if (change > 0) gains += change;
    else losses -= change;
  }
  
  const avgGain = gains / period;
  const avgLoss = losses / period;
  
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
}