import CubejsServerCore from '@cubejs-backend/server-core';
import MySQLDriver from '@cubejs-backend/mysql-driver';
import config from './cube.config.js';

const serverCore = new CubejsServerCore({
  ...config,
  driverFactory: () => new MySQLDriver({
    host: process.env.CUBEJS_DB_HOST || '127.0.0.1',
    port: process.env.CUBEJS_DB_PORT || 3306,
    database: process.env.CUBEJS_DB_NAME || 'gosales_dw',
    user: process.env.CUBEJS_DB_USER || 'dw',
    password: process.env.CUBEJS_DB_PASS || 'DwPass!123',
  })
});

const PORT = process.env.PORT || 4000;

serverCore.initApp().then(app => {
  app.listen(PORT, () => {
    console.log(`🚀 Cube.js server is listening on port ${PORT}`);
    console.log(`📊 Dashboard available at: http://localhost:${PORT}`);
    console.log(`🔗 API endpoint: http://localhost:${PORT}/cubejs-api/v1`);
  });
}).catch(e => {
  console.error('Fatal error starting server:', e);
});
