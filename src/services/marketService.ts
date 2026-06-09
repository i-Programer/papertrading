const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

export interface CandleData {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface Product {
  id: string;
  base_currency: string;
  quote_currency: string;
  base_min_size: string;
  base_max_size: string;
  quote_increment: string;
  status: string;
}

export const marketService = {
  async fetchCandles(
    symbol: string,
    interval: string,
    startTime: number,
    endTime: number,
    limit: number = 1000
  ): Promise<CandleData[]> {
    const response = await fetch(
      `${API_BASE}/api/candles?symbol=${symbol}&interval=${interval}&startTime=${startTime}&endTime=${endTime}&limit=${limit}`
    );
    if (!response.ok) throw new Error(`Failed to fetch candles: ${response.status}`);
    const rawData = await response.json();
    
    return rawData.map((row: number[]) => ({
      time: Math.floor(row[0] / 1000),
      open: parseFloat(row[1]),
      high: parseFloat(row[2]),
      low: parseFloat(row[3]),
      close: parseFloat(row[4]),
      volume: parseFloat(row[5]),
    }));
  },

  async fetchProducts(): Promise<Product[]> {
    const response = await fetch(`${API_BASE}/api/products`);
    if (!response.ok) throw new Error(`Failed to fetch products: ${response.status}`);
    const data = await response.json();
    
    return data
      .filter((p: Product) => p.quote_currency === "USDT" && p.status === "TRADING")
      .map((p: Product) => ({
        ...p,
        quote_currency: "USD",
      }));
  },

  async fetchTicker(symbol: string) {
    const response = await fetch(`${API_BASE}/api/ticker?symbol=${symbol}`);
    if (!response.ok) throw new Error(`Failed to fetch ticker: ${response.status}`);
    return response.json();
  },
};