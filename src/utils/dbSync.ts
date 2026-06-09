// src/utils/dbSync.ts - Add cache to prevent redundant fetches
import { profileService } from "@/services/profileService";
import type { Position, TradeHistory } from "@/types/trading";
import { generateId } from "@/utils/id";

// 🔥 Add simple cache
const fetchCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 10000; // 10 seconds

export async function fetchUserPortfolioFromDB(clerkId: string) {
  // Check cache
  const cached = fetchCache.get(clerkId);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    console.log("Using cached portfolio data for:", clerkId);
    return cached.data;
  }
  
  try {
    console.log("Fetching fresh portfolio data for:", clerkId);
    const data = await profileService.fetchUserProfile(clerkId);
    
    const cash = data.balance?.cash ?? 100000;
    const equity = data.balance?.equity ?? cash;
    
    const transformedPositions = (data.positions || []).map((pos: any) => ({
      id: pos.id || generateId(),
      symbol: pos.symbol || 'BTCUSDT',
      side: pos.side || "BUY",
      quantity: parseFloat(pos.quantity || 0),
      entryPrice: parseFloat(pos.entry_price || pos.entryPrice || 0),
      currentPrice: parseFloat(pos.current_price || pos.currentPrice || pos.entry_price || 0),
      pnl: 0,
    }));
    
    const transformedHistory = (data.tradeHistory || []).map((trade: any) => ({
      id: trade.id || generateId(),
      symbol: trade.symbol || 'BTCUSDT',
      side: trade.side || "BUY",
      quantity: parseFloat(trade.quantity || 0),
      price: parseFloat(trade.price || 0),
      timestamp: trade.timestamp || new Date().toISOString(),
    }));
    
    const result = {
      cash,
      equity,
      positions: transformedPositions,
      tradeHistory: transformedHistory,
    };
    
    // Store in cache
    fetchCache.set(clerkId, { data: result, timestamp: Date.now() });
    
    return result;
  } catch (error) {
    console.error("Failed to fetch portfolio:", error);
    return {
      cash: 100000,
      equity: 100000,
      positions: [],
      tradeHistory: [],
    };
  }
}

export async function syncUserProfileToDB(clerkId: string, name: string, email: string) {
  // Clear cache for this user when profile updates
  fetchCache.delete(clerkId);
  
  try {
    await profileService.syncUserProfile(clerkId, name, email);
    console.log("Profile synced successfully for:", clerkId);
  } catch (error) {
    console.error("Failed to sync profile:", error);
  }
}