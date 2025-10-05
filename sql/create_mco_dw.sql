-- Data Warehouse schema for MCO (MySQL)
-- Idempotent + self-healing for dim_product to match etl/etl_mco.py

-- 0) Schema
CREATE DATABASE IF NOT EXISTS gosales_dw
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_general_ci;

USE gosales_dw;

-- 1) Dimensions (create if missing)

CREATE TABLE IF NOT EXISTS dim_date_qtr (
  quarter_key   INT PRIMARY KEY,              -- e.g., 20123 = 2012 Q3
  year          SMALLINT NOT NULL,
  quarter       TINYINT  NOT NULL,
  quarter_start DATE     NOT NULL,
  quarter_end   DATE     NOT NULL,
  UNIQUE KEY uq_yq (year, quarter)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS dim_geo (
  geo_key        INT AUTO_INCREMENT PRIMARY KEY,
  country        VARCHAR(80),
  state_province VARCHAR(80),
  city           VARCHAR(120),
  UNIQUE KEY uq_geo (country, state_province, city)
) ENGINE=InnoDB;

-- If dim_product doesn't exist, create the minimal shape your ETL expects.
CREATE TABLE IF NOT EXISTS dim_product (
  product_key  INT AUTO_INCREMENT PRIMARY KEY,
  product_code VARCHAR(64),
  product_type VARCHAR(64),
  segment      VARCHAR(64),
  UNIQUE KEY uq_prod (product_code, product_type, segment)
) ENGINE=InnoDB;

-- 1a) SELF-HEAL an existing legacy dim_product (e.g., GO-Sales) to ensure required columns/index.
--     This block is safe to re-run.

-- Add product_code if missing
SET @col_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME='dim_product' AND COLUMN_NAME='product_code'
);
SET @sql := IF(@col_exists=0,
  'ALTER TABLE dim_product ADD COLUMN product_code VARCHAR(64) NULL',
  'DO 0'
);
PREPARE s1 FROM @sql; EXECUTE s1; DEALLOCATE PREPARE s1;

-- Add product_type if missing
SET @col_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME='dim_product' AND COLUMN_NAME='product_type'
);
SET @sql := IF(@col_exists=0,
  'ALTER TABLE dim_product ADD COLUMN product_type VARCHAR(64) NULL',
  'DO 0'
);
PREPARE s2 FROM @sql; EXECUTE s2; DEALLOCATE PREPARE s2;

-- Add segment if missing
SET @col_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME='dim_product' AND COLUMN_NAME='segment'
);
SET @sql := IF(@col_exists=0,
  'ALTER TABLE dim_product ADD COLUMN segment VARCHAR(64) NULL',
  'DO 0'
);
PREPARE s3 FROM @sql; EXECUTE s3; DEALLOCATE PREPARE s3;

-- Relax legacy NOT NULL product_number (if present) to avoid insert errors
SET @has_prodnum := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME='dim_product' AND COLUMN_NAME='product_number' AND IS_NULLABLE='NO'
);
SET @sql := IF(@has_prodnum=1,
  'ALTER TABLE dim_product MODIFY product_number INT NULL DEFAULT NULL',
  'DO 0'
);
PREPARE s4 FROM @sql; EXECUTE s4; DEALLOCATE PREPARE s4;

-- Ensure the composite unique key exists on (product_code, product_type, segment)
SET @idx_exists := (
  SELECT COUNT(*) FROM information_schema.statistics
  WHERE table_schema = DATABASE() AND table_name='dim_product' AND index_name='uq_prod'
);
SET @sql := IF(@idx_exists=0,
  'ALTER TABLE dim_product ADD UNIQUE KEY uq_prod (product_code, product_type, segment)',
  'DO 0'
);
PREPARE s5 FROM @sql; EXECUTE s5; DEALLOCATE PREPARE s5;

-- 2) Fact (create if missing)

CREATE TABLE IF NOT EXISTS fact_credit_metrics_qtr (
  quarter_key INT NOT NULL,
  geo_key     INT NOT NULL,
  product_key INT NOT NULL,

  originations_cnt BIGINT        NULL,          -- count of new accounts
  origination_amt  DECIMAL(18,2) NULL,          -- dollars
  balance_amt      DECIMAL(18,2) NULL,          -- dollars
  default_rate     DECIMAL(9,4)  NULL,          -- fraction (0..1)
  prime_rate       DECIMAL(9,4)  NULL,          -- fraction
  lending_rate     DECIMAL(9,4)  NULL,          -- fraction

  PRIMARY KEY (quarter_key, geo_key, product_key),
  CONSTRAINT fk_dd  FOREIGN KEY (quarter_key) REFERENCES dim_date_qtr (quarter_key),
  CONSTRAINT fk_geo FOREIGN KEY (geo_key)     REFERENCES dim_geo (geo_key),
  CONSTRAINT fk_prd FOREIGN KEY (product_key) REFERENCES dim_product (product_key),
  INDEX idx_q  (quarter_key),
  INDEX idx_g  (geo_key),
  INDEX idx_p  (product_key)
) ENGINE=InnoDB;

-- 3) (Optional) quick sanity checks
-- SHOW TABLES;
-- SELECT COUNT(*) AS c FROM dim_date_qtr;
-- SELECT COUNT(*) AS c FROM dim_geo;
-- SELECT COUNT(*) AS c FROM dim_product;
-- SELECT COUNT(*) AS c FROM fact_credit_metrics_qtr;
