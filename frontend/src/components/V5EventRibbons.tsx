// src/components/V5EventRibbons.tsx
import { useEffect, useRef } from "react";
import { Chart, LineController, LineElement, PointElement, LinearScale, Title, CategoryScale, Tooltip, Legend } from "chart.js";
import annotationPlugin from 'chartjs-plugin-annotation';

Chart.register(LineController, LineElement, PointElement, LinearScale, Title, CategoryScale, Tooltip, Legend, annotationPlugin);

interface EventRibbon {
  name: string;
  start: string; // e.g., "2020-Q2"
  end: string;   // e.g., "2020-Q2"
}

interface V5Props {
  labels: string[];
  datasets: { label: string; data: number[]; borderColor?: string }[];
  events: EventRibbon[];
}

export default function V5EventRibbons({ labels, datasets, events }: V5Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    const chart = new Chart(canvasRef.current, {
      type: 'line',
      data: { labels, datasets },
      options: {
        responsive: true,
        plugins: {
          title: { display: true, text: 'V5: Event Ribbons' },
          annotation: {
            annotations: events.map((e, i) => ({
              type: 'box',
              xMin: labels.indexOf(e.start),
              xMax: labels.indexOf(e.end),
              backgroundColor: 'rgba(255, 99, 132, 0.25)',
              label: { content: e.name, enabled: true, position: 'center' }
            }))
          }
        }
      }
    });

    return () => chart.destroy();
  }, [labels, datasets, events]);

  return <canvas ref={canvasRef}></canvas>;
}
