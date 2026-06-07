// src/components/ChartArea.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { 
  createChart, 
  ColorType, 
  CandlestickSeries, 
  HistogramSeries,
  LineSeries,
  IChartApi,
  ISeriesApi,
  CandlestickData,
  HistogramData,
  Time,
  UTCTimestamp
} from "lightweight-charts";
import { useTradingStore } from "@/stores/useTradingStore";
import { Loader2 } from "lucide-react";
import { wsManager, type TickerMessage } from "@/lib/websocket-manager";

interface CandleData {
  time: UTCTimestamp;
  open: number;
  high: number;
  low: number;
  close: number;
}

interface VolumeData {
  time: UTCTimestamp;
  value: number;
  color: string;
}

interface MAData {
  time: UTCTimestamp;
  value: number;
}

interface EMAData {
  time: UTCTimestamp;
  value: number;
}

interface LegendData {
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
  ma50: string;
  ema20: string;
  isPriceUp: boolean;
}

// Enhanced presets with more time ranges
const CHART_PRESETS = [
  { 
    label: "12H (1m)", 
    rangeSeconds: 12 * 3600, 
    granularity: 60, 
    description: "12 hours - 1 minute candles",
    interval: '1m'
  },
  { 
    label: "1D (3m)", 
    rangeSeconds: 24 * 3600, 
    granularity: 180, 
    description: "24 hours - 3 minute candles",
    interval: '3m'
  },
  { 
    label: "3D (5m)", 
    rangeSeconds: 3 * 24 * 3600, 
    granularity: 300, 
    description: "3 days - 5 minute candles",
    interval: '5m'
  },
  { 
    label: "7D (15m)", 
    rangeSeconds: 7 * 24 * 3600, 
    granularity: 900, 
    description: "7 days - 15 minute candles",
    interval: '15m'
  },
  { 
    label: "14D (30m)", 
    rangeSeconds: 14 * 24 * 3600, 
    granularity: 1800, 
    description: "14 days - 30 minute candles",
    interval: '30m'
  },
  { 
    label: "1M (1h)", 
    rangeSeconds: 30 * 24 * 3600, 
    granularity: 3600, 
    description: "1 month - 1 hour candles",
    interval: '1h'
  },
  { 
    label: "3M (2h)", 
    rangeSeconds: 90 * 24 * 3600, 
    granularity: 7200, 
    description: "3 months - 2 hour candles",
    interval: '2h'
  },
  { 
    label: "6M (4h)", 
    rangeSeconds: 180 * 24 * 3600, 
    granularity: 14400, 
    description: "6 months - 4 hour candles",
    interval: '4h'
  },
  { 
    label: "1Y (1d)", 
    rangeSeconds: 365 * 24 * 3600, 
    granularity: 86400, 
    description: "1 year - 1 day candles",
    interval: '1d'
  },
  { 
    label: "2Y (2d)", 
    rangeSeconds: 730 * 24 * 3600, 
    granularity: 172800, 
    description: "2 years - 2 day candles",
    interval: '2d'
  },
  { 
    label: "5Y (1w)", 
    rangeSeconds: 5 * 365 * 24 * 3600, 
    granularity: 604800, 
    description: "5 years - 1 week candles",
    interval: '1w'
  },
];

function calculateMA(data: CandleData[], period: number): MAData[] {
  const maData: MAData[] = [];
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) continue;
    let sum = 0;
    for (let j = 0; j < period; j++) sum += data[i - j].close;
    maData.push({ time: data[i].time, value: sum / period });
  }
  return maData;
}

function calculateEMA(data: CandleData[], period: number): EMAData[] {
  const emaData: EMAData[] = [];
  if (data.length < period) return [];
  const k = 2 / (period + 1);
  let sum = 0;
  for (let i = 0; i < period; i++) sum += data[i].close;
  let prevEma = sum / period;
  emaData.push({ time: data[period - 1].time, value: prevEma });

  for (let i = period; i < data.length; i++) {
    const currentEma = data[i].close * k + prevEma * (1 - k);
    emaData.push({ time: data[i].time, value: currentEma });
    prevEma = currentEma;
  }
  return emaData;
}

function getBinanceInterval(granularity: number): string {
  const intervals: Record<number, string> = {
    60: '1m',
    180: '3m',
    300: '5m',
    900: '15m',
    1800: '30m',
    3600: '1h',
    7200: '2h',
    14400: '4h',
    21600: '6h',
    43200: '12h',
    86400: '1d',
    172800: '2d',
    604800: '1w',
  };
  return intervals[granularity] || '1h';
}

// Helper to format volume for display (K/M/B suffixes)
function formatVolumeDisplay(value: number): string {
  if (value >= 1_000_000_000) {
    return (value / 1_000_000_000).toFixed(2) + 'B';
  }
  if (value >= 1_000_000) {
    return (value / 1_000_000).toFixed(2) + 'M';
  }
  if (value >= 1_000) {
    return (value / 1_000).toFixed(2) + 'K';
  }
  return value.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

export default function ChartArea() {
  const symbol = useTradingStore((state) => state.symbol);
  const [selectedPreset, setSelectedPreset] = useState(CHART_PRESETS[2]); // Default to 3D (5m)
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const [chartLoading, setChartLoading] = useState(true);
  const [isMounted, setIsMounted] = useState(false);

  const [legendData, setLegendData] = useState<LegendData>({
    open: "-", high: "-", low: "-", close: "-", volume: "-", ma50: "-", ema20: "-", isPriceUp: true
  });

  const lastValidDataRef = useRef<LegendData | null>(null);
  
  // Store MA/EMA data for crosshair
  const maDataRef = useRef<MAData[]>([]);
  const emaDataRef = useRef<EMAData[]>([]);
  
  // Refs to avoid re-render cycles
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const maSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const emaSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  
  // Real-time data tracking
  const lastCandleTimeRef = useRef<number | null>(null);
  const lastOpenRef = useRef<number>(0);
  const lastHighRef = useRef<number>(0);
  const lastLowRef = useRef<number>(0);
  const accumulatedVolumeRef = useRef<number>(0);

  // Handle hydration
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Effect 1: Chart initialization and data fetching
  useEffect(() => {
    if (!isMounted || !chartContainerRef.current) return;

    setChartLoading(true);

    const chart = createChart(chartContainerRef.current, {
      layout: { 
        background: { type: ColorType.Solid, color: "#131722" }, 
        textColor: "#d1d4dc" 
      },
      grid: { 
        vertLines: { color: "#2a2e39" }, 
        horzLines: { color: "#2a2e39" } 
      },
      rightPriceScale: { borderColor: "#2a2e39" },
      timeScale: { 
        borderColor: "#2a2e39", 
        timeVisible: true, 
        secondsVisible: false 
      },
      width: chartContainerRef.current.clientWidth,
      height: chartContainerRef.current.clientHeight,
    });
    chartRef.current = chart;

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: "#26a69a", 
      downColor: "#ef5350", 
      borderVisible: false, 
      wickUpColor: "#26a69a", 
      wickDownColor: "#ef5350"
    });
    candleSeriesRef.current = candleSeries;

    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceFormat: { type: "volume" }, 
      priceScaleId: "volume-scale"
    });
    volumeSeriesRef.current = volumeSeries;

    const maSeries = chart.addSeries(LineSeries, { 
      color: "#f5bc3f", 
      priceLineVisible: false, 
      lineWidth: 1 
    });
    maSeriesRef.current = maSeries;

    const emaSeries = chart.addSeries(LineSeries, { 
      color: "#26c6da", 
      priceLineVisible: false, 
      lineWidth: 1 
    });
    emaSeriesRef.current = emaSeries;

    chart.priceScale("volume-scale").applyOptions({
      borderVisible: false, 
      visible: false, 
      scaleMargins: { top: 0.8, bottom: 0 },
    });

    const fetchHistory = async () => {
      try {
        const now = Math.floor(Date.now() / 1000);
        const startTime = (now - selectedPreset.rangeSeconds);
        const granularity = selectedPreset.granularity;
        const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

        const binanceInterval = getBinanceInterval(granularity);
        
        console.log(`[Chart] Fetching ${selectedPreset.description}...`);
        
        const response = await fetch(
          `${API_BASE_URL}/api/candles?symbol=${symbol}&interval=${binanceInterval}&startTime=${startTime * 1000}&endTime=${now * 1000}&limit=1000`
        );

        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const rawData: unknown[] = await response.json();
        
        if (!rawData || rawData.length === 0) {
          console.log("No candle data received");
          setChartLoading(false);
          return;
        }

        console.log(`[Chart] Received ${rawData.length} candles for ${selectedPreset.label}`);

        const formattedCandles: CandleData[] = rawData
          .map((row: unknown) => {
            const rowArray = row as number[];
            const timeInSeconds = Math.floor(rowArray[0] / 1000) as UTCTimestamp;
            return {
              time: timeInSeconds,
              open: Number(rowArray[1]),
              high: Number(rowArray[2]),
              low: Number(rowArray[3]),
              close: Number(rowArray[4])
            };
          })
          .filter(candle => candle.time && !isNaN(candle.open) && !isNaN(candle.high) && !isNaN(candle.low) && !isNaN(candle.close))
          .sort((a: CandleData, b: CandleData) => a.time - b.time);

        if (formattedCandles.length === 0) {
          console.log("No valid candles after formatting");
          setChartLoading(false);
          return;
        }

        const formattedVolume: VolumeData[] = rawData
          .map((row: unknown) => {
            const rowArray = row as number[];
            const timeInSeconds = Math.floor(rowArray[0] / 1000) as UTCTimestamp;
            const close = Number(rowArray[4]);
            const open = Number(rowArray[1]);
            return {
              time: timeInSeconds,
              value: Number(rowArray[5]),
              color: close >= open ? "rgba(38, 166, 154, 0.4)" : "rgba(239, 83, 80, 0.4)",
            };
          })
          .filter(vol => vol.time && !isNaN(vol.value))
          .sort((a: VolumeData, b: VolumeData) => a.time - b.time);

        if (candleSeriesRef.current) {
          candleSeriesRef.current.setData(formattedCandles);
        }
        if (volumeSeriesRef.current) {
          volumeSeriesRef.current.setData(formattedVolume);
        }

        // Calculate and store indicators
        if (formattedCandles.length >= 50) {
          const ma50Data = calculateMA(formattedCandles, 50);
          const ema20Data = calculateEMA(formattedCandles, 20);
          maDataRef.current = ma50Data;
          emaDataRef.current = ema20Data;
          if (maSeriesRef.current) maSeriesRef.current.setData(ma50Data);
          if (emaSeriesRef.current) emaSeriesRef.current.setData(ema20Data);
        }

        const lastCandle = formattedCandles[formattedCandles.length - 1];
        const lastVol = formattedVolume[formattedVolume.length - 1];
        
        const initialLegend: LegendData = {
          open: lastCandle.open.toFixed(2),
          high: lastCandle.high.toFixed(2),
          low: lastCandle.low.toFixed(2),
          close: lastCandle.close.toFixed(2),
          volume: lastVol ? formatVolumeDisplay(lastVol.value) : "-",
          ma50: maDataRef.current.length > 0 ? maDataRef.current[maDataRef.current.length - 1].value.toFixed(2) : "-",
          ema20: emaDataRef.current.length > 0 ? emaDataRef.current[emaDataRef.current.length - 1].value.toFixed(2) : "-",
          isPriceUp: lastCandle.close >= lastCandle.open
        };

        lastValidDataRef.current = initialLegend;
        setLegendData(initialLegend);

        if (chartRef.current) {
          chartRef.current.timeScale().fitContent();
        }
        setChartLoading(false);
      } catch (err) {
        console.error("Failed to load chart data:", err);
        setChartLoading(false);
      }
    };

    fetchHistory();

    // Crosshair move handler with MA/EMA
    chart.subscribeCrosshairMove((param) => {
      if (
        param.point === undefined ||
        param.point.x < 0 ||
        param.point.x > chartContainerRef.current!.clientWidth ||
        param.point.y < 0 ||
        param.point.y > chartContainerRef.current!.clientHeight
      ) {
        if (lastValidDataRef.current) setLegendData(lastValidDataRef.current);
        return;
      }

      if (!param.time) {
        if (lastValidDataRef.current) setLegendData(lastValidDataRef.current);
        return;
      }

      const candleData = param.seriesData.get(candleSeries) as CandlestickData<Time> | undefined;
      const volData = param.seriesData.get(volumeSeries) as HistogramData<Time> | undefined;

      if (candleData && 'open' in candleData && 'high' in candleData && 'low' in candleData && 'close' in candleData) {
        const candle = candleData as CandlestickData<Time>;
        const candleTime = candle.time as number;
        
        // Find MA and EMA values at this timestamp
        let maValue = "-";
        let emaValue = "-";
        
        const maPoint = maDataRef.current.find(m => m.time === candleTime);
        const emaPoint = emaDataRef.current.find(e => e.time === candleTime);
        
        if (maPoint) maValue = maPoint.value.toFixed(2);
        if (emaPoint) emaValue = emaPoint.value.toFixed(2);
        
        setLegendData({
          open: (candle.open as number).toFixed(2),
          high: (candle.high as number).toFixed(2),
          low: (candle.low as number).toFixed(2),
          close: (candle.close as number).toFixed(2),
          volume: volData && 'value' in volData ? formatVolumeDisplay(volData.value as number) : "-",
          ma50: maValue,
          ema20: emaValue,
          isPriceUp: (candle.close as number) >= (candle.open as number)
        });
      }
    });

    // WebSocket Manager Integration for real-time updates
    const unsubscribe = wsManager.subscribe("ticker", (data: TickerMessage) => {
      if (data.type === "ticker" && data.price && data.product_id === symbol) {
        const currentPrice = parseFloat(data.price);
        const currentVolume = parseFloat(data.last_size || "0");
        
        const granularity = selectedPreset.granularity;
        const currentTimeStamp = Math.floor(Date.now() / 1000);
        const candleTimeStamp = currentTimeStamp - (currentTimeStamp % granularity);

        useTradingStore.getState().updateLivePrices(currentPrice);

        if (candleSeriesRef.current && volumeSeriesRef.current) {
          if (lastCandleTimeRef.current === candleTimeStamp) {
            // Update existing candle - USING ORIGINAL SCRIPT VOLUME APPROACH
            lastHighRef.current = Math.max(lastHighRef.current, currentPrice);
            lastLowRef.current = Math.min(lastLowRef.current, currentPrice);
            accumulatedVolumeRef.current += currentVolume;
            
            candleSeriesRef.current.update({ 
              time: candleTimeStamp as UTCTimestamp, 
              open: lastOpenRef.current, 
              high: lastHighRef.current, 
              low: lastLowRef.current, 
              close: currentPrice 
            });
            
            // Update volume - using scaling for display (original approach)
            const scaledVolume = accumulatedVolumeRef.current / 1000000;
            const volColor = currentPrice >= lastOpenRef.current ? "rgba(38, 166, 154, 0.4)" : "rgba(239, 83, 80, 0.4)";
            
            volumeSeriesRef.current.update({ 
              time: candleTimeStamp as UTCTimestamp, 
              value: scaledVolume,
              color: volColor 
            });
          } else {
            // Create new candle - USING ORIGINAL SCRIPT VOLUME APPROACH
            lastCandleTimeRef.current = candleTimeStamp;
            lastOpenRef.current = currentPrice;
            lastHighRef.current = currentPrice;
            lastLowRef.current = currentPrice;
            accumulatedVolumeRef.current = currentVolume;
            
            candleSeriesRef.current.update({ 
              time: candleTimeStamp as UTCTimestamp, 
              open: lastOpenRef.current, 
              high: lastHighRef.current, 
              low: lastLowRef.current, 
              close: currentPrice 
            });
            
            // Update volume for new candle - using scaling for display (original approach)
            const scaledVolume = accumulatedVolumeRef.current / 1000000;
            const volColor = currentPrice >= lastOpenRef.current ? "rgba(38, 166, 154, 0.4)" : "rgba(239, 83, 80, 0.4)";
            
            volumeSeriesRef.current.update({ 
              time: candleTimeStamp as UTCTimestamp, 
              value: scaledVolume,
              color: volColor 
            });
          }

          // Update legend data cache - using formatted display
          if (lastValidDataRef.current) {
            lastValidDataRef.current = {
              ...lastValidDataRef.current,
              open: lastOpenRef.current.toFixed(2),
              high: lastHighRef.current.toFixed(2),
              low: lastLowRef.current.toFixed(2),
              close: currentPrice.toFixed(2),
              volume: formatVolumeDisplay(accumulatedVolumeRef.current),
              isPriceUp: currentPrice >= lastOpenRef.current
            };
            setLegendData(lastValidDataRef.current);
          }
        }
      }
    });

    wsManager.connect(symbol);

    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({ 
          width: chartContainerRef.current.clientWidth, 
          height: chartContainerRef.current.clientHeight 
        });
      }
    };
    
    window.addEventListener("resize", handleResize);

    return () => {
      unsubscribe();
      window.removeEventListener("resize", handleResize);
      if (chartRef.current) {
        chartRef.current.remove();
      }
    };
  }, [symbol, selectedPreset, isMounted]);

  if (!isMounted) {
    return (
      <div className="flex flex-1 flex-col h-full bg-[#131722] p-2 relative select-none">
        <div className="flex-1 w-full relative pt-2 h-full flex items-center justify-center">
          <div className="flex flex-col items-center gap-2 text-xs text-[#787b86]">
            <Loader2 className="h-6 w-6 animate-spin text-[#2962ff]" />
            <span>Loading chart...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col h-full bg-[#131722] p-2 relative select-none">
      <div className="flex-1 w-full relative pt-2 h-full" ref={chartContainerRef}>
        
        {/* OVERLAY LEGEND */}
        <div className="absolute top-4 left-4 z-10 flex flex-col gap-1 bg-[#131722]/80 backdrop-blur-sm p-2 rounded text-[11px] font-medium pointer-events-none border border-[#2a2e39]/50">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <span className="font-bold text-white tracking-wide mr-1">{symbol}</span>
            <span className="text-[#787b86]">O</span>
            <span className={legendData.isPriceUp ? "text-[#26a69a]" : "text-[#ef5350]"}>{legendData.open}</span>
            <span className="text-[#787b86]">H</span>
            <span className={legendData.isPriceUp ? "text-[#26a69a]" : "text-[#ef5350]"}>{legendData.high}</span>
            <span className="text-[#787b86]">L</span>
            <span className={legendData.isPriceUp ? "text-[#26a69a]" : "text-[#ef5350]"}>{legendData.low}</span>
            <span className="text-[#787b86]">C</span>
            <span className={legendData.isPriceUp ? "text-[#26a69a]" : "text-[#ef5350]"}>{legendData.close}</span>
            <span className="text-[#787b86] ml-1">Vol</span>
            <span className="text-[#b2b5be] tabular-nums">{legendData.volume}</span>
          </div>
          <div className="flex items-center gap-3 text-[10px]">
            <span className="text-[#26c6da]">EMA(20): <span className="text-white font-semibold">{legendData.ema20}</span></span>
            <span className="text-[#f5bc3f]">MA(50): <span className="text-white font-semibold">{legendData.ma50}</span></span>
          </div>
        </div>

        {/* Loading Overlay */}
        {chartLoading && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-[#131722]/80 backdrop-blur-sm">
            <div className="flex flex-col items-center gap-2 text-xs text-[#787b86]">
              <Loader2 className="h-6 w-6 animate-spin text-[#2962ff]" />
              <span>Loading {selectedPreset.description}...</span>
            </div>
          </div>
        )}
      </div>

      {/* PRESET NAVIGATION BAR - Scrollable for many options */}
      <div className="flex h-9 shrink-0 items-center justify-between border-t border-[#2a2e39] bg-[#1c2030]/30 px-2 rounded-b select-none">
        <div className="flex items-center gap-1 overflow-x-auto scrollbar-thin scrollbar-thumb-[#2a2e39] pb-1">
          {CHART_PRESETS.map((preset) => (
            <button
              key={preset.label}
              type="button"
              onClick={() => {
                setSelectedPreset(preset);
                // Reset all real-time tracking when preset changes
                lastCandleTimeRef.current = null;
                lastOpenRef.current = 0;
                lastHighRef.current = 0;
                lastLowRef.current = 0;
                accumulatedVolumeRef.current = 0;
              }}
              className={`rounded px-2.5 py-1 text-xs font-semibold transition-all whitespace-nowrap ${
                selectedPreset.label === preset.label 
                  ? "bg-[#2962ff] text-white shadow-lg shadow-[#2962ff]/20" 
                  : "text-[#787b86] hover:bg-[#1e222d] hover:text-[#d1d4dc]"
              }`}
              title={preset.description}
            >
              {preset.label}
            </button>
          ))}
        </div>
        <div className="text-[10px] font-medium text-[#787b86] uppercase tracking-wider hidden md:block ml-2">
          {selectedPreset.description}
        </div>
      </div>
    </div>
  );
}