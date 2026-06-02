// src/app/page.tsx
"use client";

import React from "react";
import Link from "next/link";
import { TrendingUp, ShieldCheck, Zap, BarChart4 } from "lucide-react";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-[#131722] text-[#d1d4dc] flex flex-col justify-between select-none">
      {/* Top Navbar Minimalis */}
      <header className="flex h-16 items-center justify-between border-b border-[#2a2e39] px-6 md:px-12">
        <div className="flex items-center gap-2 text-[#2962ff]">
          <TrendingUp className="h-6 w-6" />
          <span className="text-md font-bold tracking-wide text-white">PaperTrade Terminal</span>
        </div>
        <div className="flex items-center gap-4 text-xs font-semibold">
          <Link href="/portfolio" className="text-[#787b86] hover:text-white transition-colors">
            Portfolio
          </Link>
          <Link href="/trade" className="bg-[#2962ff] text-white px-4 py-2 rounded hover:bg-[#1e53e5] transition-colors">
            Launch App
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1 flex flex-col items-center justify-center text-center px-4 max-w-3xl mx-auto py-12">
        <div className="inline-flex items-center gap-2 bg-[#2962ff]/10 text-[#2962ff] text-xs font-semibold px-3 py-1 rounded-full mb-6 border border-2962ff/20">
          <Zap className="h-3 w-3" /> Real-time WebSocket Simulator
        </div>
        <h1 className="text-4xl md:text-5xl font-extrabold text-white tracking-tight leading-tight mb-4">
          Asah Strategi Trading Tanpa <span className="text-[#26a69a]">Resiko Finansial</span>
        </h1>
        <p className="text-sm md:text-base text-[#787b86] mb-8 max-w-xl">
          Simulasi trading crypto interaktif menggunakan data streaming langsung dari Binance API. Sempurna untuk latihan analisis pasar kapan saja.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 w-full justify-center">
          <Link href="/trade" className="bg-[#2962ff] text-white px-6 py-3 rounded font-bold text-sm hover:bg-[#1e53e5] transition-transform active:scale-95 shadow-lg shadow-[#2962ff]/20">
            Mulai Paper Trading
          </Link>
          <Link href="/portfolio" className="border border-[#2a2e39] bg-[#1c2030]/50 text-white px-6 py-3 rounded font-bold text-sm hover:bg-[#1c2030] transition-colors">
            Lihat Portfolio Saya
          </Link>
        </div>
      </main>

      {/* Fitur Sorotan Kecil */}
      <footer className="border-t border-[#2a2e39] bg-[#171b26]/30 py-6 px-6">
        <div className="max-w-4xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-6 text-center sm:text-left">
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-3">
            <BarChart4 className="h-5 w-5 text-[#26a69a] shrink-0" />
            <div>
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">TradingView Canvas</h3>
              <p className="text-[11px] text-[#787b86]">Grafik candlestick akurat dengan performa super ringan.</p>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-3">
            <Zap className="h-5 w-5 text-[#2962ff] shrink-0" />
            <div>
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">Live Prices</h3>
              <p className="text-[11px] text-[#787b86]">Koneksi data real-time langsung lewat jalur WebSocket.</p>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-3">
            <ShieldCheck className="h-5 w-5 text-[#ef5350] shrink-0" />
            <div>
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">$100k Virtual Cash</h3>
              <p className="text-[11px] text-[#787b86]">Saldo simulasi besar untuk menguji manajemen resiko modal.</p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}