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
  const [kpiData, setKpiData] = useState<any[]>([]);
  const [qoqData, setQoqData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // 🎛️ Filters
  const [yearStart, setYearStart] = useState(2012);
  const [yearEnd, setYearEnd] = useState(2025);

  // 📑 Tab State
  const [activeTab, setActiveTab] = useState<"charts" | "tables">("charts");

  // 🔄 Reset filters
  const resetFilters = () => {
    setYearStart(2012);
    setYearEnd(2025);
  };

  useEffect(() => {
    async function loadData() {
      try {
        const [kpi, qoq, v1, v2, v4] = await Promise.all([
          fetchKPISummary(),
          fetchQuarterlyMetrics(),
          fetch(`${API_BASE_URL}/visuals/prime_vs_delinquency`).then((res) => res.json()),
          fetch(`${API_BASE_URL}/visuals/delinquency_trend`).then((res) => res.json()),
          fetch(`${API_BASE_URL}/visuals/lead_lag`).then((res) => res.json()),
        ]);

        setKpiData(kpi);
        setQoqData(qoq);
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

  // ✅ Stable hook order
  const allProducts = useMemo(() => {
    const set = new Set<string>();
    v2Data.forEach((d) => set.add(d.product_code));
    v4Data.forEach((d) => set.add(d.product_code));
    return Array.from(set).sort();
  }, [v2Data, v4Data]);

  // 🔍 Filter logic
  const filterFn = (d: any) =>
    d.year >= yearStart &&
    d.year <= yearEnd;

  const filteredV1 = v1Data.filter((d) => d.year >= yearStart && d.year <= yearEnd);
  const filteredV2 = v2Data.filter(filterFn);
  const filteredV4 = v4Data.filter(filterFn);
  const filteredKPI = kpiData.filter((d) => d.year >= yearStart && d.year <= yearEnd);
  const filteredQoQ = qoqData.filter((d) => d.year >= yearStart && d.year <= yearEnd);

  // === Derived datasets ===
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

  if (loading) return <div className="p-8 text-gray-500">Loading dashboard data...</div>;
  if (error) return <div className="p-8 text-red-600 font-semibold">{error}</div>;

  return (
    <div className="p-8 space-y-6">
      <h1 className="text-3xl font-bold mb-6">📊 Credit Metrics Dashboard</h1>

      {/* 🎛️ Global Filters */}
      <div className="flex flex-wrap items-end gap-6 mb-6 bg-white p-4 rounded-lg shadow">
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

        <button
          onClick={resetFilters}
          className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-3 py-1 rounded-md text-sm font-medium transition"
        >
          Reset Filters
        </button>
      </div>

      {/* 📑 Tab Navigation */}
      <div className="flex justify-center gap-2 border-b border-gray-200">
        <button
          onClick={() => setActiveTab("charts")}
          className={`px-6 py-3 font-medium transition ${
            activeTab === "charts"
              ? "border-b-2 border-blue-600 text-blue-600"
              : "text-gray-600 hover:text-gray-800"
          }`}
        >
          📈 Charts
        </button>
        <button
          onClick={() => setActiveTab("tables")}
          className={`px-6 py-3 font-medium transition ${
            activeTab === "tables"
              ? "border-b-2 border-blue-600 text-blue-600"
              : "text-gray-600 hover:text-gray-800"
          }`}
        >
          📋 Tables
        </button>
      </div>

      {/* 📈 Charts Panel */}
      {activeTab === "charts" && (
        <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <V1DelinquencyTrend labels={v1Labels} dprimeData={v1Dprime} dralacbnData={v1Dralacbn} />
          <V2PrimeVsDelinquency labels={v2Labels} data={v2ChartData} />
          <V4LeadLag data={filteredV4} />
        </section>
      )}

      {/* 📋 Tables Panel */}
      {activeTab === "tables" && (
        <div className="space-y-6">
          {/* 🧾 KPI Summary Table */}
          <section className="bg-white p-4 rounded-lg shadow">
            <h2 className="text-lg font-semibold mb-3">KPI Summary</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full border border-gray-200 text-sm">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="border px-3 py-2 text-left">Year</th>
                    <th className="border px-3 py-2 text-right">Total Origination</th>
                    <th className="border px-3 py-2 text-right">Total Balance</th>
                    <th className="border px-3 py-2 text-right">Avg Default</th>
                    <th className="border px-3 py-2 text-right">Avg Prime</th>
                    <th className="border px-3 py-2 text-right">Avg Lending</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredKPI.map((row) => (
                    <tr key={row.year} className="hover:bg-gray-50">
                      <td className="border px-3 py-2">{row.year}</td>
                      <td className="border px-3 py-2 text-right">{row.total_origination.toLocaleString()}</td>
                      <td className="border px-3 py-2 text-right">{row.total_balance.toLocaleString()}</td>
                      <td className="border px-3 py-2 text-right">{(row.avg_default * 100).toFixed(2)}%</td>
                      <td className="border px-3 py-2 text-right">{(row.avg_prime * 100).toFixed(2)}%</td>
                      <td className="border px-3 py-2 text-right">{(row.avg_lending * 100).toFixed(2)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* 📅 QoQ Metrics Table */}
          <section className="bg-white p-4 rounded-lg shadow">
            <h2 className="text-lg font-semibold mb-3">Quarterly QoQ Metrics</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full border border-gray-200 text-sm">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="border px-3 py-2 text-left">Year</th>
                    <th className="border px-3 py-2 text-left">Quarter</th>
                    <th className="border px-3 py-2 text-right">Balance Total</th>
                    <th className="border px-3 py-2 text-right">Avg Default</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredQoQ.map((row, idx) => (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="border px-3 py-2">{row.year}</td>
                      <td className="border px-3 py-2">Q{row.quarter}</td>
                      <td className="border px-3 py-2 text-right">{row.balance_total.toLocaleString()}</td>
                      <td className="border px-3 py-2 text-right">{(row.avg_default * 100).toFixed(2)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}