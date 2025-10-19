import mysql from 'mysql2/promise';

const dbConfig = {
  host: '127.0.0.1',
  port: 3306,
  user: 'dw',
  password: 'DwPass!123',
  database: 'gosales_dw'
};

async function verifyData() {
  try {
    console.log('🔍 VERIFICATION: Showing actual data from your database...');
    const connection = await mysql.createConnection(dbConfig);
    
    console.log('\n1. 📊 RECORD COUNT VERIFICATION:');
    const [countRows] = await connection.execute('SELECT COUNT(*) as count FROM fact_credit_metrics_qtr');
    console.log(`   Total records: ${countRows[0].count}`);
    
    console.log('\n2. 💰 KPI VALUES FROM YOUR DATABASE:');
    const [kpiRows] = await connection.execute(`
      SELECT 
        SUM(originations_cnt) as totalOriginations,
        SUM(origination_amt) as totalOriginationAmount,
        SUM(balance_amt) as totalBalanceAmount,
        AVG(default_rate) as averageDefaultRate,
        AVG(prime_rate) as averagePrimeRate,
        AVG(lending_rate) as averageLendingRate
      FROM fact_credit_metrics_qtr
    `);
    const kpi = kpiRows[0];
    console.log(`   Total Originations: ${Number(kpi.totalOriginations).toLocaleString()}`);
    console.log(`   Total Origination Amount: $${Number(kpi.totalOriginationAmount).toLocaleString()}`);
    console.log(`   Total Balance Amount: $${Number(kpi.totalBalanceAmount).toLocaleString()}`);
    console.log(`   Average Default Rate: ${(kpi.averageDefaultRate * 100).toFixed(4)}%`);
    
    console.log('\n3. 📈 QUARTERLY DATA FROM YOUR DATABASE:');
    const [quarterRows] = await connection.execute(`
      SELECT 
        CONCAT(dd.year, ' Q', dd.quarter) as quarterLabel,
        SUM(fcm.origination_amt) as totalOriginationAmount,
        SUM(fcm.balance_amt) as totalBalanceAmount,
        AVG(fcm.default_rate) as averageDefaultRate
      FROM fact_credit_metrics_qtr fcm
      JOIN dim_date_qtr dd ON fcm.quarter_key = dd.quarter_key
      GROUP BY dd.quarter_key, dd.year, dd.quarter
      ORDER BY dd.quarter_key
      LIMIT 6
    `);
    
    quarterRows.forEach((row, index) => {
      console.log(`   ${row.quarterLabel}: $${Number(row.totalOriginationAmount).toLocaleString()} origination, ${(row.averageDefaultRate * 100).toFixed(2)}% default rate`);
    });
    
    console.log('\n4. 🏦 PRODUCT TYPES FROM YOUR DATABASE:');
    const [productRows] = await connection.execute(`
      SELECT 
        dp.product_type,
        COUNT(*) as recordCount,
        SUM(fcm.origination_amt) as totalOriginationAmount
      FROM fact_credit_metrics_qtr fcm
      JOIN dim_product dp ON fcm.product_key = dp.product_key
      GROUP BY dp.product_type
      ORDER BY totalOriginationAmount DESC
    `);
    
    productRows.forEach((row, index) => {
      console.log(`   ${row.product_type}: ${row.recordCount} records, $${Number(row.totalOriginationAmount).toLocaleString()}`);
    });
    
    console.log('\n5. 🌍 COUNTRIES FROM YOUR DATABASE:');
    const [geoRows] = await connection.execute(`
      SELECT 
        dg.country,
        COUNT(*) as recordCount,
        SUM(fcm.origination_amt) as totalOriginationAmount
      FROM fact_credit_metrics_qtr fcm
      JOIN dim_geo dg ON fcm.geo_key = dg.geo_key
      GROUP BY dg.country
      ORDER BY totalOriginationAmount DESC
    `);
    
    geoRows.forEach((row, index) => {
      console.log(`   ${row.country}: ${row.recordCount} records, $${Number(row.totalOriginationAmount).toLocaleString()}`);
    });
    
    console.log('\n6. 🎯 RISK DISTRIBUTION FROM YOUR DATABASE:');
    const [riskRows] = await connection.execute(`
      SELECT 
        CASE 
          WHEN fcm.default_rate > 0.05 THEN 'High Risk'
          WHEN fcm.default_rate BETWEEN 0.02 AND 0.05 THEN 'Medium Risk'
          WHEN fcm.default_rate < 0.02 THEN 'Low Risk'
          ELSE 'Unknown'
        END as riskCategory,
        COUNT(*) as recordCount,
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
    
    riskRows.forEach((row, index) => {
      console.log(`   ${row.riskCategory}: ${row.recordCount} records, ${Number(row.totalOriginations).toLocaleString()} total originations`);
    });
    
    console.log('\n✅ VERIFICATION COMPLETE: All data shown above is from your actual MySQL database!');
    
    await connection.end();
    
  } catch (error) {
    console.error('❌ Verification failed:', error.message);
  }
}

verifyData();
