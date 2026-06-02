// src/components/ChartArea.tsx
"use client";

import React, { useEffect, useRef } from "react";
import { createChart, IChartApi, ISeriesApi, CandlestickSeries } from "lightweight-charts";
import { useTradingStore } from "@/stores/useTradingStore";

export default function ChartArea() {
  // Pastikan format symbol yang di-store sesuai dengan Coinbase (misal: BTC-USD)
  // Jika store kamu masih menyimpan format BTCUSDT, kamu perlu menambahkan logic helper untuk mengubahnya menjadi BTC-USD
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

    // Fetch Data Historis Coinbase REST API
    // Catatan: Coinbase mengembalikan data dari yang terbaru ke terlama, jadi kita perlu .reverse() untuk lightweight-charts
    const fetchHistoricalData = async () => {
      try {
        // 1800 detik = 30 menit (granularity Coinbase menggunakan satuan detik)
        const response = await fetch(
          `https://api.exchange.coinbase.com/products/${symbol}/candles?granularity=60&limit=500`
        );
        const rawData = await response.json();
        
        // Format Coinbase candle array: [time, low, high, open, close, volume]
        const formattedData = rawData.map((d: any) => ({
          time: d[0], // Sudah dalam bentuk Unix timestamp (detik)
          low: parseFloat(d[1]),
          high: parseFloat(d[2]),
          open: parseFloat(d[3]),
          close: parseFloat(d[4]),
        })).reverse(); // Balik urutan agar kronologis (lampau -> sekarang)

        candlestickSeries.setData(formattedData);
      } catch (error) {
        console.error(`Gagal mengambil data historis Coinbase untuk ${symbol}:`, error);
      }
    };

    fetchHistoricalData();

    // Koneksi WebSocket Real-time Stream Coinbase
    const ws = new WebSocket("wss://ws-feed.exchange.coinbase.com");

    ws.onopen = () => {
      // Mengirimkan payload subscribe setelah koneksi terbuka
      const subscribePayload = {
        type: "subscribe",
        product_ids: [symbol],
        channels: ["ticker"] // Menggunakan channel ticker untuk memantau harga live paling update
      };
      ws.send(JSON.stringify(subscribePayload));
    };

    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);

      // Pastikan tipe data sesuai dan datanya valid
      if (message.type === "ticker" && message.price) {
        const livePrice = parseFloat(message.price);
        const liveTime = new Date(message.time).getTime() / 1000;

        // Mendapatkan candle 30 menit saat ini berdasarkan pembulatan waktu ke bawah
        const candleTime = Math.floor(liveTime / 1800) * 1800;

        const priceTick = {
          time: candleTime,
          open: livePrice,  // Menggunakan pendekatan update dinamis lightweight-charts
          high: livePrice,
          low: livePrice,
          close: livePrice,
        };

        // Meng-update grafik secara real-time
        candlestickSeries.update(priceTick);
        useTradingStore.getState().updateLivePrices(livePrice);
      }
    };

    // Cleanup saat pindah koin / unmount
    return () => {
      window.removeEventListener("resize", handleResize);
      
      // Mengirim unsubscribe payload sebelum menutup koneksi (Good Practice)
      if (ws.readyState === WebSocket.OPEN) {
        const unsubscribePayload = {
          type: "unsubscribe",
          product_ids: [symbol],
          channels: ["ticker"]
        };
        ws.send(JSON.stringify(unsubscribePayload));
      }
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