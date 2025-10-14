# Power BI Connection Setup for MCO Data Warehouse

## Prerequisites

1. **Power BI Desktop** (free download from Microsoft)
2. **MySQL Connector** for Power BI
3. **Database Access** to your MySQL data warehouse

## Step 1: Install MySQL Connector

1. Download MySQL Connector/NET from Oracle
2. Install the connector on your machine
3. Restart Power BI Desktop

## Step 2: Connect to MySQL Data Warehouse

### Connection Parameters
```
Server: 127.0.0.1 (or your MySQL host)
Port: 3306
Database: gosales_dw
Username: dw
Password: DwPass!123
```

### Connection Steps in Power BI Desktop

1. Open Power BI Desktop
2. Click "Get Data" → "Database" → "MySQL database"
3. Enter connection details:
   - **Server**: `127.0.0.1`
   - **Database**: `gosales_dw`
   - **Data Connectivity mode**: Import (recommended for OLAP)
4. Click "OK"
5. Enter credentials when prompted:
   - Username: `dw`
   - Password: `DwPass!123`
6. Click "Connect"

## Step 3: Select OLAP Views and Tables

### Primary Tables for OLAP Analysis

1. **v_olap_credit_metrics** - Main OLAP view with all dimensions and measures
2. **v_credit_metrics_yearly** - Yearly aggregations
3. **v_credit_metrics_trends** - Trend analysis with YoY calculations
4. **agg_credit_metrics_yearly** - Pre-aggregated yearly data

### Dimension Tables
- **dim_date_qtr** - Date dimension
- **dim_geo** - Geography dimension  
- **dim_product** - Product dimension

### Fact Table
- **fact_credit_metrics_qtr** - Base fact table

## Step 4: Data Model Configuration

### Relationships
Power BI will auto-detect relationships, but verify:
- `v_olap_credit_metrics.quarter_key` → `dim_date_qtr.quarter_key`
- `v_olap_credit_metrics.geo_key` → `dim_geo.geo_key`
- `v_olap_credit_metrics.product_key` → `dim_product.product_key`

### Data Types
Ensure proper data types:
- **Date fields**: Date/Time
- **Numeric measures**: Decimal Number
- **Text dimensions**: Text
- **Calculated measures**: Decimal Number

## Step 5: Performance Optimization

### Import Mode Settings
1. Go to "File" → "Options and settings" → "Data source settings"
2. Configure refresh settings for optimal performance
3. Set up scheduled refresh if using Power BI Service

### Query Optimization
- Use the OLAP views instead of base tables for better performance
- Consider incremental refresh for large datasets
- Use DirectQuery mode only if real-time data is critical

## Troubleshooting

### Common Issues
1. **Connection timeout**: Increase timeout in connection settings
2. **Authentication failed**: Verify credentials and user permissions
3. **Slow performance**: Use OLAP views and aggregations
4. **Missing data**: Check if ETL has run successfully

### Testing Connection
Run this query to test connectivity:
```sql
SELECT COUNT(*) as record_count FROM v_olap_credit_metrics;
```


