// src/dashboard.tsx
import { useEffect, useState } from "react";
import { fetchKPISummary, fetchQuarterlyMetrics } from "./api";

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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadData() {
      try {
        const [kpiData, quarterlyData] = await Promise.all([
          fetchKPISummary(),
          fetchQuarterlyMetrics(),
        ]);
        setSummary(kpiData);
        setQuarterly(quarterlyData);
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

  return (
    <div className="p-8 space-y-10">
      <h1 className="text-3xl font-bold mb-6">📊 Credit Metrics Dashboard</h1>

      {/* KPI Summary Table */}
      <section>
        <h2 className="text-xl font-semibold mb-3">Yearly KPI Summary</h2>
        <table className="table-auto border-collapse border border-gray-400 w-full text-sm">
          <thead>
            <tr className="bg-gray-100">
              <th className="border px-2 py-1">Year</th>
              <th className="border px-2 py-1">Total Origination</th>
              <th className="border px-2 py-1">Total Balance</th>
              <th className="border px-2 py-1">Avg Default</th>
              <th className="border px-2 py-1">Avg Prime</th>
              <th className="border px-2 py-1">Avg Lending</th>
            </tr>
          </thead>
          <tbody>
            {summary.map((row) => (
              <tr key={row.year}>
                <td className="border px-2 py-1">{row.year}</td>
                <td className="border px-2 py-1">{row.total_origination.toFixed(2)}</td>
                <td className="border px-2 py-1">{row.total_balance.toFixed(2)}</td>
                <td className="border px-2 py-1">{(row.avg_default * 100).toFixed(2)}%</td>
                <td className="border px-2 py-1">{row.avg_prime.toFixed(2)}</td>
                <td className="border px-2 py-1">{row.avg_lending.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* Quarterly Data */}
      <section>
        <h2 className="text-xl font-semibold mb-3">Quarterly Metrics</h2>
        <table className="table-auto border-collapse border border-gray-400 w-full text-sm">
          <thead>
            <tr className="bg-gray-100">
              <th className="border px-2 py-1">Year</th>
              <th className="border px-2 py-1">Quarter</th>
              <th className="border px-2 py-1">Total Balance</th>
              <th className="border px-2 py-1">Avg Default</th>
            </tr>
          </thead>
          <tbody>
            {quarterly.map((row, i) => (
              <tr key={i}>
                <td className="border px-2 py-1">{row.year}</td>
                <td className="border px-2 py-1">Q{row.quarter}</td>
                <td className="border px-2 py-1">{row.balance_total.toFixed(2)}</td>
                <td className="border px-2 py-1">{(row.avg_default * 100).toFixed(2)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
