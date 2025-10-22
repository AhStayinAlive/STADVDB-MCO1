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
} from "chart.js";

Chart.register(LineController, LineElement, PointElement, LinearScale, Title, CategoryScale, Tooltip, Legend);

interface V1Props {
  labels: string[]; // e.g. ["2020-Q1", "2020-Q2", ...]
  dprimeData: number[]; // e.g. [3.2, 3.0, 3.5, ...]
  dralacbnData: number[]; // e.g. [1.5, 1.7, 2.2, ...]
}

export default function V1DelinquencyTrend({ labels, dprimeData, dralacbnData }: V1Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    const chart = new Chart(canvasRef.current, {
      type: "line",
      data: {
        labels,
        datasets: [
          {
            label: "DPRIME (%)",
            data: dprimeData,
            yAxisID: "yLeft",
            borderColor: "#1f77b4",
            backgroundColor: "#1f77b4",
            tension: 0.3,
            pointRadius: 4,
            pointHoverRadius: 6,
            fill: false,
          },
          {
            label: "DRALACBN (%)",
            data: dralacbnData,
            yAxisID: "yRight",
            borderColor: "#ff7f0e",
            backgroundColor: "#ff7f0e",
            tension: 0.3,
            pointRadius: 4,
            pointHoverRadius: 6,
            fill: false,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: "index", intersect: false },
        stacked: false,
        plugins: {
          title: {
            display: true,
            text: "V1: DPRIME vs DRALACBN (Quarterly)",
            font: { size: 18 },
          },
          legend: { position: "top" },
          tooltip: {
            callbacks: {
              label: (context) => `${context.dataset.label}: ${context.parsed.y.toFixed(2)}%`,
            },
          },
        },
        scales: {
          yLeft: {
            type: "linear",
            display: true,
            position: "left",
            title: { display: true, text: "DPRIME (%)" },
            grid: { drawOnChartArea: false },
          },
          yRight: {
            type: "linear",
            display: true,
            position: "right",
            title: { display: true, text: "DRALACBN (%)" },
            grid: { drawOnChartArea: false },
          },
          x: {
            title: { display: true, text: "Quarter" },
          },
        },
      },
    });

    return () => chart.destroy();
  }, [labels, dprimeData, dralacbnData]);

  return (
    <div className="w-full h-[350px] p-4 bg-white rounded-lg shadow">
      <canvas ref={canvasRef}></canvas>
    </div>
  );
}
