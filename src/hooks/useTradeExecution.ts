// src/hooks/useTradeExecution.ts
import { useState, useCallback } from "react";
import { useTradingStore } from "@/stores/useTradingStore";
import type { TradeSide, Position, TradeHistory } from "@/types/trading";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

// Helper to get Clerk user ID
const getClerkUserId = (): string | null => {
  const clerk = (window as { Clerk?: { user?: { id?: string } } }).Clerk;
  return clerk?.user?.id || null;
};

// Guest mode trade execution (local only, no backend)
const executeGuestTrade = (
  symbol: string,
  side: TradeSide,
  quantity: number,
  price: number,
  currentCash: number,
  currentPositions: Position[],
  currentTradeHistory: TradeHistory[]
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
          ? { ...p, quantity: finalQty, entryPrice: finalAvgPrice }
          : p
      );
    } else {
      newPositions = [
        ...currentPositions,
        {
          id: crypto.randomUUID(),
          symbol,
          side: "BUY",
          quantity,
          entryPrice: price,
          currentPrice: price,
          pnl: 0,
        },
      ];
    }
  } else {
    // SELL
    finalQty = existingPosition!.quantity - quantity;
    if (finalQty === 0) {
      newPositions = currentPositions.filter((p) => p.symbol !== symbol);
    } else {
      newPositions = currentPositions.map((p) =>
        p.symbol === symbol ? { ...p, quantity: finalQty } : p
      );
    }
  }

  const newTrade: TradeHistory = {
    id: crypto.randomUUID(),
    symbol,
    side,
    quantity,
    price,
    timestamp: new Date().toISOString(),
  };

  return {
    success: true,
    newCash,
    newPositions,
    newTrade,
  };
};

export function useTradeExecution() {
  const [isExecuting, setIsExecuting] = useState(false);
  const { symbol, balance, positions, tradeHistory, profile } = useTradingStore();
  const setBalance = useTradingStore((state) => state.setBalance);
  const setPositions = useTradingStore((state) => state.setPositions);
  const setTradeHistory = useTradingStore((state) => state.setTradeHistory);
  const resetAccount = useTradingStore((state) => state.resetAccount);

  const executeTrade = useCallback(
    async (side: TradeSide, quantity: number, price: number): Promise<boolean> => {
      const isGuest = profile.id === "demo-user";

      // Validate inputs
      if (quantity <= 0 || isNaN(quantity)) {
        alert("Please enter a valid quantity!");
        return false;
      }

      if (price <= 0 || isNaN(price)) {
        alert("Invalid price!");
        return false;
      }

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
          tradeHistory
        );

        if (result.success) {
          // Update Zustand store
          if (result.newCash !== undefined) {
            setBalance({
              ...balance,
              cash: result.newCash,
              equity: result.newCash,
              buyingPower: result.newCash,
            });
          }
          if (result.newPositions) {
            setPositions(result.newPositions);
          }
          if (result.newTrade) {
            setTradeHistory([result.newTrade, ...tradeHistory]);
          }
          setIsExecuting(false);
          return true;
        } else {
          alert(result.error || "Trade execution failed");
          setIsExecuting(false);
          return false;
        }
      }

      // Authenticated mode — execute via backend
      const userId = getClerkUserId();
      if (!userId) {
        alert("Session expired. Please refresh and login again.");
        return false;
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
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          alert(data.error || "Trade execution failed");
          setIsExecuting(false);
          return false;
        }

        if (data.success) {
          // Update Zustand store with server response
          if (data.newCash !== undefined) {
            setBalance({
              ...balance,
              cash: data.newCash,
              equity: data.newEquity || data.newCash,
              buyingPower: data.newCash,
            });
          }
          if (data.positions) {
            setPositions(data.positions);
          }
          if (data.tradeHistory) {
            setTradeHistory(data.tradeHistory);
          }
          setIsExecuting(false);
          return true;
        } else {
          alert(data.error || "Trade execution failed");
          setIsExecuting(false);
          return false;
        }
      } catch (error) {
        console.error("Trade execution error:", error);
        alert("Network error. Please check your connection and try again.");
        setIsExecuting(false);
        return false;
      }
    },
    [symbol, balance, positions, tradeHistory, profile.id, setBalance, setPositions, setTradeHistory]
  );

  const resetAccountHandler = useCallback(async (): Promise<void> => {
    const isGuest = profile.id === "demo-user";

    if (isGuest) {
      resetAccount();
      alert("Account has been reset to $100,000 virtual cash");
      return;
    }

    const userId = getClerkUserId();
    if (!userId) {
      alert("Session expired. Please refresh and login again.");
      return;
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
        return;
      }

      if (data.success) {
        resetAccount();
        alert("Account has been reset to $100,000 virtual cash");
      } else {
        alert(data.error || "Failed to reset account");
      }
    } catch (error) {
      console.error("Reset account error:", error);
      alert("Network error. Please try again.");
    } finally {
      setIsExecuting(false);
    }
  }, [profile.id, resetAccount]);

  return {
    executeTrade,
    resetAccount: resetAccountHandler,
    isExecuting,
  };
}