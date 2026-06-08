// src/components/ChartArea.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import {
  createChart,
  ColorType,
  CandlestickSeries,
  HistogramSeries,
  LineSeries,
  IChartApi,
  ISeriesApi,
  Time,
  UTCTimestamp,
} from "lightweight-charts";
import { Loader2 } from "lucide-react";
import { useChartData, CHART_PRESETS, type LegendData } from "@/hooks/useChartData";
import { useTradingStore } from "@/stores/useTradingStore";

export default function ChartArea() {
  const symbol = useTradingStore((state) => state.symbol);
  const [selectedPreset, setSelectedPreset] = useState(CHART_PRESETS[2]);
  const { candles, volumeData, ma50Data, ema20Data, legend, isLoading } = useChartData(
    symbol,
    selectedPreset
  );

  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const maSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const emaSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Render chart when data changes
  useEffect(() => {
    if (!isMounted || !chartContainerRef.current || candles.length === 0) return;

    // Create chart
    const chart = createChart(chartContainerRef.current, {
      layout: { background: { type: ColorType.Solid, color: "#131722" }, textColor: "#d1d4dc" },
      grid: { vertLines: { color: "#2a2e39" }, horzLines: { color: "#2a2e39" } },
      rightPriceScale: { borderColor: "#2a2e39" },
      timeScale: { borderColor: "#2a2e39", timeVisible: true, secondsVisible: false },
      width: chartContainerRef.current.clientWidth,
      height: chartContainerRef.current.clientHeight,
    });
    chartRef.current = chart;

    // Add series
    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: "#26a69a",
      downColor: "#ef5350",
      borderVisible: false,
      wickUpColor: "#26a69a",
      wickDownColor: "#ef5350",
    });
    candleSeriesRef.current = candleSeries;

    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceFormat: { type: "volume" },
      priceScaleId: "volume-scale",
    });
    volumeSeriesRef.current = volumeSeries;

    const maSeries = chart.addSeries(LineSeries, { color: "#f5bc3f", priceLineVisible: false, lineWidth: 1 });
    maSeriesRef.current = maSeries;

    const emaSeries = chart.addSeries(LineSeries, { color: "#26c6da", priceLineVisible: false, lineWidth: 1 });
    emaSeriesRef.current = emaSeries;

    chart.priceScale("volume-scale").applyOptions({
      borderVisible: false,
      visible: false,
      scaleMargins: { top: 0.8, bottom: 0 },
    });

    // In ChartArea.tsx, before setting data:

    // Set data with validation
    const validatedCandles = candles.filter((candle, index, arr) => {
      // Check for duplicate or out-of-order timestamps
      if (index > 0 && candle.time <= arr[index - 1].time) {
        console.warn(`Skipping duplicate/out-of-order candle at index ${index}, time: ${candle.time}`);
        return false;
      }
      return true;
    });
    if (validatedCandles.length !== candles.length) {
      console.warn(`Filtered out ${candles.length - validatedCandles.length} invalid candles`);
    }
  
    // Set data
    candleSeries.setData(validatedCandles.map(c => ({ ...c, time: c.time as UTCTimestamp })));
    volumeSeries.setData(volumeData);
    if (ma50Data.length) maSeries.setData(ma50Data);
    if (ema20Data.length) emaSeries.setData(ema20Data);

    chart.timeScale().fitContent();

    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width: chartContainerRef.current.clientWidth,
          height: chartContainerRef.current.clientHeight,
        });
      }
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      if (chartRef.current) chartRef.current.remove();
    };
  }, [candles, volumeData, ma50Data, ema20Data, isMounted]);

  // Update realtime
  useEffect(() => {
    if (!candleSeriesRef.current || !volumeSeriesRef.current || candles.length === 0) return;
    const lastCandle = candles[candles.length - 1];
    const lastVolume = volumeData[volumeData.length - 1];
    if (lastCandle && lastVolume) {
      candleSeriesRef.current.update(lastCandle);
      volumeSeriesRef.current.update(lastVolume);
    }
  }, [candles, volumeData]);

  if (!isMounted) {
    return <ChartLoading />;
  }

  return (
    <div className="flex flex-1 flex-col h-full bg-[#131722] p-2 relative select-none">
      <div className="flex-1 w-full relative pt-2 h-full" ref={chartContainerRef}>
        <ChartLegend legend={legend} symbol={symbol} />
        {isLoading && <ChartLoadingOverlay preset={selectedPreset} />}
      </div>
      <ChartPresetBar
        presets={CHART_PRESETS}
        selected={selectedPreset}
        onSelect={setSelectedPreset}
      />
    </div>
  );
}

// Sub-components (presentational)
function ChartLegend({ legend, symbol }: { legend: LegendData | null; symbol: string }) {
  if (!legend) return null;
  return (
    <div className="absolute top-4 left-4 z-10 flex flex-col gap-1 bg-[#131722]/80 backdrop-blur-sm p-2 rounded text-[11px] font-medium pointer-events-none border border-[#2a2e39]/50">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
        <span className="font-bold text-white tracking-wide mr-1">{symbol}</span>
        <span className="text-[#787b86]">O</span>
        <span className={legend.isPriceUp ? "text-[#26a69a]" : "text-[#ef5350]"}>{legend.open}</span>
        <span className="text-[#787b86]">H</span>
        <span className={legend.isPriceUp ? "text-[#26a69a]" : "text-[#ef5350]"}>{legend.high}</span>
        <span className="text-[#787b86]">L</span>
        <span className={legend.isPriceUp ? "text-[#26a69a]" : "text-[#ef5350]"}>{legend.low}</span>
        <span className="text-[#787b86]">C</span>
        <span className={legend.isPriceUp ? "text-[#26a69a]" : "text-[#ef5350]"}>{legend.close}</span>
        <span className="text-[#787b86] ml-1">Vol</span>
        <span className="text-[#b2b5be] tabular-nums">{legend.volume}</span>
      </div>
      <div className="flex items-center gap-3 text-[10px]">
        <span className="text-[#26c6da]">EMA(20): <span className="text-white font-semibold">{legend.ema20}</span></span>
        <span className="text-[#f5bc3f]">MA(50): <span className="text-white font-semibold">{legend.ma50}</span></span>
      </div>
    </div>
  );
}

function ChartPresetBar({ presets, selected, onSelect }: any) {
  return (
    <div className="flex h-9 shrink-0 items-center justify-between border-t border-[#2a2e39] bg-[#1c2030]/30 px-2 rounded-b select-none">
      <div className="flex items-center gap-1 overflow-x-auto">
        {presets.map((preset: any) => (
          <button
            key={preset.label}
            onClick={() => onSelect(preset)}
            className={`rounded px-2.5 py-1 text-xs font-semibold transition-all whitespace-nowrap ${
              selected.label === preset.label
                ? "bg-[#2962ff] text-white shadow-lg shadow-[#2962ff]/20"
                : "text-[#787b86] hover:bg-[#1e222d] hover:text-[#d1d4dc]"
            }`}
          >
            {preset.label}
          </button>
        ))}
      </div>
      <div className="text-[10px] font-medium text-[#787b86] uppercase tracking-wider hidden md:block ml-2">
        {selected.description || selected.label}
      </div>
    </div>
  );
}

function ChartLoading() {
  return (
    <div className="flex flex-1 flex-col h-full bg-[#131722] p-2 relative select-none">
      <div className="flex-1 w-full relative pt-2 h-full flex items-center justify-center">
        <div className="flex flex-col items-center gap-2 text-xs text-[#787b86]">
          <Loader2 className="h-6 w-6 animate-spin text-[#2962ff]" />
          <span>Loading chart...</span>
        </div>
      </div>
    </div>
  );
}

function ChartLoadingOverlay({ preset }: { preset: any }) {
  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-[#131722]/80 backdrop-blur-sm">
      <div className="flex flex-col items-center gap-2 text-xs text-[#787b86]">
        <Loader2 className="h-6 w-6 animate-spin text-[#2962ff]" />
        <span>Loading {preset.description || preset.label}...</span>
      </div>
    </div>
  );
}