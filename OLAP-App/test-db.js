import mysql from 'mysql2/promise';

async function testDatabase() {
  console.log('🔍 Testing database connection...');
  
  try {
    const connection = await mysql.createConnection({
      host: '127.0.0.1',
      port: 3306,
      user: 'dw',
      password: 'DwPass!123',
      database: 'gosales_dw'
    });

    console.log('✅ Database connection successful!');
    
    // Test if tables exist
    const [tables] = await connection.execute(`
      SELECT TABLE_NAME 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_SCHEMA = 'gosales_dw'
    `);
    
    console.log('📊 Available tables:');
    tables.forEach(table => {
      console.log(`  - ${table.TABLE_NAME}`);
    });
    
    // Check if our main tables exist
    const requiredTables = ['fact_credit_metrics_qtr', 'dim_date_qtr', 'dim_geo', 'dim_product'];
    const existingTables = tables.map(t => t.TABLE_NAME);
    
    console.log('\n🔍 Checking required tables:');
    requiredTables.forEach(table => {
      if (existingTables.includes(table)) {
        console.log(`  ✅ ${table}`);
      } else {
        console.log(`  ❌ ${table} - MISSING`);
      }
    });
    
    // Test data count
    try {
      const [count] = await connection.execute('SELECT COUNT(*) as count FROM fact_credit_metrics_qtr');
      console.log(`\n📈 Data records: ${count[0].count}`);
    } catch (err) {
      console.log('\n⚠️  Could not count records from fact_credit_metrics_qtr');
    }
    
    await connection.end();
    console.log('\n🎉 Database test completed successfully!');
    
  } catch (error) {
    console.error('❌ Database connection failed:');
    console.error(error.message);
    
    if (error.code === 'ECONNREFUSED') {
      console.log('\n💡 Troubleshooting:');
      console.log('  - Make sure MySQL is running');
      console.log('  - Check if port 3306 is accessible');
    } else if (error.code === 'ER_ACCESS_DENIED_ERROR') {
      console.log('\n💡 Troubleshooting:');
      console.log('  - Check username/password: dw / DwPass!123');
      console.log('  - Make sure user has access to gosales_dw database');
    } else if (error.code === 'ER_BAD_DB_ERROR') {
      console.log('\n💡 Troubleshooting:');
      console.log('  - Database "gosales_dw" does not exist');
      console.log('  - Run the SQL scripts in the ../sql directory first');
    }
  }
}

testDatabase();
