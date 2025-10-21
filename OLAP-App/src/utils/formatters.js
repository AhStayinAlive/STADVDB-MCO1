// src/utils/formatters.js
export function formatPeso(value) {
  if (value === 0 || value === null || isNaN(value)) return "₱0";

  const abs = Math.abs(value);
  if (abs >= 1e9) return `₱${(value / 1e9).toFixed(1)}B`;
  if (abs >= 1e6) return `₱${(value / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `₱${(value / 1e3).toFixed(1)}K`;
  return `₱${value.toLocaleString()}`;
}

export function formatPercent(value) {
  if (value === null || isNaN(value)) return "0%";
  return `${value.toFixed(2)}%`;
}
