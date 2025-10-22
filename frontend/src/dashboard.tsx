import { useEffect, useState } from "react";
import { fetchKPISummary, fetchQuarterlyMetrics } from "./api";

import V1DelinquencyTrend from "./components/V1DelinquencyTrend";
import V2PrimeVsDelinquency from "./components/V2PrimeVsDelinquency";
import V4LeadLag from "./components/V4LeadLag";

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
  const [v1Data, setV1Data] = useState<any[]>([]);
  const [v2Data, setV2Data] = useState<any[]>([]);
  const [v4Data, setV4Data] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadData() {
      try {
        const [kpiData, quarterlyData, v1, v2, v4] = await Promise.all([
          fetchKPISummary(),
          fetchQuarterlyMetrics(),

          // ✅ Corrected mappings
          fetch(`${API_BASE_URL}/visuals/prime_vs_delinquency`).then((res) =>
            res.json()
          ), // V1: DPRIME vs DRALACBN
          fetch(`${API_BASE_URL}/visuals/delinquency_trend`).then((res) =>
            res.json()
          ), // V2: Product delinquency + charge-off
          fetch(`${API_BASE_URL}/visuals/lead_lag`).then((res) => res.json()), // V4
        ]);

        setV1Data(v1);
        setV2Data(v2);
        setV4Data(v4);
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

  // === V1: DPRIME vs DRALACBN Overlay ===
  const v1Labels = v1Data.map((d) => `${d.year}-Q${d.quarter}`);
  const v1Dprime = v1Data.map((d) => d.prime_rate);
  const v1Dralacbn = v1Data.map((d) => d.delinquency);

  // === V2: Product Delinquency & Charge-off ===
  const v2Labels = [...new Set(v2Data.map((d) => `${d.year}-Q${d.quarter}`))];
  const v2ChartData = v2Data.map((d) => ({
    product_code: d.product_code,
    year: d.year,
    quarter: d.quarter,
    delinquency: d.delinquency,
    chargeoff: d.chargeoff_rate ?? 0, // ✅ field name aligned with backend
  }));

  // === V4: Lead-Lag Correlations ===
  const v4Labels = [...new Set(v4Data.map((d) => `${d.year}-Q${d.quarter}`))];
  const v4Products = [...new Set(v4Data.map((d) => d.product_code))];
  const v4Datasets = v4Products.flatMap((p) => {
    const prodData = v4Data.filter((d) => d.product_code === p);
    const color = "#" + Math.floor(Math.random() * 16777215).toString(16);
    return [
      {
        label: `${p} (current)`,
        data: prodData.map((d) => d.delinquency),
        borderColor: color,
        fill: false,
      },
      {
        label: `${p} (lag1)`,
        data: prodData.map((d) => d.lag_1),
        borderColor: color + "99",
        borderDash: [5, 5],
        fill: false,
      },
      {
        label: `${p} (lag2)`,
        data: prodData.map((d) => d.lag_2),
        borderColor: color + "55",
        borderDash: [5, 5],
        fill: false,
      },
    ];
  });

  return (
    <div className="p-8 space-y-10">
      <h1 className="text-3xl font-bold mb-6">📊 Credit Metrics Dashboard</h1>

      {/* Charts Grid */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* V1: DPRIME vs DRALACBN Overlay */}
        <V1DelinquencyTrend
          labels={v1Labels}
          dprimeData={v1Dprime}
          dralacbnData={v1Dralacbn}
        />

        {/* V2: Product Delinquency & Charge-off Trends */}
        <V2PrimeVsDelinquency labels={v2Labels} data={v2ChartData} />

        {/* V4: Lead-Lag Correlations */}
        <V4LeadLag data={v4Data} />
      </section>
    </div>
  );
}
