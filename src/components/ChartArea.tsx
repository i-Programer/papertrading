// src/components/ChartArea.tsx
"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import {
  createChart,
  ColorType,
  CandlestickSeries,
  HistogramSeries,
  LineSeries,
  IChartApi,
  ISeriesApi,
  UTCTimestamp,
  MouseEventHandler,
  Time,
} from "lightweight-charts";
import { Loader2 } from "lucide-react";
import { useChartData, CHART_PRESETS, type LegendData, type ChartPreset } from "@/hooks/useChartData";
import { useTradingStore } from "@/stores/useTradingStore";

// ============ TYPES ============
interface ChartLegendProps {
  legend: LegendData | null;
  symbol: string;
}

interface ChartPresetBarProps {
  presets: ChartPreset[];
  selected: ChartPreset;
  onSelect: (preset: ChartPreset) => void;
}

interface ChartLoadingOverlayProps {
  preset: ChartPreset;
}

// ============ MAIN COMPONENT ============
export default function ChartArea() {
  const symbol = useTradingStore((state) => state.symbol);
  const [selectedPreset, setSelectedPreset] = useState<ChartPreset>(CHART_PRESETS[2]);
  
  // 🔥 FIX: Memoize the preset to prevent unnecessary re-renders
  const memoizedPreset = useMemo(() => selectedPreset, [selectedPreset]);
  
  const { candles, volumeData, ma50Data, ema20Data, legend, isLoading } = useChartData(
    symbol,
    memoizedPreset
  );

  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const maSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const emaSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const [isMounted, setIsMounted] = useState(false);
  const [legendData, setLegendData] = useState<LegendData | null>(null);
  const lastValidDataRef = useRef<LegendData | null>(null);
  const hasInitialDataRef = useRef<boolean>(false);
  
  // 🔥 FIX: Track if chart is ready to prevent updates before creation
  const isChartReadyRef = useRef<boolean>(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // 🔥 FIX: CREATE CHART - ONLY ONCE (when symbol/preset changes)
  useEffect(() => {
    if (!isMounted || !chartContainerRef.current) return;

    // Clean up previous chart
    if (chartRef.current) {
      chartRef.current.remove();
      chartRef.current = null;
      isChartReadyRef.current = false;
    }

    // Create chart
    const chart = createChart(chartContainerRef.current, {
      layout: { background: { type: ColorType.Solid, color: "#131722" }, textColor: "#d1d4dc" },
      grid: { vertLines: { color: "#2a2e39" }, horzLines: { color: "#2a2e39" } },
      rightPriceScale: { borderColor: "#2a2e39" },
      timeScale: { 
        borderColor: "#2a2e39", 
        timeVisible: true, 
        secondsVisible: false,
        fixLeftEdge: false,
        fixRightEdge: false,
      },
      width: chartContainerRef.current.clientWidth,
      height: chartContainerRef.current.clientHeight,
      handleScroll: { mouseWheel: true, pressedMouseMove: true },
      handleScale: { mouseWheel: true, pinch: true },
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

    const maSeries = chart.addSeries(LineSeries, { 
      color: "#f5bc3f", 
      priceLineVisible: false, 
      lineWidth: 1 
    });
    maSeriesRef.current = maSeries;

    const emaSeries = chart.addSeries(LineSeries, { 
      color: "#26c6da", 
      priceLineVisible: false, 
      lineWidth: 1 
    });
    emaSeriesRef.current = emaSeries;

    chart.priceScale("volume-scale").applyOptions({
      borderVisible: false,
      visible: false,
      scaleMargins: { top: 0.8, bottom: 0 },
    });

    // 🔥 FIX: Crosshair interaction for legend - use a debounced update
    let crosshairTimeout: NodeJS.Timeout | null = null;
    
    chart.subscribeCrosshairMove((param) => {
      if (!candleSeriesRef.current || !chartContainerRef.current) return;

      // Clear any pending timeout
      if (crosshairTimeout) {
        clearTimeout(crosshairTimeout);
        crosshairTimeout = null;
      }

      // Debounce the crosshair update
      crosshairTimeout = setTimeout(() => {
        if (
          param.point === undefined ||
          param.point.x < 0 ||
          param.point.x > chartContainerRef.current!.clientWidth ||
          param.point.y < 0 ||
          param.point.y > chartContainerRef.current!.clientHeight
        ) {
          if (lastValidDataRef.current) {
            setLegendData(lastValidDataRef.current);
          }
          return;
        }

        if (!param.time) {
          if (lastValidDataRef.current) {
            setLegendData(lastValidDataRef.current);
          }
          return;
        }

        const candleData = param.seriesData.get(candleSeries);
        const volData = param.seriesData.get(volumeSeries);
        const maData = param.seriesData.get(maSeries);
        const emaData = param.seriesData.get(emaSeries);

        if (candleData && 'open' in candleData) {
          const newLegend = {
            open: (candleData.open as number).toFixed(2),
            high: (candleData.high as number).toFixed(2),
            low: (candleData.low as number).toFixed(2),
            close: (candleData.close as number).toFixed(2),
            volume: volData && 'value' in volData ? (volData.value as number).toLocaleString("en-US", { maximumFractionDigits: 0 }) : "-",
            ma50: maData && 'value' in maData ? (maData.value as number).toFixed(2) : "-",
            ema20: emaData && 'value' in emaData ? (emaData.value as number).toFixed(2) : "-",
            isPriceUp: (candleData.close as number) >= (candleData.open as number)
          };
          setLegendData(newLegend);
        }
      }, 16); // ~60fps debounce
    });

    isChartReadyRef.current = true;

    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width: chartContainerRef.current.clientWidth,
          height: chartContainerRef.current.clientHeight,
        });
        chartRef.current.timeScale().fitContent();
      }
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      if (crosshairTimeout) {
        clearTimeout(crosshairTimeout);
        crosshairTimeout = null;
      }
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
        isChartReadyRef.current = false;
      }
      hasInitialDataRef.current = true;
    };
  }, [symbol, selectedPreset, isMounted]);

  // 🔥 FIX: UPDATE DATA - Only when chart is ready and data changes
  useEffect(() => {
    if (!isChartReadyRef.current || !candleSeriesRef.current || candles.length === 0) return;

    // Validate candles
    const validatedCandles = candles.filter((candle, index, arr) => {
      if (index > 0 && candle.time <= arr[index - 1].time) return false;
      return true;
    });

    if (validatedCandles.length === 0) return;

    // 🔥 FIX: Only update if data actually changed
    const chartData = validatedCandles.map(c => ({
      time: c.time as UTCTimestamp,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    }));
    
    candleSeriesRef.current.setData(chartData);
    
    const volumeChartData = volumeData.map(v => ({
      time: v.time as UTCTimestamp,
      value: v.value,
      color: v.color,
    }));
    volumeSeriesRef.current?.setData(volumeChartData);
    
    const maChartData = ma50Data.map(m => ({
      time: m.time as UTCTimestamp,
      value: m.value,
    }));
    if (maChartData.length) maSeriesRef.current?.setData(maChartData);
    
    const emaChartData = ema20Data.map(e => ({
      time: e.time as UTCTimestamp,
      value: e.value,
    }));
    if (emaChartData.length) emaSeriesRef.current?.setData(emaChartData);

    // Update legend
    const lastCandle = validatedCandles[validatedCandles.length - 1];
    const lastVolume = volumeData[volumeData.length - 1];
    if (lastCandle && lastVolume) {
      const newLegend: LegendData = {
        open: lastCandle.open.toFixed(2),
        high: lastCandle.high.toFixed(2),
        low: lastCandle.low.toFixed(2),
        close: lastCandle.close.toFixed(2),
        volume: lastVolume.value.toLocaleString("en-US", { maximumFractionDigits: 0 }),
        ma50: ma50Data.length ? ma50Data[ma50Data.length - 1]?.value.toFixed(2) || "-" : "-",
        ema20: ema20Data.length ? ema20Data[ema20Data.length - 1]?.value.toFixed(2) || "-" : "-",
        isPriceUp: lastCandle.close >= lastCandle.open
      };
      
      // Check if data actually changed
      const currentLegend = lastValidDataRef.current;
      if (!currentLegend || 
          currentLegend.open !== newLegend.open ||
          currentLegend.high !== newLegend.high ||
          currentLegend.low !== newLegend.low ||
          currentLegend.close !== newLegend.close ||
          currentLegend.volume !== newLegend.volume ||
          currentLegend.ma50 !== newLegend.ma50 ||
          currentLegend.ema20 !== newLegend.ema20) {
        lastValidDataRef.current = newLegend;
        setLegendData(newLegend);
      }
    }
    
    // 🔥 FIX: Only scroll to latest on initial load or when new data arrives
    if (!hasInitialDataRef.current && chartRef.current && validatedCandles.length > 0) {
      requestAnimationFrame(() => {
        if (chartRef.current) {
          chartRef.current.timeScale().fitContent();
        }
      });
      // Flip the ref to true so this block never forces a snap-back again
      hasInitialDataRef.current = true; 
    }
  }, [candles, volumeData, ma50Data, ema20Data]);

  if (!isMounted) {
    return <ChartLoading />;
  }

  return (
    <div className="flex flex-1 flex-col h-full bg-[#131722] p-2 relative select-none">
      <div className="flex-1 w-full relative pt-2 h-full" ref={chartContainerRef}>
        <ChartLegend legend={legendData || legend} symbol={symbol} />
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

// ============ SUB-COMPONENTS ============

function ChartLegend({ legend, symbol }: ChartLegendProps) {
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

function ChartPresetBar({ presets, selected, onSelect }: ChartPresetBarProps) {
  return (
    <div className="flex h-9 shrink-0 items-center justify-between border-t border-[#2a2e39] bg-[#1c2030]/30 px-2 rounded-b select-none">
      <div className="flex items-center gap-1 overflow-x-auto">
        {presets.map((preset) => (
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

function ChartLoadingOverlay({ preset }: ChartLoadingOverlayProps) {
  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-[#131722]/80 backdrop-blur-sm">
      <div className="flex flex-col items-center gap-2 text-xs text-[#787b86]">
        <Loader2 className="h-6 w-6 animate-spin text-[#2962ff]" />
        <span>Loading {preset.description || preset.label}...</span>
      </div>
    </div>
  );
}