// src/components/ChartArea.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { 
  createChart, 
  ColorType, 
  CandlestickSeries, 
  HistogramSeries 
} from "lightweight-charts";
import { useTradingStore } from "@/stores/useTradingStore";
import { Loader2 } from "lucide-react";

// Definisi kombinasi yang VALID (maks 300 candle)
const CHART_PRESETS = [
  { 
    label: "24H (5m)", 
    range: "24 hours", 
    rangeSeconds: 24 * 60 * 60,
    interval: "5m", 
    granularity: 300,
    description: "24 hours in 5 minute intervals"
  },
  { 
    label: "7D (1H)", 
    range: "7 days", 
    rangeSeconds: 7 * 24 * 60 * 60,
    interval: "1H", 
    granularity: 3600,
    description: "7 days in 1 hour intervals"
  },
  { 
    label: "30D (4H)", 
    range: "30 days", 
    rangeSeconds: 30 * 24 * 60 * 60,
    interval: "4H", 
    granularity: 4 * 3600,
    description: "30 days in 4 hour intervals"
  },
  { 
    label: "3M (1D)", 
    range: "3 months", 
    rangeSeconds: 90 * 24 * 60 * 60,
    interval: "1D", 
    granularity: 86400,
    description: "3 months in 1 day interval"
  },
  { 
    label: "6M (1D)", 
    range: "6 months", 
    rangeSeconds: 180 * 24 * 60 * 60,
    interval: "1D", 
    granularity: 86400,
    description: "6 months in 1 day interval"
  },
  { 
    label: "1Y (2D)", 
    range: "1 year", 
    rangeSeconds: 365 * 24 * 60 * 60,
    interval: "2D", 
    granularity: 2 * 86400,
    description: "1 tahun dengan candle 2 hari"
  },
  { 
    label: "5Y (1W)", 
    range: "5 years", 
    rangeSeconds: 5 * 365 * 24 * 60 * 60,
    interval: "1W", 
    granularity: 7 * 86400,
    description: "5 tahun dengan candle 1 minggu"
  }
];

// Helper untuk formatting display
function formatInterval(interval: string): string {
  switch(interval) {
    case "1W": return "Weekly";
    case "2D": return "2 Days";
    case "3D": return "3 Days";
    case "4H": return "4 Hours";
    case "6H": return "6 Hours";
    default: return interval;
  }
}

export default function ChartArea() {
  const symbol = useTradingStore((state) => state.symbol);
  const [selectedPreset, setSelectedPreset] = useState(CHART_PRESETS[0]);
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const [chartLoading, setChartLoading] = useState(true);

  useEffect(() => {
    if (!chartContainerRef.current) return;

    setChartLoading(true);

    // Inisialisasi Chart
    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "#131722" },
        textColor: "#d1d4dc",
      },
      grid: {
        vertLines: { color: "#2a2e39" },
        horzLines: { color: "#2a2e39" },
      },
      rightPriceScale: {
        borderColor: "#2a2e39",
      },
      timeScale: {
        borderColor: "#2a2e39",
        timeVisible: true,
        secondsVisible: false,
      },
      width: chartContainerRef.current.clientWidth,
      height: 450,
    });

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: "#26a69a",
      downColor: "#ef5350",
      borderVisible: false,
      wickUpColor: "#26a69a",
      wickDownColor: "#ef5350",
    });

    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceFormat: { type: "volume" },
      priceScaleId: "",
    });

    chart.priceScale("").applyOptions({
      scaleMargins: {
        top: 0.8,
        bottom: 0,
      },
    });

    // Fetch data dengan preset yang dipilih
    const fetchHistory = async () => {
      try {
        const now = Math.floor(Date.now() / 1000);
        const startTime = now - selectedPreset.rangeSeconds;
        const granularity = selectedPreset.granularity;

        console.log(`Fetching: ${selectedPreset.description}`);
        console.log(`Start: ${new Date(startTime * 1000).toLocaleString()}`);
        console.log(`End: ${new Date(now * 1000).toLocaleString()}`);
        console.log(`Granularity: ${granularity} seconds`);

        const response = await fetch(
          `https://api.exchange.coinbase.com/products/${symbol}/candles?` +
          `granularity=${granularity}&start=${startTime}&end=${now}`
        );

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const rawData = await response.json();
        
        if (!rawData || rawData.length === 0) {
          console.warn("No data received from Coinbase API");
          setChartLoading(false);
          return;
        }

        console.log(`Received ${rawData.length} candles`);

        // Format candles
        const formattedCandles = rawData
          .map((row: any) => ({
            time: row[0],
            open: row[3],
            high: row[2],
            low: row[1],
            close: row[4],
          }))
          .sort((a: any, b: any) => a.time - b.time);

        const formattedVolume = rawData
          .map((row: any) => ({
            time: row[0],
            value: row[5],
            color: row[4] >= row[3] ? "rgba(38, 166, 154, 0.5)" : "rgba(239, 83, 80, 0.5)",
          }))
          .sort((a: any, b: any) => a.time - b.time);

        candleSeries.setData(formattedCandles);
        volumeSeries.setData(formattedVolume);
        chart.timeScale().fitContent();
        setChartLoading(false);
        
      } catch (err) {
        console.error("Failed to load chart data:", err);
        setChartLoading(false);
      }
    };

    fetchHistory();

    // WebSocket untuk data real-time
    const ws = new WebSocket("wss://ws-feed.exchange.coinbase.com");
    
    ws.onopen = () => {
      ws.send(
        JSON.stringify({
          type: "subscribe",
          product_ids: [symbol],
          channels: ["ticker"],
        })
      );
    };

    let lastCandleTime: number | null = null;
    let lastOpen = 0;
    let lastHigh = 0;
    let lastLow = 0;

    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      if (message.type === "ticker" && message.price) {
        const currentPrice = parseFloat(message.price);
        const currentVolume = parseFloat(message.last_size || "0");
        
        const granularity = selectedPreset.granularity;
        const currentTimeStamp = Math.floor(Date.now() / 1000);
        const candleTimeStamp = currentTimeStamp - (currentTimeStamp % granularity);

        useTradingStore.getState().updateLivePrices(currentPrice);

        if (lastCandleTime === candleTimeStamp) {
          lastHigh = Math.max(lastHigh, currentPrice);
          lastLow = Math.min(lastLow, currentPrice);
          
          candleSeries.update({
            time: candleTimeStamp,
            open: lastOpen,
            high: lastHigh,
            low: lastLow,
            close: currentPrice,
          });
        } else {
          lastCandleTime = candleTimeStamp;
          lastOpen = currentPrice;
          lastHigh = currentPrice;
          lastLow = currentPrice;
          
          candleSeries.update({
            time: candleTimeStamp,
            open: lastOpen,
            high: lastHigh,
            low: lastLow,
            close: currentPrice,
          });
        }

        volumeSeries.update({
          time: candleTimeStamp,
          value: currentVolume,
          color: "rgba(38, 166, 154, 0.7)",
        });
      }
    };

    const handleResize = () => {
      if (chartContainerRef.current) {
        chart.applyOptions({ width: chartContainerRef.current.clientWidth });
      }
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "unsubscribe", product_ids: [symbol], channels: ["ticker"] }));
      }
      ws.close();
      chart.remove();
    };
  }, [symbol, selectedPreset]);

  return (
    <div className="flex flex-1 flex-col h-full bg-[#131722] p-2 relative">
      {/* Canvas Chart */}
      <div className="flex-1 w-full relative pt-2" ref={chartContainerRef}>
        {chartLoading && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-[#131722]/80 backdrop-blur-xs">
            <div className="flex flex-col items-center gap-2 text-xs text-[#787b86]">
              <Loader2 className="h-6 w-6 animate-spin text-[#2962ff]" />
              <span>Loading {selectedPreset.description}...</span>
            </div>
          </div>
        )}
      </div>

      {/* Navigation Bar dengan Presets */}
      <div className="flex h-9 shrink-0 items-center justify-between border-b border-[#2a2e39] bg-[#1c2030]/30 px-2 rounded-t select-none">
        <div className="flex items-center gap-2 overflow-x-auto">
          {CHART_PRESETS.map((preset) => (
            <button
              key={preset.label}
              type="button"
              onClick={() => setSelectedPreset(preset)}
              className={`rounded px-2.5 py-1 text-xs font-semibold transition-colors whitespace-nowrap ${
                selectedPreset.label === preset.label
                  ? "bg-[#2962ff] text-white"
                  : "text-[#787b86] hover:bg-[#1e222d] hover:text-[#d1d4dc]"
              }`}
              title={preset.description}
            >
              {preset.label}
            </button>
          ))}
        </div>
        <div className="text-[10px] font-bold text-[#787b86] uppercase tracking-wider">
          {selectedPreset.description}
        </div>
      </div>
    </div>
  );
}