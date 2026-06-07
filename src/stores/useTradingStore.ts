// src/stores/useTradingStore.ts
import { create } from "zustand";
import type { Position, TradeHistory, UserBalance, UserProfile } from "@/types/trading";

interface TradingState {
  // Global UI state
  symbol: string;
  interval: string;
  profile: UserProfile;
  balance: UserBalance;
  positions: Position[];
  tradeHistory: TradeHistory[];
  isLoading: boolean;

  // Actions
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

  // In useTradingStore.ts - ensure this function is correct
  updateLivePrices: (currentPrice) => {
    const { symbol, balance, positions } = get();
    
    console.log(`Updating price for ${symbol}: ${currentPrice}`); // Debug log
    
    const updatedPositions = positions.map((pos) => {
      if (pos.symbol === symbol) {
        const pnl = (currentPrice - pos.entryPrice) * pos.quantity;
        console.log(`Position ${pos.symbol}: entry=${pos.entryPrice}, current=${currentPrice}, qty=${pos.quantity}, pnl=${pnl}`); // Debug
        return { 
          ...pos, 
          currentPrice, 
          pnl 
        };
      }
      return pos;
    });
    
    // Calculate total P&L across all positions
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