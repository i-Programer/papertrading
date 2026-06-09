// src/hooks/useMarketData.ts - MODIFIED to reduce subscriptions
import { useState, useEffect, useCallback } from "react";
import { marketService, type Product } from "@/services/marketService";
import { wsManager, type TickerMessage } from "@/lib/websocket-manager";

export interface ExtendedProduct extends Product {
  currentPrice?: number;
  priceChangePercent24h?: number;
  volume24h?: number;
  high24h?: number;
  low24h?: number;
}

export function useMarketData(activeSymbol: string) {
  const [products, setProducts] = useState<ExtendedProduct[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [watchlist, setWatchlist] = useState<string[]>([]);

  // Load watchlist from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("trading_watchlist");
    if (saved) {
      try {
        setWatchlist(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to load watchlist:", e);
      }
    }
  }, []);

  const addToWatchlist = useCallback((symbol: string) => {
    setWatchlist((prev) => {
      if (prev.includes(symbol)) return prev;
      const newList = [...prev, symbol];
      localStorage.setItem("trading_watchlist", JSON.stringify(newList));
      return newList;
    });
  }, []);

  const removeFromWatchlist = useCallback((symbol: string) => {
    setWatchlist((prev) => {
      const newList = prev.filter((s) => s !== symbol);
      localStorage.setItem("trading_watchlist", JSON.stringify(newList));
      return newList;
    });
  }, []);

  const isInWatchlist = useCallback((symbol: string) => watchlist.includes(symbol), [watchlist]);

  // Fetch products
  useEffect(() => {
    const fetchProducts = async () => {
      try {
        setIsLoading(true);
        const data = await marketService.fetchProducts();
        setProducts(data);
      } catch (err) {
        console.error("Failed to fetch products:", err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchProducts();
  }, []);

  // WebSocket price updates - REDUCED to only watchlist + active symbol
  useEffect(() => {
    if (products.length === 0) return;

    // Only subscribe to watchlist items + active symbol (max 11-15 items)
    const symbolsToSubscribe = [...new Set([activeSymbol, ...watchlist])].slice(0, 15);
    
    console.log(`[MarketData] Subscribing to ${symbolsToSubscribe.length} symbols:`, symbolsToSubscribe);

    const unsubscribe = wsManager.subscribe("ticker", (data: TickerMessage) => {
      if (data.price && data.product_id && symbolsToSubscribe.includes(data.product_id)) {
        const price = parseFloat(data.price);
        const changePercent = data.changePercent ? parseFloat(data.changePercent) : undefined;
        const volume = data.volume ? parseFloat(data.volume) : undefined;
        const high = data.high ? parseFloat(data.high) : undefined;
        const low = data.low ? parseFloat(data.low) : undefined;

        setProducts((prev) =>
          prev.map((p) =>
            p.id === data.product_id
              ? {
                  ...p,
                  currentPrice: price,
                  priceChangePercent24h: changePercent ?? p.priceChangePercent24h,
                  volume24h: volume ?? p.volume24h,
                  high24h: high ?? p.high24h,
                  low24h: low ?? p.low24h,
                }
              : p
          )
        );
      }
    });

    // Subscribe only to necessary symbols
    if (wsManager && typeof wsManager.subscribeToMarkets === "function") {
      wsManager.subscribeToMarkets(symbolsToSubscribe);
    }
    
    wsManager.connect(activeSymbol);

    return () => unsubscribe();
  }, [products.length, activeSymbol, watchlist]);

  return {
    products,
    isLoading,
    watchlist,
    addToWatchlist,
    removeFromWatchlist,
    isInWatchlist,
  };
}