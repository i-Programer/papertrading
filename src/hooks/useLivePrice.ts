// src/hooks/useLivePrice.ts
import { useState, useEffect, useRef } from "react";
import { wsManager, type TickerMessage } from "@/lib/websocket-manager";

export function useLivePrice(symbol: string, onPriceUpdate?: (price: number) => void) {
  const [livePrice, setLivePrice] = useState<number>(67000);
  const [isConnected, setIsConnected] = useState(wsManager.getStatus() === "connected");
  const lastPriceRef = useRef<number>(67000);

  useEffect(() => {
    // Subscribe to WebSocket for real price updates
    const unsubscribe = wsManager.subscribe("ticker", (data: TickerMessage) => {
      if (data.product_id === symbol && data.price) {
        const price = parseFloat(data.price);
        if (!isNaN(price) && price > 0) {
          lastPriceRef.current = price;
          setLivePrice(price);
          onPriceUpdate?.(price);
        }
      }
    });

    // Listen to connection status
    const statusUnsubscribe = wsManager.onStatusChange((status) => {
      setIsConnected(status === "connected");
    });

    // Ensure WebSocket is connected
    wsManager.connect(symbol);

    return () => {
      unsubscribe();
      statusUnsubscribe();
    };
  }, [symbol, onPriceUpdate]);

  return { livePrice, isConnected };
}