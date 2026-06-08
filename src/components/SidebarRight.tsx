// src/components/SidebarRight.tsx
"use client";

import { useState, useEffect } from "react";
import { Search, Loader2, Star, TrendingUp, TrendingDown, Volume2, Clock } from "lucide-react";
import { useTradingStore } from "@/stores/useTradingStore";
import { useMarketData, type ExtendedProduct } from "@/hooks/useMarketData";

function formatAssetPrice(value: number): string {
  if (value >= 1000) return value.toLocaleString("en-US", { maximumFractionDigits: 2 });
  if (value >= 1) return value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 4 });
  return value.toLocaleString("en-US", { minimumFractionDigits: 4, maximumFractionDigits: 8 });
}

function formatCompactNumber(value: number): string {
  if (value >= 1_000_000_000) return (value / 1_000_000_000).toFixed(2) + "B";
  if (value >= 1_000_000) return (value / 1_000_000).toFixed(2) + "M";
  if (value >= 1_000) return (value / 1_000).toFixed(2) + "K";
  return value.toLocaleString();
}

export default function SidebarRight() {
  const activeSymbol = useTradingStore((state) => state.symbol);
  const setSymbol = useTradingStore((state) => state.setSymbol);
  const positions = useTradingStore((state) => state.positions);
  
  const { products, isLoading, watchlist, addToWatchlist, removeFromWatchlist, isInWatchlist } =
    useMarketData(activeSymbol);

  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"all" | "watchlist" | "gainers" | "losers">("all");
  const [sortBy, setSortBy] = useState<"name" | "price" | "change" | "volume">("name");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const sortProducts = (productsToSort: ExtendedProduct[]): ExtendedProduct[] => {
    return [...productsToSort].sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case "name":
          comparison = a.base_currency.localeCompare(b.base_currency);
          break;
        case "price":
          comparison = (a.currentPrice || 0) - (b.currentPrice || 0);
          break;
        case "change":
          comparison = (a.priceChangePercent24h || 0) - (b.priceChangePercent24h || 0);
          break;
        case "volume":
          comparison = (a.volume24h || 0) - (b.volume24h || 0);
          break;
      }
      return sortOrder === "asc" ? comparison : -comparison;
    });
  };

  const getDisplayedProducts = (): ExtendedProduct[] => {
    let filtered = [...products];

    if (searchQuery) {
      filtered = filtered.filter(
        (coin) =>
          coin.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
          coin.base_currency.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    switch (activeTab) {
      case "watchlist":
        filtered = filtered.filter((coin) => isInWatchlist(coin.id));
        break;
      case "gainers":
        filtered = filtered.filter((coin) => (coin.priceChangePercent24h || 0) > 0);
        break;
      case "losers":
        filtered = filtered.filter((coin) => (coin.priceChangePercent24h || 0) < 0);
        break;
    }

    return sortProducts(filtered).slice(0, 100);
  };

  const displayedProducts = getDisplayedProducts();

  if (!isMounted) {
    return (
      <aside className="flex w-72 shrink-0 flex-col border-l border-[#2a2e39] bg-[#131722] xl:w-80 select-none">
        <div className="flex items-center justify-center h-full p-8">
          <Loader2 className="h-8 w-8 animate-spin text-[#2962ff] mx-auto" />
        </div>
      </aside>
    );
  }

  return (
    <aside className="flex w-72 shrink-0 flex-col border-l border-[#2a2e39] bg-[#131722] xl:w-80 select-none">
      {/* Header with Search */}
      <div className="p-4 border-b border-[#2a2e39]">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-[#787b86] mb-3">Markets</h2>
        <div className="flex items-center gap-2 rounded-lg border border-[#2a2e39] bg-[#1e222d] px-3 py-2 focus-within:border-[#2962ff] transition-all">
          <Search className="h-4 w-4 text-[#787b86]" />
          <input
            type="text"
            placeholder="Search coin (e.g. BTC, ETH, DOGE)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-transparent text-sm text-white outline-none placeholder-[#434651]"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery("")} className="text-[#787b86] hover:text-white text-xs">
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[#2a2e39]">
        {[
          { id: "all", label: "All", icon: null },
          { id: "watchlist", label: "Watchlist", icon: Star },
          { id: "gainers", label: "Gainers", icon: TrendingUp },
          { id: "losers", label: "Losers", icon: TrendingDown },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as typeof activeTab)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold uppercase tracking-wider transition-all ${
              activeTab === tab.id
                ? "border-b-2 border-[#2962ff] text-[#2962ff] bg-[#2962ff]/5"
                : "text-[#787b86] hover:text-[#d1d4dc] hover:bg-[#1e222d]/50"
            }`}
          >
            {tab.icon && <tab.icon className="h-3 w-3" />}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Sort Controls */}
      <div className="flex gap-1 p-2 border-b border-[#2a2e39] bg-[#1c2030]/20">
        {[
          { id: "name", label: "Name" },
          { id: "price", label: "Price" },
          { id: "change", label: "Change" },
          { id: "volume", label: "Volume" },
        ].map((sort) => (
          <button
            key={sort.id}
            onClick={() => {
              if (sortBy === sort.id) {
                setSortOrder(sortOrder === "asc" ? "desc" : "asc");
              } else {
                setSortBy(sort.id as typeof sortBy);
                setSortOrder("asc");
              }
            }}
            className={`flex-1 px-2 py-1 text-[10px] font-semibold rounded transition-all ${
              sortBy === sort.id ? "bg-[#2962ff] text-white" : "text-[#787b86] hover:bg-[#1e222d]"
            }`}
          >
            {sort.label}
            {sortBy === sort.id && <span className="ml-1">{sortOrder === "asc" ? "↑" : "↓"}</span>}
          </button>
        ))}
      </div>

      {/* Market List - Added custom scrollbar classes */}
      <div className="flex-1 overflow-y-auto sidebar-scrollbar">
        {isLoading ? (
          <div className="flex h-64 flex-col items-center justify-center gap-3 text-xs text-[#787b86]">
            <Loader2 className="h-6 w-6 animate-spin text-[#2962ff]" />
            <span>Loading market data...</span>
          </div>
        ) : displayedProducts.length === 0 ? (
          <div className="flex h-64 flex-col items-center justify-center gap-2 text-center">
            <p className="text-sm text-[#434651]">No assets found</p>
            <p className="text-xs text-[#787b86]">
              {searchQuery ? "Try a different search term" : "Add coins to your watchlist"}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[#2a2e39]/50">
            {displayedProducts.map((coin) => (
              <MarketRow
                key={coin.id}
                coin={coin}
                isSelected={coin.id === activeSymbol}
                isInWatchlist={isInWatchlist(coin.id)}
                onSelect={() => {
                  setSymbol(coin.id);
                  setSearchQuery("");
                }}
                onToggleWatchlist={() => {
                  if (isInWatchlist(coin.id)) {
                    removeFromWatchlist(coin.id);
                  } else {
                    addToWatchlist(coin.id);
                  }
                }}
                position={positions.find((p) => p.symbol === coin.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Footer Stats */}
      <div className="shrink-0 p-3 bg-[#171b26]/40 border-t border-[#2a2e39]">
        <div className="flex justify-between text-[10px] mb-2">
          <span className="text-[#787b86]">Active Symbol</span>
          <span className="font-bold text-white">{activeSymbol}</span>
        </div>
        <div className="flex justify-between text-[10px]">
          <span className="text-[#787b86]">Watchlist</span>
          <span className="font-bold text-white">{watchlist.length} coins</span>
        </div>
      </div>

      {/* Custom scrollbar styles */}
      <style jsx global>{`
        .sidebar-scrollbar {
          scrollbar-width: thin;
          scrollbar-color: #2962ff #1c2030;
          overflow-x: hidden !important;
        }
        
        .sidebar-scrollbar::-webkit-scrollbar {
          width: 6px;
          height: 0px; /* Hide horizontal scrollbar */
        }
        
        .sidebar-scrollbar::-webkit-scrollbar-track {
          background: #1c2030;
          border-radius: 3px;
          margin: 4px 0;
        }
        
        .sidebar-scrollbar::-webkit-scrollbar-thumb {
          background: #2a2e39;
          border-radius: 3px;
          transition: background 0.2s ease;
        }
        
        .sidebar-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #2962ff;
        }
        
        /* Hide horizontal scrollbar completely */
        .sidebar-scrollbar::-webkit-scrollbar-corner {
          background: transparent;
        }
        
        /* Optional: Add a subtle gradient effect when scrolling */
        .sidebar-scrollbar {
          background: linear-gradient(to bottom, transparent 0%, rgba(41, 98, 255, 0.05) 100%);
        }
      `}</style>
    </aside>
  );
}

// Sub-component for individual market row
function MarketRow({
  coin,
  isSelected,
  isInWatchlist,
  onSelect,
  onToggleWatchlist,
  position,
}: {
  coin: ExtendedProduct;
  isSelected: boolean;
  isInWatchlist: boolean;
  onSelect: () => void;
  onToggleWatchlist: () => void;
  position?: any;
}) {
  const currentPrice = coin.currentPrice;
  const priceChange = coin.priceChangePercent24h || 0;
  const isPositive = priceChange >= 0;
  const hasPosition = position && position.quantity > 0;

  return (
    <div
      onClick={onSelect}
      className={`group relative cursor-pointer transition-all duration-200 ${
        isSelected ? "bg-[#2962ff]/10 border-l-2 border-[#2962ff]" : "hover:bg-[#1e222d]/50"
      }`}
    >
      <div className="px-3 py-2.5">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggleWatchlist();
              }}
              className={`transition-colors ${
                isInWatchlist ? "text-yellow-500" : "text-[#434651] hover:text-yellow-500"
              }`}
            >
              <Star className="h-3 w-3 fill-current" />
            </button>
            <div>
              <div className="font-bold text-sm text-white">{coin.base_currency}</div>
              <div className="text-[10px] text-[#787b86] font-mono">{coin.id}</div>
            </div>
          </div>
          <div className="text-right">
            <div className="font-bold text-sm text-white tabular-nums">
              {currentPrice ? formatAssetPrice(currentPrice) : "—"}
            </div>
            {priceChange !== 0 && (
              <div
                className={`text-[10px] font-semibold tabular-nums flex items-center justify-end gap-0.5 ${
                  isPositive ? "text-[#26a69a]" : "text-[#ef5350]"
                }`}
              >
                {isPositive ? <TrendingUp className="h-2.5 w-2.5" /> : <TrendingDown className="h-2.5 w-2.5" />}
                {isPositive ? "+" : ""}
                {priceChange.toFixed(2)}%
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center justify-between text-[10px] text-[#787b86]">
          <div className="flex items-center gap-3">
            {hasPosition && (
              <div className="flex items-center gap-1 text-[#2962ff]">
                <Volume2 className="h-2.5 w-2.5" />
                <span>{position.quantity.toFixed(4)}</span>
              </div>
            )}
            {coin.volume24h && (
              <div className="flex items-center gap-1">
                <Clock className="h-2.5 w-2.5" />
                <span>Vol {formatCompactNumber(coin.volume24h)}</span>
              </div>
            )}
          </div>
          {hasPosition && (
            <div className={`font-semibold ${position.pnl >= 0 ? "text-[#26a69a]" : "text-[#ef5350]"}`}>
              ${Math.abs(position.pnl).toFixed(2)}
            </div>
          )}
        </div>
      </div>
      {!isSelected && <div className="absolute inset-x-0 bottom-0 h-0.5 bg-[#2962ff]/0 group-hover:bg-[#2962ff]/30 transition-all" />}
    </div>
  );
}