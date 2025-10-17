import { cubejsApi } from '@cubejs-client/core';

// Initialize Cube.js API client
export const cubejsApi = cubejsApi(
  process.env.VITE_CUBEJS_API_SECRET || 'your-secret-key-change-in-production',
  {
    apiUrl: process.env.VITE_CUBEJS_API_URL || 'http://localhost:4000/cubejs-api/v1'
  }
);

// Helper function to create common queries
export const createQuery = (config: {
  measures?: string[];
  dimensions?: string[];
  timeDimensions?: any[];
  filters?: any[];
  order?: any;
  limit?: number;
}) => {
  return {
    measures: config.measures || [],
    dimensions: config.dimensions || [],
    timeDimensions: config.timeDimensions || [],
    filters: config.filters || [],
    order: config.order || {},
    limit: config.limit || 1000
  };
};

// Pre-defined query templates for common use cases
export const queryTemplates = {
  // KPI Metrics
  kpiMetrics: () => createQuery({
    measures: [
      'CreditMetrics.totalOriginationAmount',
      'CreditMetrics.totalBalanceAmount',
      'CreditMetrics.averageDefaultRate',
      'CreditMetrics.primeLendingSpread',
      'CreditMetricsCalculated.originationGrowthRate',
      'CreditMetricsCalculated.balanceGrowthRate'
    ]
  }),

  // Trend Analysis
  quarterlyTrends: (startDate: string, endDate: string) => createQuery({
    measures: [
      'CreditMetrics.totalOriginationAmount',
      'CreditMetrics.totalBalanceAmount',
      'CreditMetrics.averageDefaultRate'
    ],
    timeDimensions: [{
      dimension: 'DateDimension.quarterStart',
      granularity: 'quarter',
      dateRange: [startDate, endDate]
    }],
    dimensions: ['DateDimension.quarterLabel']
  }),

  // Risk Analysis
  riskDistribution: () => createQuery({
    measures: ['CreditMetrics.totalOriginations'],
    dimensions: ['CreditMetrics.riskCategory']
  }),

  // Product Performance
  productPerformance: () => createQuery({
    measures: [
      'CreditMetrics.totalOriginationAmount',
      'CreditMetrics.averageDefaultRate',
      'CreditMetricsCalculated.marketShareByProduct'
    ],
    dimensions: ['ProductDimension.productType']
  }),

  // Geographic Analysis
  geographicAnalysis: () => createQuery({
    measures: [
      'CreditMetrics.totalOriginationAmount',
      'CreditMetrics.totalBalanceAmount',
      'CreditMetrics.averageDefaultRate'
    ],
    dimensions: ['GeographyDimension.country', 'GeographyDimension.stateProvince']
  }),

  // Risk vs Return Analysis
  riskReturnAnalysis: () => createQuery({
    measures: [
      'CreditMetrics.totalOriginationAmount',
      'CreditMetrics.averageDefaultRate',
      'CreditMetrics.totalBalanceAmount'
    ],
    dimensions: ['ProductDimension.productType']
  })
};

// Error handling utility
export const handleCubeError = (error: any) => {
  console.error('Cube.js Error:', error);
  
  if (error.message?.includes('Connection')) {
    return 'Unable to connect to the analytics server. Please check your connection.';
  }
  
  if (error.message?.includes('Authentication')) {
    return 'Authentication failed. Please check your credentials.';
  }
  
  if (error.message?.includes('Query timeout')) {
    return 'Query took too long to execute. Please try with fewer filters.';
  }
  
  return 'An error occurred while loading data. Please try again.';
};

// Data transformation utilities
export const transformChartData = (pivotData: any[], keyField: string, valueFields: string[]) => {
  return pivotData.map(row => {
    const transformed: any = { [keyField]: row[keyField] };
    valueFields.forEach(field => {
      transformed[field] = parseFloat(row[field]) || 0;
    });
    return transformed;
  });
};

export const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(value);
};

export const formatPercent = (value: number) => {
  return `${(value * 100).toFixed(2)}%`;
};

export const formatNumber = (value: number) => {
  return new Intl.NumberFormat('en-US').format(value);
};
