-- Performance Optimization for OLAP and Power BI
-- Run these scripts to optimize your data warehouse for OLAP queries

USE gosales_dw;

-- 1. Create additional indexes for OLAP queries
-- These indexes will significantly improve Power BI query performance

-- Composite indexes for common OLAP query patterns
CREATE INDEX idx_fact_quarter_geo_product 
ON fact_credit_metrics_qtr(quarter_key, geo_key, product_key);

CREATE INDEX idx_fact_quarter_product_metrics 
ON fact_credit_metrics_qtr(quarter_key, product_key, originations_cnt, origination_amt, balance_amt);

-- Covering indexes for specific OLAP views
CREATE INDEX idx_olap_quarter_year 
ON dim_date_qtr(quarter_key, year, quarter, quarter_start, quarter_end);

CREATE INDEX idx_olap_geo_country 
ON dim_geo(geo_key, country, state_province, city);

CREATE INDEX idx_olap_product_type 
ON dim_product(product_key, product_type, product_code, segment);

-- 2. Create materialized views for common aggregations
-- These will cache frequently accessed aggregations

-- Monthly aggregations (if you have monthly data)
CREATE TABLE IF NOT EXISTS agg_credit_metrics_monthly (
    year INT,
    month INT,
    country VARCHAR(80),
    product_type VARCHAR(64),
    total_originations_cnt BIGINT,
    total_origination_amt DECIMAL(18,2),
    total_balance_amt DECIMAL(18,2),
    avg_default_rate DECIMAL(9,4),
    avg_prime_rate DECIMAL(9,4),
    avg_lending_rate DECIMAL(9,4),
    PRIMARY KEY (year, month, country, product_type),
    INDEX idx_agg_monthly_year (year),
    INDEX idx_agg_monthly_product (product_type)
) ENGINE=InnoDB;

-- Quarterly aggregations with additional metrics
CREATE TABLE IF NOT EXISTS agg_credit_metrics_quarterly (
    year INT,
    quarter INT,
    quarter_key INT,
    country VARCHAR(80),
    product_type VARCHAR(64),
    total_originations_cnt BIGINT,
    total_origination_amt DECIMAL(18,2),
    total_balance_amt DECIMAL(18,2),
    avg_default_rate DECIMAL(9,4),
    avg_prime_rate DECIMAL(9,4),
    avg_lending_rate DECIMAL(9,4),
    min_default_rate DECIMAL(9,4),
    max_default_rate DECIMAL(9,4),
    stddev_default_rate DECIMAL(9,4),
    PRIMARY KEY (quarter_key, country, product_type),
    INDEX idx_agg_quarterly_year (year),
    INDEX idx_agg_quarterly_product (product_type)
) ENGINE=InnoDB;

-- 3. Create stored procedures for maintaining aggregations
DELIMITER //

-- Procedure to refresh all aggregations
CREATE PROCEDURE RefreshAllAggregations()
BEGIN
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;
    
    START TRANSACTION;
    
    -- Refresh yearly aggregations
    CALL RefreshOLAPAggregations();
    
    -- Refresh quarterly aggregations
    TRUNCATE TABLE agg_credit_metrics_quarterly;
    
    INSERT INTO agg_credit_metrics_quarterly
    SELECT 
        d.year,
        d.quarter,
        d.quarter_key,
        g.country,
        p.product_type,
        SUM(f.originations_cnt) as total_originations_cnt,
        SUM(f.origination_amt) as total_origination_amt,
        SUM(f.balance_amt) as total_balance_amt,
        AVG(f.default_rate) as avg_default_rate,
        AVG(f.prime_rate) as avg_prime_rate,
        AVG(f.lending_rate) as avg_lending_rate,
        MIN(f.default_rate) as min_default_rate,
        MAX(f.default_rate) as max_default_rate,
        STDDEV(f.default_rate) as stddev_default_rate
    FROM fact_credit_metrics_qtr f
    JOIN dim_date_qtr d ON f.quarter_key = d.quarter_key
    JOIN dim_geo g ON f.geo_key = g.geo_key
    JOIN dim_product p ON f.product_key = p.product_key
    GROUP BY d.year, d.quarter, d.quarter_key, g.country, p.product_type;
    
    COMMIT;
    
    SELECT 'All aggregations refreshed successfully' as status;
END //

-- Procedure to analyze query performance
CREATE PROCEDURE AnalyzeQueryPerformance()
BEGIN
    -- Show index usage statistics
    SELECT 
        TABLE_NAME,
        INDEX_NAME,
        CARDINALITY,
        SUB_PART,
        PACKED,
        NULLABLE,
        INDEX_TYPE
    FROM INFORMATION_SCHEMA.STATISTICS 
    WHERE TABLE_SCHEMA = 'gosales_dw'
    ORDER BY TABLE_NAME, SEQ_IN_INDEX;
    
    -- Show table sizes
    SELECT 
        TABLE_NAME,
        ROUND(((DATA_LENGTH + INDEX_LENGTH) / 1024 / 1024), 2) AS 'Size (MB)',
        TABLE_ROWS
    FROM INFORMATION_SCHEMA.TABLES 
    WHERE TABLE_SCHEMA = 'gosales_dw'
    ORDER BY (DATA_LENGTH + INDEX_LENGTH) DESC;
    
    -- Show slow query log (if enabled)
    SHOW VARIABLES LIKE 'slow_query_log';
    SHOW VARIABLES LIKE 'long_query_time';
END //

DELIMITER ;

-- 4. Create views optimized for Power BI
-- These views are specifically designed for Power BI's query patterns

-- Optimized view for Power BI with pre-calculated measures
CREATE OR REPLACE VIEW v_powerbi_optimized AS
SELECT 
    -- Date dimensions
    d.quarter_key,
    d.year,
    d.quarter,
    d.quarter_start,
    d.quarter_end,
    CONCAT(d.year, ' Q', d.quarter) as quarter_label,
    YEAR(d.quarter_start) as fiscal_year,
    QUARTER(d.quarter_start) as fiscal_quarter,
    
    -- Geography dimensions
    g.geo_key,
    g.country,
    g.state_province,
    g.city,
    CONCAT_WS(', ', g.city, g.state_province, g.country) as full_address,
    
    -- Product dimensions
    p.product_key,
    p.product_code,
    p.product_type,
    p.segment,
    CONCAT_WS(' - ', p.product_type, p.segment) as product_description,
    
    -- Fact measures
    COALESCE(f.originations_cnt, 0) as originations_cnt,
    COALESCE(f.origination_amt, 0) as origination_amt,
    COALESCE(f.balance_amt, 0) as balance_amt,
    COALESCE(f.default_rate, 0) as default_rate,
    COALESCE(f.prime_rate, 0) as prime_rate,
    COALESCE(f.lending_rate, 0) as lending_rate,
    
    -- Pre-calculated measures for better performance
    CASE 
        WHEN f.originations_cnt > 0 
        THEN f.origination_amt / f.originations_cnt 
        ELSE 0 
    END as avg_origination_per_account,
    
    CASE 
        WHEN f.origination_amt > 0 
        THEN f.balance_amt / f.origination_amt 
        ELSE 0 
    END as balance_to_origination_ratio,
    
    f.prime_rate - f.lending_rate as prime_lending_spread,
    
    -- Risk categories
    CASE 
        WHEN f.default_rate > 0.05 THEN 'High Risk'
        WHEN f.default_rate > 0.02 THEN 'Medium Risk'
        WHEN f.default_rate > 0 THEN 'Low Risk'
        ELSE 'Unknown'
    END as risk_category,
    
    -- Time-based calculations
    ROW_NUMBER() OVER (ORDER BY d.year, d.quarter) as time_sequence,
    DATEDIFF(d.quarter_end, d.quarter_start) + 1 as days_in_quarter,
    
    -- Flags for filtering
    CASE WHEN d.year >= YEAR(CURDATE()) - 1 THEN 1 ELSE 0 END as is_recent,
    CASE WHEN d.quarter = 4 THEN 1 ELSE 0 END as is_q4,
    CASE WHEN d.quarter IN (1, 2) THEN 1 ELSE 0 END as is_h1

FROM fact_credit_metrics_qtr f
JOIN dim_date_qtr d ON f.quarter_key = d.quarter_key
JOIN dim_geo g ON f.geo_key = g.geo_key
JOIN dim_product p ON f.product_key = p.product_key;

-- 5. Create indexes on the optimized view (MySQL doesn't support indexes on views directly)
-- Instead, create indexes on the underlying tables that support the view

-- Additional indexes for Power BI query patterns
CREATE INDEX idx_fact_metrics_composite 
ON fact_credit_metrics_qtr(quarter_key, originations_cnt, origination_amt, balance_amt, default_rate);

CREATE INDEX idx_date_year_quarter 
ON dim_date_qtr(year, quarter, quarter_start, quarter_end);

-- 6. Create a procedure to monitor Power BI query performance
DELIMITER //

CREATE PROCEDURE MonitorPowerBIQueries()
BEGIN
    -- Show current connections
    SELECT 
        ID,
        USER,
        HOST,
        DB,
        COMMAND,
        TIME,
        STATE,
        INFO
    FROM INFORMATION_SCHEMA.PROCESSLIST 
    WHERE DB = 'gosales_dw'
    ORDER BY TIME DESC;
    
    -- Show table locks
    SHOW OPEN TABLES WHERE In_use > 0;
    
    -- Show index usage
    SELECT 
        OBJECT_SCHEMA,
        OBJECT_NAME,
        INDEX_NAME,
        COUNT_FETCH,
        COUNT_INSERT,
        COUNT_UPDATE,
        COUNT_DELETE
    FROM performance_schema.table_io_waits_summary_by_index_usage
    WHERE OBJECT_SCHEMA = 'gosales_dw'
    ORDER BY COUNT_FETCH DESC;
END //

DELIMITER ;

-- 7. Create a maintenance procedure for regular optimization
DELIMITER //

CREATE PROCEDURE OptimizeDataWarehouse()
BEGIN
    -- Analyze tables for better query planning
    ANALYZE TABLE fact_credit_metrics_qtr;
    ANALYZE TABLE dim_date_qtr;
    ANALYZE TABLE dim_geo;
    ANALYZE TABLE dim_product;
    
    -- Optimize tables to reclaim space
    OPTIMIZE TABLE fact_credit_metrics_qtr;
    OPTIMIZE TABLE dim_date_qtr;
    OPTIMIZE TABLE dim_geo;
    OPTIMIZE TABLE dim_product;
    
    -- Refresh aggregations
    CALL RefreshAllAggregations();
    
    SELECT 'Data warehouse optimization completed' as status;
END //

DELIMITER ;

-- 8. Create a procedure to generate Power BI connection string
DELIMITER //

CREATE PROCEDURE GetPowerBIConnectionInfo()
BEGIN
    SELECT 
        'Server' as Parameter,
        @@hostname as Value
    UNION ALL
    SELECT 
        'Port',
        @@port
    UNION ALL
    SELECT 
        'Database',
        DATABASE()
    UNION ALL
    SELECT 
        'Connection String',
        CONCAT(
            'Server=', @@hostname, 
            ';Port=', @@port, 
            ';Database=', DATABASE(), 
            ';Uid=dw;Pwd=DwPass!123;'
        );
END //

DELIMITER ;

-- 9. Create a procedure to validate data quality for OLAP
DELIMITER //

CREATE PROCEDURE ValidateOLAPDataQuality()
BEGIN
    -- Check for missing data
    SELECT 
        'Missing Data Check' as Check_Type,
        COUNT(*) as Issue_Count,
        'Rows with NULL quarter_key' as Description
    FROM fact_credit_metrics_qtr 
    WHERE quarter_key IS NULL
    
    UNION ALL
    
    SELECT 
        'Data Range Check',
        COUNT(*),
        'Rows with negative amounts'
    FROM fact_credit_metrics_qtr 
    WHERE origination_amt < 0 OR balance_amt < 0
    
    UNION ALL
    
    SELECT 
        'Data Range Check',
        COUNT(*),
        'Rows with invalid default rates'
    FROM fact_credit_metrics_qtr 
    WHERE default_rate < 0 OR default_rate > 1;
    
    -- Check data freshness
    SELECT 
        'Data Freshness' as Check_Type,
        MAX(d.quarter_end) as Latest_Data_Date,
        DATEDIFF(CURDATE(), MAX(d.quarter_end)) as Days_Old
    FROM fact_credit_metrics_qtr f
    JOIN dim_date_qtr d ON f.quarter_key = d.quarter_key;
END //

DELIMITER ;

-- 10. Create a procedure to generate sample Power BI queries for testing
DELIMITER //

CREATE PROCEDURE GeneratePowerBITestQueries()
BEGIN
    SELECT '-- Test Query 1: Basic OLAP Query' as Query_Type,
           'SELECT year, quarter, SUM(origination_amt) as total_amt FROM v_powerbi_optimized GROUP BY year, quarter ORDER BY year, quarter' as Query_Text
    
    UNION ALL
    
    SELECT '-- Test Query 2: Risk Analysis',
           'SELECT risk_category, COUNT(*) as account_count, AVG(default_rate) as avg_rate FROM v_powerbi_optimized GROUP BY risk_category'
    
    UNION ALL
    
    SELECT '-- Test Query 3: Product Performance',
           'SELECT product_type, SUM(origination_amt) as total_amt, AVG(default_rate) as avg_rate FROM v_powerbi_optimized GROUP BY product_type ORDER BY total_amt DESC'
    
    UNION ALL
    
    SELECT '-- Test Query 4: Time Series',
           'SELECT quarter_label, SUM(origination_amt) as total_amt FROM v_powerbi_optimized WHERE year >= 2020 GROUP BY quarter_label ORDER BY quarter_label';
END //

DELIMITER ;

-- 11. Create a procedure to set up automated maintenance (manual setup)
DELIMITER //

CREATE PROCEDURE SetupAutomatedMaintenance()
BEGIN
    -- Enable event scheduler
    SET GLOBAL event_scheduler = ON;
    
    SELECT 'Event scheduler enabled. Please create events manually:' as status;
    SELECT 'CREATE EVENT daily_optimization ON SCHEDULE EVERY 1 DAY DO CALL OptimizeDataWarehouse();' as daily_event;
    SELECT 'CREATE EVENT weekly_aggregation_refresh ON SCHEDULE EVERY 1 WEEK DO CALL RefreshAllAggregations();' as weekly_event;
END //

DELIMITER ;

-- 12. Final optimization recommendations
SELECT 
    'Optimization Complete' as Status,
    'Run CALL OptimizeDataWarehouse() weekly' as Recommendation_1,
    'Run CALL RefreshAllAggregations() after ETL' as Recommendation_2,
    'Monitor with CALL MonitorPowerBIQueries()' as Recommendation_3,
    'Use v_powerbi_optimized view in Power BI' as Recommendation_4;

