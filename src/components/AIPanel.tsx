// src/components/AIPanel.tsx
"use client";

import { useState, useEffect } from "react";
import { Brain, TrendingUp, TrendingDown, AlertCircle, MessageCircle, X } from "lucide-react";
import { useTradingStore } from "@/stores/useTradingStore";
import { useChartData, CHART_PRESETS } from "@/hooks/useChartData";

interface AISignal {
  action: "BUY" | "SELL" | "HOLD";
  confidence: number;
  takeProfit: number | null;
  stopLoss: number | null;
  reasoning: string;
  riskLevel: "LOW" | "MEDIUM" | "HIGH";
}

interface Pattern {
  name: string;
  meaning: string;
  strength: "LOW" | "MEDIUM" | "HIGH";
}

export default function AIPanel() {
  const { symbol, positions, balance, tradeHistory } = useTradingStore();
  const { candles, isLoading } = useChartData(symbol, CHART_PRESETS[2]); 
  
  const [aiSignal, setAiSignal] = useState<AISignal | null>(null);
  const [patterns, setPatterns] = useState<Pattern[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessage, setChatMessage] = useState("");
  const [chatHistory, setChatHistory] = useState<{ role: "user" | "assistant"; content: string }[]>([]);
  const [showAIPanel, setShowAIPanel] = useState(true);

  const calculateIndicators = () => {
    if (candles.length < 20) return { rsi: null, macd: null, volumeChange: null };
    
    const closes = candles.map(c => c.close);
    let gains = 0, losses = 0;
    for (let i = closes.length - 14; i < closes.length; i++) {
      const change = closes[i] - closes[i - 1];
      if (change > 0) gains += change;
      else losses -= change;
    }
    const avgGain = gains / 14;
    const avgLoss = losses / 14;
    const rsi = avgLoss === 0 ? 100 : 100 - (100 / (1 + avgGain / avgLoss));
    
    const avgVolumeLast5 = candles.slice(-5).reduce((s, c) => s + c.volume, 0) / 5;
    const avgVolumePrev5 = candles.slice(-10, -5).reduce((s, c) => s + c.volume, 0) / 5;
    const volumeChange = ((avgVolumeLast5 - avgVolumePrev5) / avgVolumePrev5) * 100;
    
    return { rsi: Math.round(rsi), macd: "trending", volumeChange: Math.round(volumeChange) };
  };

  const getAISignal = async () => {
    setIsAnalyzing(true);
    const indicators = calculateIndicators();
    
    try {
      const signalRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/ai/signal`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symbol,
          currentPrice: candles[candles.length - 1]?.close || 0,
          indicators,
          candles: candles.slice(-50),
          positions
        })
      });
      const signalData = await signalRes.json();
      if (signalData.success) setAiSignal(signalData.signal);
      
      const patternRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/ai/patterns`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ candles: candles.slice(-30) })
      });
      const patternData = await patternRes.json();
      if (patternData.success) setPatterns(patternData.patterns);
      
    } catch (error) {
      console.error("AI analysis failed:", error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const sendChatMessage = async () => {
    if (!chatMessage.trim()) return;
    
    const userMessage = chatMessage;
    setChatHistory(prev => [...prev, { role: "user", content: userMessage }]);
    setChatMessage("");
    
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/ai/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMessage,
          portfolio: { cash: balance.cash, equity: balance.equity, dayPnl: balance.dayPnl },
          positions,
          tradeHistory: tradeHistory.slice(0, 10)
        })
      });
      const data = await res.json();
      if (data.success) {
        setChatHistory(prev => [...prev, { role: "assistant", content: data.reply }]);
      }
    } catch (error) {
      setChatHistory(prev => [...prev, { role: "assistant", content: "Sorry, I'm having trouble connecting. Please try again." }]);
    }
  };

  if (!showAIPanel) {
    return (
      <button
        onClick={() => setShowAIPanel(true)}
        className="fixed bottom-20 right-4 z-40 bg-[#2962ff] text-white p-3 rounded-full shadow-lg hover:bg-[#1e53e5] transition-all"
      >
        <Brain className="h-6 w-6" />
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-40 w-96 bg-[#1c2030] rounded-xl border border-[#2a2e39] shadow-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-[#2a2e39] bg-[#2962ff]/10">
        <div className="flex items-center gap-2">
          <Brain className="h-5 w-5 text-[#2962ff]" />
          <span className="font-bold text-white">AI Trading Assistant</span>
        </div>
        <button onClick={() => setShowAIPanel(false)} className="text-[#787b86] hover:text-white">
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Content */}
      <div className="max-h-[500px] overflow-y-auto p-3 space-y-3">
        
        {/* AI Signal Button */}
        <button
          onClick={getAISignal}
          disabled={isAnalyzing || isLoading}
          className="w-full bg-[#2962ff] text-white py-2 rounded-lg font-semibold text-sm hover:bg-[#1e53e5] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {isAnalyzing ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              Analyzing...
            </>
          ) : (
            <>
              <Brain className="h-4 w-4" />
              Get AI Trading Signal
            </>
          )}
        </button>

        {/* AI Signal Display */}
        {aiSignal && (
          <div className={`p-3 rounded-lg border ${
            aiSignal.action === "BUY" ? "bg-green-500/10 border-green-500/30" :
            aiSignal.action === "SELL" ? "bg-red-500/10 border-red-500/30" :
            "bg-yellow-500/10 border-yellow-500/30"
          }`}>
            <div className="flex items-center justify-between mb-2">
              <span className={`text-lg font-bold ${
                aiSignal.action === "BUY" ? "text-green-400" :
                aiSignal.action === "SELL" ? "text-red-400" :
                "text-yellow-400"
              }`}>
                {aiSignal.action}
              </span>
              <span className="text-xs text-[#787b86]">Confidence: {aiSignal.confidence}%</span>
            </div>
            <div className="text-xs text-[#b2b5be] mb-2">{aiSignal.reasoning}</div>
            <div className="flex gap-2 text-xs">
              {aiSignal.takeProfit && (
                <span className="px-2 py-1 bg-green-500/20 text-green-400 rounded">TP: ${aiSignal.takeProfit}</span>
              )}
              {aiSignal.stopLoss && (
                <span className="px-2 py-1 bg-red-500/20 text-red-400 rounded">SL: ${aiSignal.stopLoss}</span>
              )}
              <span className={`px-2 py-1 rounded ${
                aiSignal.riskLevel === "LOW" ? "bg-green-500/20 text-green-400" :
                aiSignal.riskLevel === "HIGH" ? "bg-red-500/20 text-red-400" :
                "bg-yellow-500/20 text-yellow-400"
              }`}>
                {aiSignal.riskLevel} Risk
              </span>
            </div>
          </div>
        )}

        {/* Pattern Detection */}
        {patterns.length > 0 && (
          <div className="p-3 bg-[#1e222d] rounded-lg border border-[#2a2e39]">
            <h4 className="text-xs font-semibold text-[#787b86] mb-2">📈 Pattern Detected</h4>
            {patterns.map((pattern, i) => (
              <div key={i} className="mb-2 last:mb-0">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-white">{pattern.name}</span>
                  <span className={`text-xs px-2 py-0.5 rounded ${
                    pattern.strength === "HIGH" ? "bg-green-500/20 text-green-400" :
                    pattern.strength === "MEDIUM" ? "bg-yellow-500/20 text-yellow-400" :
                    "bg-gray-500/20 text-gray-400"
                  }`}>
                    {pattern.strength}
                  </span>
                </div>
                <p className="text-xs text-[#b2b5be] mt-1">{pattern.meaning}</p>
              </div>
            ))}
          </div>
        )}

        {/* Chat Toggle */}
        <button
          onClick={() => setChatOpen(!chatOpen)}
          className="w-full flex items-center justify-center gap-2 py-2 text-sm text-[#2962ff] hover:bg-[#2962ff]/10 rounded-lg transition-all"
        >
          <MessageCircle className="h-4 w-4" />
          {chatOpen ? "Hide Chat" : "Ask AI Assistant"}
        </button>

        {/* Chat Interface */}
        {chatOpen && (
          <div className="border-t border-[#2a2e39] pt-3">
            <div className="max-h-64 overflow-y-auto space-y-2 mb-3">
              {chatHistory.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[80%] p-2 rounded-lg text-xs ${
                    msg.role === "user" 
                      ? "bg-[#2962ff] text-white" 
                      : "bg-[#2a2e39] text-[#d1d4dc]"
                  }`}>
                    {msg.content}
                  </div>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={chatMessage}
                onChange={(e) => setChatMessage(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && sendChatMessage()}
                placeholder="Ask about trading..."
                className="flex-1 bg-[#1e222d] border border-[#2a2e39] rounded-lg px-3 py-2 text-sm text-white placeholder-[#787b86] focus:outline-none focus:border-[#2962ff]"
              />
              <button
                onClick={sendChatMessage}
                className="bg-[#2962ff] text-white px-3 py-2 rounded-lg hover:bg-[#1e53e5] transition-all"
              >
                Send
              </button>
            </div>
          </div>
        )}

        {/* Disclaimer */}
        <div className="text-[10px] text-center text-[#787b86] pt-2 border-t border-[#2a2e39]">
          ⚠️ AI recommendations are for paper trading only. Not financial advice.
        </div>
      </div>
    </div>
  );
}