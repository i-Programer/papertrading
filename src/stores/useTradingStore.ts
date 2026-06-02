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

export const useTradingStore = create<TradingState>((set, get) => ({
  // 1. DIUBAH: Menyesuaikan nilai default dengan format instrumen Coinbase (BTC-USD)
  symbol: "BTC-USD",
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

  executeTradeWithDB: async (side, quantity, price) => {
    const { symbol, balance, positions, tradeHistory, profile } = get();
    const isGuest = profile.id === "demo-user";
    const totalCost = quantity * price;

    // --- 1. VALIDASI SALDO & KEPEMILIKAN ---
    if (side === "BUY" && balance.cash < totalCost) {
      alert("⚠️ Transaksi Gagal: Saldo Virtual Cash Tidak Cukup!");
      return false;
    }

    const existingPosition = positions.find((p) => p.symbol === symbol);
    if (side === "SELL" && (!existingPosition || existingPosition.quantity < quantity)) {
      alert("⚠️ Transaksi Gagal: Anda tidak memiliki cukup aset untuk dijual!");
      return false;
    }

    // --- 2. KALKULASI LOGIKA TRADING ---
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
          id: Math.random().toString(36).substring(7),
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
      id: Math.random().toString(36).substring(7),
      symbol,
      side,
      quantity,
      price,
      timestamp: new Date().toLocaleTimeString(),
    };

    // --- 3. JALUR NEGOSIASI DATA (GUEST VS CLOUD DB) ---
    if (isGuest) {
      set({
        balance: { ...balance, cash: newCash, buyingPower: newCash },
        positions: newPositions,
        tradeHistory: [newLog, ...tradeHistory],
      });
      return true;
    } else {
      try {
        set({ isLoading: true });
        const { data: { user } } = await supabase.auth.session ? { data: { user: { id: null } } } : { data: { user: null } }; 
        const clerkUserId = user?.id || (window as any).Clerk?.user?.id;

        if (!clerkUserId) {
          alert("Sesi login terputus, silakan refresh halaman.");
          return false;
        }

        // A. Insert History Log
        await supabase.from("trade_history").insert({
          user_id: clerkUserId,
          symbol,
          side,
          quantity,
          price,
        });

        // B. Upsert Positions
        if (side === "BUY" || (side === "SELL" && finalQty > 0)) {
          await supabase.from("positions").upsert(
            {
              user_id: clerkUserId,
              symbol,
              side: "BUY",
              quantity: finalQty,
              entry_price: finalAvgPrice,
            },
            { onConflict: "user_id,symbol" }
          );
        } else if (side === "SELL" && finalQty === 0) {
          await supabase
            .from("positions")
            .delete()
            .eq("user_id", clerkUserId)
            .eq("symbol", symbol);
        }

        // C. Update Cash di Profiles
        await supabase
          .from("profiles")
          .update({ cash: newCash, equity: newCash })
          .eq("id", clerkUserId);

        set({
          balance: { ...balance, cash: newCash, buyingPower: newCash },
          positions: newPositions,
          tradeHistory: [newLog, ...tradeHistory],
        });

        return true;
      } catch (err) {
        console.error("Database Transaction Error:", err);
        alert("Terjadi kendala jaringan saat menyimpan transaksi.");
        return false;
      } finally {
        set({ isLoading: false });
      }
    }
  },

  // 2. DISESUAIKAN: Memastikan kalkulasi PnL berjalan mulus dengan data Coinbase live feed
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