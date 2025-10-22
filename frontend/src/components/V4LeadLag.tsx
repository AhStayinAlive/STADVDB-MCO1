import { useEffect, useRef } from "react";
import {
  Chart,
  BarController,
  BarElement,
  CategoryScale,
  LinearScale,
  Title,
  Tooltip,
  Legend,
} from "chart.js";

Chart.register(
  BarController,
  BarElement,
  CategoryScale,
  LinearScale,
  Title,
  Tooltip,
  Legend
);

interface V4Props {
  data: Array<{
    product_code: string;
    year: number;
    quarter: number;
    delinquency: number;
    macro_lag_0: number;
    macro_lag_1: number | null;
    macro_lag_2: number | null;
  }>;
}

export default function V4LeadLag({ data }: V4Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart | null>(null);

  useEffect(() => {
    if (!data?.length || !canvasRef.current) return;

    if (chartRef.current) {
      chartRef.current.destroy();
      chartRef.current = null;
    }

    const ctx = canvasRef.current.getContext("2d");
    if (!ctx) return;

    // Extract quarters and products
    const labels = [...new Set(data.map(d => `${d.year}-Q${d.quarter}`))];
    const products = [...new Set(data.map(d => d.product_code))];

    // Define colors by lag (consistent per lag across products)
    const lagColors = {
      macro_lag_0: "#2563eb", // blue
      macro_lag_1: "#f59e0b", // amber
      macro_lag_2: "#dc2626", // red
    };

    // Define friendly lag labels
    const lagLabels: Record<string, string> = {
      macro_lag_0: "Current Quarter",
      macro_lag_1: "1 Quarter Prior",
      macro_lag_2: "2 Quarters Prior",
    };

    // Build datasets: one per product × lag
    const datasets = products.flatMap((product) => {
      const subset = data.filter((d) => d.product_code === product);

      return Object.keys(lagLabels).map((lagKey) => ({
        label: `${product} – ${lagLabels[lagKey]}`,
        data: subset.map((d) => (d[lagKey as keyof typeof d] ?? 0) * 100),
        backgroundColor: lagColors[lagKey as keyof typeof lagColors],
        borderColor: lagColors[lagKey as keyof typeof lagColors],
        borderWidth: 1.5,
        stack: product,
      }));
    });

    // Initialize chart
    const chart = new Chart(ctx, {
      type: "bar",
      data: { labels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: "index", intersect: false },
        plugins: {
          title: {
            display: true,
            text: "V4: Lead-Lag Comparison by Product (Macro Delinquency Influence)",
            font: { size: 16, weight: "bold" },
          },
          legend: {
            position: "bottom",
            labels: {
              boxWidth: 14,
              usePointStyle: true,
              font: { size: 11 },
            },
          },
          tooltip: {
            callbacks: {
              label: (ctx) =>
                `${ctx.dataset.label}: ${ctx.parsed.y?.toFixed(2)}%`,
            },
          },
        },
        scales: {
          x: {
            title: { display: true, text: "Quarter" },
            stacked: false,
            ticks: { maxRotation: 45, minRotation: 45 },
          },
          y: {
            title: { display: true, text: "Delinquency Rate (%)" },
            beginAtZero: true,
            grid: { color: "rgba(0,0,0,0.1)" },
          },
        },
      },
    });

    chartRef.current = chart;

    return () => {
      chartRef.current?.destroy();
      chartRef.current = null;
    };
  }, [data]);

  return (
    <div className="w-full h-[400px] p-4 bg-white rounded-lg shadow">
      <canvas ref={canvasRef}></canvas>
    </div>
  );
}
