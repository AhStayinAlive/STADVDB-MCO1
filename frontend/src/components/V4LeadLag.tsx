// src/components/V4LeadLag.tsx
import LineChart from "./LineChart";

interface V4Props {
  labels: string[];
  datasets: { label: string; data: number[]; borderColor?: string; borderDash?: number[] }[];
}

export default function V4LeadLag({ labels, datasets }: V4Props) {
  return <LineChart labels={labels} datasets={datasets} title="V4: Lead-Lag Delinquency" />;
}
