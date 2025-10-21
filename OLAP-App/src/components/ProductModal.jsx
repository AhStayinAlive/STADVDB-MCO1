// src/components/ProductModal.jsx
import React from "react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";
import { formatPeso } from "../utils/formatters";

export default function ProductModal({ open, onClose, year, rows = [], onExportCSV }) {
  if (!open) return null;
  // aggregate rows by product (some adapters return origination_amt per product)
  const grouped = rows.reduce((acc, r) => {
    const p = r.product ?? r["product.product_code"] ?? "UNKNOWN";
    const val = Number(r.origination_amt ?? r.origination_amt_sum ?? r.origination_amt_avg ?? r.origination_amt ?? 0);
    acc[p] = (acc[p] || 0) + (isNaN(val) ? 0 : val);
    return acc;
  }, {});
  const chartData = Object.entries(grouped).map(([product, amount]) => ({ product, amount }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-11/12 md:w-3/4 lg:w-2/3 bg-gray-900 border border-gray-700 rounded-lg p-4 text-white shadow-2xl">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold">Product breakdown — {year}</h3>
          <div className="flex items-center gap-2">
            {onExportCSV && (
              <button
                className="bg-blue-600 hover:bg-blue-700 text-sm px-3 py-1 rounded"
                onClick={() => onExportCSV(chartData, `product_breakdown_${year}.csv`)}
              >
                Export CSV
              </button>
            )}
            <button className="bg-gray-700 hover:bg-gray-600 px-3 py-1 rounded" onClick={onClose}>
              Close
            </button>
          </div>
        </div>

        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} layout="vertical" margin={{ left: 40 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis type="number" tickFormatter={(v) => formatPeso(v)} />
              <YAxis type="category" dataKey="product" width={200} />
              <Tooltip formatter={(v) => formatPeso(Number(v))} />
              <Legend />
              <Bar dataKey="amount" name="Origination (PHP)" fill="#00D9FF" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="mt-3 max-h-40 overflow-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-400">
                <th>Product</th>
                <th className="text-right">Originations</th>
              </tr>
            </thead>
            <tbody>
              {chartData.map((r) => (
                <tr key={r.product} className="border-t border-gray-800">
                  <td className="py-1">{r.product}</td>
                  <td className="py-1 text-right">{formatPeso(r.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
