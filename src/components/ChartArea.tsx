// src/components/ChartArea.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { 
  createChart, 
  ColorType, 
  CandlestickSeries, 
  HistogramSeries,
  LineSeries // 🔥 Tambahkan LineSeries untuk menggambar garis MA/EMA
} from "lightweight-charts";
import { useTradingStore } from "@/stores/useTradingStore";
import { Loader2 } from "lucide-react";

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

// 🔥 Helper Fungsi Matematika: Hitung Simple Moving Average (MA)
function calculateMA(data: any[], period: number) {
  const maData = [];
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) continue; // Skip jika data belum mencukupi panjang periode
    
    let sum = 0;
    for (let j = 0; j < period; j++) {
      sum += data[i - j].close;
    }
    maData.push({ time: data[i].time, value: sum / period });
  }
  return maData;
}

// 🔥 Helper Fungsi Matematika: Hitung Exponential Moving Average (EMA)
function calculateEMA(data: any[], period: number) {
  const emaData = [];
  if (data.length < period) return [];

  // Lilin pertama EMA diambil dari rata-rata SMA awal
  let k = 2 / (period + 1);
  let sum = 0;
  for (let i = 0; i < period; i++) {
    sum += data[i].close;
  }
  let prevEma = sum / period;
  emaData.push({ time: data[period - 1].time, value: prevEma });

  // Kalkulasi baris lilin sisanya menggunakan multiplier
  for (let i = period; i < data.length; i++) {
    const currentEma = data[i].close * k + prevEma * (1 - k);
    emaData.push({ time: data[i].time, value: currentEma });
    prevEma = currentEma;
  }
  return emaData;
}

export default function ChartArea() {
  const symbol = useTradingStore((state) => state.symbol);
  const [selectedPreset, setSelectedPreset] = useState(CHART_PRESETS[0]);
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const [chartLoading, setChartLoading] = useState(true);

  useEffect(() => {
    if (!chartContainerRef.current) return;

    setChartLoading(true);

    // --- 1. SETTING UTAMA KANVAS CHART ---
    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "#131722" },
        textColor: "#d1d4dc",
      },
      // Sembunyikan crosshair label / tooltip bawaan agar tidak memunculkan teks anomali
      crosshair: {
        vertLine: {
          labelBackgroundColor: "#2962ff",
        },
        horzLine: {
          labelBackgroundColor: "#2962ff",
        },
      },
      grid: {
        vertLines: { color: "#2a2e39" },
        horzLines: { color: "#2a2e39" },
      },
      rightPriceScale: { borderColor: "#2a2e39" },
      timeScale: {
        borderColor: "#2a2e39",
        timeVisible: true,
        secondsVisible: false,
      },
      width: chartContainerRef.current.clientWidth,
      height: 450,
    });

    // --- 2. CANDLESTICK SERIES ---
    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: "#26a69a",
      downColor: "#ef5350",
      borderVisible: false,
      wickUpColor: "#26a69a",
      wickDownColor: "#ef5350",
      title: "", // 🔥 Sembunyikan judul teks legenda bawaan di atas chart
    });

    // --- 3. VOLUME SERIES ---
    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceFormat: { type: "volume" },
      priceScaleId: "volume-scale",
      title: "", // 🔥 DIUBAH: Kosongkan titel agar angka 0 dan 0.01 tidak dicetak di teks atas
    });

    // --- 4. MA 50 SERIES ---
    const maSeries = chart.addSeries(LineSeries, {
      color: "#f5bc3f",
      lineWidth: 1.5,
      priceLineVisible: false,
      title: "", // 🔥 Sembunyikan judul bawaan
    });

    // --- 5. EMA 20 SERIES ---
    const emaSeries = chart.addSeries(LineSeries, {
      color: "#26c6da",
      lineWidth: 1.5,
      priceLineVisible: false,
      title: "", // 🔥 Sembunyikan judul bawaan
    });

    // Sembunyikan skala sumbu Y milik volume
    chart.priceScale("volume-scale").applyOptions({
      borderVisible: false,
      visible: false,
      scaleMargins: {
        top: 0.8,
        bottom: 0,
      },
    });

    const fetchHistory = async () => {
      try {
        const now = Math.floor(Date.now() / 1000);
        const startTime = now - selectedPreset.rangeSeconds;
        const granularity = selectedPreset.granularity;

        const response = await fetch(
          `https://api.exchange.coinbase.com/products/${symbol}/candles?` +
          `granularity=${granularity}&start=${startTime}&end=${now}`
        );

        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

        const rawData = await response.json();
        if (!rawData || rawData.length === 0) {
          setChartLoading(false);
          return;
        }

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

        // Set data dasar chart
        candleSeries.setData(formattedCandles);
        volumeSeries.setData(formattedVolume);

        // 🔥 Hitung dan Suntikkan Data Garis MA & EMA ke Chart
        const ma50Data = calculateMA(formattedCandles, 50);
        const ema20Data = calculateEMA(formattedCandles, 20);
        maSeries.setData(ma50Data);
        emaSeries.setData(ema20Data);

        chart.timeScale().fitContent();
        setChartLoading(false);
        
      } catch (err) {
        console.error("Failed to load chart data:", err);
        setChartLoading(false);
      }
    };

    fetchHistory();

    // WebSocket untuk stream data real-time ticker
    const ws = new WebSocket("wss://ws-feed.exchange.coinbase.com");
    ws.onopen = () => {
      ws.send(JSON.stringify({ type: "subscribe", product_ids: [symbol], channels: ["ticker"] }));
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
            time: candleTimeStamp, open: lastOpen, high: lastHigh, low: lastLow, close: currentPrice,
          });
        } else {
          lastCandleTime = candleTimeStamp;
          lastOpen = currentPrice;
          lastHigh = currentPrice;
          lastLow = currentPrice;
          
          candleSeries.update({
            time: candleTimeStamp, open: lastOpen, high: lastHigh, low: lastLow, close: currentPrice,
          });
        }

        volumeSeries.update({
          time: candleTimeStamp,
          value: currentVolume,
          color: "rgba(38, 166, 154, 0.7)",
        });

        // 💡 Catatan Real-time Update MA/EMA: 
        // Untuk menjaga performa render WebSocket yang berdetak milidetik, kalkulasi MA/EMA garis
        // akan langsung ter-recalculating otomatis secara presisi setiap kali user mengganti preset/koin.
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

      {/* Navigation Bar dengan Presets & Legend Indikator */}
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
          
          {/* 🔥 LEGENDA INDIKATOR KECIL DI SAMPING PRESET */}
          <div className="ml-4 hidden items-center gap-3 border-l border-[#2a2e39] pl-4 sm:flex">
            <span className="flex items-center gap-1.5 text-[10px] font-medium text-[#b2b5be]">
              <span className="h-1.5 w-3 rounded-xs bg-[#26c6da]"></span> EMA(20)
            </span>
            <span className="flex items-center gap-1.5 text-[10px] font-medium text-[#b2b5be]">
              <span className="h-1.5 w-3 rounded-xs bg-[#f5bc3f]"></span> MA(50)
            </span>
          </div>
        </div>

        <div className="text-[10px] font-bold text-[#787b86] uppercase tracking-wider hidden md:block">
          {selectedPreset.description}
        </div>
      </div>
    </div>
  );
}