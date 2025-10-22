import { useEffect, useState, useMemo } from "react";
import { fetchKPISummary, fetchQuarterlyMetrics } from "./api";

import V1DelinquencyTrend from "./components/V1DelinquencyTrend";
import V2PrimeVsDelinquency from "./components/V2PrimeVsDelinquency";
import V4LeadLag from "./components/V4LeadLag";

const API_BASE_URL = "http://127.0.0.1:8000";

export default function Dashboard() {
  const [v1Data, setV1Data] = useState<any[]>([]);
  const [v2Data, setV2Data] = useState<any[]>([]);
  const [v4Data, setV4Data] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // 🌍 Global filters
  const [selectedProduct, setSelectedProduct] = useState("ALL");
  const [yearStart, setYearStart] = useState(2012);
  const [yearEnd, setYearEnd] = useState(2025);

  useEffect(() => {
    async function loadData() {
      try {
        const [kpiData, quarterlyData, v1, v2, v4] = await Promise.all([
          fetchKPISummary(),
          fetchQuarterlyMetrics(),
          fetch(`${API_BASE_URL}/visuals/prime_vs_delinquency`).then((res) => res.json()),
          fetch(`${API_BASE_URL}/visuals/delinquency_trend`).then((res) => res.json()),
          fetch(`${API_BASE_URL}/visuals/lead_lag`).then((res) => res.json()),
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

  // ✅ Hooks always run before conditionals
  const allProducts = useMemo(() => {
    const all = new Set<string>();
    v2Data.forEach((d) => all.add(d.product_code));
    v4Data.forEach((d) => all.add(d.product_code));
    return Array.from(all);
  }, [v2Data, v4Data]);

  const filterFn = (d: any) =>
    (selectedProduct === "ALL" || d.product_code === selectedProduct) &&
    d.year >= yearStart &&
    d.year <= yearEnd;

  const filteredV1 = v1Data.filter((d) => d.year >= yearStart && d.year <= yearEnd);
  const filteredV2 = v2Data.filter(filterFn);
  const filteredV4 = v4Data.filter(filterFn);

  // Derived datasets
  const v1Labels = filteredV1.map((d) => `${d.year}-Q${d.quarter}`);
  const v1Dprime = filteredV1.map((d) => d.prime_rate);
  const v1Dralacbn = filteredV1.map((d) => d.delinquency);

  const v2Labels = [...new Set(filteredV2.map((d) => `${d.year}-Q${d.quarter}`))];
  const v2ChartData = filteredV2.map((d) => ({
    product_code: d.product_code,
    year: d.year,
    quarter: d.quarter,
    delinquency: d.delinquency,
    chargeoff: d.chargeoff_rate ?? 0,
  }));

  // ✅ Only one return statement below
  if (loading) return <div className="p-8 text-gray-500">Loading dashboard data...</div>;
  if (error) return <div className="p-8 text-red-600 font-semibold">{error}</div>;

  return (
    <div className="p-8 space-y-10">
      <h1 className="text-3xl font-bold mb-6">📊 Credit Metrics Dashboard</h1>

      {/* 🎛️ Global Filters */}
      <div className="flex flex-wrap items-center gap-4 mb-6 bg-white p-4 rounded-lg shadow">
        <div>
          <label className="block text-sm text-gray-600">Product</label>
          <select
            value={selectedProduct}
            onChange={(e) => setSelectedProduct(e.target.value)}
            className="border border-gray-300 rounded-md px-2 py-1 text-sm"
          >
            <option value="ALL">All</option>
            {allProducts.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm text-gray-600">Year Range</label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min="2012"
              max="2025"
              value={yearStart}
              onChange={(e) => setYearStart(Number(e.target.value))}
              className="w-20 border border-gray-300 rounded-md px-2 py-1 text-sm"
            />
            <span>–</span>
            <input
              type="number"
              min="2012"
              max="2025"
              value={yearEnd}
              onChange={(e) => setYearEnd(Number(e.target.value))}
              className="w-20 border border-gray-300 rounded-md px-2 py-1 text-sm"
            />
          </div>
        </div>
      </div>

      {/* 📊 Chart Grid */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <V1DelinquencyTrend
          labels={v1Labels}
          dprimeData={v1Dprime}
          dralacbnData={v1Dralacbn}
        />

        <V2PrimeVsDelinquency labels={v2Labels} data={v2ChartData} />

        <V4LeadLag data={filteredV4} />
      </section>
    </div>
  );
}
