import React, { useState, useEffect } from 'react';
import { 
  BarChart, Bar, PieChart, Pie, LineChart, Line, XAxis, YAxis, 
  CartesianGrid, Tooltip, Legend, Cell, ResponsiveContainer,
  AreaChart, Area, ScatterChart, Scatter
} from 'recharts';
import { Filter, ChevronDown, TrendingUp, TrendingDown, DollarSign, AlertTriangle } from 'lucide-react';
import { cubejsApi } from './cube-client';

// Types for our data
interface CreditMetricsData {
  totalOriginationAmount: number;
  totalBalanceAmount: number;
  averageDefaultRate: number;
  primeLendingSpread: number;
  originationGrowthRate: number;
  balanceGrowthRate: number;
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
  percentage: number;
}

interface ProductPerformanceData {
  productType: string;
  totalOriginationAmount: number;
  averageDefaultRate: number;
  marketShare: number;
}

// Custom hook for Cube.js queries
const useCubeQuery = (query: any) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const result = await cubejsApi.load(query);
        setData(result);
        setError(null);
      } catch (err) {
        setError(err);
        console.error('Cube.js query error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [JSON.stringify(query)]);

  return { data, loading, error };
};

// KPI Card Component
const KPICard = ({ title, value, change, icon: Icon, format = 'number' }: {
  title: string;
  value: number;
  change?: number;
  icon: React.ComponentType<any>;
  format?: 'number' | 'currency' | 'percent';
}) => {
  const formatValue = (val: number) => {
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
          {change !== undefined && (
            <div className={`flex items-center mt-2 ${change >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {change >= 0 ? <TrendingUp className="w-4 h-4 mr-1" /> : <TrendingDown className="w-4 h-4 mr-1" />}
              <span className="text-sm">{Math.abs(change).toFixed(1)}%</span>
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
    <div className="mb-4">
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

const CubeDashboard = () => {
  const [filters, setFilters] = useState({
    year: 'All',
    productType: 'All',
    geography: 'All',
    riskCategory: 'All'
  });

  // KPI Metrics Query
  const kpiQuery = {
    measures: [
      'CreditMetrics.totalOriginationAmount',
      'CreditMetrics.totalBalanceAmount',
      'CreditMetrics.averageDefaultRate',
      'CreditMetrics.primeLendingSpread',
      'CreditMetricsCalculated.originationGrowthRate',
      'CreditMetricsCalculated.balanceGrowthRate'
    ],
    timeDimensions: [],
    filters: []
  };

  // Trend Analysis Query
  const trendQuery = {
    measures: [
      'CreditMetrics.totalOriginationAmount',
      'CreditMetrics.totalBalanceAmount',
      'CreditMetrics.averageDefaultRate'
    ],
    timeDimensions: [{
      dimension: 'DateDimension.quarterStart',
      granularity: 'quarter',
      dateRange: ['2021-01-01', '2024-12-31']
    }],
    dimensions: ['DateDimension.quarterLabel']
  };

  // Risk Distribution Query
  const riskQuery = {
    measures: ['CreditMetrics.totalOriginations'],
    dimensions: ['CreditMetrics.riskCategory'],
    timeDimensions: []
  };

  // Product Performance Query
  const productQuery = {
    measures: [
      'CreditMetrics.totalOriginationAmount',
      'CreditMetrics.averageDefaultRate',
      'CreditMetricsCalculated.marketShareByProduct'
    ],
    dimensions: ['ProductDimension.productType'],
    timeDimensions: []
  };

  const { data: kpiData, loading: kpiLoading } = useCubeQuery(kpiQuery);
  const { data: trendData, loading: trendLoading } = useCubeQuery(trendQuery);
  const { data: riskData, loading: riskLoading } = useCubeQuery(riskQuery);
  const { data: productData, loading: productLoading } = useCubeQuery(productQuery);

  const kpiMetrics = kpiData?.pivot()?.[0] || {};
  const trendChartData = trendData?.chartPivot() || [];
  const riskChartData = riskData?.chartPivot() || [];
  const productChartData = productData?.chartPivot() || [];

  // Color scheme matching Power BI design
  const colors = {
    primary: '#1f77b4',
    secondary: '#d62728',
    accent: '#2ca02c',
    neutral: '#7f7f7f'
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">Credit Card OLAP Dashboard</h1>
          <p className="text-gray-400 text-sm mt-1">Real-time Analytics powered by Cube.js</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-sm text-gray-400">
            Last updated: {new Date().toLocaleTimeString()}
          </div>
        </div>
      </div>

      <div className="flex gap-6">
        {/* Main Content */}
        <div className="flex-1">
          {/* Executive Summary - KPI Cards */}
          <div className="grid grid-cols-4 gap-6 mb-8">
            <KPICard
              title="Total Origination Amount"
              value={kpiMetrics['CreditMetrics.totalOriginationAmount'] || 0}
              change={kpiMetrics['CreditMetricsCalculated.originationGrowthRate'] || 0}
              icon={DollarSign}
              format="currency"
            />
            <KPICard
              title="Total Balance Amount"
              value={kpiMetrics['CreditMetrics.totalBalanceAmount'] || 0}
              change={kpiMetrics['CreditMetricsCalculated.balanceGrowthRate'] || 0}
              icon={DollarSign}
              format="currency"
            />
            <KPICard
              title="Average Default Rate"
              value={kpiMetrics['CreditMetrics.averageDefaultRate'] || 0}
              icon={AlertTriangle}
              format="percent"
            />
            <KPICard
              title="Prime-Lending Spread"
              value={kpiMetrics['CreditMetrics.primeLendingSpread'] || 0}
              icon={TrendingUp}
              format="percent"
            />
          </div>

          {/* Trend Analysis */}
          <div className="grid grid-cols-2 gap-6 mb-8">
            <div className="bg-gray-800 rounded-lg p-6">
              <h2 className="text-lg font-semibold mb-4">Quarterly Origination Trends</h2>
              {trendLoading ? (
                <div className="flex items-center justify-center h-64">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400"></div>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={trendChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis dataKey="DateDimension.quarterLabel" stroke="#9ca3af" />
                    <YAxis stroke="#9ca3af" />
                    <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: 'none' }} />
                    <Legend />
                    <Line 
                      type="monotone" 
                      dataKey="CreditMetrics.totalOriginationAmount" 
                      stroke={colors.primary} 
                      strokeWidth={2} 
                      dot={{ fill: colors.primary }} 
                    />
                    <Line 
                      type="monotone" 
                      dataKey="CreditMetrics.totalBalanceAmount" 
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
              {trendLoading ? (
                <div className="flex items-center justify-center h-64">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400"></div>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={trendChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis dataKey="DateDimension.quarterLabel" stroke="#9ca3af" />
                    <YAxis stroke="#9ca3af" />
                    <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: 'none' }} />
                    <Area 
                      type="monotone" 
                      dataKey="CreditMetrics.averageDefaultRate" 
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
              {riskLoading ? (
                <div className="flex items-center justify-center h-64">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400"></div>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={riskChartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={90}
                      dataKey="CreditMetrics.totalOriginations"
                    >
                      {riskChartData.map((entry, index) => (
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
              {productLoading ? (
                <div className="flex items-center justify-center h-64">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400"></div>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <ScatterChart data={productChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis 
                      dataKey="CreditMetrics.averageDefaultRate" 
                      stroke="#9ca3af"
                      name="Default Rate"
                    />
                    <YAxis 
                      dataKey="CreditMetrics.totalOriginationAmount" 
                      stroke="#9ca3af"
                      name="Origination Amount"
                    />
                    <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: 'none' }} />
                    <Scatter 
                      dataKey="CreditMetrics.totalOriginationAmount" 
                      fill={colors.primary}
                    />
                  </ScatterChart>
                </ResponsiveContainer>
              )}
            </div>
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
            options={['All', 'Credit Card', 'Personal Loan', 'Auto Loan', 'Mortgage']} 
            value={filters.productType}
            onChange={(value) => setFilters({...filters, productType: value})}
          />
          <FilterDropdown 
            label="Geography" 
            options={['All', 'North America', 'Europe', 'Asia Pacific']} 
            value={filters.geography}
            onChange={(value) => setFilters({...filters, geography: value})}
          />
          <FilterDropdown 
            label="Risk Category" 
            options={['All', 'Low Risk', 'Medium Risk', 'High Risk']} 
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

export default CubeDashboard;
