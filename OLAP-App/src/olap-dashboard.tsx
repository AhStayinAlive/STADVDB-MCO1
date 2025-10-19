import React, { useState, useEffect } from 'react';
import { 
  BarChart, Bar, PieChart, Pie, LineChart, Line, XAxis, YAxis, 
  CartesianGrid, Tooltip, Legend, Cell, ResponsiveContainer,
  AreaChart, Area, ScatterChart, Scatter, ComposedChart
} from 'recharts';
import { Filter, ChevronDown, TrendingUp, TrendingDown, DollarSign, AlertTriangle, Zap, BarChart3, Globe, Calendar } from 'lucide-react';

// Types for OLAP data
interface OLAPData {
  [key: string]: any;
}

interface OLAPQuery {
  measures: string[];
  dimensions: string[];
  filters?: any[];
  timeDimensions?: any[];
  order?: any;
  limit?: number;
}

// OLAP Query Builder Component
const OLAPQueryBuilder = ({ onQueryChange }: { onQueryChange: (query: OLAPQuery) => void }) => {
  const [measures, setMeasures] = useState<string[]>(['CreditMetrics.totalOriginationAmount']);
  const [dimensions, setDimensions] = useState<string[]>(['DateDimension.quarterLabel']);
  const [filters, setFilters] = useState<any[]>([]);

  const availableMeasures = [
    'CreditMetrics.totalOriginationAmount',
    'CreditMetrics.totalBalanceAmount',
    'CreditMetrics.averageDefaultRate',
    'CreditMetrics.primeLendingSpread',
    'CreditMetrics.totalOriginations'
  ];

  const availableDimensions = [
    'DateDimension.year',
    'DateDimension.quarter',
    'DateDimension.quarterLabel',
    'GeographyDimension.country',
    'GeographyDimension.stateProvince',
    'GeographyDimension.city',
    'ProductDimension.productType',
    'ProductDimension.segment',
    'CreditMetrics.riskCategory'
  ];

  useEffect(() => {
    onQueryChange({
      measures,
      dimensions,
      filters
    });
  }, [measures, dimensions, filters, onQueryChange]);

  const toggleMeasure = (measure: string) => {
    setMeasures(prev => 
      prev.includes(measure) 
        ? prev.filter(m => m !== measure)
        : [...prev, measure]
    );
  };

  const toggleDimension = (dimension: string) => {
    setDimensions(prev => 
      prev.includes(dimension) 
        ? prev.filter(d => d !== dimension)
        : [...prev, dimension]
    );
  };

  return (
    <div className="bg-gray-800 rounded-lg p-6">
      <div className="flex items-center gap-2 mb-6">
        <Zap className="w-5 h-5 text-yellow-400" />
        <h2 className="text-lg font-semibold">OLAP Query Builder</h2>
      </div>
      
      <div className="space-y-4">
        <div>
          <h3 className="text-sm font-medium text-gray-300 mb-2">📈 Measures</h3>
          <div className="grid grid-cols-2 gap-2">
            {availableMeasures.map(measure => (
              <label key={measure} className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={measures.includes(measure)}
                  onChange={() => toggleMeasure(measure)}
                  className="rounded"
                />
                <span className="text-sm text-gray-300">{measure.split('.').pop()}</span>
              </label>
            ))}
          </div>
        </div>

        <div>
          <h3 className="text-sm font-medium text-gray-300 mb-2">📐 Dimensions</h3>
          <div className="grid grid-cols-2 gap-2">
            {availableDimensions.map(dimension => (
              <label key={dimension} className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={dimensions.includes(dimension)}
                  onChange={() => toggleDimension(dimension)}
                  className="rounded"
                />
                <span className="text-sm text-gray-300">{dimension.split('.').pop()}</span>
              </label>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

// OLAP Chart Component
const OLAPChart = ({ data, measures, dimensions, chartType = 'bar' }: {
  data: OLAPData[];
  measures: string[];
  dimensions: string[];
  chartType?: 'bar' | 'line' | 'pie' | 'area' | 'scatter' | 'composed';
}) => {
  const colors = ['#1f77b4', '#d62728', '#2ca02c', '#ff7f0e', '#9467bd'];

  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 bg-gray-800 rounded-lg">
        <div className="text-center">
          <BarChart3 className="w-12 h-12 text-gray-400 mx-auto mb-2" />
          <p className="text-gray-400">No data available</p>
        </div>
      </div>
    );
  }

  const renderChart = () => {
    switch (chartType) {
      case 'line':
        return (
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey={dimensions[0]?.split('.').pop()} stroke="#9ca3af" />
            <YAxis stroke="#9ca3af" />
            <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: 'none' }} />
            <Legend />
            {measures.map((measure, index) => (
              <Line
                key={measure}
                type="monotone"
                dataKey={measure.split('.').pop()}
                stroke={colors[index % colors.length]}
                strokeWidth={2}
                dot={{ fill: colors[index % colors.length] }}
              />
            ))}
          </LineChart>
        );

      case 'pie':
        return (
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={90}
              dataKey={measures[0]?.split('.').pop()}
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
              ))}
            </Pie>
            <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: 'none' }} />
            <Legend />
          </PieChart>
        );

      case 'area':
        return (
          <AreaChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey={dimensions[0]?.split('.').pop()} stroke="#9ca3af" />
            <YAxis stroke="#9ca3af" />
            <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: 'none' }} />
            {measures.map((measure, index) => (
              <Area
                key={measure}
                type="monotone"
                dataKey={measure.split('.').pop()}
                stroke={colors[index % colors.length]}
                fill={colors[index % colors.length]}
                fillOpacity={0.3}
              />
            ))}
          </AreaChart>
        );

      case 'scatter':
        return (
          <ScatterChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey={measures[0]?.split('.').pop()} stroke="#9ca3af" />
            <YAxis dataKey={measures[1]?.split('.').pop()} stroke="#9ca3af" />
            <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: 'none' }} />
            <Scatter fill="#1f77b4" />
          </ScatterChart>
        );

      case 'composed':
        return (
          <ComposedChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey={dimensions[0]?.split('.').pop()} stroke="#9ca3af" />
            <YAxis stroke="#9ca3af" />
            <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: 'none' }} />
            <Legend />
            <Bar dataKey={measures[0]?.split('.').pop()} fill="#1f77b4" />
            <Line type="monotone" dataKey={measures[1]?.split('.').pop()} stroke="#d62728" />
          </ComposedChart>
        );

      default: // bar
        return (
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey={dimensions[0]?.split('.').pop()} stroke="#9ca3af" />
            <YAxis stroke="#9ca3af" />
            <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: 'none' }} />
            <Legend />
            {measures.map((measure, index) => (
              <Bar
                key={measure}
                dataKey={measure.split('.').pop()}
                fill={colors[index % colors.length]}
              />
            ))}
          </BarChart>
        );
    }
  };

  return (
    <ResponsiveContainer width="100%" height={400}>
      {renderChart()}
    </ResponsiveContainer>
  );
};

const OLAPDashboard = () => {
  const [olapData, setOlapData] = useState<OLAPData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentQuery, setCurrentQuery] = useState<OLAPQuery>({
    measures: ['CreditMetrics.totalOriginationAmount'],
    dimensions: ['DateDimension.quarterLabel']
  });
  const [chartType, setChartType] = useState<'bar' | 'line' | 'pie' | 'area' | 'scatter' | 'composed'>('bar');

  // Execute OLAP query
  const executeOLAPQuery = async (query: OLAPQuery) => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('http://localhost:4000/cubejs-api/v1/load', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(query)
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      setOlapData(result.data || []);
    } catch (err) {
      console.error('OLAP query error:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    executeOLAPQuery(currentQuery);
  }, [currentQuery]);

  const handleQueryChange = (query: OLAPQuery) => {
    setCurrentQuery(query);
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">OLAP Analytics Dashboard</h1>
          <p className="text-gray-400 text-sm mt-1">True Multi-Dimensional Analysis with Drill-Down Capabilities</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-sm text-gray-400">
            Last updated: {new Date().toLocaleTimeString()}
          </div>
          {loading && (
            <div className="flex items-center gap-2">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-400"></div>
              <span className="text-sm text-gray-400">Executing OLAP Query...</span>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* OLAP Query Builder */}
        <div className="lg:col-span-1">
          <OLAPQueryBuilder onQueryChange={handleQueryChange} />
          
          {/* Chart Type Selector */}
          <div className="bg-gray-800 rounded-lg p-6 mt-6">
            <h3 className="text-lg font-semibold mb-4">📊 Chart Type</h3>
            <div className="grid grid-cols-2 gap-2">
              {[
                { type: 'bar', label: 'Bar Chart', icon: BarChart3 },
                { type: 'line', label: 'Line Chart', icon: TrendingUp },
                { type: 'pie', label: 'Pie Chart', icon: Globe },
                { type: 'area', label: 'Area Chart', icon: Calendar },
                { type: 'scatter', label: 'Scatter Plot', icon: AlertTriangle },
                { type: 'composed', label: 'Composed', icon: Zap }
              ].map(({ type, label, icon: Icon }) => (
                <button
                  key={type}
                  onClick={() => setChartType(type as any)}
                  className={`p-3 rounded-lg flex flex-col items-center gap-2 transition ${
                    chartType === type 
                      ? 'bg-blue-600 text-white' 
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span className="text-xs">{label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Main Chart Area */}
        <div className="lg:col-span-3">
          <div className="bg-gray-800 rounded-lg p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold">OLAP Analysis Results</h2>
              <div className="text-sm text-gray-400">
                {olapData.length} records
              </div>
            </div>

            {error ? (
              <div className="flex items-center justify-center h-64">
                <div className="text-center">
                  <AlertTriangle className="w-12 h-12 text-red-400 mx-auto mb-2" />
                  <p className="text-red-400 mb-2">Error Loading Data</p>
                  <p className="text-gray-400 text-sm">{error}</p>
                </div>
              </div>
            ) : loading ? (
              <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400"></div>
              </div>
            ) : (
              <OLAPChart 
                data={olapData} 
                measures={currentQuery.measures}
                dimensions={currentQuery.dimensions}
                chartType={chartType}
              />
            )}

            {/* Query Debug Info */}
            <div className="mt-6 p-4 bg-gray-700 rounded-lg">
              <h3 className="text-sm font-medium text-gray-300 mb-2">🔍 Current OLAP Query:</h3>
              <pre className="text-xs text-gray-400 overflow-x-auto">
                {JSON.stringify(currentQuery, null, 2)}
              </pre>
            </div>
          </div>

          {/* OLAP Capabilities Info */}
          <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-gray-800 rounded-lg p-4 text-center">
              <BarChart3 className="w-8 h-8 text-blue-400 mx-auto mb-2" />
              <h3 className="text-sm font-semibold">Slicing</h3>
              <p className="text-xs text-gray-400">Multi-dimensional analysis</p>
            </div>
            <div className="bg-gray-800 rounded-lg p-4 text-center">
              <ChevronDown className="w-8 h-8 text-green-400 mx-auto mb-2" />
              <h3 className="text-sm font-semibold">Drilling</h3>
              <p className="text-xs text-gray-400">Drill-down capabilities</p>
            </div>
            <div className="bg-gray-800 rounded-lg p-4 text-center">
              <Globe className="w-8 h-8 text-yellow-400 mx-auto mb-2" />
              <h3 className="text-sm font-semibold">Dicing</h3>
              <p className="text-xs text-gray-400">Dynamic filtering</p>
            </div>
            <div className="bg-gray-800 rounded-lg p-4 text-center">
              <Zap className="w-8 h-8 text-purple-400 mx-auto mb-2" />
              <h3 className="text-sm font-semibold">Pivoting</h3>
              <p className="text-xs text-gray-400">Dimension switching</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OLAPDashboard;