// src/stores/useTradingStore.ts

import { create } from "zustand";
import type {
  Position,
  TradeHistory,
  TradeSide,
  UserBalance,
  UserProfile,
} from "@/types/trading";

interface TradingState {
  symbol: string;
  profile: UserProfile;
  balance: UserBalance;
  positions: Position[];
  tradeHistory: TradeHistory[];
  isLoading: boolean;
  setSymbol: (symbol: string) => void;
  setBalance: (balance: UserBalance) => void;
  setPositions: (positions: Position[]) => void;
  setTradeHistory: (history: TradeHistory[]) => void;
  setLoading: (loading: boolean) => void;
  executeTradeLocal: (side: TradeSide, quantity: number, price: number) => boolean;
  updateLivePrices: (currentPrice: number) => void;
  resetAccount: () => void;
  syncProfile: (name: string, email: string) => void;
}

const defaultProfile: UserProfile = {
  id: "demo-user",
  name: "Paper Trader",
  email: "demo@papertrading.local",
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
  profile: defaultProfile,
  balance: defaultBalance,
  positions: [],
  tradeHistory: [],
  isLoading: false,

  setSymbol: (symbol) => set({ symbol }),
  setBalance: (balance) => set({ balance }),
  setPositions: (positions) => set({ positions }),
  setTradeHistory: (history) => set({ tradeHistory: history }),
  setLoading: (isLoading) => set({ isLoading }),

  syncProfile: (name, email) => {
    const { profile } = get();
    // Hanya update jika datanya berbeda untuk menghindari kelesuan re-render
    if (profile.name !== name || profile.email !== email) {
      set({
        profile: {
          id: name === "Guest User" ? "demo-user" : "clerk-user",
          name,
          email,
        },
      });
    }
  },

  executeTradeLocal: (side, quantity, price) => {
    const { symbol, balance, positions, tradeHistory } = get();
    const totalCost = quantity * price;

    if (side === "BUY" && balance.cash < totalCost) {
      alert("⚠️ Transaksi Gagal: Saldo Virtual Cash Tidak Cukup!");
      return false;
    }

    const existingPosition = positions.find((p) => p.symbol === symbol);
    if (side === "SELL") {
      if (!existingPosition || existingPosition.quantity < quantity) {
        alert("⚠️ Transaksi Gagal: Anda tidak memiliki cukup aset untuk dijual!");
        return false;
      }
    }

    const newCash = side === "BUY" ? balance.cash - totalCost : balance.cash + totalCost;
    let newPositions = [...positions];

    if (side === "BUY") {
      if (existingPosition) {
        const newQuantity = existingPosition.quantity + quantity;
        const newAvgPrice = ((existingPosition.entryPrice * existingPosition.quantity) + totalCost) / newQuantity;
        
        newPositions = positions.map((p) =>
          p.symbol === symbol
            ? { ...p, quantity: newQuantity, entryPrice: newAvgPrice }
            : p
        );
      } else {
        const newPos: Position = {
          id: Math.random().toString(36).substring(7),
          symbol,
          side: "BUY",
          quantity,
          entryPrice: price,
          currentPrice: price,
          pnl: 0,
        };
        newPositions.push(newPos);
      }
    } else if (side === "SELL" && existingPosition) {
      const newQuantity = existingPosition.quantity - quantity;
      
      if (newQuantity === 0) {
        newPositions = positions.filter((p) => p.symbol !== symbol);
      } else {
        newPositions = positions.map((p) =>
          p.symbol === symbol ? { ...p, quantity: newQuantity } : p
        );
      }
    }

    const newLog: TradeHistory = {
      id: Math.random().toString(36).substring(7),
      symbol,
      side,
      quantity,
      price,
      timestamp: new Date().toLocaleTimeString(),
    };

    set({
      balance: {
        ...balance,
        cash: newCash,
        buyingPower: newCash,
      },
      positions: newPositions,
      tradeHistory: [newLog, ...tradeHistory],
    });

    return true;
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

    set({
      positions: updatedPositions,
      balance: {
        ...balance,
        equity: balance.cash + totalPnL,
        dayPnl: totalPnL,
        dayPnlPercent: balance.cash > 0 ? (totalPnL / balance.cash) * 100 : 0,
      }
    });
  },

  resetAccount: () => set({
    balance: defaultBalance,
    positions: [],
    tradeHistory: []
  }),
}));