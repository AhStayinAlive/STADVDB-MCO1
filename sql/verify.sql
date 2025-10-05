USE gosales_dw;

SELECT COUNT(*) AS dim_date_cnt     FROM dim_date_qtr;
SELECT COUNT(*) AS dim_geo_cnt      FROM dim_geo;
SELECT COUNT(*) AS dim_product_cnt  FROM dim_product;
SELECT COUNT(*) AS fact_cnt         FROM fact_credit_metrics_qtr;

-- Trend check
SELECT dd.year, dd.quarter,
       SUM(f.origination_amt) AS orig_amt_usd,
       SUM(f.balance_amt)     AS balance_usd,
       AVG(f.default_rate)    AS default_rate
FROM fact_credit_metrics_qtr f
JOIN dim_date_qtr dd ON dd.quarter_key = f.quarter_key
GROUP BY dd.year, dd.quarter
ORDER BY dd.year, dd.quarter;
