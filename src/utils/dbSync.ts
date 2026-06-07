// src/utils/dbSync.ts
import { profileService } from "@/services/profileService";
import type { Position, TradeHistory } from "@/types/trading";

// Helper: Normalize symbol format (BTC-USD -> BTCUSDT)
const normalizeSymbol = (symbol: string): string => {
  if (!symbol) return "BTCUSDT";
  
  // Remove any dash and convert to USDT format
  let normalized = symbol.replace(/-/g, '');
  
  // Handle special cases
  if (normalized === 'BTCUSD') return 'BTCUSDT';
  if (normalized === 'ETHUSD') return 'ETHUSDT';
  if (normalized === 'BNBUSD') return 'BNBUSDT';
  if (normalized === 'SOLUSD') return 'SOLUSDT';
  if (normalized === 'XRPUSD') return 'XRPUSDT';
  if (normalized === 'ADAUSD') return 'ADAUSDT';
  if (normalized === 'DOGEUSD') return 'DOGEUSDT';
  if (normalized === 'AVAXUSD') return 'AVAXUSDT';
  if (normalized === 'DOTUSD') return 'DOTUSDT';
  if (normalized === 'MATICUSD') return 'MATICUSDT';
  
  // If it ends with USDT already, keep as is
  if (normalized.endsWith('USDT')) return normalized;
  
  // Default: add USDT
  return `${normalized}USDT`;
};

// Helper: Transform backend position to frontend Position type
const transformPosition = (backendPosition: any, currentPrice?: number): Position => {
  // Safely extract values with fallbacks
  const entryPrice = parseFloat(backendPosition.entry_price || backendPosition.entryPrice || 0);
  const quantity = parseFloat(backendPosition.quantity || 0);
  const symbol = normalizeSymbol(backendPosition.symbol || 'BTCUSDT');
  
  // Use provided currentPrice, or from backend, or fallback to entryPrice
  const current = currentPrice || backendPosition.currentPrice || backendPosition.current_price || entryPrice;
  
  // Calculate P&L (don't rely on backend's null value)
  const pnl = (current - entryPrice) * quantity;
  
  return {
    id: backendPosition.id || crypto.randomUUID(),
    symbol: symbol,
    side: backendPosition.side || "BUY",
    quantity: quantity,
    entryPrice: entryPrice,
    currentPrice: current,
    pnl: pnl,
  };
};

// Helper: Transform trade history
const transformTradeHistory = (backendTrade: any): TradeHistory => {
  return {
    id: backendTrade.id || crypto.randomUUID(),
    symbol: normalizeSymbol(backendTrade.symbol || 'BTCUSDT'),
    side: backendTrade.side || "BUY",
    quantity: parseFloat(backendTrade.quantity || 0),
    price: parseFloat(backendTrade.price || 0),
    timestamp: backendTrade.timestamp || new Date().toISOString(),
  };
};

export async function syncUserProfileToDB(clerkId: string, name: string, email: string) {
  try {
    await profileService.syncUserProfile(clerkId, name, email);
    console.log("Profile synced successfully");
  } catch (error) {
    console.error("Failed to sync profile:", error);
  }
}

export async function fetchUserPortfolioFromDB(clerkId: string) {
  try {
    const data = await profileService.fetchUserProfile(clerkId);
    
    // console.log("Raw data from backend:", data); // Debug log
    
    // Transform positions - ensure every position has currentPrice and pnl
    const transformedPositions = (data.positions || []).map((pos: any) => {
      const transformed = transformPosition(pos);
      // console.log(`Transformed position ${pos.symbol}:`, transformed); // Debug log
      return transformed;
    });
    
    const transformedHistory = (data.tradeHistory || []).map(transformTradeHistory);
    
    // Get cash balance with fallback
    const cash = data.balance?.cash ?? 100000;
    const equity = data.balance?.equity ?? cash;
    
    return {
      cash: cash,
      equity: equity,
      positions: transformedPositions,
      tradeHistory: transformedHistory,
    };
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

// Helper function to update positions with live prices (called from WebSocket updates)
export function updatePositionsWithLivePrices(
  positions: Position[], 
  symbol: string, 
  currentPrice: number
): Position[] {
  return positions.map((pos) => {
    if (pos.symbol === symbol) {
      const pnl = (currentPrice - pos.entryPrice) * pos.quantity;
      return {
        ...pos,
        currentPrice,
        pnl,
      };
    }
    return pos;
  });
}