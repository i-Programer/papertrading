// src/components/SidebarRight.tsx
"use client";

import { useState, useEffect } from "react";
import { Search, Loader2 } from "lucide-react";
import { useTradingStore } from "@/stores/useTradingStore";

interface CoinbaseProduct {
  id: string;          // Contoh: "BTC-USD"
  base_currency: string; // Contoh: "BTC"
  quote_currency: string; // Contoh: "USD"
}

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

  // --- STATE UNTUK DATA DINAMIS ---
  const [allProducts, setAllProducts] = useState<CoinbaseProduct[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Store price locally for the active coin if available
  const activePosition = positions.find((p) => p.symbol === activeSymbol);
  const livePrice = activePosition?.currentPrice || 67000.0; // Default fallback

  // 1. Fetch semua produk/koin dari Coinbase API saat komponen di-mount
  useEffect(() => {
    const fetchCoinbaseProducts = async () => {
      try {
        setIsLoading(true);
        const response = await fetch("https://api.exchange.coinbase.com/products");
        const data: CoinbaseProduct[] = await response.json();
        
        // Filter hanya koin yang berpasangan dengan USD (bukan EUR, GBP, atau Crypto-to-Crypto)
        // Dan urutkan secara alfabetis
        const usdPairs = data
          .filter((product) => product.quote_currency === "USD")
          .sort((a, b) => a.base_currency.localeCompare(b.base_currency));

        setAllProducts(usdPairs);
      } catch (error) {
        console.error("Gagal mengambil daftar koin dari Coinbase:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchCoinbaseProducts();
  }, []);

  // 2. Filter list koin berdasarkan apa yang diketik user di Search Bar
  const filteredProducts = allProducts.filter((coin) =>
    coin.id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Ambil list pendek untuk tampilan "Watchlist Default" jika kolom pencarian kosong
  // Menampilkan 7 koin populer teratas di awal
  const popularCoins = ["BTC-USD", "ETH-USD", "SOL-USD", "ADA-USD", "XRP-USD", "LINK-USD", "DOGE-USD"];
  const displayedList = searchQuery
    ? filteredProducts.slice(0, 50) // Batasi 50 hasil pencarian teratas agar performa lancar
    : allProducts.filter((coin) => popularCoins.includes(coin.id));

  return (
    <aside className="flex w-72 shrink-0 flex-col border-l border-[#2a2e39] bg-[#131722] xl:w-80 select-none">
      
      {/* SECTION SEARCH BAR & WATCHLIST */}
      <section className="flex min-h-0 flex-1 flex-col overflow-hidden border-b border-[#2a2e39]">
        <div className="p-3 shrink-0">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-[#787b86]">
            Search Markets
          </h2>
          {/* Input Box Pencarian */}
          <div className="flex items-center gap-2 rounded border border-[#2a2e39] bg-[#1e222d] px-2.5 py-1.5 focus-within:border-[#2962ff]">
            <Search className="h-3.5 w-3.5 text-[#787b86]" />
            <input
              type="text"
              placeholder="Search coin (e.g. DOGE)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-transparent text-xs text-white outline-none placeholder-[#434651]"
            />
          </div>
        </div>

        {/* Tabel Daftar Koin */}
        <div className="min-h-0 flex-1 overflow-y-auto px-1 pb-2">
          {isLoading ? (
            <div className="flex h-32 flex-col items-center justify-center gap-2 text-xs text-[#787b86]">
              <Loader2 className="h-5 w-5 animate-spin text-[#2962ff]" />
              <span>Loading pairs from Coinbase...</span>
            </div>
          ) : (
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-[#131722] text-[#787b86] z-10">
                <tr>
                  <th className="px-2 py-1 font-normal">Symbol</th>
                  <th className="px-2 py-1 text-right font-normal">Currency</th>
                </tr>
              </thead>
              <tbody>
                {displayedList.length === 0 ? (
                  <tr>
                    <td colSpan={2} className="py-8 text-center text-[#434651]">
                      No assets found.
                    </td>
                  </tr>
                ) : (
                  displayedList.map((coin) => {
                    const isSelected = coin.id === activeSymbol;

                    return (
                      <tr
                        key={coin.id}
                        onClick={() => {
                          setSymbol(coin.id);
                          setSearchQuery(""); // Reset pencarian setelah diklik
                        }}
                        className={`cursor-pointer transition-colors ${
                          isSelected
                            ? "bg-[#2962ff]/20 text-white font-semibold border-l-2 border-[#2962ff]"
                            : "text-[#b2b5be] hover:bg-[#1e222d]"
                        }`}
                      >
                        <td className="px-2 py-2.5 font-medium">{coin.id}</td>
                        <td className="px-2 py-2.5 text-right text-[#787b86] font-normal">
                          {coin.base_currency} / USD
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {/* SECTION KEY STATS ASET AKTIF */}
      <section className="shrink-0 p-3 bg-[#171b26]/40">
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-[#787b86]">
          {activeSymbol} Key Stats
        </h2>
        <dl className="space-y-2 text-xs">
          <div className="flex justify-between">
            <dt className="text-[#787b86]">Last Price</dt>
            <dd className="font-bold tabular-nums text-white">
              {formatAssetPrice(livePrice)}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-[#787b86]">Simulated 24h High</dt>
            <dd className="tabular-nums text-[#b2b5be]">
              {formatAssetPrice(livePrice * 1.02)}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-[#787b86]">Simulated 24h Low</dt>
            <dd className="tabular-nums text-[#b2b5be]">
              {formatAssetPrice(livePrice * 0.98)}
            </dd>
          </div>
        </dl>
      </section>
    </aside>
  );
}