import express from 'express';
import mysql from 'mysql2/promise';

const app = express();
const PORT = 4000;

// Enable CORS for the frontend
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  next();
});

app.use(express.json());

// Database connection
const dbConfig = {
  host: '127.0.0.1',
  port: 3306,
  user: 'dw',
  password: 'DwPass!123',
  database: 'gosales_dw'
};

// Helper function to get database connection
async function getConnection() {
  return await mysql.createConnection(dbConfig);
}

// API endpoint to get KPI metrics
app.get('/cubejs-api/v1/load', async (req, res) => {
  try {
    console.log('📊 Fetching KPI metrics from database...');
    const connection = await getConnection();
    
    // Get current quarter data for KPIs
    const [kpiRows] = await connection.execute(`
      SELECT 
        SUM(originations_cnt) as totalOriginations,
        SUM(origination_amt) as totalOriginationAmount,
        SUM(balance_amt) as totalBalanceAmount,
        AVG(default_rate) as averageDefaultRate,
        AVG(prime_rate) as averagePrimeRate,
        AVG(lending_rate) as averageLendingRate,
        (AVG(prime_rate) - AVG(lending_rate)) as primeLendingSpread
      FROM fact_credit_metrics_qtr
    `);
    
    // Get previous quarter data for growth calculations
    const [prevRows] = await connection.execute(`
      SELECT 
        SUM(origination_amt) as prevOriginationAmount,
        SUM(balance_amt) as prevBalanceAmount
      FROM fact_credit_metrics_qtr fcm
      JOIN dim_date_qtr dd ON fcm.quarter_key = dd.quarter_key
      WHERE dd.quarter_key < (SELECT MAX(quarter_key) FROM dim_date_qtr)
    `);
    
    const current = kpiRows[0];
    const previous = prevRows[0];
    
    // Calculate growth rates
    const originationGrowthRate = previous.prevOriginationAmount > 0 
      ? (current.totalOriginationAmount - previous.prevOriginationAmount) / previous.prevOriginationAmount 
      : 0;
    const balanceGrowthRate = previous.prevBalanceAmount > 0 
      ? (current.totalBalanceAmount - previous.prevBalanceAmount) / previous.prevBalanceAmount 
      : 0;
    
    const kpiData = {
      'CreditMetrics.totalOriginationAmount': current.totalOriginationAmount,
      'CreditMetrics.totalBalanceAmount': current.totalBalanceAmount,
      'CreditMetrics.averageDefaultRate': current.averageDefaultRate,
      'CreditMetrics.primeLendingSpread': current.primeLendingSpread,
      'CreditMetricsCalculated.originationGrowthRate': originationGrowthRate,
      'CreditMetricsCalculated.balanceGrowthRate': balanceGrowthRate
    };
    
    await connection.end();
    
    res.json({
      query: req.query,
      data: [kpiData],
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
    
  } catch (error) {
    console.error('❌ Error fetching KPI data:', error);
    res.status(500).json({ error: 'Failed to fetch KPI data' });
  }
});

// API endpoint to get trend data
app.get('/cubejs-api/v1/trends', async (req, res) => {
  try {
    console.log('📈 Fetching trend data from database...');
    const connection = await getConnection();
    
    const [rows] = await connection.execute(`
      SELECT 
        CONCAT(dd.year, ' Q', dd.quarter) as quarterLabel,
        SUM(fcm.origination_amt) as totalOriginationAmount,
        SUM(fcm.balance_amt) as totalBalanceAmount,
        AVG(fcm.default_rate) as averageDefaultRate
      FROM fact_credit_metrics_qtr fcm
      JOIN dim_date_qtr dd ON fcm.quarter_key = dd.quarter_key
      GROUP BY dd.quarter_key, dd.year, dd.quarter
      ORDER BY dd.quarter_key
    `);
    
    await connection.end();
    
    res.json({ data: rows });
    
  } catch (error) {
    console.error('❌ Error fetching trend data:', error);
    res.status(500).json({ error: 'Failed to fetch trend data' });
  }
});

// API endpoint to get risk distribution data
app.get('/cubejs-api/v1/risk-distribution', async (req, res) => {
  try {
    console.log('🎯 Fetching risk distribution data from database...');
    const connection = await getConnection();
    
    const [rows] = await connection.execute(`
      SELECT 
        CASE 
          WHEN fcm.default_rate > 0.05 THEN 'High Risk'
          WHEN fcm.default_rate BETWEEN 0.02 AND 0.05 THEN 'Medium Risk'
          WHEN fcm.default_rate < 0.02 THEN 'Low Risk'
          ELSE 'Unknown'
        END as riskCategory,
        SUM(fcm.originations_cnt) as totalOriginations
      FROM fact_credit_metrics_qtr fcm
      GROUP BY 
        CASE 
          WHEN fcm.default_rate > 0.05 THEN 'High Risk'
          WHEN fcm.default_rate BETWEEN 0.02 AND 0.05 THEN 'Medium Risk'
          WHEN fcm.default_rate < 0.02 THEN 'Low Risk'
          ELSE 'Unknown'
        END
    `);
    
    await connection.end();
    
    res.json({ data: rows });
    
  } catch (error) {
    console.error('❌ Error fetching risk distribution data:', error);
    res.status(500).json({ error: 'Failed to fetch risk distribution data' });
  }
});

// API endpoint to get product performance data
app.get('/cubejs-api/v1/product-performance', async (req, res) => {
  try {
    console.log('🏦 Fetching product performance data from database...');
    const connection = await getConnection();
    
    const [rows] = await connection.execute(`
      SELECT 
        dp.product_type as productType,
        SUM(fcm.origination_amt) as totalOriginationAmount,
        AVG(fcm.default_rate) as averageDefaultRate
      FROM fact_credit_metrics_qtr fcm
      JOIN dim_product dp ON fcm.product_key = dp.product_key
      GROUP BY dp.product_type
    `);
    
    await connection.end();
    
    res.json({ data: rows });
    
  } catch (error) {
    console.error('❌ Error fetching product performance data:', error);
    res.status(500).json({ error: 'Failed to fetch product performance data' });
  }
});

// API endpoint to get geographic data
app.get('/cubejs-api/v1/geographic', async (req, res) => {
  try {
    console.log('🌍 Fetching geographic data from database...');
    const connection = await getConnection();
    
    const [rows] = await connection.execute(`
      SELECT 
        dg.country,
        SUM(fcm.origination_amt) as totalOriginationAmount,
        SUM(fcm.balance_amt) as totalBalanceAmount,
        AVG(fcm.default_rate) as averageDefaultRate
      FROM fact_credit_metrics_qtr fcm
      JOIN dim_geo dg ON fcm.geo_key = dg.geo_key
      GROUP BY dg.country
      ORDER BY totalOriginationAmount DESC
    `);
    
    await connection.end();
    
    res.json({ data: rows });
    
  } catch (error) {
    console.error('❌ Error fetching geographic data:', error);
    res.status(500).json({ error: 'Failed to fetch geographic data' });
  }
});

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    const connection = await getConnection();
    const [rows] = await connection.execute('SELECT COUNT(*) as count FROM fact_credit_metrics_qtr');
    await connection.end();
    
    res.json({ 
      status: 'healthy', 
      database: 'connected',
      recordCount: rows[0].count,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ 
      status: 'unhealthy', 
      database: 'disconnected',
      error: error.message 
    });
  }
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'Credit Card OLAP API Server - Real Database',
    version: '2.0.0',
    endpoints: {
      health: '/health',
      kpiMetrics: '/cubejs-api/v1/load',
      trends: '/cubejs-api/v1/trends',
      riskDistribution: '/cubejs-api/v1/risk-distribution',
      productPerformance: '/cubejs-api/v1/product-performance',
      geographic: '/cubejs-api/v1/geographic'
    }
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Real Database OLAP API server running on port ${PORT}`);
  console.log(`📊 API available at: http://localhost:${PORT}`);
  console.log(`🔗 Health check: http://localhost:${PORT}/health`);
  console.log(`📈 KPI endpoint: http://localhost:${PORT}/cubejs-api/v1/load`);
  console.log(`📊 Trends endpoint: http://localhost:${PORT}/cubejs-api/v1/trends`);
});
