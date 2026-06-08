// src/hooks/useChartData.ts (COMPLETE UPDATED VERSION)
import { useState, useEffect, useRef, useCallback } from "react";
import { marketService, type CandleData } from "@/services/marketService";
import { wsManager, type TickerMessage } from "@/lib/websocket-manager";

export interface ChartPreset {
  label: string;
  rangeSeconds: number;
  granularity: number;
  interval: string;
  description?: string;
}

export const CHART_PRESETS: ChartPreset[] = [
  { label: "12H (1m)", rangeSeconds: 12 * 3600, granularity: 60, interval: "1m", description: "12 hours - 1 minute candles" },
  { label: "1D (3m)", rangeSeconds: 24 * 3600, granularity: 180, interval: "3m", description: "24 hours - 3 minute candles" },
  { label: "3D (5m)", rangeSeconds: 3 * 24 * 3600, granularity: 300, interval: "5m", description: "3 days - 5 minute candles" },
  { label: "7D (15m)", rangeSeconds: 7 * 24 * 3600, granularity: 900, interval: "15m", description: "7 days - 15 minute candles" },
  { label: "14D (30m)", rangeSeconds: 14 * 24 * 3600, granularity: 1800, interval: "30m", description: "14 days - 30 minute candles" },
  { label: "1M (1h)", rangeSeconds: 30 * 24 * 3600, granularity: 3600, interval: "1h", description: "1 month - 1 hour candles" },
  { label: "3M (2h)", rangeSeconds: 90 * 24 * 3600, granularity: 7200, interval: "2h", description: "3 months - 2 hour candles" },
  { label: "6M (4h)", rangeSeconds: 180 * 24 * 3600, granularity: 14400, interval: "4h", description: "6 months - 4 hour candles" },
  { label: "1Y (1d)", rangeSeconds: 365 * 24 * 3600, granularity: 86400, interval: "1d", description: "1 year - 1 day candles" },
  { label: "2Y (2d)", rangeSeconds: 730 * 24 * 3600, granularity: 172800, interval: "2d", description: "2 years - 2 day candles" },
  { label: "5Y (1w)", rangeSeconds: 5 * 365 * 24 * 3600, granularity: 604800, interval: "1w", description: "5 years - 1 week candles" },
];

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

// Helper: Deduplicate and sort candles
const deduplicateAndSortCandles = (candles: CandleData[]): CandleData[] => {
  const uniqueMap = new Map<number, CandleData>();
  
  for (const candle of candles) {
    const existing = uniqueMap.get(candle.time);
    if (!existing) {
      uniqueMap.set(candle.time, candle);
    } else if (candle.volume > existing.volume) {
      uniqueMap.set(candle.time, candle);
    }
  }
  
  return Array.from(uniqueMap.values()).sort((a, b) => a.time - b.time);
};

const calculateMA = (data: CandleData[], period: number) => {
  const result = [];
  for (let i = period - 1; i < data.length; i++) {
    let sum = 0;
    for (let j = 0; j < period; j++) sum += data[i - j].close;
    result.push({ time: data[i].time, value: sum / period });
  }
  return result;
};

const calculateEMA = (data: CandleData[], period: number) => {
  if (data.length < period) return [];
  const k = 2 / (period + 1);
  let sum = 0;
  for (let i = 0; i < period; i++) sum += data[i].close;
  let prevEma = sum / period;
  const result = [{ time: data[period - 1].time, value: prevEma }];
  for (let i = period; i < data.length; i++) {
    const currentEma = data[i].close * k + prevEma * (1 - k);
    result.push({ time: data[i].time, value: currentEma });
    prevEma = currentEma;
  }
  return result;
};

const formatVolumeDisplay = (value: number): string => {
  if (value >= 1e9) return (value / 1e9).toFixed(2) + "B";
  if (value >= 1e6) return (value / 1e6).toFixed(2) + "M";
  if (value >= 1e3) return (value / 1e3).toFixed(2) + "K";
  return value.toLocaleString("en-US", { maximumFractionDigits: 0 });
};

export function useChartData(symbol: string, preset: ChartPreset) {
  const [candles, setCandles] = useState<CandleData[]>([]);
  const [volumeData, setVolumeData] = useState<any[]>([]);
  const [ma50Data, setMa50Data] = useState<any[]>([]);
  const [ema20Data, setEma20Data] = useState<any[]>([]);
  const [legend, setLegend] = useState<LegendData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [realtimePrice, setRealtimePrice] = useState<number | null>(null);

  // Realtime candle builder refs
  const lastCandleTimeRef = useRef<number | null>(null);
  const lastOpenRef = useRef<number>(0);
  const lastHighRef = useRef<number>(0);
  const lastLowRef = useRef<number>(0);
  const accumulatedVolumeRef = useRef<number>(0);

  // Fetch historical data
  const fetchHistory = useCallback(async () => {
    setIsLoading(true);
    try {
      const now = Math.floor(Date.now() / 1000);
      const startTime = now - preset.rangeSeconds;
      const rawCandles = await marketService.fetchCandles(
        symbol,
        preset.interval,
        startTime * 1000,
        now * 1000,
        1000
      );

      // Deduplicate and sort
      const uniqueCandles = deduplicateAndSortCandles(rawCandles);
      
      if (uniqueCandles.length === 0) {
        console.warn("No valid candles received");
        setIsLoading(false);
        return;
      }

      setCandles(uniqueCandles);

      // Build volume data
      const volumes = uniqueCandles.map((c) => ({
        time: c.time,
        value: c.volume,
        color: c.close >= c.open ? "rgba(38, 166, 154, 0.4)" : "rgba(239, 83, 80, 0.4)",
      }));
      setVolumeData(volumes);

      // Calculate indicators
      if (uniqueCandles.length >= 50) {
        const ma50 = calculateMA(uniqueCandles, 50);
        const ema20 = calculateEMA(uniqueCandles, 20);
        setMa50Data(ma50);
        setEma20Data(ema20);
      }

      // Set initial legend
      const last = uniqueCandles[uniqueCandles.length - 1];
      const lastVol = volumes[volumes.length - 1];
      setLegend({
        open: last.open.toFixed(2),
        high: last.high.toFixed(2),
        low: last.low.toFixed(2),
        close: last.close.toFixed(2),
        volume: lastVol ? formatVolumeDisplay(lastVol.value) : "-",
        ma50: ma50Data.length > 0 ? ma50Data[ma50Data.length - 1]?.value.toFixed(2) || "-" : "-",
        ema20: ema20Data.length > 0 ? ema20Data[ema20Data.length - 1]?.value.toFixed(2) || "-" : "-",
        isPriceUp: last.close >= last.open,
      });
      
      // Reset realtime refs
      lastCandleTimeRef.current = null;
      lastOpenRef.current = 0;
      lastHighRef.current = 0;
      lastLowRef.current = 0;
      accumulatedVolumeRef.current = 0;
      
    } catch (err) {
      console.error("Failed to fetch chart data:", err);
    } finally {
      setIsLoading(false);
    }
  }, [symbol, preset, preset.interval]);

  

  // WebSocket realtime update handler
  const handleRealtimeUpdate = useCallback(
    (price: number, volume: number) => {
      setRealtimePrice(price);
      const granularity = preset.granularity;
      const currentTimeStamp = Math.floor(Date.now() / 1000);
      const candleTimeStamp = currentTimeStamp - (currentTimeStamp % granularity);

      setCandles((prev) => {
        let newCandles = [...prev];
        const existingIndex = newCandles.findIndex(c => c.time === candleTimeStamp);
        
        if (existingIndex !== -1) {
          // Update existing candle
          const existingCandle = newCandles[existingIndex];
          const updatedCandle = {
            ...existingCandle,
            high: Math.max(existingCandle.high, price),
            low: Math.min(existingCandle.low, price),
            close: price,
            volume: existingCandle.volume + volume,
          };
          newCandles[existingIndex] = updatedCandle;
          
          // Update refs
          lastOpenRef.current = existingCandle.open;
          lastHighRef.current = updatedCandle.high;
          lastLowRef.current = updatedCandle.low;
          accumulatedVolumeRef.current = updatedCandle.volume;
        } else if (newCandles.length === 0 || candleTimeStamp > newCandles[newCandles.length - 1].time) {
          // Create new candle at the end
          const newCandle: CandleData = {
            time: candleTimeStamp,
            open: price,
            high: price,
            low: price,
            close: price,
            volume: volume,
          };
          newCandles.push(newCandle);
          
          // Update refs
          lastCandleTimeRef.current = candleTimeStamp;
          lastOpenRef.current = price;
          lastHighRef.current = price;
          lastLowRef.current = price;
          accumulatedVolumeRef.current = volume;
        }
        
        // Deduplicate and return
        return deduplicateAndSortCandles(newCandles);
      });

      // Update legend
      setLegend((prevLegend) => {
        if (!prevLegend) return prevLegend;
        return {
          ...prevLegend,
          open: lastOpenRef.current.toFixed(2),
          high: lastHighRef.current.toFixed(2),
          low: lastLowRef.current.toFixed(2),
          close: price.toFixed(2),
          volume: formatVolumeDisplay(accumulatedVolumeRef.current),
          isPriceUp: price >= lastOpenRef.current,
        };
      });
    },
    [preset.granularity]
  );

  // Subscribe to WebSocket
  useEffect(() => {
    fetchHistory();

    const unsubscribe = wsManager.subscribe("ticker", (data: TickerMessage) => {
      if (data.product_id === symbol && data.price) {
        const price = parseFloat(data.price);
        const volume = parseFloat(data.last_size || "0");
        handleRealtimeUpdate(price, volume);
      }
    });

    wsManager.connect(symbol);

    return () => unsubscribe();
  }, [symbol, preset, fetchHistory, handleRealtimeUpdate]);

  return {
    candles,
    volumeData,
    ma50Data,
    ema20Data,
    legend,
    realtimePrice,
    isLoading,
    preset,
  };
}