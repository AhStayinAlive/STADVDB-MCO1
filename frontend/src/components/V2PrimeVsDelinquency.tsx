import { useEffect, useRef } from "react";
import {
  Chart,
  LineController,
  LineElement,
  PointElement,
  LinearScale,
  Title,
  CategoryScale,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";

Chart.register(LineController, LineElement, PointElement, LinearScale, Title, CategoryScale, Tooltip, Legend, Filler);

interface V2Props {
  labels: string[];
  data: Array<{
    product_code: string;
    year: number;
    quarter: number;
    delinquency: number;
    chargeoff?: number;
  }>;
}

export default function V2PrimeVsDelinquency({ labels, data }: V2Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    // 🎨 Fixed palette for consistency
    const colors = {
      delinquency: "#1f77b4", // blue
      chargeoff: "#ff7f0e",   // orange
    };

    // Group by product (normally “ALL”)
    const grouped = Array.from(
      data.reduce((map, d) => {
        if (!map.has(d.product_code)) map.set(d.product_code, []);
        map.get(d.product_code)!.push(d);
        return map;
      }, new Map<string, any[]>())
    );

    // Build datasets
    const datasets = grouped.flatMap(([product, rows]) => {
      const sorted = rows.sort(
        (a, b) => a.year * 4 + a.quarter - (b.year * 4 + b.quarter)
      );

      const delinquencyData = sorted.map((r) => r.delinquency * 100); // convert to %
      const chargeoffData = sorted.map((r) => (r.chargeoff ?? 0) * 100); // also %

      return [
        {
          label: `${product} – Delinquency`,
          data: delinquencyData,
          borderColor: colors.delinquency,
          backgroundColor: colors.delinquency,
          yAxisID: "y",
          tension: 0.3,
          borderWidth: 2,
          pointRadius: 2,
        },
        {
          label: `${product} – Charge-off Δ`,
          data: chargeoffData,
          borderColor: colors.chargeoff,
          backgroundColor: colors.chargeoff + "33",
          yAxisID: "y1",
          tension: 0.3,
          fill: true,
          borderWidth: 1.5,
          pointRadius: 0,
        },
      ];
    });

    const chart = new Chart(canvasRef.current, {
      type: "line",
      data: { labels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: "index", intersect: false },
        plugins: {
          title: {
            display: true,
            text: "V2: Product Delinquency & Charge-off Δ (Quarterly)",
            font: { size: 18 },
          },
          legend: {
            position: "bottom",
            labels: { boxWidth: 20, usePointStyle: true },
          },
          tooltip: {
            callbacks: {
              label: (ctx) => `${ctx.dataset.label}: ${ctx.parsed.y.toFixed(2)}%`,
            },
          },
        },
        scales: {
          y: {
            position: "left",
            title: { display: true, text: "Delinquency (%)" },
            grid: { color: "rgba(0,0,0,0.1)" },
          },
          y1: {
            position: "right",
            title: { display: true, text: "Charge-off Δ (%)" },
            grid: { drawOnChartArea: false },
          },
          x: {
            title: { display: true, text: "Quarter" },
            ticks: { maxRotation: 45, minRotation: 45, autoSkip: true },
          },
        },
      },
    });

    return () => chart.destroy();
  }, [labels, data]);

  return (
    <div className="w-full h-[350px] p-4 bg-white rounded-lg shadow">
      <canvas ref={canvasRef}></canvas>
    </div>
  );
}
