// src/components/V2PrimeVsDelinquency.tsx
import LineChart from "./LineChart";

interface V2Props {
  labels: string[];
  datasets: { label: string; data: number[]; borderColor?: string; borderDash?: number[]; yAxisID?: string }[];
}

export default function V2PrimeVsDelinquency({ labels, datasets }: V2Props) {
  return <LineChart labels={labels} datasets={datasets} title="V2: Prime vs Delinquency" />;
}
