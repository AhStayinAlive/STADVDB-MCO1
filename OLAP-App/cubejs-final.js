import CubejsServerCore from '@cubejs-backend/server-core';
import MySQLDriver from '@cubejs-backend/mysql-driver';

const serverCore = new CubejsServerCore({
  dbType: 'mysql',
  driverFactory: ({ securityContext }) => new MySQLDriver({
    host: process.env.CUBEJS_DB_HOST || '127.0.0.1',
    port: process.env.CUBEJS_DB_PORT || 3306,
    database: process.env.CUBEJS_DB_NAME || 'gosales_dw',
    user: process.env.CUBEJS_DB_USER || 'dw',
    password: process.env.CUBEJS_DB_PASS || 'DwPass!123',
  }),
  apiSecret: process.env.CUBEJS_API_SECRET || 'your-secret-key-change-in-production',
  schemaPath: 'schema',
  devServer: true,
  telemetry: false
});

const PORT = process.env.PORT || 4000;

serverCore.initApp().then(app => {
  app.listen(PORT, () => {
    console.log(`🚀 Cube.js OLAP Server running on port ${PORT}`);
    console.log(`📊 API endpoint: http://localhost:${PORT}/cubejs-api/v1`);
    console.log(`🔗 Meta endpoint: http://localhost:${PORT}/cubejs-api/v1/meta`);
    console.log(`📈 Load endpoint: http://localhost:${PORT}/cubejs-api/v1/load`);
    console.log(`\n🎯 OLAP Features Available:`);
    console.log(`   ✅ Multi-dimensional analysis`);
    console.log(`   ✅ Drill-down capabilities`);
    console.log(`   ✅ Time intelligence`);
    console.log(`   ✅ Calculated measures`);
    console.log(`   ✅ Pre-aggregations`);
    console.log(`\n📊 Available Cubes:`);
    console.log(`   • CreditMetrics - Main fact table`);
    console.log(`   • DateDimension - Time analysis`);
    console.log(`   • GeographyDimension - Location analysis`);
    console.log(`   • ProductDimension - Product analysis`);
    console.log(`   • CreditMetricsCalculated - Business logic`);
  });
}).catch(e => {
  console.error('Fatal error starting Cube.js server:', e);
  process.exit(1);
});
