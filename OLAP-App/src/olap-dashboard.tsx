// src/components/Dashboard.jsx
import React, { useEffect, useState, useCallback } from "react";
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
  Legend,
} from "recharts";

import { OLAPAdapter } from "../adapters/olapAdapter"; // assuming adapters is at src/adapters
import { formatPeso, formatPercent } from "../utils/formatters"; // fixed path
import Filters from "./components/Filters"; // fixed path (same folder)
import ProductModal from "./components/ProductModal"; // fixed path (same folder)
import { downloadCSV } from "../utils/csv"; // fixed path

const Dashboard = () => {
  const [filtersState, setFiltersState] = useState({ yearFrom: null, yearTo: null, product: null });
  const [productBreakdown, setProductBreakdown] = useState([]); // rows: { year, product, origination_amt }
  const [selectedYear, setSelectedYear] = useState(null);
  const [availableYears, setAvailableYears] = useState([]);
  const [availableProducts, setAvailableProducts] = useState([]);

  const [originationData, setOriginationData] = useState([]);
  const [balanceData, setBalanceData] = useState([]);
  const [defaultRateData, setDefaultRateData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [modalYear, setModalYear] = useState(null);
  const [modalRows, setModalRows] = useState([]);

  const normalizeRateForDisplay = (raw) => {
    if (raw === null || raw === undefined || raw === "") return null;
    const n = Number(raw);
    if (!Number.isFinite(n)) return null;
    return n > 1 ? n / 100 : n;
  };

  const defaultRateTooltip = (value) => {
    const v = normalizeRateForDisplay(value);
    return v === null ? "—" : formatPercent(v);
  };

  // Reusable loader that supports passing filter params (adapter must accept those)
  const handleReloadWithFilters = async (filters) => {
    setLoading(true);
    try {
      const extraParams = {};
      if (filters.yearFrom) extraParams.year_from = filters.yearFrom;
      if (filters.yearTo) extraParams.year_to = filters.yearTo;
      if (filters.product) extraParams.product = filters.product;

      // NOTE: adapter methods must accept an options/params object
      const [origination, balance, defaults] = await Promise.all([
        OLAPAdapter.fetchOriginationByYear(extraParams), // adapter should accept options
        OLAPAdapter.fetchBalanceByYear(extraParams),
        OLAPAdapter.fetchDefaultRateByYear(extraParams),
      ]);
      setOriginationData(origination || []);
      setBalanceData(balance || []);
      setDefaultRateData(defaults || []);
    } catch (e) {
      console.error(e);
      setError("Failed to re-load filtered data");
    } finally {
      setLoading(false);
    }
  };

  const handleOriginationBarClick = async (payload) => {
    const year = payload?.payload?.year || payload?.activeLabel || payload?.label;
    if (!year) return;

    setSelectedYear(year);
    try {
      // adapter should support fetching product-level rows accepting { year }
      const pb = await OLAPAdapter.fetchOriginationByYearOrProduct({ year });
      setProductBreakdown((pb || []).filter((r) => String(r.year) === String(year)));
    } catch (e) {
      console.error("product breakdown fetch failed", e);
      setProductBreakdown([]);
    }
  };

  useEffect(() => {
    let mounted = true;
    const loadData = async () => {
      setLoading(true);
      setError(null);
      try {
        const [origination, balance, defaults] = await Promise.all([
          OLAPAdapter.fetchOriginationByYear(),
          OLAPAdapter.fetchBalanceByYear(),
          OLAPAdapter.fetchDefaultRateByYear(),
        ]);

        const safeMap = (arr, key) =>
          (arr || []).map((r) => ({
            ...r,
            year: r.year ?? r.label ?? r["date_qtr.year"] ?? "UNKNOWN",
            [key]: r[key] === null || r[key] === undefined || r[key] === "" ? 0 : Number(r[key]),
          }));

        const oData = safeMap(origination, "origination_amt");
        const bData = safeMap(balance, "balance_amt");
        const dData = (defaults || []).map((r) => ({
          ...r,
          year: r.year ?? r.label ?? r["date_qtr.year"] ?? "UNKNOWN",
          default_rate_raw: r.default_rate ?? r.default_rate_avg ?? r.default_rate_sum ?? 0,
        }));

        if (!mounted) return;
        setOriginationData(oData);
        setBalanceData(bData);
        setDefaultRateData(dData);

        const years = Array.from(
          new Set([...bData.map((r) => r.year), ...oData.map((r) => r.year), ...dData.map((r) => r.year)])
        )
          .filter(Boolean)
          .sort((a, b) => {
            const na = Number(a),
              nb = Number(b);
            if (!isNaN(na) && !isNaN(nb)) return na - nb;
            return String(a).localeCompare(String(b));
          });

        setAvailableYears(years);

        try {
          const prodRows = await OLAPAdapter.fetchOriginationByYearOrProduct();
          const products = Array.from(new Set((prodRows || []).map((r) => r.product).filter(Boolean))).map((p) => ({
            value: p,
            label: p,
          }));
          setAvailableProducts(products);
        } catch (err) {
          console.debug("product lookup failed:", err?.message ?? err);
        }
      } catch (err) {
        console.error("OLAP load failed:", err);
        if (!mounted) return;
        setError("Failed to load OLAP data. Check backend or network.");
      } finally {
        if (mounted) setLoading(false);
      }
    };

    loadData();
    return () => {
      mounted = false;
    };
  }, []);

  // NOTE: setFiltersState (was setFilters by mistake)
  const handleFilters = useCallback(
    async ({ yearFrom, yearTo, product }) => {
      setFiltersState({ yearFrom, yearTo, product });

      const yf = yearFrom ? Number(yearFrom) : -Infinity;
      const yt = yearTo ? Number(yearTo) : Infinity;

      const filterRange = (arr) =>
        (arr || []).filter((r) => {
          const yr = Number(r.year);
          if (isNaN(yr)) return true;
          return yr >= yf && yr <= yt;
        });

      setOriginationData((prev) => filterRange(prev));
      setBalanceData((prev) => filterRange(prev));
      setDefaultRateData((prev) => filterRange(prev));

      if (product) {
        try {
          const prodRows = await OLAPAdapter.fetchOriginationByYearOrProduct();
          const filtered = (prodRows || []).filter((r) => String(r.product) === String(product));
          setProductBreakdown(filtered);
        } catch (err) {
          console.debug("product drilldown failed:", err?.message ?? err);
          setProductBreakdown([]);
        }
      } else {
        setProductBreakdown([]);
      }
    },
    []
  );

  const handleBarClick = useCallback(
    async (data) => {
      if (!data || !data.year) return;
      const year = String(data.year);
      try {
        const prodRows = await OLAPAdapter.fetchOriginationByYearOrProduct();
        const filtered = (prodRows || []).filter((r) => String(r.year) === year);
        setModalRows(filtered);
        setModalYear(year);
        setModalOpen(true);
      } catch (err) {
        console.debug("drilldown by year failed:", err?.message ?? err);
      }
    },
    []
  );

  const handleExportCSV = (rows, filename) => downloadCSV(rows, filename);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white">
        <div className="text-center">
          <div className="mb-2 animate-pulse">Loading OLAP data...</div>
          <div className="text-sm text-gray-400">If this hangs, check the backend /api/olap endpoints.</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen p-6 bg-gray-900 text-white">
        <h1 className="text-2xl font-bold mb-4">Credit Metrics Dashboard</h1>
        <div className="bg-red-800 p-4 rounded">{error}</div>
      </div>
    );
  }

  const hasData = (originationData && originationData.length) || (balanceData && balanceData.length) || (defaultRateData && defaultRateData.length);

  if (!hasData) {
    return (
      <div className="min-h-screen p-6 bg-gray-900 text-white">
        <h1 className="text-2xl font-bold mb-4">Credit Metrics Dashboard</h1>
        <div className="bg-gray-800 p-6 rounded">No data available for the selected measures.</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      <h1 className="text-2xl font-bold mb-4">Credit Metrics Dashboard</h1>

      <div className="mb-4">
        <Filters
          initial={{ yearFrom: 2018, yearTo: 2024 }}
          onApply={(f) => {
            setFiltersState(f);
            handleReloadWithFilters(f);
          }}
        />
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-gray-800 p-6 rounded-lg">
          <h2 className="text-lg font-semibold mb-4">Origination Amount by Year</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={originationData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="year" stroke="#9ca3af" />
              <YAxis stroke="#9ca3af" tickFormatter={formatPeso} />
              <Tooltip formatter={(value) => formatPeso(Number(value))} />
              <Legend />
              <Bar dataKey="origination_amt" name="Originations (PHP)" fill="#00D9FF" onClick={(data) => handleOriginationBarClick(data)} />
            </BarChart>
          </ResponsiveContainer>

          {productBreakdown && productBreakdown.length > 0 && (
            <div className="bg-gray-900 p-3 rounded mt-4">
              <h3 className="font-semibold mb-2">Product breakdown</h3>
              <div className="overflow-auto max-h-48">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-400">
                      <th>Product</th>
                      <th className="text-right">Originations</th>
                    </tr>
                  </thead>
                  <tbody>
                    {productBreakdown.map((row) => (
                      <tr key={`${row.year}-${row.product}`} className="border-t border-gray-700">
                        <td className="py-1">{row.product}</td>
                        <td className="py-1 text-right">{formatPeso(Number(row.origination_amt ?? row.origination_amt_sum ?? 0))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <div className="bg-gray-800 p-6 rounded-lg">
          <h2 className="text-lg font-semibold mb-4">Balance Amount by Year</h2>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={balanceData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="year" stroke="#9ca3af" />
              <YAxis stroke="#9ca3af" tickFormatter={formatPeso} />
              <Tooltip formatter={(value) => formatPeso(Number(value))} />
              <Legend />
              <Line type="monotone" dataKey="balance_amt" name="Balance (PHP)" stroke="#FF6B35" strokeWidth={2} dot={{ r: 2 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-gray-800 p-6 rounded-lg mt-6">
        <h2 className="text-lg font-semibold mb-4">Default Rate by Year</h2>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart
            data={defaultRateData.map((r) => ({
              ...r,
              default_rate: normalizeRateForDisplay(Number(r.default_rate_raw)),
            }))}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="year" stroke="#9ca3af" />
            <YAxis stroke="#9ca3af" tickFormatter={(v) => (v === null || v === undefined ? "—" : formatPercent(v))} />
            <Tooltip formatter={(val) => defaultRateTooltip(val)} labelFormatter={(label) => `Year: ${label}`} />
            <Legend />
            <Line type="monotone" dataKey="default_rate" name="Default Rate" stroke="#90EE90" strokeWidth={2} dot={{ r: 2 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <ProductModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        year={modalYear}
        rows={modalRows}
        onExportCSV={(rows, filename) => {
          const csvRows = (rows || []).map((r) => ({
            product: r.product ?? r["product.product_code"] ?? "UNKNOWN",
            amount: Number(r.origination_amt ?? r.origination_amt_sum ?? 0),
          }));
          handleExportCSV(csvRows, filename);
        }}
      />
    </div>
  );
};

export default Dashboard;
