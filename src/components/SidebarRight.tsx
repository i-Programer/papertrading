// src/components/SidebarRight.tsx
"use client";

import { useState, useEffect } from "react";
import { Search, Loader2, Star, TrendingUp, TrendingDown, Volume2, Clock } from "lucide-react";
import { useTradingStore } from "@/stores/useTradingStore";
import { wsManager, type TickerMessage } from "@/lib/websocket-manager";

interface BinanceProduct {
  id: string;
  base_currency: string;
  quote_currency: string;
  base_min_size: string;
  base_max_size: string;
  quote_increment: string;
  status: string;
}

interface ExtendedProduct extends BinanceProduct {
  currentPrice?: number;
  priceChange24h?: number;
  priceChangePercent24h?: number;
  volume24h?: number;
  high24h?: number;
  low24h?: number;
}

interface WatchlistItem {
  symbol: string;
  addedAt: number;
}

function formatAssetPrice(value: number): string {
  if (value >= 1000) {
    return value.toLocaleString("en-US", { maximumFractionDigits: 2 });
  }
  if (value >= 1) {
    return value.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 4,
    });
  }
  return value.toLocaleString("en-US", {
    minimumFractionDigits: 4,
    maximumFractionDigits: 8,
  });
}

function formatCompactNumber(value: number): string {
  if (value >= 1_000_000_000) {
    return (value / 1_000_000_000).toFixed(2) + 'B';
  }
  if (value >= 1_000_000) {
    return (value / 1_000_000).toFixed(2) + 'M';
  }
  if (value >= 1_000) {
    return (value / 1_000).toFixed(2) + 'K';
  }
  return value.toLocaleString();
}

// Popular trading pairs on Binance (filtered to USD pairs)
const POPULAR_SYMBOLS = [
  "BTCUSDT", "ETHUSDT", "BNBUSDT", "SOLUSDT", "XRPUSDT", 
  "ADAUSDT", "DOGEUSDT", "AVAXUSDT", "DOTUSDT", "MATICUSDT"
];

export default function SidebarRight() {
  const activeSymbol = useTradingStore((state) => state.symbol);
  const setSymbol = useTradingStore((state) => state.setSymbol);
  const positions = useTradingStore((state) => state.positions);

  // State for market data
  const [allProducts, setAllProducts] = useState<ExtendedProduct[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isMounted, setIsMounted] = useState(false);
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
  const [activeTab, setActiveTab] = useState<"all" | "watchlist" | "gainers" | "losers">("all");
  const [sortBy, setSortBy] = useState<"name" | "price" | "change" | "volume">("name");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  // Handle hydration
  useEffect(() => {
    setIsMounted(true);
    // Load watchlist from localStorage
    const savedWatchlist = localStorage.getItem("trading_watchlist");
    if (savedWatchlist) {
      try {
        setWatchlist(JSON.parse(savedWatchlist));
      } catch (e) {
        console.error("Failed to load watchlist:", e);
      }
    }
  }, []);

  // Save watchlist to localStorage
  useEffect(() => {
    if (isMounted && watchlist.length > 0) {
      localStorage.setItem("trading_watchlist", JSON.stringify(watchlist));
    }
  }, [watchlist, isMounted]);

  // Fetch all products from backend proxy
  useEffect(() => {
    if (!isMounted) return;

    // In SidebarRight.tsx, update the fetchProducts useEffect (around line 130)
    const fetchProducts = async () => {
      try {
        setIsLoading(true);
        const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
        const response = await fetch(`${API_BASE}/api/products`);
        
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const data: BinanceProduct[] = await response.json();
        
        // Filter only USDT pairs (equivalent to USD) and popular ones
        const usdPairs = data
          .filter((product) => product.quote_currency === "USDT" && product.status === "TRADING")
          .slice(0, 150)
          .map(product => ({
            ...product,
            id: product.id,
            base_currency: product.base_currency,
            quote_currency: "USD",
            currentPrice: undefined,
            priceChange24h: undefined,
            priceChangePercent24h: undefined,
            volume24h: undefined,
            high24h: undefined,
            low24h: undefined,
          }));

        // Sort alphabetically by base currency
        usdPairs.sort((a, b) => a.base_currency.localeCompare(b.base_currency));
        setAllProducts(usdPairs);

        // Subscribe to top symbols for real-time updates
        const topSymbols = usdPairs.slice(0, 50).map(p => p.id);
        
        // Check if subscribeToMarkets exists before calling
        if (wsManager && typeof wsManager.subscribeToMarkets === 'function') {
          wsManager.subscribeToMarkets(topSymbols);
        } else {
          // console.log('subscribeToMarkets not available yet, will subscribe individually');
          // Fallback: connect to first symbol to establish connection
          if (topSymbols.length > 0) {
            wsManager.connect(topSymbols[0]);
          }
        }
      } catch (error) {
        console.error("Failed to fetch products:", error);
        // Fallback to popular symbols if API fails
        const fallbackProducts: ExtendedProduct[] = POPULAR_SYMBOLS.map(symbol => ({
          id: symbol,
          base_currency: symbol.replace('USDT', ''),
          quote_currency: "USD",
          base_min_size: "0.00001",
          base_max_size: "1000",
          quote_increment: "0.01",
          status: "TRADING",
          currentPrice: undefined,
        }));
        setAllProducts(fallbackProducts);
      } finally {
        setIsLoading(false);
      }
    };

    fetchProducts();
  }, [isMounted]);

  // Subscribe to real-time price updates for all displayed coins
  useEffect(() => {
    if (!isMounted || allProducts.length === 0) return;

    // Get unique symbols from displayed list and watchlist
    const displayedSymbols = getDisplayedProducts().map(p => p.id);
    const watchlistSymbols = watchlist.map(w => w.symbol);
    const allSymbols = [...new Set([...displayedSymbols, ...watchlistSymbols])];
    
    // Subscribe to these symbols if method exists
    if (wsManager && typeof wsManager.subscribeToMarkets === 'function') {
      wsManager.subscribeToMarkets(allSymbols);
    }

    // Subscribe to ticker updates
    const unsubscribe = wsManager.subscribe("ticker", (data: TickerMessage) => {
        // console.log('[Sidebar] Received ticker update:', data.product_id, data.price);
        
        if (data.price && data.product_id) {
            const price = parseFloat(data.price);
            
            setAllProducts(prev => prev.map(product => {
                const frontendSymbol = data.product_id.replace('-', '').toUpperCase();
                
                if (product.id === frontendSymbol || product.id === data.product_id) {
                    // console.log(`[Sidebar] Updating ${product.id} price to ${price}`);
                    return {
                        ...product,
                        currentPrice: price,
                        priceChangePercent24h: data.changePercent ? parseFloat(data.changePercent) : product.priceChangePercent24h,
                        volume24h: data.volume ? parseFloat(data.volume) : product.volume24h,
                        high24h: data.high ? parseFloat(data.high) : product.high24h,
                        low24h: data.low ? parseFloat(data.low) : product.low24h,
                    };
                }
                return product;
            }));
        }
    });

    // Connect WebSocket if not already connected
    wsManager.connect(activeSymbol);

    return () => unsubscribe();
  }, [allProducts.length, watchlist, activeSymbol, isMounted]);

  // Watchlist management functions
  const addToWatchlist = (symbol: string) => {
    if (!watchlist.find(w => w.symbol === symbol)) {
      setWatchlist([...watchlist, { symbol, addedAt: Date.now() }]);
    }
  };

  const removeFromWatchlist = (symbol: string) => {
    setWatchlist(watchlist.filter(w => w.symbol !== symbol));
  };

  const isInWatchlist = (symbol: string): boolean => {
    return watchlist.some(w => w.symbol === symbol);
  };

  // Sort products
  const sortProducts = (products: ExtendedProduct[]): ExtendedProduct[] => {
    return [...products].sort((a, b) => {
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

  // Filter and sort products based on active tab
  const getDisplayedProducts = (): ExtendedProduct[] => {
    let filtered = [...allProducts];

    // Apply search filter
    if (searchQuery) {
      filtered = filtered.filter(coin =>
        coin.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        coin.base_currency.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Apply tab filter
    switch (activeTab) {
      case "watchlist":
        filtered = filtered.filter(coin => isInWatchlist(coin.id));
        break;
      case "gainers":
        filtered = filtered.filter(coin => (coin.priceChangePercent24h || 0) > 0);
        break;
      case "losers":
        filtered = filtered.filter(coin => (coin.priceChangePercent24h || 0) < 0);
        break;
    }

    // Apply sorting
    return sortProducts(filtered).slice(0, 100); // Limit to 100 for performance
  };

  const displayedProducts = getDisplayedProducts();

  // Don't render until mounted
  if (!isMounted) {
    return (
      <aside className="flex w-72 shrink-0 flex-col border-l border-[#2a2e39] bg-[#131722] xl:w-80 select-none">
        <div className="flex items-center justify-center h-full p-8">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin text-[#2962ff] mx-auto mb-2" />
            <p className="text-xs text-[#787b86]">Loading markets...</p>
          </div>
        </div>
      </aside>
    );
  }

  return (
    <aside className="flex w-72 shrink-0 flex-col border-l border-[#2a2e39] bg-[#131722] xl:w-80 select-none">
      
      {/* Header with Search */}
      <div className="p-4 border-b border-[#2a2e39]">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-[#787b86] mb-3">
          Markets
        </h2>
        
        {/* Search Bar */}
        <div className="flex items-center gap-2 rounded-lg border border-[#2a2e39] bg-[#1e222d] px-3 py-2 focus-within:border-[#2962ff] transition-all">
          <Search className="h-4 w-4 text-[#787b86]" />
          <input
            type="text"
            placeholder="Search coin (e.g. BTC, ETH, DOGE)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-transparent text-sm text-white outline-none placeholder-[#434651]"
            autoComplete="off"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="text-[#787b86] hover:text-white text-xs"
            >
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
              sortBy === sort.id
                ? "bg-[#2962ff] text-white"
                : "text-[#787b86] hover:bg-[#1e222d]"
            }`}
          >
            {sort.label}
            {sortBy === sort.id && (
              <span className="ml-1">{sortOrder === "asc" ? "↑" : "↓"}</span>
            )}
          </button>
        ))}
      </div>

      {/* Market List */}
      <div className="flex-1 overflow-y-auto">
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
            {displayedProducts.map((coin) => {
              const isSelected = coin.id === activeSymbol;
              const inWatchlist = isInWatchlist(coin.id);
              const currentPrice = coin.currentPrice;
              const priceChange = coin.priceChangePercent24h || 0;
              const isPositive = priceChange >= 0;
              const position = positions.find(p => p.symbol === coin.id);
              const hasPosition = position && position.quantity > 0;

              return (
                <div
                  key={coin.id}
                  onClick={() => {
                    setSymbol(coin.id);
                    setSearchQuery("");
                  }}
                  className={`group relative cursor-pointer transition-all duration-200 ${
                    isSelected
                      ? "bg-[#2962ff]/10 border-l-2 border-[#2962ff]"
                      : "hover:bg-[#1e222d]/50"
                  }`}
                >
                  <div className="px-3 py-2.5">
                    {/* Main row */}
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        {/* Watchlist star */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (inWatchlist) {
                              removeFromWatchlist(coin.id);
                            } else {
                              addToWatchlist(coin.id);
                            }
                          }}
                          className={`transition-colors ${
                            inWatchlist ? "text-yellow-500" : "text-[#434651] hover:text-yellow-500"
                          }`}
                        >
                          <Star className="h-3 w-3 fill-current" />
                        </button>
                        
                        {/* Symbol and name */}
                        <div>
                          <div className="font-bold text-sm text-white">
                            {coin.base_currency}
                          </div>
                          <div className="text-[10px] text-[#787b86] font-mono">
                            {coin.id}
                          </div>
                        </div>
                      </div>

                      {/* Price and change */}
                      <div className="text-right">
                        <div className="font-bold text-sm text-white tabular-nums">
                          {currentPrice ? formatAssetPrice(currentPrice) : "—"}
                        </div>
                        {priceChange !== 0 && (
                          <div className={`text-[10px] font-semibold tabular-nums flex items-center justify-end gap-0.5 ${
                            isPositive ? "text-[#26a69a]" : "text-[#ef5350]"
                          }`}>
                            {isPositive ? <TrendingUp className="h-2.5 w-2.5" /> : <TrendingDown className="h-2.5 w-2.5" />}
                            {isPositive ? "+" : ""}{priceChange.toFixed(2)}%
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Secondary info */}
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
                        <div className={`font-semibold ${
                          position.pnl >= 0 ? "text-[#26a69a]" : "text-[#ef5350]"
                        }`}>
                          ${Math.abs(position.pnl).toFixed(2)}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Hover indicator */}
                  {!isSelected && (
                    <div className="absolute inset-x-0 bottom-0 h-0.5 bg-[#2962ff]/0 group-hover:bg-[#2962ff]/30 transition-all" />
                  )}
                </div>
              );
            })}
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
    </aside>
  );
}