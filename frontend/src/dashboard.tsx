// src/dashboard.tsx
import { useEffect, useState } from "react";
import { fetchKPISummary, fetchQuarterlyMetrics } from "./api";

import V1DelinquencyTrend from "./components/V1DelinquencyTrend";
import V2PrimeVsDelinquency from "./components/V2PrimeVsDelinquency";
import V4LeadLag from "./components/V4LeadLag";
import V5EventRibbons from "./components/V5EventRibbons";

const API_BASE_URL = "http://127.0.0.1:8000";

interface KPISummary {
  year: number;
  total_origination: number;
  total_balance: number;
  avg_default: number;
  avg_prime: number;
  avg_lending: number;
}

interface QuarterlyMetric {
  year: number;
  quarter: number;
  balance_total: number;
  avg_default: number;
}

export default function Dashboard() {
  const [summary, setSummary] = useState<KPISummary[]>([]);
  const [quarterly, setQuarterly] = useState<QuarterlyMetric[]>([]);
  const [v1Data, setV1Data] = useState<any[]>([]);
  const [v2Data, setV2Data] = useState<any[]>([]);
  const [v4Data, setV4Data] = useState<any[]>([]);
  const [v5Events, setV5Events] = useState<any[]>([]);
  const [v3Data, setV3Data] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadData() {
      try {
        const [
          kpiData,
          quarterlyData,
          v1,
          v2,
          v4,
          v5,
          v3
        ] = await Promise.all([
          fetchKPISummary(),
          fetchQuarterlyMetrics(),
          fetch(`${API_BASE_URL}/visuals/delinquency_trend`).then(res => res.json()),
          fetch(`${API_BASE_URL}/visuals/prime_vs_delinquency`).then(res => res.json()),
          fetch(`${API_BASE_URL}/visuals/lead_lag`).then(res => res.json()),
          fetch(`${API_BASE_URL}/visuals/event_ribbons`).then(res => res.json())
        ]);
        setSummary(kpiData);
        setQuarterly(quarterlyData);
        setV1Data(v1);
        setV2Data(v2);
        setV4Data(v4);
        setV5Events(v5);
        setV3Data(v3);
      } catch (err) {
        console.error("API Error:", err);
        setError("Failed to fetch data from backend.");
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  if (loading)
    return <div className="p-8 text-gray-500">Loading dashboard data...</div>;
  if (error)
    return <div className="p-8 text-red-600 font-semibold">{error}</div>;

  // Prepare datasets for V1
  const v1Labels = [...new Set(v1Data.map(d => `${d.year}-Q${d.quarter}`))];
  const v1Products = [...new Set(v1Data.map(d => d.product_code))];
  const v1Datasets = v1Products.map(p => ({
    label: p,
    data: v1Data.filter(d => d.product_code === p).map(d => d.delinquency),
    borderColor: "#" + Math.floor(Math.random() * 16777215).toString(16),
    fill: false
  }));

  // V2 datasets
  const v2Labels = v2Data.map(d => `${d.year}-Q${d.quarter}`);
  const v2Datasets = [
    { label: "Prime Rate", data: v2Data.map(d => d.prime_rate), borderColor: "blue", yAxisID: "y1", fill: false },
    { label: "Delinquency", data: v2Data.map(d => d.delinquency), borderColor: "red", yAxisID: "y2", fill: false }
  ];

  // V4 datasets
  const v4Labels = [...new Set(v4Data.map(d => `${d.year}-Q${d.quarter}`))];
  const v4Products = [...new Set(v4Data.map(d => d.product_code))];
  const v4Datasets = v4Products.flatMap(p => {
    const prodData = v4Data.filter(d => d.product_code === p);
    return [
      { label: `${p} (current)`, data: prodData.map(d => d.delinquency), borderColor: "#" + Math.floor(Math.random() * 16777215).toString(16), fill: false },
      { label: `${p} (lag1)`, data: prodData.map(d => d.lag_1), borderColor: "#" + Math.floor(Math.random() * 16777215).toString(16), borderDash: [5,5], fill: false },
      { label: `${p} (lag2)`, data: prodData.map(d => d.lag_2), borderColor: "#" + Math.floor(Math.random() * 16777215).toString(16), borderDash: [5,5], fill: false }
    ];
  });

  return (
    <div className="p-8 space-y-10">
      <h1 className="text-3xl font-bold mb-6">📊 Credit Metrics Dashboard</h1>

      {/* KPI and Quarterly Tables */}
      <section className="space-y-6">
        {/* ... your existing tables ... */}
      </section>

      {/* Charts Grid */}
      <section className="grid grid-cols-2 gap-6">
        <V1DelinquencyTrend labels={v1Labels} datasets={v1Datasets} />
        <V2PrimeVsDelinquency labels={v2Labels} datasets={v2Datasets} />
        <V4LeadLag labels={v4Labels} datasets={v4Datasets} />
        <V5EventRibbons labels={v2Labels} datasets={v2Datasets} events={v5Events} />
      </section>
    </div>
  );
}
