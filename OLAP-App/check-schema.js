import mysql from 'mysql2/promise';

const dbConfig = {
  host: '127.0.0.1',
  port: 3306,
  user: 'dw',
  password: 'DwPass!123',
  database: 'gosales_dw'
};

async function checkSchema() {
  try {
    const connection = await mysql.createConnection(dbConfig);
    
    console.log('🔍 Checking table schemas...');
    
    // Check dim_date_qtr structure
    console.log('\n📅 dim_date_qtr columns:');
    const [dateCols] = await connection.execute('DESCRIBE dim_date_qtr');
    console.log(dateCols.map(col => `${col.Field} (${col.Type})`).join('\n'));
    
    // Check fact_credit_metrics_qtr structure
    console.log('\n📊 fact_credit_metrics_qtr columns:');
    const [factCols] = await connection.execute('DESCRIBE fact_credit_metrics_qtr');
    console.log(factCols.map(col => `${col.Field} (${col.Type})`).join('\n'));
    
    // Check dim_product structure
    console.log('\n🏦 dim_product columns:');
    const [productCols] = await connection.execute('DESCRIBE dim_product');
    console.log(productCols.map(col => `${col.Field} (${col.Type})`).join('\n'));
    
    // Check dim_geo structure
    console.log('\n🌍 dim_geo columns:');
    const [geoCols] = await connection.execute('DESCRIBE dim_geo');
    console.log(geoCols.map(col => `${col.Field} (${col.Type})`).join('\n'));
    
    // Sample data from each table
    console.log('\n📊 Sample data from dim_date_qtr:');
    const [dateSample] = await connection.execute('SELECT * FROM dim_date_qtr LIMIT 3');
    console.log(JSON.stringify(dateSample, null, 2));
    
    console.log('\n📊 Sample data from fact_credit_metrics_qtr:');
    const [factSample] = await connection.execute('SELECT * FROM fact_credit_metrics_qtr LIMIT 3');
    console.log(JSON.stringify(factSample, null, 2));
    
    await connection.end();
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkSchema();
