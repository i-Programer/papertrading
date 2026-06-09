// src/stores/useTradingStore.ts
import { create } from "zustand";
import { useCallback, useRef } from "react";
import type { Position, TradeHistory, UserBalance, UserProfile } from "@/types/trading";
import { generateId } from "@/utils/id";

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

export const useTradingStore = create<TradingState>((set, get) => ({
  symbol: "BTCUSDT",
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

  // 🔥 FIX: Only update if actually changed
  syncProfile: (name, email) => {
    const { profile } = get();
    if (profile.name !== name || profile.email !== email) {
      set({
        profile: {
          id: name === "Guest User" ? "demo-user" : generateId(),
          name,
          email,
        },
      });
    }
  },

  updateLivePrices: (currentPrice) => {
    const { symbol, balance, positions } = get();
    
    const updatedPositions = positions.map((pos) => {
      if (pos.symbol === symbol) {
        const pnl = (currentPrice - pos.entryPrice) * pos.quantity;
        return { ...pos, currentPrice, pnl };
      }
      return pos;
    });
    
    const totalPnL = updatedPositions.reduce((sum, pos) => sum + (pos.pnl || 0), 0);
    const newEquity = balance.cash + totalPnL;
    const dayPnlPercent = balance.cash > 0 ? (totalPnL / balance.cash) * 100 : 0;
    
    set({
      positions: updatedPositions,
      balance: {
        ...balance,
        equity: newEquity,
        dayPnl: totalPnL,
        dayPnlPercent,
      },
    });
  },

  resetAccount: () =>
    set({
      balance: defaultBalance,
      positions: [],
      tradeHistory: [],
    }),
}));