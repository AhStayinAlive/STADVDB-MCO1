# Credit Card OLAP Dashboard - Cube.js Migration

This project migrates the Power BI credit card analytics dashboard to a modern Cube.js + React stack, providing better performance, flexibility, and developer experience.

## 🚀 Features

- **Real-time Analytics**: Live data queries powered by Cube.js
- **Interactive Dashboards**: Modern React components with Recharts
- **OLAP Capabilities**: Multi-dimensional analysis with drill-down support
- **Performance Optimized**: Pre-aggregations and smart caching
- **Developer Friendly**: TypeScript, modern tooling, and hot reload

## 📊 Dashboard Components

### Executive Summary
- Total Origination Amount (with YoY growth)
- Total Balance Amount (with YoY growth)
- Average Default Rate
- Prime-Lending Spread

### Trend Analysis
- Quarterly Origination Trends
- Default Rate Trends over time
- Moving averages and seasonal patterns

### Risk Management
- Risk Distribution by Category
- Product Performance Analysis
- Risk vs Return Scatter Plot

### Geographic Analysis
- Origination Amount by Country/Region
- Top Markets by Volume

## 🛠️ Setup Instructions

### Prerequisites
- Node.js 16+ and npm
- MySQL database with the data warehouse schema
- Python environment with ETL scripts (for data loading)

### 1. Install Dependencies
```bash
cd OLAP-App
npm install
```

### 2. Database Configuration
Ensure your MySQL database is running with the `gosales_dw` schema:
```sql
-- Database should contain:
-- - dim_date_qtr
-- - dim_geo  
-- - dim_product
-- - fact_credit_metrics_qtr
```

### 3. Environment Setup
Create a `.env` file in the OLAP-App directory:
```env
# Cube.js Configuration
CUBEJS_DB_HOST=127.0.0.1
CUBEJS_DB_PORT=3306
CUBEJS_DB_NAME=gosales_dw
CUBEJS_DB_USER=dw
CUBEJS_DB_PASS=DwPass!123
CUBEJS_API_SECRET=your-secret-key-change-in-production

# Frontend Configuration
VITE_CUBEJS_API_URL=http://localhost:4000/cubejs-api/v1
```

### 4. Start Development Servers
```bash
# Start both Cube.js server and React app
npm run dev:full

# Or start individually:
npm run cube:dev    # Cube.js server on port 4000
npm run dev         # React app on port 5173
```

### 5. Access the Dashboard
- **React Dashboard**: http://localhost:5173
- **Cube.js API**: http://localhost:4000/cubejs-api/v1
- **Cube.js Dev Tools**: http://localhost:4000

## 📁 Project Structure

```
OLAP-App/
├── src/
│   ├── cube-dashboard.tsx    # Main dashboard component
│   ├── cube-client.ts        # Cube.js API client
│   ├── App.tsx              # App entry point
│   └── olap-dashboard.tsx   # Legacy dashboard (for reference)
├── schema/
│   ├── CreditMetrics.js     # Main fact table schema
│   ├── CreditMetricsCalculated.js  # Calculated measures
│   ├── DateDimension.js     # Date dimension
│   ├── GeographyDimension.js # Geography dimension
│   └── ProductDimension.js  # Product dimension
├── cube.js                  # Cube.js server entry point
├── cube.config.js          # Cube.js configuration
└── package.json            # Dependencies and scripts
```

## 🔧 Cube.js Schema

### Fact Table: CreditMetrics
- **Measures**: Origination amounts, balances, default rates, spreads
- **Dimensions**: Risk categories, performance indicators
- **Joins**: Links to date, geography, and product dimensions

### Calculated Measures
- Year-over-year growth rates
- Market share calculations
- Performance vs average metrics
- Volatility indices
- Portfolio health scores

### Pre-aggregations
- Quarterly summaries for faster queries
- Product and geography aggregations
- Time-based rollups

## 📈 Performance Features

### Caching
- In-memory caching for frequently accessed data
- Configurable cache refresh intervals
- Smart cache invalidation

### Pre-aggregations
- Pre-computed summaries for common queries
- Automatic refresh based on data changes
- Multiple granularity levels (quarter, year)

### Query Optimization
- Efficient SQL generation
- Index-aware query planning
- Connection pooling

## 🎨 Dashboard Features

### Interactive Components
- Real-time KPI cards with trend indicators
- Drill-down capabilities
- Cross-filtering between charts
- Responsive design for mobile/tablet

### Visualizations
- Line charts for trend analysis
- Pie charts for distribution analysis
- Scatter plots for risk-return analysis
- Area charts for cumulative metrics

### Filtering
- Date range selection
- Product type filtering
- Geographic filtering
- Risk category filtering

## 🔄 Migration from Power BI

### Key Differences
- **Power BI**: Desktop-based, DAX measures, Microsoft ecosystem
- **Cube.js**: API-first, JavaScript schemas, cloud-native

### Migrated Features
✅ KPI Cards with YoY growth  
✅ Trend analysis charts  
✅ Risk distribution analysis  
✅ Product performance metrics  
✅ Geographic analysis  
✅ Interactive filtering  
✅ Responsive design  

### New Capabilities
✅ Real-time data queries  
✅ Custom API endpoints  
✅ Programmatic access  
✅ Better performance scaling  
✅ Modern development workflow  

## 🚀 Deployment

### Production Build
```bash
npm run build
```

### Docker Deployment
```dockerfile
# Dockerfile example
FROM node:16-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 4000
CMD ["npm", "run", "cube"]
```

### Environment Variables
- Set production database credentials
- Configure API secrets
- Set up SSL certificates
- Configure CORS for production domains

## 📚 API Usage

### Example Query
```javascript
import { cubejsApi } from './src/cube-client';

const query = {
  measures: ['CreditMetrics.totalOriginationAmount'],
  dimensions: ['ProductDimension.productType'],
  timeDimensions: [{
    dimension: 'DateDimension.quarterStart',
    granularity: 'quarter'
  }]
};

const result = await cubejsApi.load(query);
```

### REST API
```bash
curl -X POST http://localhost:4000/cubejs-api/v1/load \
  -H "Content-Type: application/json" \
  -d '{"query": {"measures": ["CreditMetrics.totalOriginationAmount"]}}'
```

## 🔍 Troubleshooting

### Common Issues
1. **Database Connection**: Check MySQL credentials and network connectivity
2. **Schema Errors**: Verify table structure matches schema definitions
3. **Performance**: Enable pre-aggregations for large datasets
4. **CORS Issues**: Configure CORS settings in cube.config.js

### Debug Mode
```bash
# Enable debug logging
CUBEJS_DEV_MODE=true npm run cube
```

## 📞 Support

For issues or questions:
1. Check the Cube.js documentation: https://cube.dev/docs
2. Review the schema files for data model issues
3. Check browser console for frontend errors
4. Review server logs for backend issues

## 🔄 Next Steps

- [ ] Add user authentication
- [ ] Implement data export functionality
- [ ] Add more chart types and visualizations
- [ ] Set up automated testing
- [ ] Configure production monitoring
- [ ] Add real-time data streaming
