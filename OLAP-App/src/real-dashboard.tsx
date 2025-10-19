import React, { useState, useEffect } from 'react';
import { 
  BarChart, Bar, PieChart, Pie, LineChart, Line, XAxis, YAxis, 
  CartesianGrid, Tooltip, Legend, Cell, ResponsiveContainer,
  AreaChart, Area, ScatterChart, Scatter
} from 'recharts';
import { Filter, ChevronDown, TrendingUp, TrendingDown, DollarSign, AlertTriangle } from 'lucide-react';

// Types for our data
interface KpiData {
  'CreditMetrics.totalOriginationAmount': number;
  'CreditMetrics.totalBalanceAmount': number;
  'CreditMetrics.averageDefaultRate': number;
  'CreditMetrics.primeLendingSpread': number;
  'CreditMetricsCalculated.originationGrowthRate': number;
  'CreditMetricsCalculated.balanceGrowthRate': number;
}

interface TrendData {
  quarterLabel: string;
  totalOriginationAmount: number;
  totalBalanceAmount: number;
  averageDefaultRate: number;
}

interface RiskData {
  riskCategory: string;
  totalOriginations: number;
}

interface ProductData {
  productType: string;
  totalOriginationAmount: number;
  averageDefaultRate: number;
}

interface GeographicData {
  country: string;
  totalOriginationAmount: number;
  totalBalanceAmount: number;
  averageDefaultRate: number;
}

// KPI Card Component
const KPICard = ({ title, value, change, icon: Icon, format = 'number', loading = false }: {
  title: string;
  value: number;
  change?: number;
  icon: React.ComponentType<any>;
  format?: 'number' | 'currency' | 'percent';
  loading?: boolean;
}) => {
  const formatValue = (val: number) => {
    if (loading) return 'Loading...';
    switch (format) {
      case 'currency':
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(val);
      case 'percent':
        return `${(val * 100).toFixed(2)}%`;
      default:
        return new Intl.NumberFormat('en-US').format(val);
    }
  };

  return (
    <div className="bg-gray-800 rounded-lg p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-gray-400 text-sm">{title}</p>
          <p className="text-2xl font-bold text-white">{formatValue(value)}</p>
          {change !== undefined && !loading && (
            <div className={`flex items-center mt-2 ${change >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {change >= 0 ? <TrendingUp className="w-4 h-4 mr-1" /> : <TrendingDown className="w-4 h-4 mr-1" />}
              <span className="text-sm">{Math.abs(change * 100).toFixed(1)}%</span>
            </div>
          )}
        </div>
        <Icon className="w-8 h-8 text-blue-400" />
      </div>
    </div>
  );
};

// Filter Dropdown Component
const FilterDropdown = ({ label, options, value, onChange }: {
  label: string;
  options: string[];
  value: string;
  onChange: (value: string) => void;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  
  return (
    <div className="mb-4 relative">
      <label className="text-gray-400 text-sm block mb-2">{label}</label>
      <div 
        className="bg-gray-800 border border-gray-700 rounded px-3 py-2 flex items-center justify-between cursor-pointer hover:border-gray-600 transition"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="text-gray-300 text-sm">{value}</span>
        <ChevronDown className="w-4 h-4 text-gray-400" />
      </div>
      {isOpen && (
        <div className="absolute z-10 mt-1 w-full bg-gray-800 border border-gray-700 rounded shadow-lg">
          {options.map((option) => (
            <div
              key={option}
              className="px-3 py-2 hover:bg-gray-700 cursor-pointer text-gray-300 text-sm"
              onClick={() => {
                onChange(option);
                setIsOpen(false);
              }}
            >
              {option}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const RealDashboard = () => {
  const [kpiData, setKpiData] = useState<KpiData | null>(null);
  const [trendData, setTrendData] = useState<TrendData[]>([]);
  const [riskData, setRiskData] = useState<RiskData[]>([]);
  const [productData, setProductData] = useState<ProductData[]>([]);
  const [geographicData, setGeographicData] = useState<GeographicData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [filters, setFilters] = useState({
    year: 'All',
    productType: 'All',
    geography: 'All',
    riskCategory: 'All'
  });

  // Fetch data from real database
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch KPI data
        const kpiResponse = await fetch('http://localhost:4000/cubejs-api/v1/load');
        if (!kpiResponse.ok) throw new Error('Failed to fetch KPI data');
        const kpiResult = await kpiResponse.json();
        setKpiData(kpiResult.data[0]);

        // Fetch trend data
        const trendResponse = await fetch('http://localhost:4000/cubejs-api/v1/trends');
        if (!trendResponse.ok) throw new Error('Failed to fetch trend data');
        const trendResult = await trendResponse.json();
        setTrendData(trendResult.data);

        // Fetch risk distribution data
        const riskResponse = await fetch('http://localhost:4000/cubejs-api/v1/risk-distribution');
        if (!riskResponse.ok) throw new Error('Failed to fetch risk data');
        const riskResult = await riskResponse.json();
        setRiskData(riskResult.data);

        // Fetch product performance data
        const productResponse = await fetch('http://localhost:4000/cubejs-api/v1/product-performance');
        if (!productResponse.ok) throw new Error('Failed to fetch product data');
        const productResult = await productResponse.json();
        setProductData(productResult.data);

        // Fetch geographic data
        const geoResponse = await fetch('http://localhost:4000/cubejs-api/v1/geographic');
        if (!geoResponse.ok) throw new Error('Failed to fetch geographic data');
        const geoResult = await geoResponse.json();
        setGeographicData(geoResult.data);

        setLoading(false);
      } catch (err) {
        console.error('Error fetching data:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Color scheme matching Power BI design
  const colors = {
    primary: '#1f77b4',
    secondary: '#d62728',
    accent: '#2ca02c',
    neutral: '#7f7f7f'
  };

  if (error) {
    return (
      <div className="min-h-screen bg-gray-900 text-white p-6 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-400 mb-4">Error Loading Dashboard</h1>
          <p className="text-gray-400 mb-4">{error}</p>
          <p className="text-sm text-gray-500">
            Make sure the API server is running: <code>node real-db-server.js</code>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">Credit Card OLAP Dashboard</h1>
          <p className="text-gray-400 text-sm mt-1">Real-time Analytics powered by Real Database</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-sm text-gray-400">
            Last updated: {new Date().toLocaleTimeString()}
          </div>
          {loading && (
            <div className="flex items-center gap-2">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-400"></div>
              <span className="text-sm text-gray-400">Loading...</span>
            </div>
          )}
        </div>
      </div>

      <div className="flex gap-6">
        {/* Main Content */}
        <div className="flex-1">
          {/* Executive Summary - KPI Cards */}
          <div className="grid grid-cols-4 gap-6 mb-8">
            <KPICard
              title="Total Origination Amount"
              value={kpiData?.['CreditMetrics.totalOriginationAmount'] || 0}
              change={kpiData?.['CreditMetricsCalculated.originationGrowthRate']}
              icon={DollarSign}
              format="currency"
              loading={loading}
            />
            <KPICard
              title="Total Balance Amount"
              value={kpiData?.['CreditMetrics.totalBalanceAmount'] || 0}
              change={kpiData?.['CreditMetricsCalculated.balanceGrowthRate']}
              icon={DollarSign}
              format="currency"
              loading={loading}
            />
            <KPICard
              title="Average Default Rate"
              value={kpiData?.['CreditMetrics.averageDefaultRate'] || 0}
              icon={AlertTriangle}
              format="percent"
              loading={loading}
            />
            <KPICard
              title="Prime-Lending Spread"
              value={kpiData?.['CreditMetrics.primeLendingSpread'] || 0}
              icon={TrendingUp}
              format="percent"
              loading={loading}
            />
          </div>

          {/* Trend Analysis */}
          <div className="grid grid-cols-2 gap-6 mb-8">
            <div className="bg-gray-800 rounded-lg p-6">
              <h2 className="text-lg font-semibold mb-4">Quarterly Origination Trends</h2>
              {loading ? (
                <div className="flex items-center justify-center h-64">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400"></div>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={trendData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis dataKey="quarterLabel" stroke="#9ca3af" />
                    <YAxis stroke="#9ca3af" />
                    <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: 'none' }} />
                    <Legend />
                    <Line 
                      type="monotone" 
                      dataKey="totalOriginationAmount" 
                      stroke={colors.primary} 
                      strokeWidth={2} 
                      dot={{ fill: colors.primary }} 
                    />
                    <Line 
                      type="monotone" 
                      dataKey="totalBalanceAmount" 
                      stroke={colors.accent} 
                      strokeWidth={2} 
                      dot={{ fill: colors.accent }} 
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>

            <div className="bg-gray-800 rounded-lg p-6">
              <h2 className="text-lg font-semibold mb-4">Default Rate Trends</h2>
              {loading ? (
                <div className="flex items-center justify-center h-64">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400"></div>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={trendData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis dataKey="quarterLabel" stroke="#9ca3af" />
                    <YAxis stroke="#9ca3af" />
                    <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: 'none' }} />
                    <Area 
                      type="monotone" 
                      dataKey="averageDefaultRate" 
                      stroke={colors.secondary} 
                      fill={colors.secondary}
                      fillOpacity={0.3}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Risk Analysis */}
          <div className="grid grid-cols-2 gap-6 mb-8">
            <div className="bg-gray-800 rounded-lg p-6">
              <h2 className="text-lg font-semibold mb-4">Risk Distribution by Category</h2>
              {loading ? (
                <div className="flex items-center justify-center h-64">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400"></div>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={riskData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={90}
                      dataKey="totalOriginations"
                    >
                      {riskData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={[colors.primary, colors.secondary, colors.accent, colors.neutral][index % 4]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: 'none' }} />
                    <Legend 
                      verticalAlign="middle" 
                      align="right"
                      layout="vertical"
                      iconType="circle"
                    />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>

            <div className="bg-gray-800 rounded-lg p-6">
              <h2 className="text-lg font-semibold mb-4">Product Performance Analysis</h2>
              {loading ? (
                <div className="flex items-center justify-center h-64">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400"></div>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <ScatterChart data={productData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis 
                      dataKey="averageDefaultRate" 
                      stroke="#9ca3af"
                      name="Default Rate"
                    />
                    <YAxis 
                      dataKey="totalOriginationAmount" 
                      stroke="#9ca3af"
                      name="Origination Amount"
                    />
                    <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: 'none' }} />
                    <Scatter 
                      dataKey="totalOriginationAmount" 
                      fill={colors.primary}
                    />
                  </ScatterChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Geographic Analysis */}
          <div className="bg-gray-800 rounded-lg p-6">
            <h2 className="text-lg font-semibold mb-4">Geographic Distribution</h2>
            {loading ? (
              <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400"></div>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-4">
                {geographicData.map((geo, index) => (
                  <div key={index} className="bg-gray-700 rounded-lg p-4">
                    <h3 className="font-semibold text-blue-400">{geo.country}</h3>
                    <div className="mt-2 space-y-1">
                      <div className="text-sm">
                        <span className="text-gray-400">Origination: </span>
                        <span className="text-green-400">
                          ${(geo.totalOriginationAmount / 1000000).toFixed(1)}M
                        </span>
                      </div>
                      <div className="text-sm">
                        <span className="text-gray-400">Balance: </span>
                        <span className="text-blue-400">
                          ${(geo.totalBalanceAmount / 1000000).toFixed(1)}M
                        </span>
                      </div>
                      <div className="text-sm">
                        <span className="text-gray-400">Default Rate: </span>
                        <span className="text-red-400">
                          {(geo.averageDefaultRate * 100).toFixed(2)}%
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Sidebar - Filters */}
        <div className="w-64 bg-gray-800 rounded-lg p-6">
          <div className="flex items-center gap-2 mb-6">
            <Filter className="w-5 h-5" />
            <h2 className="text-lg font-semibold">Filters</h2>
          </div>
          
          <FilterDropdown 
            label="Year" 
            options={['All', '2021', '2022', '2023', '2024']} 
            value={filters.year}
            onChange={(value) => setFilters({...filters, year: value})}
          />
          <FilterDropdown 
            label="Product Type" 
            options={['All', ...productData.map(p => p.productType)]} 
            value={filters.productType}
            onChange={(value) => setFilters({...filters, productType: value})}
          />
          <FilterDropdown 
            label="Geography" 
            options={['All', ...geographicData.map(g => g.country)]} 
            value={filters.geography}
            onChange={(value) => setFilters({...filters, geography: value})}
          />
          <FilterDropdown 
            label="Risk Category" 
            options={['All', ...riskData.map(r => r.riskCategory)]} 
            value={filters.riskCategory}
            onChange={(value) => setFilters({...filters, riskCategory: value})}
          />
          
          <button className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded mt-6 transition">
            Apply Filters
          </button>
          
          <button className="w-full bg-gray-700 hover:bg-gray-600 text-white font-medium py-2 px-4 rounded mt-2 transition">
            Reset
          </button>
        </div>
      </div>
    </div>
  );
};

export default RealDashboard;
