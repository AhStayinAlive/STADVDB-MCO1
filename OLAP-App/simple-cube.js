import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';

const app = express();
const PORT = 4000;

// Simple API endpoints that return mock data for now
app.get('/cubejs-api/v1/load', (req, res) => {
  // Return mock data structure that matches what the frontend expects
  res.json({
    query: req.query,
    data: [
      {
        'CreditMetrics.totalOriginationAmount': 1500000,
        'CreditMetrics.totalBalanceAmount': 1200000,
        'CreditMetrics.averageDefaultRate': 0.025,
        'CreditMetrics.primeLendingSpread': 0.035,
        'CreditMetricsCalculated.originationGrowthRate': 0.12,
        'CreditMetricsCalculated.balanceGrowthRate': 0.08
      }
    ],
    annotation: {
      measures: {
        'CreditMetrics.totalOriginationAmount': { title: 'Total Origination Amount' },
        'CreditMetrics.totalBalanceAmount': { title: 'Total Balance Amount' },
        'CreditMetrics.averageDefaultRate': { title: 'Average Default Rate' },
        'CreditMetrics.primeLendingSpread': { title: 'Prime Lending Spread' },
        'CreditMetricsCalculated.originationGrowthRate': { title: 'Origination Growth Rate' },
        'CreditMetricsCalculated.balanceGrowthRate': { title: 'Balance Growth Rate' }
      }
    }
  });
});

app.get('/cubejs-api/v1/meta', (req, res) => {
  res.json({
    cubes: [
      {
        name: 'CreditMetrics',
        title: 'Credit Metrics',
        measures: [
          { name: 'totalOriginationAmount', title: 'Total Origination Amount' },
          { name: 'totalBalanceAmount', title: 'Total Balance Amount' },
          { name: 'averageDefaultRate', title: 'Average Default Rate' },
          { name: 'primeLendingSpread', title: 'Prime Lending Spread' }
        ],
        dimensions: [
          { name: 'quarterKey', title: 'Quarter Key' },
          { name: 'riskCategory', title: 'Risk Category' }
        ]
      }
    ]
  });
});

app.get('/', (req, res) => {
  res.json({
    message: 'Credit Card OLAP API Server',
    version: '1.0.0',
    endpoints: {
      api: '/cubejs-api/v1',
      load: '/cubejs-api/v1/load',
      meta: '/cubejs-api/v1/meta'
    }
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Simple OLAP API server running on port ${PORT}`);
  console.log(`📊 API available at: http://localhost:${PORT}/cubejs-api/v1`);
  console.log(`🔗 Meta endpoint: http://localhost:${PORT}/cubejs-api/v1/meta`);
  console.log(`📈 Load endpoint: http://localhost:${PORT}/cubejs-api/v1/load`);
});
