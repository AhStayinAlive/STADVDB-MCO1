import CubejsServerCore from '@cubejs-backend/server-core';
import { createConnection } from 'mysql2/promise';

// Custom MySQL driver using mysql2 for better compatibility
class MySQL2Driver {
  constructor(config) {
    this.config = config;
  }

  async query(query, values) {
    const connection = await createConnection({
      host: this.config.host,
      port: this.config.port,
      database: this.config.database,
      user: this.config.user,
      password: this.config.password,
    });
    
    try {
      const [rows] = await connection.execute(query, values);
      return rows;
    } finally {
      await connection.end();
    }
  }

  async testConnection() {
    const connection = await createConnection({
      host: this.config.host,
      port: this.config.port,
      database: this.config.database,
      user: this.config.user,
      password: this.config.password,
    });
    await connection.end();
  }
}

const serverCore = new CubejsServerCore({
  dbType: 'mysql',
  driverFactory: () => new MySQL2Driver({
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
    console.log(`🚀 Cube.js OLAP server is listening on port ${PORT}`);
    console.log(`📊 Dashboard available at: http://localhost:${PORT}`);
    console.log(`🔗 API endpoint: http://localhost:${PORT}/cubejs-api/v1`);
    console.log(`📈 Meta endpoint: http://localhost:${PORT}/cubejs-api/v1/meta`);
    console.log(`🔍 Load endpoint: http://localhost:${PORT}/cubejs-api/v1/load`);
    console.log(`\n🎯 OLAP Features Enabled:`);
    console.log(`   ✅ Multi-dimensional analysis`);
    console.log(`   ✅ Drill-down capabilities`);
    console.log(`   ✅ Pre-aggregations`);
    console.log(`   ✅ Time intelligence`);
    console.log(`   ✅ Calculated measures`);
  });
}).catch(e => {
  console.error('Fatal error starting Cube.js server:', e);
});
