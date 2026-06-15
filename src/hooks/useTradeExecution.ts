// src/hooks/useTradeExecution.ts

import { useState, useCallback } from "react";
import { useTradingStore } from "@/stores/useTradingStore";
import type { TradeSide, Position, TradeHistory } from "@/types/trading";
import { generateId } from "@/utils/id";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

// Helper to get Clerk user ID
const getClerkUserId = (): string | null => {
  const clerk = (window as { Clerk?: { user?: { id?: string } } }).Clerk;
  return clerk?.user?.id || null;
};

// ============ AI TRADE REASON GENERATOR ============
interface CandleData {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

const generateTradeReason = (
  side: TradeSide, 
  price: number, 
  candles: CandleData[],
  balance: { cash: number; equity: number },
  positions: Position[]
): string => {
  if (!candles || candles.length < 10) {
    return side === "BUY" ? "Manual buy order" : "Manual sell order";
  }
  
  const recentPrices = candles.slice(-10).map(c => c.close);
  const currentPrice = price;
  const prevPrice = recentPrices[recentPrices.length - 2] || currentPrice;
  const priceChange = ((currentPrice - prevPrice) / prevPrice) * 100;
  const isRising = priceChange > 0;
  
  // Calculate volume trend
  const recentVolumes = candles.slice(-5).map(c => c.volume);
  const olderVolumes = candles.slice(-10, -5).map(c => c.volume);
  const avgRecentVolume = recentVolumes.reduce((a, b) => a + b, 0) / recentVolumes.length;
  const avgOlderVolume = olderVolumes.reduce((a, b) => a + b, 0) / olderVolumes.length;
  const volumeSurge = avgRecentVolume / avgOlderVolume;
  
  // Check if user has existing position
  const existingPosition = positions.find(p => p.symbol === useTradingStore.getState().symbol);
  const hasPosition = existingPosition && existingPosition.quantity > 0;
  
  if (side === "BUY") {
    // Aggressive buy signals
    if (priceChange > 3 && volumeSurge > 1.5) {
      return "🚀 Breakout buy - Strong momentum with high volume";
    }
    if (priceChange > 2) {
      return "📈 Trend following - Buying the breakout";
    }
    
    // Conservative buy signals
    if (priceChange < -4 && volumeSurge > 1.2) {
      return "📉 Panic dip buy - High volume selloff, potential reversal";
    }
    if (priceChange < -2) {
      return "💰 Dip buying - Price at discount to recent levels";
    }
    
    // Strategic buys
    if (!hasPosition) {
      return "🟢 Position entry - Starting new position";
    }
    if (existingPosition && existingPosition.pnl < 0) {
      return "📊 Averaging down - Reducing average entry price";
    }
    
    return "🟢 Accumulation - Adding to existing position";
    
  } else {
    // SELL side
    const positionPnL = existingPosition?.pnl || 0;
    const pnlPercent = existingPosition 
      ? ((price - existingPosition.entryPrice) / existingPosition.entryPrice) * 100 
      : 0;
    
    // Take profit scenarios
    if (pnlPercent > 10) {
      return `💸 Taking profits - Excellent gain of +${pnlPercent.toFixed(1)}%`;
    }
    if (pnlPercent > 5) {
      return `✅ Profit taking - Securing +${pnlPercent.toFixed(1)}% gain`;
    }
    if (pnlPercent > 2) {
      return `🎯 Target reached - Exiting with ${pnlPercent.toFixed(1)}% profit`;
    }
    
    // Stop loss scenarios
    if (pnlPercent < -8) {
      return "🛑 Emergency stop loss - Severe downturn detected";
    }
    if (pnlPercent < -5) {
      return "⚠️ Stop loss triggered - Cutting losses at -5%";
    }
    if (pnlPercent < -2 && volumeSurge > 1.3) {
      return "📉 Panic sell - High volume breakdown";
    }
    
    // Strategic sells
    if (priceChange < -3) {
      return "🔻 Trend reversal - Exiting before further downside";
    }
    if (hasPosition && positionPnL > 0) {
      return "💰 Partial profit taking - Reducing exposure";
    }
    
    return "📤 Position exit - Closing trade";
  }
};

// Transform backend position to frontend Position type
const transformPosition = (backendPosition: any): Position => {
  const entryPrice = parseFloat(backendPosition.entry_price || backendPosition.entryPrice || 0);
  const quantity = parseFloat(backendPosition.quantity || 0);
  const symbol = backendPosition.symbol || 'BTCUSDT';
  const currentPrice = parseFloat(backendPosition.current_price || backendPosition.currentPrice || entryPrice);
  
  const pnl = (currentPrice - entryPrice) * quantity;
  const pnlPercent = entryPrice > 0 ? (pnl / (entryPrice * quantity)) * 100 : 0;
  
  return {
    id: backendPosition.id || generateId(),
    symbol: symbol,
    side: backendPosition.side || "BUY",
    quantity: quantity,
    entryPrice: entryPrice,
    currentPrice: currentPrice,
    pnl: pnl,
    pnlPercent: pnlPercent,
    entry_price: entryPrice, // For backward compatibility
  };
};

// Transform trade history
const transformTradeHistory = (backendTrade: any): TradeHistory => {
  return {
    id: backendTrade.id || generateId(),
    symbol: backendTrade.symbol || 'BTCUSDT',
    side: backendTrade.side || "BUY",
    quantity: parseFloat(backendTrade.quantity || 0),
    price: parseFloat(backendTrade.price || 0),
    timestamp: backendTrade.timestamp || new Date().toISOString(),
  };
};

// Guest mode trade execution (local only, no backend)
const executeGuestTrade = (
  symbol: string,
  side: TradeSide,
  quantity: number,
  price: number,
  currentCash: number,
  currentPositions: Position[],
  currentTradeHistory: TradeHistory[],
  tradeReason: string
): {
  success: boolean;
  newCash?: number;
  newPositions?: Position[];
  newTrade?: TradeHistory;
  error?: string;
} => {
  const totalCost = quantity * price;
  const existingPosition = currentPositions.find((p) => p.symbol === symbol);

  // Validation
  if (side === "BUY" && currentCash < totalCost) {
    return {
      success: false,
      error: `Insufficient funds. Need $${totalCost.toFixed(2)}, have $${currentCash.toFixed(2)}`,
    };
  }

  if (side === "SELL" && (!existingPosition || existingPosition.quantity < quantity)) {
    const available = existingPosition?.quantity || 0;
    return {
      success: false,
      error: `Insufficient ${symbol}. You have ${available}, trying to sell ${quantity}`,
    };
  }

  // Calculate new state
  const newCash = side === "BUY" ? currentCash - totalCost : currentCash + totalCost;
  let newPositions: Position[];
  let finalQty = quantity;
  let finalAvgPrice = price;

  if (side === "BUY") {
    if (existingPosition) {
      finalQty = existingPosition.quantity + quantity;
      finalAvgPrice =
        (existingPosition.entryPrice * existingPosition.quantity + totalCost) / finalQty;
      newPositions = currentPositions.map((p) =>
        p.symbol === symbol
          ? { 
              ...p, 
              quantity: finalQty, 
              entryPrice: finalAvgPrice,
              entry_price: finalAvgPrice,
              pnl: (p.currentPrice - finalAvgPrice) * finalQty,
              pnlPercent: finalAvgPrice > 0 ? ((p.currentPrice - finalAvgPrice) / finalAvgPrice) * 100 : 0
            }
          : p
      );
    } else {
      newPositions = [
        ...currentPositions,
        {
          id: generateId(),
          symbol,
          side: "BUY",
          quantity,
          entryPrice: price,
          entry_price: price,
          currentPrice: price,
          pnl: 0,
          pnlPercent: 0,
        },
      ];
    }
  } else {
    // SELL - calculate realized P&L for this trade
    const realizedPnl = existingPosition 
      ? (price - existingPosition.entryPrice) * quantity 
      : 0;
    
    finalQty = existingPosition!.quantity - quantity;
    if (finalQty === 0) {
      newPositions = currentPositions.filter((p) => p.symbol !== symbol);
    } else {
      newPositions = currentPositions.map((p) =>
        p.symbol === symbol 
          ? { 
              ...p, 
              quantity: finalQty,
              pnl: (p.currentPrice - p.entryPrice) * finalQty,
              pnlPercent: p.entryPrice > 0 ? ((p.currentPrice - p.entryPrice) / p.entryPrice) * 100 : 0
            } 
          : p
      );
    }
  }

  const newTrade: TradeHistory = {
    id: generateId(),
    symbol,
    side,
    quantity,
    price,
    timestamp: new Date().toISOString(),
  };

  // Store trade reason in localStorage for display
  const tradeWithReason = { ...newTrade, reason: tradeReason };
  const storedReasons = JSON.parse(localStorage.getItem("trade_reasons") || "{}");
  storedReasons[newTrade.id] = tradeReason;
  localStorage.setItem("trade_reasons", JSON.stringify(storedReasons));

  return {
    success: true,
    newCash,
    newPositions,
    newTrade,
  };
};

export function useTradeExecution() {
  const [isExecuting, setIsExecuting] = useState(false);
  const [lastTradeReason, setLastTradeReason] = useState<string | null>(null);
  
  const { symbol, balance, positions, tradeHistory, profile } = useTradingStore();
  const setBalance = useTradingStore((state) => state.setBalance);
  const setPositions = useTradingStore((state) => state.setPositions);
  const setTradeHistory = useTradingStore((state) => state.setTradeHistory);
  const resetAccount = useTradingStore((state) => state.resetAccount);
  
  // Get candles from the chart data (passed from component or from store)
  const getCandles = useCallback((): CandleData[] => {
    // This assumes you have a way to access chart data
    // You might need to pass this from the component or use a separate store
    return (window as any).__chartCandles || [];
  }, []);

  const executeTrade = useCallback(
    async (
      side: TradeSide, 
      quantity: number, 
      price: number,
      candles?: CandleData[]
    ): Promise<{ success: boolean; reason?: string }> => {
      const isGuest = profile.id === "demo-user";

      // Validate inputs
      if (quantity <= 0 || isNaN(quantity)) {
        alert("Please enter a valid quantity!");
        return { success: false };
      }

      if (price <= 0 || isNaN(price)) {
        alert("Invalid price!");
        return { success: false };
      }

      // Generate AI trade reason
      const chartData = candles || getCandles();
      const tradeReason = generateTradeReason(side, price, chartData, balance, positions);
      setLastTradeReason(tradeReason);

      // Guest mode — execute locally
      if (isGuest) {
        setIsExecuting(true);

        // Simulate network delay for realism
        await new Promise((resolve) => setTimeout(resolve, 300));

        const result = executeGuestTrade(
          symbol,
          side,
          quantity,
          price,
          balance.cash,
          positions,
          tradeHistory,
          tradeReason
        );

        if (result.success) {
          // Update Zustand store
          if (result.newCash !== undefined) {
            const newEquity = result.newCash + positions.reduce((sum, p) => sum + p.pnl, 0);
            setBalance({
              ...balance,
              cash: result.newCash,
              equity: newEquity,
              buyingPower: result.newCash,
            });
          }
          if (result.newPositions) {
            setPositions(result.newPositions);
          }
          if (result.newTrade) {
            setTradeHistory([result.newTrade, ...tradeHistory]);
          }
          
          // Show trade reason in a non-intrusive way
          console.log(`📊 Trade executed: ${tradeReason}`);
          
          setIsExecuting(false);
          return { success: true, reason: tradeReason };
        } else {
          alert(result.error || "Trade execution failed");
          setIsExecuting(false);
          return { success: false };
        }
      }

      // Authenticated mode — execute via backend
      const userId = getClerkUserId();
      if (!userId) {
        alert("Session expired. Please refresh and login again.");
        return { success: false };
      }

      setIsExecuting(true);

      try {
        const response = await fetch(`${API_BASE}/api/trade/execute`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Clerk-User-Id": userId,
          },
          body: JSON.stringify({
            symbol,
            side,
            quantity,
            price,
            tradeReason, // Send reason to backend for storage
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          alert(data.error || "Trade execution failed");
          setIsExecuting(false);
          return { success: false };
        }

        if (data.success) {
          console.log("=== TRADE EXECUTION SUCCESS ===");
          console.log("Reason:", tradeReason);
          
          // Transform the backend data
          const transformedPositions = (data.positions || []).map(transformPosition);
          const transformedHistory = (data.tradeHistory || []).map(transformTradeHistory);
          
          // Update Zustand store with transformed data
          if (data.newCash !== undefined) {
            setBalance({
              ...balance,
              cash: data.newCash,
              equity: data.newEquity || data.newCash,
              buyingPower: data.newCash,
            });
          }
          if (transformedPositions.length > 0 || data.positions?.length === 0) {
            setPositions(transformedPositions);
          }
          if (transformedHistory.length > 0) {
            setTradeHistory(transformedHistory);
          }
          
          setIsExecuting(false);
          return { success: true, reason: tradeReason };
        } else {
          alert(data.error || "Trade execution failed");
          setIsExecuting(false);
          return { success: false };
        }
      } catch (error) {
        console.error("Trade execution error:", error);
        alert("Network error. Please check your connection and try again.");
        setIsExecuting(false);
        return { success: false };
      }
    },
    [symbol, balance, positions, tradeHistory, profile.id, setBalance, setPositions, setTradeHistory, getCandles]
  );

  const resetAccountHandler = useCallback(async (): Promise<boolean> => {
    const isGuest = profile.id === "demo-user";

    if (isGuest) {
      resetAccount();
      alert("Account has been reset to $100,000 virtual cash");
      return true;
    }

    const userId = getClerkUserId();
    if (!userId) {
      alert("Session expired. Please refresh and login again.");
      return false;
    }

    setIsExecuting(true);

    try {
      const response = await fetch(`${API_BASE}/api/reset-account`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Clerk-User-Id": userId,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        alert(data.error || "Failed to reset account");
        setIsExecuting(false);
        return false;
      }

      if (data.success) {
        resetAccount();
        alert("Account has been reset to $100,000 virtual cash");
        setIsExecuting(false);
        return true;
      } else {
        alert(data.error || "Failed to reset account");
        setIsExecuting(false);
        return false;
      }
    } catch (error) {
      console.error("Reset account error:", error);
      alert("Network error. Please try again.");
      setIsExecuting(false);
      return false;
    }
  }, [profile.id, resetAccount]);

  // Helper to get stored trade reason for a specific trade
  const getTradeReason = useCallback((tradeId: string): string | null => {
    const storedReasons = JSON.parse(localStorage.getItem("trade_reasons") || "{}");
    return storedReasons[tradeId] || null;
  }, []);

  return {
    executeTrade,
    resetAccount: resetAccountHandler,
    isExecuting,
    lastTradeReason,
    getTradeReason,
  };
}