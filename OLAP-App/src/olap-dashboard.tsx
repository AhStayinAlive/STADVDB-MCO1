import React, { useEffect, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
} from "recharts";
import { OLAPAdapter } from "../adapters/olapAdapter";
import { formatPeso, formatPercent } from "../utils/formatters";

const Dashboard = () => {
  const [originationData, setOriginationData] = useState([]);
  const [balanceData, setBalanceData] = useState([]);
  const [defaultRateData, setDefaultRateData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [origination, balance, defaults] = await Promise.all([
          OLAPAdapter.fetchOriginationByYear(),
          OLAPAdapter.fetchBalanceByYear(),
          OLAPAdapter.fetchDefaultRateByYear(),
        ]);
        setOriginationData(origination);
        setBalanceData(balance);
        setDefaultRateData(defaults);
      } catch (err) {
        console.error("OLAP load failed:", err);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  if (loading) return <div className="text-center text-gray-400">Loading OLAP data...</div>;

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      <h1 className="text-2xl font-bold mb-6">Credit Metrics Dashboard</h1>

      <div className="grid grid-cols-2 gap-6">
        {/* --- Origination Amount --- */}
        <div className="bg-gray-800 p-6 rounded-lg">
          <h2 className="text-lg font-semibold mb-4">Origination Amount by Year</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={originationData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="year" stroke="#9ca3af" />
              <YAxis stroke="#9ca3af" tickFormatter={formatPeso} />
              <Tooltip formatter={(v) => formatPeso(v)} />
              <Bar dataKey="origination_amt" fill="#00D9FF" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* --- Balance Amount --- */}
        <div className="bg-gray-800 p-6 rounded-lg">
          <h2 className="text-lg font-semibold mb-4">Balance Amount by Year</h2>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={balanceData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="year" stroke="#9ca3af" />
              <YAxis stroke="#9ca3af" tickFormatter={formatPercent} />
              <Tooltip formatter={(v) => formatPercent(v)} />
              <Line type="monotone" dataKey="balance_amt" stroke="#FF6B35" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* --- Default Rate --- */}
      <div className="bg-gray-800 p-6 rounded-lg mt-6">
        <h2 className="text-lg font-semibold mb-4">Default Rate by Year</h2>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={defaultRateData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="year" stroke="#9ca3af" />
            <YAxis stroke="#9ca3af" />
            <Tooltip formatter={(v) => formatPeso(v)}/>
            <Line type="monotone" dataKey="default_rate" stroke="#90EE90" strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default Dashboard;
