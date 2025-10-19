import mysql from 'mysql2/promise';

const dbConfig = {
  host: '127.0.0.1',
  port: 3306,
  user: 'dw',
  password: 'DwPass!123',
  database: 'gosales_dw'
};

async function testConnection() {
  try {
    console.log('🔍 Testing database connection...');
    const connection = await mysql.createConnection(dbConfig);
    
    console.log('✅ Connected to database successfully!');
    
    // Test query to get record count
    const [rows] = await connection.execute('SELECT COUNT(*) as count FROM fact_credit_metrics_qtr');
    console.log(`📊 Total records in fact_credit_metrics_qtr: ${rows[0].count}`);
    
    // Test KPI query
    const [kpiRows] = await connection.execute(`
      SELECT 
        SUM(originations_cnt) as totalOriginations,
        SUM(origination_amt) as totalOriginationAmount,
        SUM(balance_amt) as totalBalanceAmount,
        AVG(default_rate) as averageDefaultRate
      FROM fact_credit_metrics_qtr
    `);
    
    console.log('📈 Sample KPI data:');
    console.log(JSON.stringify(kpiRows[0], null, 2));
    
    // Test trend query
    const [trendRows] = await connection.execute(`
      SELECT 
        dd.quarter_label as quarterLabel,
        SUM(fcm.origination_amt) as totalOriginationAmount,
        SUM(fcm.balance_amt) as totalBalanceAmount,
        AVG(fcm.default_rate) as averageDefaultRate
      FROM fact_credit_metrics_qtr fcm
      JOIN dim_date_qtr dd ON fcm.quarter_key = dd.quarter_key
      GROUP BY dd.quarter_key, dd.quarter_label
      ORDER BY dd.quarter_key
      LIMIT 5
    `);
    
    console.log('📊 Sample trend data:');
    console.log(JSON.stringify(trendRows, null, 2));
    
    await connection.end();
    console.log('✅ Database test completed successfully!');
    
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    console.error('Full error:', error);
  }
}

testConnection();
