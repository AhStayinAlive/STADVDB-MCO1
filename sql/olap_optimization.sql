-- OLAP Optimization for Power BI Integration
-- Run this after your main ETL to optimize for OLAP queries

USE gosales_dw;

-- 1. Create materialized views for common OLAP aggregations
-- These will significantly improve Power BI performance

-- Yearly aggregations
CREATE OR REPLACE VIEW v_credit_metrics_yearly AS
SELECT 
    d.year,
    g.country,
    p.product_type,
    p.segment,
    SUM(f.originations_cnt) as total_originations_cnt,
    SUM(f.origination_amt) as total_origination_amt,
    SUM(f.balance_amt) as total_balance_amt,
    AVG(f.default_rate) as avg_default_rate,
    AVG(f.prime_rate) as avg_prime_rate,
    AVG(f.lending_rate) as avg_lending_rate,
    COUNT(*) as quarter_count
FROM fact_credit_metrics_qtr f
JOIN dim_date_qtr d ON f.quarter_key = d.quarter_key
JOIN dim_geo g ON f.geo_key = g.geo_key
JOIN dim_product p ON f.product_key = p.product_key
GROUP BY d.year, g.country, p.product_type, p.segment;

-- Quarterly trends with year-over-year calculations
CREATE OR REPLACE VIEW v_credit_metrics_trends AS
SELECT 
    d.year,
    d.quarter,
    d.quarter_key,
    g.country,
    p.product_type,
    SUM(f.originations_cnt) as originations_cnt,
    SUM(f.origination_amt) as origination_amt,
    SUM(f.balance_amt) as balance_amt,
    AVG(f.default_rate) as default_rate,
    AVG(f.prime_rate) as prime_rate,
    AVG(f.lending_rate) as lending_rate,
    -- Year-over-year calculations
    LAG(SUM(f.originations_cnt), 4) OVER (
        PARTITION BY g.country, p.product_type 
        ORDER BY d.year, d.quarter
    ) as originations_cnt_prev_year,
    LAG(SUM(f.origination_amt), 4) OVER (
        PARTITION BY g.country, p.product_type 
        ORDER BY d.year, d.quarter
    ) as origination_amt_prev_year
FROM fact_credit_metrics_qtr f
JOIN dim_date_qtr d ON f.quarter_key = d.quarter_key
JOIN dim_geo g ON f.geo_key = g.geo_key
JOIN dim_product p ON f.product_key = p.product_key
GROUP BY d.year, d.quarter, d.quarter_key, g.country, p.product_type;

-- 2. Create indexes for better OLAP query performance
CREATE INDEX idx_fact_date_year ON fact_credit_metrics_qtr(quarter_key);
CREATE INDEX idx_fact_geo_country ON dim_geo(country);
CREATE INDEX idx_fact_product_type ON dim_product(product_type);

-- 3. Create a comprehensive OLAP view for Power BI
CREATE OR REPLACE VIEW v_olap_credit_metrics AS
SELECT 
    -- Date dimensions
    d.quarter_key,
    d.year,
    d.quarter,
    d.quarter_start,
    d.quarter_end,
    CONCAT(d.year, ' Q', d.quarter) as quarter_label,
    
    -- Geography dimensions
    g.geo_key,
    g.country,
    g.state_province,
    g.city,
    
    -- Product dimensions
    p.product_key,
    p.product_code,
    p.product_type,
    p.segment,
    
    -- Fact measures
    f.originations_cnt,
    f.origination_amt,
    f.balance_amt,
    f.default_rate,
    f.prime_rate,
    f.lending_rate,
    
    -- Calculated measures for OLAP
    CASE 
        WHEN f.originations_cnt > 0 
        THEN f.origination_amt / f.originations_cnt 
        ELSE NULL 
    END as avg_origination_per_account,
    
    CASE 
        WHEN f.origination_amt > 0 
        THEN f.balance_amt / f.origination_amt 
        ELSE NULL 
    END as balance_to_origination_ratio,
    
    -- Risk indicators
    CASE 
        WHEN f.default_rate > 0.05 THEN 'High Risk'
        WHEN f.default_rate > 0.02 THEN 'Medium Risk'
        WHEN f.default_rate > 0 THEN 'Low Risk'
        ELSE 'Unknown'
    END as risk_category,
    
    -- Rate spreads
    f.prime_rate - f.lending_rate as prime_lending_spread,
    
    -- Time-based calculations
    ROW_NUMBER() OVER (ORDER BY d.year, d.quarter) as time_sequence,
    DATEDIFF(d.quarter_end, d.quarter_start) + 1 as days_in_quarter

FROM fact_credit_metrics_qtr f
JOIN dim_date_qtr d ON f.quarter_key = d.quarter_key
JOIN dim_geo g ON f.geo_key = g.geo_key
JOIN dim_product p ON f.product_key = p.product_key;

-- 4. Create summary tables for faster Power BI refresh
CREATE TABLE IF NOT EXISTS agg_credit_metrics_yearly (
    year INT,
    country VARCHAR(80),
    product_type VARCHAR(64),
    total_originations_cnt BIGINT,
    total_origination_amt DECIMAL(18,2),
    total_balance_amt DECIMAL(18,2),
    avg_default_rate DECIMAL(9,4),
    avg_prime_rate DECIMAL(9,4),
    avg_lending_rate DECIMAL(9,4),
    PRIMARY KEY (year, country, product_type)
) ENGINE=InnoDB;

-- 5. Create stored procedure to refresh aggregations
DELIMITER //
CREATE PROCEDURE RefreshOLAPAggregations()
BEGIN
    -- Clear and refresh yearly aggregations
    TRUNCATE TABLE agg_credit_metrics_yearly;
    
    INSERT INTO agg_credit_metrics_yearly
    SELECT 
        d.year,
        g.country,
        p.product_type,
        SUM(f.originations_cnt) as total_originations_cnt,
        SUM(f.origination_amt) as total_origination_amt,
        SUM(f.balance_amt) as total_balance_amt,
        AVG(f.default_rate) as avg_default_rate,
        AVG(f.prime_rate) as avg_prime_rate,
        AVG(f.lending_rate) as avg_lending_rate
    FROM fact_credit_metrics_qtr f
    JOIN dim_date_qtr d ON f.quarter_key = d.quarter_key
    JOIN dim_geo g ON f.geo_key = g.geo_key
    JOIN dim_product p ON f.product_key = p.product_key
    GROUP BY d.year, g.country, p.product_type;
    
    SELECT 'OLAP aggregations refreshed successfully' as status;
END //
DELIMITER ;

