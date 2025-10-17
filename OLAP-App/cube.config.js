export default {
  // API configuration
  apiSecret: process.env.CUBEJS_API_SECRET || 'your-secret-key-change-in-production',
  
  // Schema configuration
  schemaPath: 'schema',
  
  // Development settings
  devServer: true,
  telemetry: false,
  
  // Cache configuration
  cacheAndQueueDriver: 'memory',
  
  // Pre-aggregations configuration
  preAggregationsSchema: 'pre_aggregations',
  
  // Logging
  logger: (msg, params) => {
    console.log(`${new Date().toISOString()}: ${msg}`, params);
  }
};
