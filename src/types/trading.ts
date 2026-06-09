// src/types/trading.ts
export type TradeSide = "BUY" | "SELL";

export interface UserProfile {
  id: string;
  name: string;
  email: string;
}

export interface UserBalance {
  cash: number;
  equity: number;
  buyingPower: number;
  dayPnl: number;
  dayPnlPercent: number;
}

export interface Position {
  id: string;
  symbol: string;
  side: TradeSide;
  quantity: number;
  entryPrice: number;
  currentPrice: number;
  pnl: number;
  // Add these if your code references them
  entry_price?: number;  // For backward compatibility
  pnlPercent?: number;
}

export interface TradeHistory {
  id: string;
  symbol: string;
  side: TradeSide;
  quantity: number;
  price: number;
  timestamp: string;
}

export interface WatchlistItem {
  symbol: string;
  price: number;
  changePercent: number;
}

export interface AssetStats {
  symbol: string;
  lastPrice: number;
  high24h: number;
  low24h: number;
  volume24h: number;
  changePercent: number;
}


export interface ChartPreset {
  label: string;
  rangeSeconds: number;
  granularity: number;
  interval: string;
  description?: string;
}

export interface LegendData {
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
  ma50: string;
  ema20: string;
  isPriceUp: boolean;
}

export interface VolumeDataPoint {
  time: number;
  value: number;
  color: string;
}

export interface MADataPoint {
  time: number;
  value: number;
}

export interface EMADataPoint {
  time: number;
  value: number;
}