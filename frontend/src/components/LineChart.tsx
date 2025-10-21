// src/components/LineChart.tsx
import { useEffect, useRef } from "react";
import { Chart, LineController, LineElement, PointElement, LinearScale, Title, CategoryScale, Tooltip, Legend } from "chart.js";

Chart.register(LineController, LineElement, PointElement, LinearScale, Title, CategoryScale, Tooltip, Legend);

interface LineChartProps {
  labels: string[];
  datasets: { label: string; data: number[]; borderColor?: string; borderDash?: number[] }[];
  title?: string;
}

export default function LineChart({ labels, datasets, title }: LineChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    const chart = new Chart(canvasRef.current, {
      type: "line",
      data: { labels, datasets },
      options: {
        responsive: true,
        plugins: { title: { display: !!title, text: title } },
      },
    });

    return () => chart.destroy();
  }, [labels, datasets, title]);

  return <canvas ref={canvasRef}></canvas>;
}
