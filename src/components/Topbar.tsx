// src/components/Topbar.tsx
"use client";

import { TrendingUp } from "lucide-react";
import { useTradingStore } from "@/stores/useTradingStore";
import { UserButton } from "@clerk/nextjs";
import Link from "next/link";

export default function Topbar() {
  const symbol = useTradingStore((state) => state.symbol);

  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-[#2a2e39] bg-[#131722] px-6 md:px-12 select-none">
      {/* Sisi Kiri: Identitas Aplikasi */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 text-[#2962ff]">
          <TrendingUp className="h-6 w-6" aria-hidden />
          <Link href="/" className="text-md font-bold tracking-wide text-white">
            PaperTrade Terminal
          </Link>
        </div>
        {/* <span className="rounded border border-[#2a2e39] bg-[#1e222d] px-2.5 py-1 text-xs font-semibold text-white tracking-wider">
          {symbol}
        </span> */}
      </div>

      {/* Sisi Kanan: Menu User Auth */}
      <div className="flex items-center gap-4">
        <div className="border-l border-[#2a2e39] pl-3 h-6 flex items-center">
          <UserButton />
        </div>
      </div>
    </header>
  );
}