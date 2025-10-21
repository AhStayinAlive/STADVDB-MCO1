// src/components/V1DelinquencyTrend.tsx
import LineChart from "./LineChart";

interface V1Props {
  labels: string[];
  datasets: { label: string; data: number[]; borderColor?: string; borderDash?: number[] }[];
}

export default function V1DelinquencyTrend({ labels, datasets }: V1Props) {
  return <LineChart labels={labels} datasets={datasets} title="V1: Delinquency Trend" />;
}
