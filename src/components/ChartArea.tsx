// src/components/ChartArea.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { 
  createChart, 
  ColorType, 
  CandlestickSeries, 
  HistogramSeries,
  LineSeries,
  createSeriesMarkers,
  IChartApi,
  ISeriesApi
} from "lightweight-charts";
import { useTradingStore } from "@/stores/useTradingStore";
import { Loader2 } from "lucide-react";

const CHART_PRESETS = [
  { label: "24H (5m)", rangeSeconds: 24 * 60 * 60, granularity: 300, description: "24 hours in 5 minute intervals" },
  { label: "7D (1H)", rangeSeconds: 7 * 24 * 60 * 60, granularity: 3600, description: "7 days in 1 hour intervals" },
  { label: "30D (4H)", rangeSeconds: 30 * 24 * 60 * 60, granularity: 14400, description: "30 days in 4 hour intervals" },
  { label: "3M (1D)", rangeSeconds: 90 * 24 * 60 * 60, granularity: 86400, description: "3 months in 1 day interval" },
  { label: "6M (1D)", rangeSeconds: 180 * 24 * 60 * 60, granularity: 86400, description: "6 months in 1 day interval" },
  { label: "1Y (2D)", rangeSeconds: 365 * 24 * 60 * 60, granularity: 172800, description: "1 tahun dengan candle 2 hari" },
  { label: "5Y (1W)", rangeSeconds: 5 * 365 * 24 * 60 * 60, granularity: 604800, description: "5 tahun dengan candle 1 minggu" }
];

function calculateMA(data: any[], period: number) {
  const maData = [];
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) continue;
    let sum = 0;
    for (let j = 0; j < period; j++) sum += data[i - j].close;
    maData.push({ time: data[i].time, value: sum / period });
  }
  return maData;
}

function calculateEMA(data: any[], period: number) {
  const emaData = [];
  if (data.length < period) return [];
  let k = 2 / (period + 1);
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

export default function ChartArea() {
  const symbol = useTradingStore((state) => state.symbol);
  const tradeHistory = useTradingStore((state) => state.tradeHistory);
  const [selectedPreset, setSelectedPreset] = useState(CHART_PRESETS[0]);
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const [chartLoading, setChartLoading] = useState(true);

  const [legendData, setLegendData] = useState({
    open: "-", high: "-", low: "-", close: "-", volume: "-", ma50: "-", ema20: "-", isPriceUp: true
  });

  const lastValidDataRef = useRef<any>(null);
  
  // 🔥 REFS UNTUK MENGHINDARI SIKLUS RE-RENDER YANG MERUSAK INSTANCE CHART
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const firstCandleTimeRef = useRef<number | null>(null);

  // useEffect 1: Mengurus Rendering Dasar Chart & Data Historis (Hanya dipicu jika simbol atau preset berubah)
  useEffect(() => {
    if (!chartContainerRef.current) return;

    setChartLoading(true);

    const chart = createChart(chartContainerRef.current, {
      layout: { background: { type: ColorType.Solid, color: "#131722" }, textColor: "#d1d4dc" },
      grid: { vertLines: { color: "#2a2e39" }, horzLines: { color: "#2a2e39" } },
      rightPriceScale: { borderColor: "#2a2e39" },
      timeScale: { borderColor: "#2a2e39", timeVisible: true, secondsVisible: false },
      width: chartContainerRef.current.clientWidth,
      height: chartContainerRef.current.clientHeight,
    });

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: "#26a69a", downColor: "#ef5350", borderVisible: false, wickUpColor: "#26a69a", wickDownColor: "#ef5350", title: " "
    });
    candleSeriesRef.current = candleSeries; // Simpan ke ref agar bisa diakses dari luar useEffect ini

    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceFormat: { type: "volume" }, priceScaleId: "volume-scale", title: " "
    });

    const maSeries = chart.addSeries(LineSeries, { color: "#f5bc3f", lineWidth: 1.5, priceLineVisible: false, title: " " });
    const emaSeries = chart.addSeries(LineSeries, { color: "#26c6da", lineWidth: 1.5, priceLineVisible: false, title: " " });

    chart.priceScale("volume-scale").applyOptions({
      borderVisible: false, visible: false, scaleMargins: { top: 0.8, bottom: 0 },
    });

    const fetchHistory = async () => {
      try {
        const now = Math.floor(Date.now() / 1000);
        const startTime = now - selectedPreset.rangeSeconds;
        const granularity = selectedPreset.granularity;
        const API_BASE_URL = process.env.NEXT_API_URL || 'http://localhost:5000';

        const response = await fetch(
          `${API_BASE_URL}/api/candles?product_id=${symbol}&granularity=${granularity}&start=${startTime}&end=${now}`
        );

        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const rawData = await response.json();
        if (!rawData || rawData.length === 0) {
          setChartLoading(false);
          return;
        }

        const formattedCandles = rawData
          .map((row: any) => ({ time: row[0], open: row[3], high: row[2], low: row[1], close: row[4] }))
          .sort((a: any, b: any) => a.time - b.time);

        const formattedVolume = rawData
          .map((row: any) => ({
            time: row[0],
            value: row[5],
            color: row[4] >= row[3] ? "rgba(38, 166, 154, 0.4)" : "rgba(239, 83, 80, 0.4)",
          }))
          .sort((a: any, b: any) => a.time - b.time);

        if (formattedCandles.length > 0) {
          firstCandleTimeRef.current = formattedCandles[0].time;
        }

        candleSeries.setData(formattedCandles);
        volumeSeries.setData(formattedVolume);

        const ma50Data = calculateMA(formattedCandles, 50);
        const ema20Data = calculateEMA(formattedCandles, 20);
        maSeries.setData(ma50Data);
        emaSeries.setData(ema20Data);

        // Pemicu awal render marker untuk history transaksi saat pertama kali chart dimuat
        // triggerMarkersUpdate();

        const lastCandle = formattedCandles[formattedCandles.length - 1];
        const lastVol = formattedVolume[formattedVolume.length - 1];
        const lastMa = ma50Data[ma50Data.length - 1];
        const lastEma = ema20Data[ema20Data.length - 1];

        const initialLegend = {
          open: lastCandle.open.toFixed(2),
          high: lastCandle.high.toFixed(2),
          low: lastCandle.low.toFixed(2),
          close: lastCandle.close.toFixed(2),
          volume: lastVol?.value.toLocaleString("en-US", { maximumFractionDigits: 0 }) || "-",
          ma50: lastMa ? lastMa.value.toFixed(2) : "-",
          ema20: lastEma ? lastEma.value.toFixed(2) : "-",
          isPriceUp: lastCandle.close >= lastCandle.open
        };

        lastValidDataRef.current = initialLegend;
        setLegendData(initialLegend);

        chart.timeScale().fitContent();
        setChartLoading(false);
      } catch (err) {
        console.error("Failed to load chart data:", err);
        setChartLoading(false);
      }
    };

    fetchHistory();

    // Logika Sinkronisasi Kursor Mouse (Crosshair Move)
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

      const candleData: any = param.seriesData.get(candleSeries);
      const volData: any = param.seriesData.get(volumeSeries);
      const maData: any = param.seriesData.get(maSeries);
      const emaData: any = param.seriesData.get(emaSeries);

      if (candleData) {
        setLegendData({
          open: candleData.open.toFixed(2),
          high: candleData.high.toFixed(2),
          low: candleData.low.toFixed(2),
          close: candleData.close.toFixed(2),
          volume: volData ? volData.value.toLocaleString("en-US", { maximumFractionDigits: 0 }) : "-",
          ma50: maData ? maData.value.toFixed(2) : "-",
          ema20: emaData ? emaData.value.toFixed(2) : "-",
          isPriceUp: candleData.close >= candleData.open
        });
      }
    });

    // Real-time WebSocket Feed
    const WS_BASE_URL = process.env.NEXT_WS_URL || "ws://localhost:5000";
    const ws = new WebSocket(WS_BASE_URL);
    ws.onopen = () => {
      ws.send(JSON.stringify({ type: "subscribe", product_ids: [symbol], channels: ["ticker"] }));
    };

    let lastCandleTime: number | null = null;
    let lastOpen = 0; let lastHigh = 0; let lastLow = 0;
    let accumulatedVolume = 0;

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
          accumulatedVolume += currentVolume; 
          candleSeries.update({ time: candleTimeStamp, open: lastOpen, high: lastHigh, low: lastLow, close: currentPrice });
        } else {
          lastCandleTime = candleTimeStamp; lastOpen = currentPrice; lastHigh = currentPrice; lastLow = currentPrice;
          accumulatedVolume = currentVolume;
          candleSeries.update({ time: candleTimeStamp, open: lastOpen, high: lastHigh, low: lastLow, close: currentPrice });
        }

        const volColor = currentPrice >= lastOpen ? "rgba(38, 166, 154, 0.4)" : "rgba(239, 83, 80, 0.4)";
        volumeSeries.update({ time: candleTimeStamp, value: accumulatedVolume, color: volColor });

        if (lastValidDataRef.current) {
          lastValidDataRef.current = {
            ...lastValidDataRef.current,
            open: lastOpen.toFixed(2),
            high: lastHigh.toFixed(2),
            low: lastLow.toFixed(2),
            close: currentPrice.toFixed(2),
            volume: accumulatedVolume.toLocaleString("en-US", { maximumFractionDigits: 0 }),
            isPriceUp: currentPrice >= lastOpen
          };
        }
      }
    };

    const handleResize = () => {
      if (chartContainerRef.current) chart.applyOptions({ width: chartContainerRef.current.clientWidth, height: chartContainerRef.current.clientHeight });
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "unsubscribe", product_ids: [symbol], channels: ["ticker"] }));
      }
      ws.close();
      chart.remove(); // Dipanggil dengan aman hanya jika simbol/preset berganti
    };
  }, [symbol, selectedPreset]);

  // const triggerMarkersUpdate = () => {
  //   if (!candleSeriesRef.current || !firstCandleTimeRef.current) return;

  //   const granularity = selectedPreset.granularity;

  //   const markers = tradeHistory
  //     .filter((trade) => trade.symbol === symbol)
  //     .map((trade) => {
  //       let formattedTimestamp = trade.timestamp;
  //       console.log(formattedTimestamp);

  //       if (formattedTimestamp && typeof formattedTimestamp === "string") {
  //         // 1. Ganti spasi menjadi 'T' agar menjadi standar ISO (misal: "2026-06-04 05:57..." -> "2026-06-04T05:57...")
  //         formattedTimestamp = formattedTimestamp.replace(" ", "T");
          
  //         // 2. Normalisasi mikrodetik Supabase (+00 atauZ) agar browser tidak bingung
  //         // Jika berakhiran +00, pastikan formatnya ramah untuk di-parse
  //         if (formattedTimestamp.includes("+")) {
  //           const parts = formattedTimestamp.split("+");
  //           // Ambil bagian sebelum tanda +, potong mikrodetiknya jika terlalu panjang, lalu gabungkan kembali
  //           const timePart = parts[0].split(".");
  //           formattedTimestamp = timePart[0] + "+" + parts[1];
  //         }
  //       }

  //       // Sekarang dijamin valid di semua browser!
  //       const parsedDate = new Date(formattedTimestamp);
  //       const tradeTimeRaw = parsedDate.getTime() / 1000;
        
  //       // Jika parsing masih tetap gagal karena hal lain, fallback aman ke candle pertama
  //       let exactTradeTime = isNaN(tradeTimeRaw) ? (firstCandleTimeRef.current as number) : tradeTimeRaw;
        
  //       // Jika sukses di-parse, bulatkan waktu transaksi ke awal blok lilin granularity-nya agar mengunci kokoh
  //       if (!isNaN(tradeTimeRaw)) {
  //         exactTradeTime = tradeTimeRaw - (tradeTimeRaw % granularity);
  //       }

  //       const isBuy = trade.side === "BUY";

  //       return {
  //         id: trade.id,
  //         time: exactTradeTime, // Waktu absolut penempatan marker di lilin yang tepat
  //         position: (isBuy ? "belowBar" : "aboveBar") as const,
  //         color: isBuy ? "#26a69a" : "#ef5350",
  //         shape: (isBuy ? "arrowUp" : "arrowDown") as const,
  //         text: `${trade.side} ${trade.quantity}`,
  //       };
  //     })
  //     .filter((marker) => marker.time >= (firstCandleTimeRef.current as number))
  //     .sort((a, b) => (a.time as number) - (b.time as number));

  //   createSeriesMarkers(candleSeriesRef.current, markers);
  // };

  // // Jalankan sinkronisasi marker setiap kali tradeHistory bertambah secara eksternal
  // useEffect(() => {
  //   triggerMarkersUpdate();
  // }, [tradeHistory, symbol]);

  return (
    <div className="flex flex-1 flex-col h-full bg-[#131722] p-2 relative select-none">
      <div className="flex-1 w-full relative pt-2 h-full" ref={chartContainerRef}>
        
        {/* OVERLAY LEGENDA INTERAKTIF */}
        <div className="absolute top-4 left-4 z-10 flex flex-col gap-1 bg-[#131722]/60 p-2 rounded backdrop-blur-xs text-[11px] font-medium pointer-events-none">
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

        {chartLoading && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-[#131722]/80 backdrop-blur-xs h-full">
            <div className="flex flex-col items-center gap-2 text-xs text-[#787b86]">
              <Loader2 className="h-6 w-6 animate-spin text-[#2962ff]" />
              <span>Loading {selectedPreset.description}...</span>
            </div>
          </div>
        )}
      </div>

      {/* NAVIGATION BAR DENGAN PRESETS */}
      <div className="flex h-9 shrink-0 items-center justify-between border-b border-[#2a2e39] bg-[#1c2030]/30 px-2 rounded-t select-none">
        <div className="flex items-center gap-2 overflow-x-auto">
          {CHART_PRESETS.map((preset) => (
            <button
              key={preset.label}
              type="button"
              onClick={() => setSelectedPreset(preset)}
              className={`rounded px-2.5 py-1 text-xs font-semibold transition-colors whitespace-nowrap ${
                selectedPreset.label === preset.label ? "bg-[#2962ff] text-white" : "text-[#787b86] hover:bg-[#1e222d] hover:text-[#d1d4dc]"
              }`}
              title={preset.description}
            >
              {preset.label}
            </button>
          ))}
        </div>
        <div className="text-[10px] font-bold text-[#787b86] uppercase tracking-wider hidden md:block">
          {selectedPreset.description}
        </div>
      </div>
    </div>
  );
}