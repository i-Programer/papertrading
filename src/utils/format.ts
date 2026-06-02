// src/utils/format.ts

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatPercent(value: number): string {
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

export function pnlColorClass(value: number): string {
  if (value > 0) return "text-[#26a69a]"; // Hijau khas TradingView
  if (value < 0) return "text-[#ef5350]"; // Merah khas TradingView
  return "text-[#787b86]"; // Abu-abu kalau impas
}