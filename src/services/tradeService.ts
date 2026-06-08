// src/services/tradeService.ts
const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

export interface TradeExecutionParams {
  symbol: string;
  side: "BUY" | "SELL";
  quantity: number;
  price: number;
}

export interface TradeExecutionResult {
  success: boolean;
  newCash?: number;
  newEquity?: number;
  positions?: Position[];
  tradeHistory?: TradeHistory[];
  error?: string;
}

interface Position {
  id: string;
  symbol: string;
  side: string;
  quantity: number;
  entryPrice: number;
  currentPrice: number;
  pnl: number;
}

interface TradeHistory {
  id: string;
  symbol: string;
  side: string;
  quantity: number;
  price: number;
  timestamp: string;
}

export const tradeService = {
  async executeTrade(params: TradeExecutionParams & { userId: string }): Promise<TradeExecutionResult> {
    const response = await fetch(`${API_BASE}/api/trade/execute`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Clerk-User-Id": params.userId,
      },
      body: JSON.stringify({
        symbol: params.symbol,
        side: params.side,
        quantity: params.quantity,
        price: params.price,
      }),
    });
    
    if (!response.ok) {
      const error = await response.json();
      return { success: false, error: error.error || "Trade execution failed" };
    }
    
    return await response.json();
  },
  
  async resetAccount(userId: string): Promise<{ success: boolean; error?: string }> {
    const response = await fetch(`${API_BASE}/api/reset-account`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Clerk-User-Id": userId,
      },
    });
    
    if (!response.ok) {
      const error = await response.json();
      return { success: false, error: error.error };
    }
    
    return await response.json();
  },
};