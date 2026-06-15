// src/hooks/useVolatilityAlert.ts
import { useState, useEffect, useRef } from "react";

interface VolatilityAlert {
  type: "HIGH_VOLATILITY" | "UNUSUAL_VOLUME" | "SUPPORT_BREACH" | "RESISTANCE_BREACH";
  message: string;
  severity: "LOW" | "MEDIUM" | "HIGH";
  timestamp: number;
}

export function useVolatilityAlert(symbol: string, currentPrice: number, candles: any[]) {
  const [alerts, setAlerts] = useState<VolatilityAlert[]>([]);
  const lastAlertTime = useRef<number>(0);
  
  useEffect(() => {
    if (candles.length < 20) return;
    
    const now = Date.now();
    if (now - lastAlertTime.current < 60000) return; // Max 1 alert per minute
    
    const recentCandles = candles.slice(-20);
    const prices = recentCandles.map(c => c.close);
    const volumes = recentCandles.map(c => c.volume);
    
    // Calculate volatility (standard deviation of returns)
    const returns = [];
    for (let i = 1; i < prices.length; i++) {
      returns.push((prices[i] - prices[i-1]) / prices[i-1]);
    }
    const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length;
    const volatility = Math.sqrt(variance) * Math.sqrt(365 * 24); // Annualized
    
    // Volume anomaly detection
    const avgVolume = volumes.slice(0, -1).reduce((a, b) => a + b, 0) / (volumes.length - 1);
    const currentVolume = volumes[volumes.length - 1];
    const volumeRatio = currentVolume / avgVolume;
    
    // Find support/resistance (simplified)
    const highs = recentCandles.map(c => c.high);
    const lows = recentCandles.map(c => c.low);
    const resistance = Math.max(...highs.slice(0, -5));
    const support = Math.min(...lows.slice(0, -5));
    
    const newAlerts: VolatilityAlert[] = [];
    
    // Check for high volatility
    if (volatility > 0.8) { // 80% annualized volatility
      newAlerts.push({
        type: "HIGH_VOLATILITY",
        message: `⚠️ High volatility detected! ${symbol} is moving aggressively. Consider reducing position size.`,
        severity: "HIGH",
        timestamp: now
      });
    }
    
    // Check for volume spike
    if (volumeRatio > 2.5) {
      newAlerts.push({
        type: "UNUSUAL_VOLUME",
        message: `📊 Unusual volume spike (${volumeRatio.toFixed(1)}x normal). Big move might be coming!`,
        severity: volumeRatio > 4 ? "HIGH" : "MEDIUM",
        timestamp: now
      });
    }
    
    // Check support/resistance breach
    if (currentPrice < support * 0.98) {
      newAlerts.push({
        type: "SUPPORT_BREACH",
        message: `📉 ${symbol} broke below support at $${support.toFixed(2)}! Potential further downside.`,
        severity: "HIGH",
        timestamp: now
      });
    } else if (currentPrice > resistance * 1.02) {
      newAlerts.push({
        type: "RESISTANCE_BREACH",
        message: `📈 ${symbol} broke above resistance at $${resistance.toFixed(2)}! Bullish momentum.`,
        severity: "HIGH",
        timestamp: now
      });
    }
    
    if (newAlerts.length > 0) {
      setAlerts(prev => [...newAlerts, ...prev].slice(0, 10));
      lastAlertTime.current = now;
      
      // Play sound? (optional)
      // new Audio('/alert.mp3').play();
    }
  }, [currentPrice, candles, symbol]);
  
  return { alerts, clearAlerts: () => setAlerts([]) };
}