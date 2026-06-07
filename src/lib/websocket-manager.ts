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
  private maxReconnectAttempts = 3;
  private reconnectDelay = 2000;
  private currentSymbol = "BTCUSDT";
  private statusListeners: Set<(status: ConnectionStatus) => void> = new Set();
  private currentStatus: ConnectionStatus = "disconnected";
  private messageId = 1;
  private subscribedStreams: Set<string> = new Set();
  private isConnecting = false;
  private pendingSubscriptions: string[] = [];

  /**
   * Connect to the backend WebSocket proxy (single connection)
   */
  connect(symbol: string): void {
    this.currentSymbol = symbol;
    
    // If already connected or connecting, just update the current symbol
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      // console.log(`WebSocket already ${this.ws.readyState === WebSocket.OPEN ? 'connected' : 'connecting'}, using existing connection`);
      if (this.ws.readyState === WebSocket.OPEN) {
        this.sendSubscribe(symbol);
      }
      return;
    }
    
    // Prevent multiple connection attempts
    if (this.isConnecting) {
      // console.log('Connection already in progress, skipping...');
      return;
    }
    
    this.isConnecting = true;
    const WS_URL = process.env.NEXT_PUBLIC_WS_URL || `ws://localhost:5000`;
    
    // console.log(`Creating WebSocket connection to backend proxy: ${WS_URL}`);
    this.ws = new WebSocket(WS_URL);
    this.setupEventHandlers();
  }

  /**
   * Subscribe to multiple markets (for sidebar)
   */
  subscribeToMarkets(symbols: string[]): void {
    if (!symbols || symbols.length === 0) return;
    
    const streams = symbols.map(s => `${s.toLowerCase()}@ticker`);
    const newStreams = streams.filter(stream => !this.subscribedStreams.has(stream));
    
    if (newStreams.length === 0) return;
    
    // console.log(`Subscribing to ${newStreams.length} new markets`);
    newStreams.forEach(stream => this.subscribedStreams.add(stream));
    
    // If connection is ready, send subscription immediately
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      const subscribeMsg = {
        method: "SUBSCRIBE",
        params: newStreams,
        id: this.messageId++
      };
      this.ws.send(JSON.stringify(subscribeMsg));
    } else {
      // Queue subscription for when connection is ready
      this.pendingSubscriptions.push(...newStreams);
      // Trigger connection if not already connecting
      this.connect(this.currentSymbol);
    }
  }

  /**
   * Send subscribe message through backend proxy
   */
  private sendSubscribe(symbol: string): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    
    const stream = `${symbol.toLowerCase()}@ticker`;
    
    // Only subscribe if not already subscribed
    if (!this.subscribedStreams.has(stream)) {
      const subscribeMsg: SubscribeMessage = {
        method: "SUBSCRIBE",
        params: [stream],
        id: this.messageId++
      };
      this.ws.send(JSON.stringify(subscribeMsg));
      this.subscribedStreams.add(stream);
      // console.log(`Sent subscribe for ${symbol}`);
    }
  }

  /**
   * Process any pending subscriptions
   */
  private processPendingSubscriptions(): void {
    if (this.pendingSubscriptions.length === 0) return;
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    
    const subscriptions = [...this.pendingSubscriptions];
    this.pendingSubscriptions = [];
    
    const subscribeMsg = {
      method: "SUBSCRIBE",
      params: subscriptions,
      id: this.messageId++
    };
    this.ws.send(JSON.stringify(subscribeMsg));
    // console.log(`Processed ${subscriptions.length} pending subscriptions`);
  }

  /**
   * Update connection status and notify all listeners
   */
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
      // console.log("WebSocket connected to backend proxy successfully");
      this.setStatus("connected");
      this.reconnectAttempts = 0;
      this.isConnecting = false;
      
      // Process any pending subscriptions
      this.processPendingSubscriptions();
      
      // Subscribe to current symbol
      this.sendSubscribe(this.currentSymbol);
    };

    const DEBUG = true;
    function debugLog(...args: any[]) {
        if (DEBUG) {
            // console.log('[WS DEBUG]', new Date().toISOString(), ...args);
        }
    }
    this.ws.onmessage = (event: MessageEvent): void => {
        try {
            const data = JSON.parse(event.data);
            
            debugLog('Received message type:', data.e || data.event || 'unknown', data);
            
            // Handle backend proxy events
            if (data.event === 'connected') {
                // console.log('Backend proxy confirmed connection:', data.message);
                return;
            }
            
            if (data.event === 'disconnected') {
                console.warn('Backend proxy disconnected from Binance:', data.reason);
                this.setStatus("disconnected");
                return;
            }
            
            if (data.event === 'error') {
                console.error('Backend proxy error:', data.message);
                return;
            }
            
            // Handle ticker messages from Binance
            if (data.e === "24hrTicker" && data.c) {
                debugLog(`Processing ticker for ${data.s}: price=${data.c}`);
                
                const tickerMessage: TickerMessage = {
                    type: "ticker",
                    price: data.c,
                    last_size: data.v,
                    product_id: this.toFrontendSymbol(data.s),
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
                
                const handlers = this.handlers.get("ticker");
                if (handlers && handlers.size > 0) {
                    debugLog(`Notifying ${handlers.size} ticker handlers`);
                    handlers.forEach(handler => handler(tickerMessage));
                } else {
                    debugLog('No ticker handlers registered');
                }
            }
            
            // Handle subscription response
            if (data.result !== undefined) {
                // console.log("Subscription confirmed:", data);
            }
        } catch (error) {
            console.error("Error parsing WebSocket message:", error);
        }
    };

    this.ws.onclose = (event: CloseEvent): void => {
      // console.log(`WebSocket disconnected: ${event.code} - ${event.reason}`);
      this.setStatus("disconnected");
      this.isConnecting = false;
      
      // Clear all subscriptions on disconnect
      this.subscribedStreams.clear();
      
      // Reconnect if not manual disconnect
      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        this.reconnect();
      }
    };

    this.ws.onerror = (error: Event): void => {
      console.error("WebSocket error:", error);
      this.setStatus("disconnected");
      this.isConnecting = false;
    };
  }

  /**
   * Convert Binance symbol format to frontend format
   */
  private toFrontendSymbol(symbol: string): string {
    if (symbol.endsWith('USDT') || symbol.endsWith('USDC')) {
      return symbol;
    }
    return symbol;
  }

  /**
   * Attempt to reconnect with exponential backoff
   */
  private reconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error("Max reconnection attempts reached. Please refresh the page.");
      return;
    }

    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts);
    // console.log(`Reconnecting in ${delay}ms... (Attempt ${this.reconnectAttempts + 1}/${this.maxReconnectAttempts})`);
    
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
   * Manually disconnect WebSocket
   */
  disconnect(): void {
    this.reconnectAttempts = this.maxReconnectAttempts; // Prevent auto-reconnect
    if (this.ws) {
      // console.log("Manually disconnecting WebSocket");
      this.ws.close();
      this.ws = null;
    }
    this.handlers.clear();
    this.statusListeners.clear();
    this.subscribedStreams.clear();
    this.pendingSubscriptions = [];
    this.isConnecting = false;
    this.setStatus("disconnected");
  }
}

export const wsManager = new WebSocketManager();
export type { TickerMessage, ConnectionStatus };