// src/lib/websocket-manager.ts

type MessageHandler = (data: TickerMessage) => void;
type ConnectionStatus = "connecting" | "connected" | "disconnected";

interface TickerMessage {
  type: "ticker";
  price: string;
  last_size: string;
  product_id: string;
  time?: string;
  bid?: string;
  ask?: string;
  volume?: string;
  open?: string;
  high?: string;
  low?: string;
  change?: string;
  changePercent?: string;
}

interface SubscribeMessage {
  method: "SUBSCRIBE";
  params: string[];
  id: number;
}

class WebSocketManager {
  private ws: WebSocket | null = null;
  private handlers: Map<string, Set<MessageHandler>> = new Map();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 2000;
  private currentSymbol = "BTCUSDT";
  private statusListeners: Set<(status: ConnectionStatus) => void> = new Set();
  private currentStatus: ConnectionStatus = "disconnected";
  private messageId = 1;
  private subscribedStreams: Set<string> = new Set();
  private isConnecting = false;
  private isSubscribing = false;
  
  // Priority queue for messages
  private messageQueue: Array<{ priority: 'high' | 'low'; data: TickerMessage; timestamp: number }> = [];
  private isProcessingQueue = false;
  private lastHighPriorityUpdate = 0;
  private lowPriorityInterval: NodeJS.Timeout | null = null;

  /**
   * Connect to the backend WebSocket proxy (single connection)
   * Now only subscribes to the current symbol by default
   */
  connect(symbol: string, subscribeImmediately: boolean = true): void {
    this.currentSymbol = symbol;
    
    // If already connected, just update subscription
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      if (subscribeImmediately) {
        this.sendSubscribe(symbol);
      }
      return;
    }
    
    // If already connecting, wait
    if (this.isConnecting) {
      return;
    }
    
    this.isConnecting = true;
    const WS_URL = process.env.NEXT_PUBLIC_WS_URL || `ws://localhost:5000`;
    
    this.ws = new WebSocket(WS_URL);
    this.setupEventHandlers();
  }

  /**
   * Subscribe to multiple markets (for sidebar - OPTIONAL, use with caution)
   * Now with rate limiting and priority management
   */
  subscribeToMarkets(symbols: string[]): void {
    if (!symbols || symbols.length === 0) return;
    
    // CRITICAL: Limit subscriptions to avoid flooding
    const MAX_SUBSCRIPTIONS = 10;
    if (symbols.length > MAX_SUBSCRIPTIONS) {
      console.warn(`[WS] Limiting subscriptions from ${symbols.length} to ${MAX_SUBSCRIPTIONS}`);
      symbols = symbols.slice(0, MAX_SUBSCRIPTIONS);
    }
    
    const streams = symbols.map(s => `${s.toLowerCase()}@ticker`);
    const newStreams = streams.filter(stream => !this.subscribedStreams.has(stream));
    
    if (newStreams.length === 0) return;
    
    newStreams.forEach(stream => this.subscribedStreams.add(stream));
    
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      const subscribeMsg = {
        method: "SUBSCRIBE",
        params: newStreams,
        id: this.messageId++
      };
      this.ws.send(JSON.stringify(subscribeMsg));
      console.log(`[WS] Subscribed to ${newStreams.length} additional markets`);
    }
  }

  
  /**
   * Send subscribe message for a single symbol (HIGH PRIORITY)
   */
  private sendSubscribe(symbol: string): void {
    if (this.isSubscribing) return;
    this.isSubscribing = true;
    
    try {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
      
      const stream = `${symbol.toLowerCase()}@ticker`;
      
      // Check if already subscribed
      if (this.subscribedStreams.has(stream)) {
        this.isSubscribing = false;
        return;
      }
      
      const subscribeMsg: SubscribeMessage = {
        method: "SUBSCRIBE",
        params: [stream],
        id: this.messageId++
      };
      this.ws.send(JSON.stringify(subscribeMsg));
      this.subscribedStreams.add(stream);
      console.log(`[WS] Subscribed to ${symbol}`);
    } finally {
      this.isSubscribing = false;
    }
  }

  /**
   * Process message queue with priority
   */
  private processQueue(): void {
    if (this.isProcessingQueue) return;
    
    this.isProcessingQueue = true;
    
    try {
      // Sort by priority (high first) and timestamp
      const sorted = [...this.messageQueue].sort((a, b) => {
        if (a.priority === 'high' && b.priority === 'low') return -1;
        if (a.priority === 'low' && b.priority === 'high') return 1;
        return a.timestamp - b.timestamp;
      });
      
      // Process high priority messages immediately
      const highPriorityMessages = sorted.filter(m => m.priority === 'high');
      const lowPriorityMessages = sorted.filter(m => m.priority === 'low');
      
      // High priority - process all immediately
      highPriorityMessages.forEach(msg => {
        this.notifyHandlers(msg.data);
      });
      
      // Low priority - throttle to max 10 per second
      const now = Date.now();
      const timeSinceLastUpdate = now - this.lastHighPriorityUpdate;
      
      if (lowPriorityMessages.length > 0 && timeSinceLastUpdate > 100) {
        // Process only first 5 low priority messages per batch
        const toProcess = lowPriorityMessages.slice(0, 5);
        toProcess.forEach(msg => {
          this.notifyHandlers(msg.data);
        });
        this.lastHighPriorityUpdate = now;
      }
      
      // Clear processed messages
      this.messageQueue = [];
      
    } finally {
      this.isProcessingQueue = false;
    }
  }

  /**
   * Notify all handlers for a channel
   */
  private notifyHandlers(data: TickerMessage): void {
    const handlers = this.handlers.get("ticker");
    if (handlers && handlers.size > 0) {
      handlers.forEach(handler => {
        try {
          handler(data);
        } catch (error) {
          console.error("[WS] Handler error:", error);
        }
      });
    }
  }

  private setStatus(status: ConnectionStatus): void {
    if (this.currentStatus === status) return;
    this.currentStatus = status;
    this.statusListeners.forEach(listener => listener(status));
  }

  /**
   * Set up WebSocket event handlers
   */
  private setupEventHandlers(): void {
    if (!this.ws) return;

    this.ws.onopen = (): void => {
      console.log("[WS] Connected to backend proxy");
      this.setStatus("connected");
      this.reconnectAttempts = 0;
      this.isConnecting = false;
      
      // Subscribe to current symbol
      this.sendSubscribe(this.currentSymbol);
      
      // Start low priority interval processing
      if (this.lowPriorityInterval) clearInterval(this.lowPriorityInterval);
      this.lowPriorityInterval = setInterval(() => {
        if (this.messageQueue.length > 0) {
          this.processQueue();
        }
      }, 500);
    };

    this.ws.onmessage = (event: MessageEvent): void => {
      try {
        const data = JSON.parse(event.data);
        
        // Handle backend proxy events
        if (data.event === 'connected') {
          console.log("[WS] Backend proxy connected:", data.message);
          return;
        }
        
        if (data.event === 'disconnected') {
          console.warn("[WS] Backend proxy disconnected:", data.reason);
          this.setStatus("disconnected");
          return;
        }
        
        if (data.event === 'error') {
          console.error("[WS] Backend proxy error:", data.message);
          return;
        }
        
        // Handle ticker messages from Binance
        if ((data.e === "24hrTicker" || data.stream?.includes('@ticker')) && data.c) {
          // Get symbol from data.s (Binance format) or from stream
          let symbol = data.s;
          if (data.stream) {
            symbol = data.stream.split('@')[0].toUpperCase();
          }
          
          const tickerMessage: TickerMessage = {
            type: "ticker",
            price: data.c,
            last_size: data.v || "0",
            product_id: symbol, // Keep as is (BTCUSDT format)
            time: new Date(data.E).toISOString(),
            bid: data.b,
            ask: data.a,
            volume: data.v,
            open: data.o,
            high: data.h,
            low: data.l,
            change: data.p,
            changePercent: data.P
          };
          
          // Determine priority based on whether it's the current symbol
          const priority = symbol === this.currentSymbol ? 'high' : 'low';
          
          // Add to queue instead of processing immediately
          this.messageQueue.push({
            priority,
            data: tickerMessage,
            timestamp: Date.now()
          });
          
          // Process high priority immediately
          if (priority === 'high') {
            this.processQueue();
          }
        }
        
        // Handle subscription response
        if (data.result !== undefined) {
          console.log("[WS] Subscription confirmed:", data.result);
        }
      } catch (error) {
        console.error("[WS] Error parsing message:", error);
      }
    };

    this.ws.onclose = (event: CloseEvent): void => {
      console.log(`[WS] Disconnected: ${event.code} - ${event.reason}`);
      this.setStatus("disconnected");
      this.isConnecting = false;
      
      if (this.lowPriorityInterval) {
        clearInterval(this.lowPriorityInterval);
        this.lowPriorityInterval = null;
      }
      
      // Clear subscriptions
      this.subscribedStreams.clear();
      
      // Reconnect if not manual disconnect
      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        this.reconnect();
      }
    };

    this.ws.onerror = (error: Event): void => {
      console.error("[WS] Error:", error);
      this.setStatus("disconnected");
      this.isConnecting = false;
    };
  }

  /**
   * Attempt to reconnect with exponential backoff
   */
  private reconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error("[WS] Max reconnection attempts reached");
      return;
    }

    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts);
    console.log(`[WS] Reconnecting in ${delay}ms... (Attempt ${this.reconnectAttempts + 1})`);
    
    setTimeout(() => {
      this.reconnectAttempts++;
      this.isConnecting = false;
      this.connect(this.currentSymbol);
    }, delay);
  }

  /**
   * Subscribe to a message channel
   */
  subscribe(channel: "ticker", handler: MessageHandler): () => void {
    if (!this.handlers.has(channel)) {
      this.handlers.set(channel, new Set());
    }
    this.handlers.get(channel)!.add(handler);
    
    return () => {
      this.handlers.get(channel)?.delete(handler);
    };
  }

  /**
   * Listen to connection status changes
   */
  onStatusChange(listener: (status: ConnectionStatus) => void): () => void {
    this.statusListeners.add(listener);
    listener(this.currentStatus);
    return () => this.statusListeners.delete(listener);
  }

  /**
   * Get current connection status
   */
  getStatus(): ConnectionStatus {
    return this.currentStatus;
  }

  /**
   * Update current symbol (re-subscribe)
   */
  updateSymbol(newSymbol: string): void {
    if (this.currentSymbol === newSymbol) return;
    this.currentSymbol = newSymbol;
    
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.sendSubscribe(newSymbol);
    }
  }

  /**
   * Manually disconnect WebSocket
   */
  disconnect(): void {
    this.reconnectAttempts = this.maxReconnectAttempts;
    if (this.lowPriorityInterval) {
      clearInterval(this.lowPriorityInterval);
      this.lowPriorityInterval = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.handlers.clear();
    this.statusListeners.clear();
    this.subscribedStreams.clear();
    this.messageQueue = [];
    this.isConnecting = false;
    this.setStatus("disconnected");
  }
}

export const wsManager = new WebSocketManager();
export type { TickerMessage, ConnectionStatus };