// src/components/ChartArea.tsx
"use client";

import React, { useEffect, useRef } from "react";
import { createChart, IChartApi, ISeriesApi, CandlestickSeries } from "lightweight-charts";
import { useTradingStore } from "@/stores/useTradingStore";

export default function ChartArea() {
  const symbol = useTradingStore((state) => state.symbol);
  const chartContainerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candlestickSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);

  useEffect(() => {
    if (!chartContainerRef.current) return;

    // Inisialisasi Chart Canvas
    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height: chartContainerRef.current.clientHeight || 500,
      layout: {
        background: { color: "#131722" },
        textColor: "#d1d4dc",
      },
      grid: {
        vertLines: { color: "#232733" },
        horzLines: { color: "#232733" },
      },
      crosshair: { mode: 0 },
      timeScale: {
        borderColor: "#2b2e3a",
        timeVisible: true,
        secondsVisible: false,
      },
    });
    chartRef.current = chart;

    // Tambah Candlestick Series
    const candlestickSeries = chart.addSeries(CandlestickSeries, {
      upColor: "#26a69a",
      downColor: "#ef5350",
      borderVisible: false,
      wickUpColor: "#26a69a",
      wickDownColor: "#ef5350",
    });
    candlestickSeriesRef.current = candlestickSeries;

    // Handle Responsive Resize
    const handleResize = () => {
      if (chartContainerRef.current) {
        chart.applyOptions({
          width: chartContainerRef.current.clientWidth,
          height: chartContainerRef.current.clientHeight,
        });
      }
    };
    window.addEventListener("resize", handleResize);

    // Fetch Data Historis Binance REST API
    const fetchHistoricalData = async () => {
      try {
        const response = await fetch(
          `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=30m&limit=500`
        );
        const rawData = await response.json();
        const formattedData = rawData.map((d: any) => ({
          time: d[0] / 1000,
          open: parseFloat(d[1]),
          high: parseFloat(d[2]),
          low: parseFloat(d[3]),
          close: parseFloat(d[4]),
        }));
        candlestickSeries.setData(formattedData);
      } catch (error) {
        console.error(`Gagal mengambil data historis untuk ${symbol}:`, error);
      }
    };

    fetchHistoricalData();

    // Koneksi WebSocket Real-time Stream
    const ws = new WebSocket(`wss://stream.binance.com:9443/ws/${symbol.toLowerCase()}@kline_30m`);

    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      const kline = message.k;

      if (kline) {
        const priceTick = {
          time: kline.t / 1000,
          open: parseFloat(kline.o),
          high: parseFloat(kline.h),
          low: parseFloat(kline.l),
          close: parseFloat(kline.c),
        };
        candlestickSeries.update(priceTick);
        useTradingStore.getState().updateLivePrices(priceTick.close);
      }
    };

    // Cleanup saat pindah koin / unmount
    return () => {
      window.removeEventListener("resize", handleResize);
      ws.close();
      chart.remove();
    };
  }, [symbol]);

  return (
    <main className="flex-1 min-w-0 bg-[#131722] relative w-full h-full">
      <div ref={chartContainerRef} className="w-full h-full absolute inset-0" />
    </main>
  );
}