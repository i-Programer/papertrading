// src/components/SidebarRight.tsx
"use client";

import type { WatchlistItem } from "@/types/trading";
import { formatCurrency, formatPercent, pnlColorClass } from "@/utils/format";
import { useTradingStore } from "@/stores/useTradingStore";

const WATCHLIST: WatchlistItem[] = [
  { symbol: "BTCUSDT", price: 67_850.2, changePercent: 2.14 },
  { symbol: "ETHUSDT", price: 3_412.8, changePercent: -0.87 },
  { symbol: "SOLUSDT", price: 178.45, changePercent: 4.32 },
  { symbol: "BNBUSDT", price: 612.1, changePercent: 0.55 },
  { symbol: "XRPUSDT", price: 0.62, changePercent: -1.2 },
];

function formatAssetPrice(value: number): string {
  if (value >= 1000) {
    return value.toLocaleString("en-US", { maximumFractionDigits: 1 });
  }
  return value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  });
}

export default function SidebarRight() {
  const activeSymbol = useTradingStore((state) => state.symbol);
  const setSymbol = useTradingStore((state) => state.setSymbol);
  const positions = useTradingStore((state) => state.positions);

  const activePosition = positions.find((p) => p.symbol === activeSymbol);
  const livePrice = activePosition?.currentPrice;
  const currentWatchlistItem = WATCHLIST.find((item) => item.symbol === activeSymbol) || WATCHLIST[0];

  return (
    <aside className="flex w-72 shrink-0 flex-col border-l border-[#2a2e39] bg-[#131722] xl:w-80 select-none">
      <section className="flex min-h-0 flex-1 flex-col overflow-hidden border-b border-[#2a2e39]">
        <h2 className="shrink-0 px-3 py-2 text-xs font-semibold uppercase tracking-wider text-[#787b86]">
          Watchlist
        </h2>
        <div className="min-h-0 flex-1 overflow-y-auto px-1 pb-2">
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 bg-[#131722] text-[#787b86] z-10">
              <tr>
                <th className="px-2 py-1 font-normal">Symbol</th>
                <th className="px-2 py-1 text-right font-normal">Price</th>
                <th className="px-2 py-1 text-right font-normal">Chg%</th>
              </tr>
            </thead>
            <tbody>
              {WATCHLIST.map((row) => {
                const isSelected = row.symbol === activeSymbol;
                const displayedPrice = isSelected && livePrice ? livePrice : row.price;

                return (
                  <tr
                    key={row.symbol}
                    onClick={() => setSymbol(row.symbol)}
                    className={`cursor-pointer transition-colors ${
                      isSelected
                        ? "bg-[#2962ff]/20 text-white font-semibold border-l-2 border-[#2962ff]"
                        : "text-[#b2b5be] hover:bg-[#1e222d]"
                    }`}
                  >
                    <td className="px-2 py-2.5 font-medium">{row.symbol}</td>
                    <td className="px-2 py-2.5 text-right tabular-nums">
                      {formatAssetPrice(displayedPrice)}
                    </td>
                    <td className={`px-2 py-2.5 text-right tabular-nums ${pnlColorClass(row.changePercent)}`}>
                      {formatPercent(row.changePercent)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="shrink-0 p-3 bg-[#171b26]/40">
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-[#787b86]">
          {activeSymbol} Key Stats
        </h2>
        <dl className="space-y-2 text-xs">
          <div className="flex justify-between">
            <dt className="text-[#787b86]">Last Price</dt>
            <dd className="font-bold tabular-nums text-white">
              {formatAssetPrice(livePrice || currentWatchlistItem.price)}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-[#787b86]">Simulated 24h High</dt>
            <dd className="tabular-nums text-[#b2b5be]">
              {formatAssetPrice((livePrice || currentWatchlistItem.price) * 1.02)}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-[#787b86]">Simulated 24h Low</dt>
            <dd className="tabular-nums text-[#b2b5be]">
              {formatAssetPrice((livePrice || currentWatchlistItem.price) * 0.98)}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-[#787b86]">24h Change</dt>
            <dd className={pnlColorClass(currentWatchlistItem.changePercent)}>
              {formatPercent(currentWatchlistItem.changePercent)}
            </dd>
          </div>
        </dl>
      </section>
    </aside>
  );
}