// src/stores/useTradingStore.ts
import { create } from "zustand";
import { supabase } from "@/utils/supabase";
import type {
  Position,
  TradeHistory,
  TradeSide,
  UserBalance,
  UserProfile,
} from "@/types/trading";

interface TradingState {
  symbol: string;
  interval: string;
  profile: UserProfile;
  balance: UserBalance;
  positions: Position[];
  tradeHistory: TradeHistory[];
  isLoading: boolean;
  setSymbol: (symbol: string) => void;
  setInterval: (interval: string) => void;
  setBalance: (balance: UserBalance) => void;
  setPositions: (positions: Position[]) => void;
  setTradeHistory: (history: TradeHistory[]) => void;
  setLoading: (loading: boolean) => void;
  syncProfile: (name: string, email: string) => void;
  executeTradeWithDB: (side: TradeSide, quantity: number, price: number) => Promise<boolean>;
  updateLivePrices: (currentPrice: number) => void;
  resetAccount: () => void;
}

const defaultProfile: UserProfile = {
  id: "demo-user",
  name: "Guest User",
  email: "guest@papertrading.local",
};

const defaultBalance: UserBalance = {
  cash: 100_000,
  equity: 100_000,
  buyingPower: 100_000,
  dayPnl: 0,
  dayPnlPercent: 0,
};

// Helper to convert Binance symbol to display format
const toDisplaySymbol = (symbol: string): string => {
  if (symbol.endsWith('USDT')) {
    return symbol.replace('USDT', '-USD');
  }
  return symbol;
};

// Rate limiting helper to prevent spam trading
const rateLimiter = {
  lastTradeTime: new Map<string, number>(),
  minInterval: 1000, // 1 second between trades
  
  canTrade(userId: string): boolean {
    const now = Date.now();
    const lastTrade = this.lastTradeTime.get(userId) || 0;
    if (now - lastTrade < this.minInterval) {
      const waitTime = ((this.minInterval - (now - lastTrade)) / 1000).toFixed(1);
      alert(`Please wait ${waitTime} seconds before next trade`);
      return false;
    }
    this.lastTradeTime.set(userId, now);
    return true;
  },
  
  reset(userId: string): void {
    this.lastTradeTime.delete(userId);
  }
};

// Helper to safely get Clerk user ID
const getClerkUserId = (): string | null => {
  const clerk = (window as { Clerk?: { user?: { id?: string } } }).Clerk;
  if (clerk?.user?.id) {
    return clerk.user.id;
  }
  return null;
};

export const useTradingStore = create<TradingState>((set, get) => ({
  symbol: "BTCUSDT", // Changed from BTC-USD to BTCUSDT for Binance
  interval: "15m",
  profile: defaultProfile,
  balance: defaultBalance,
  positions: [],
  tradeHistory: [],
  isLoading: false,

  setSymbol: (symbol) => set({ symbol }),
  setInterval: (interval) => set({ interval }),
  setBalance: (balance) => set({ balance }),
  setPositions: (positions) => set({ positions }),
  setTradeHistory: (history) => set({ tradeHistory: history }),
  setLoading: (isLoading) => set({ isLoading }),

  syncProfile: (name, email) => {
    const { profile } = get();
    if (profile.name !== name || profile.email !== email) {
      set({
        profile: {
          id: name === "Guest User" ? "demo-user" : crypto.randomUUID(),
          name,
          email,
        },
      });
    }
  },

  executeTradeWithDB: async (side, quantity, price) => {
    const { symbol, balance, positions, tradeHistory, profile } = get();
    const isGuest = profile.id === "demo-user";
    const totalCost = quantity * price;
    const baseCurrency = symbol.replace('USDT', ''); // Extract base currency from Binance symbol

    // --- VALIDATION CHECKS ---
    if (side === "BUY" && balance.cash < totalCost) {
      alert(`⚠️ Insufficient funds!\nNeed: $${totalCost.toLocaleString()}\nAvailable: $${balance.cash.toLocaleString()}`);
      return false;
    }

    const existingPosition = positions.find((p) => p.symbol === symbol);
    if (side === "SELL" && (!existingPosition || existingPosition.quantity < quantity)) {
      const availableQty = existingPosition?.quantity || 0;
      alert(`⚠️ Insufficient assets to sell!\nYou have: ${availableQty} ${baseCurrency}\nAttempting to sell: ${quantity}`);
      return false;
    }

    // Rate limiting for authenticated users
    if (!isGuest) {
      const clerkUserId = getClerkUserId();
      if (clerkUserId && !rateLimiter.canTrade(clerkUserId)) {
        return false;
      }
    }

    // --- CALCULATE NEW STATE ---
    const newCash = side === "BUY" ? balance.cash - totalCost : balance.cash + totalCost;
    let newPositions = [...positions];
    let finalQty = quantity;
    let finalAvgPrice = price;

    if (side === "BUY") {
      if (existingPosition) {
        finalQty = existingPosition.quantity + quantity;
        finalAvgPrice = ((existingPosition.entryPrice * existingPosition.quantity) + totalCost) / finalQty;
        newPositions = positions.map((p) =>
          p.symbol === symbol ? { ...p, quantity: finalQty, entryPrice: finalAvgPrice } : p
        );
      } else {
        newPositions.push({
          id: crypto.randomUUID(),
          symbol,
          side: "BUY",
          quantity,
          entryPrice: price,
          currentPrice: price,
          pnl: 0,
        });
      }
    } else if (side === "SELL" && existingPosition) {
      finalQty = existingPosition.quantity - quantity;
      finalAvgPrice = existingPosition.entryPrice;

      if (finalQty === 0) {
        newPositions = positions.filter((p) => p.symbol !== symbol);
      } else {
        newPositions = positions.map((p) =>
          p.symbol === symbol ? { ...p, quantity: finalQty } : p
        );
      }
    }

    const newLog: TradeHistory = {
      id: crypto.randomUUID(),
      symbol,
      side,
      quantity,
      price,
      timestamp: new Date().toISOString(),
    };

    // --- GUEST MODE (No database) ---
    if (isGuest) {
      set({
        balance: { ...balance, cash: newCash, equity: newCash, buyingPower: newCash },
        positions: newPositions,
        tradeHistory: [newLog, ...tradeHistory],
      });
      return true;
    }

    // --- AUTHENTICATED MODE with Database ---
    try {
      set({ isLoading: true });
      
      const clerkUserId = getClerkUserId();
      if (!clerkUserId) {
        alert("Session expired. Please refresh and login again.");
        return false;
      }

      // Execute database operations sequentially to ensure data consistency
      
      // 1. Insert trade history
      const { error: historyError } = await supabase
        .from("trade_history")
        .insert({
          user_id: clerkUserId,
          symbol,
          side,
          quantity,
          price,
          timestamp: new Date().toISOString(),
        });

      if (historyError) {
        console.error("Trade history insert error:", historyError);
        throw new Error(historyError.message);
      }

      // 2. Handle positions table
      if (side === "BUY" || (side === "SELL" && finalQty > 0)) {
        const { error: positionError } = await supabase
          .from("positions")
          .upsert(
            {
              user_id: clerkUserId,
              symbol,
              side: "BUY",
              quantity: finalQty,
              entry_price: finalAvgPrice,
            },
            { onConflict: "user_id,symbol" }
          );

        if (positionError) {
          console.error("Position upsert error:", positionError);
          throw new Error(positionError.message);
        }
      } else if (side === "SELL" && finalQty === 0) {
        const { error: positionError } = await supabase
          .from("positions")
          .delete()
          .eq("user_id", clerkUserId)
          .eq("symbol", symbol);

        if (positionError) {
          console.error("Position delete error:", positionError);
          throw new Error(positionError.message);
        }
      }

      // 3. Update profile cash balance
      const { error: profileError } = await supabase
        .from("profiles")
        .update({ 
          cash: newCash, 
          equity: newCash,
        })
        .eq("id", clerkUserId);

      if (profileError) {
        console.error("Profile update error:", profileError);
        throw new Error(profileError.message);
      }

      // ONLY update UI after ALL database operations succeed
      set({
        balance: { ...balance, cash: newCash, equity: newCash, buyingPower: newCash },
        positions: newPositions,
        tradeHistory: [newLog, ...tradeHistory],
      });

      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error occurred";
      console.error("Transaction error:", err);
      alert(`Transaction failed: ${errorMessage}\nPlease try again.`);
      return false;
    } finally {
      set({ isLoading: false });
    }
  },

  updateLivePrices: (currentPrice) => {
    const { symbol, balance, positions } = get();
    let totalPnL = 0;
    
    const updatedPositions = positions.map((pos) => {
      if (pos.symbol === symbol) {
        const pnl = (currentPrice - pos.entryPrice) * pos.quantity;
        totalPnL += pnl;
        return { ...pos, currentPrice, pnl };
      }
      totalPnL += pos.pnl;
      return pos;
    });

    const newEquity = balance.cash + totalPnL;
    const dayPnlPercent = balance.cash > 0 ? (totalPnL / balance.cash) * 100 : 0;

    set({
      positions: updatedPositions,
      balance: {
        ...balance,
        equity: newEquity,
        dayPnl: totalPnL,
        dayPnlPercent,
      }
    });
  },

  resetAccount: () => set({
    balance: defaultBalance,
    positions: [],
    tradeHistory: []
  }),
}));