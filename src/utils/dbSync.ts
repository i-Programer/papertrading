// src/utils/dbSync.ts
import { supabase } from "./supabase";
import type { Position, TradeHistory } from "@/types/trading";

// 1. Fungsi untuk mendaftarkan / memperbarui profil user di Supabase
export async function syncUserProfileToDB(clerkId: string, name: string, email: string) {
  const { data, error } = await supabase
    .from("profiles")
    .upsert(
      { id: clerkId, name, email },
      { onConflict: "id" } // Jika ID sudah ada, hiraukan atau update info dasar saja
    )
    .select()
    .single();

  if (error) {
    console.error("Gagal sinkronisasi profil ke Supabase:", error.message);
    return null;
  }
  return data;
}

// 2. Fungsi untuk mengambil seluruh data portofolio user yang tersimpan di cloud
export async function fetchUserPortfolioFromDB(clerkId: string) {
  // Ambil saldo
  const { data: profile } = await supabase
    .from("profiles")
    .select("cash, equity")
    .eq("id", clerkId)
    .single();

  // Ambil posisi koin aktif
  const { data: dbPositions } = await supabase
    .from("positions")
    .select("*")
    .eq("user_id", clerkId);

  // Ambil log histori transaksi
  const { data: dbHistory } = await supabase
    .from("trade_history")
    .select("*")
    .eq("user_id", clerkId)
    .order("timestamp", { ascending: false });

  // Format ulang data dari DB agar sesuai dengan interface TypeScript di Zustand kita
  const formattedPositions: Position[] = (dbPositions || []).map((p) => ({
    id: p.id,
    symbol: p.symbol,
    side: p.side,
    quantity: parseFloat(p.quantity),
    entryPrice: parseFloat(p.entry_price),
    currentPrice: parseFloat(p.entry_price), // Sementara disamakan, nanti di-update oleh live websocket
    pnl: 0,
  }));

  const formattedHistory: TradeHistory[] = (dbHistory || []).map((h) => ({
    id: h.id,
    symbol: h.symbol,
    side: h.side,
    quantity: parseFloat(h.quantity),
    price: parseFloat(h.price),
    timestamp: new Date(h.timestamp).toLocaleTimeString(),
  }));

  return {
    cash: profile?.cash ? parseFloat(profile.cash) : 100000,
    equity: profile?.equity ? parseFloat(profile.equity) : 100000,
    positions: formattedPositions,
    tradeHistory: formattedHistory,
  };
}