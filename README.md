STADVDB • Credit Card DW/ETL (MCO)

A small star-schema data warehouse that loads quarterly U.S. credit-card metrics (originations, balances) and macro rates (prime, lending).
Tech: MySQL, Python (pandas/SQLAlchemy).

1) Repository layout
mco/
├─ etl/
│  └─ etl_mco.py                # main ETL script (supports --recreate, --debug)
├─ sql/
│  ├─ 01_init_dw.sql            # creates DB + dims/facts + indexes + view
│  └─ 99_checks.sql             # integrity & QA queries
├─ source_raw/                  # drop source files here (see list below)
├─ .env                         # MySQL connection (not committed)
└─ README.md

2) Data sources (drop into source_raw/)

Required now:

25Q1-CreditCardOrigination.csv (Philadelphia Fed)

25Q1-CreditCardBalances.csv (Philadelphia Fed)

API_FR.INR.LEND_DS2_en_xml_v2_1223050.xml (World Bank — lending interest rate, annual)

DPRIME.xlsx (FRED Bank Prime Loan Rate – use the “Daily” export; any sheet name; we autodetect)

Optional / for future default-rate work:

DRALACBN.xlsx (FRED Delinquency Rate – quarterly) or

Loan_Default.csv (your synthetic/student dataset with columns year, status)

If your prime comes back empty, it’s usually because the Excel is only the “README” tab. Re-download from FRED and choose XLSX and make sure the file contains a sheet with date/value rows.

3) Prerequisites

Python 3.10+ (Windows works fine)

MySQL 8.x (local or remote)

Create a MySQL user with DDL/DML on your DW database

CREATE DATABASE IF NOT EXISTS gosales_dw CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
CREATE USER IF NOT EXISTS 'dw'@'%' IDENTIFIED BY 'DwPass!123';
GRANT ALL ON gosales_dw.* TO 'dw'@'%';
FLUSH PRIVILEGES;

Python env
python -m venv .venv
. .\.venv\Scripts\Activate.ps1
pip install -U pip
pip install pandas numpy SQLAlchemy PyMySQL python-dotenv lxml openpyxl

.env (put in repo root)
MYSQL_HOST=127.0.0.1
MYSQL_PORT=3306
MYSQL_USER=dw
MYSQL_PASS=DwPass!123
MYSQL_DB=gosales_dw

4) Initialize the warehouse (one-time)

Run the schema:

mysql -h 127.0.0.1 -u dw -p gosales_dw < .\sql\01_init_dw.sql


What it creates:

dim_date_qtr (quarter_key PK; year, quarter, quarter_start, quarter_end)

dim_geo (geo_key PK; country, state_province, city)

dim_product (product_key PK; product_code, product_type, segment, uq_prod unique)

fact_credit_metrics_qtr
Keys: quarter_key, geo_key, product_key (unique grain)
Measures: originations_cnt, origination_amt, balance_amt, default_rate, prime_rate, lending_rate

vw_credit_quarterly convenience view (dim joins)

We keep the legacy GO-Sales columns that already exist in dim_product but we only use: product_code, product_type, segment.

5) Run the ETL
# first load (also clears fact)
python .\etl\etl_mco.py --recreate

# with verbose instrumentation
python .\etl\etl_mco.py --recreate --debug


Expected console summary (current datasets):

ETL completed ✓
{'dim_date_cnt': 51, 'dim_geo_cnt': 1, 'dim_product_cnt': 275, 'fact_cnt': 51}


Date range loaded: 2012 Q3 → 2025 Q1 (51 quarters)

Prime and Default may be NULL if those source files aren’t in the expected formats (see Troubleshooting).

6) Verify the load (quick QA)

Open MySQL Workbench (or run in CLI):

-- Row counts
SELECT COUNT(*) AS dim_date_cnt   FROM dim_date_qtr;
SELECT COUNT(*) AS dim_geo_cnt    FROM dim_geo;
SELECT COUNT(*) AS dim_product_cnt FROM dim_product;
SELECT COUNT(*) AS fact_cnt       FROM fact_credit_metrics_qtr;

-- Key integrity
SELECT COUNT(*) AS date_fk_misses
FROM fact_credit_metrics_qtr f
LEFT JOIN dim_date_qtr d USING (quarter_key)
WHERE d.quarter_key IS NULL;

SELECT COUNT(*) AS geo_fk_misses
FROM fact_credit_metrics_qtr f
LEFT JOIN dim_geo g USING (geo_key)
WHERE g.geo_key IS NULL;

SELECT COUNT(*) AS prod_fk_misses
FROM fact_credit_metrics_qtr f
LEFT JOIN dim_product p USING (product_key)
WHERE p.product_key IS NULL;

-- Grain uniqueness (should return 0 rows)
SELECT quarter_key, geo_key, product_key, COUNT(*) c
FROM fact_credit_metrics_qtr
GROUP BY 1,2,3
HAVING c>1;

-- Null checks on rates
SELECT
  SUM(default_rate IS NOT NULL) AS has_default,
  SUM(prime_rate   IS NOT NULL) AS has_prime,
  SUM(lending_rate IS NOT NULL) AS has_lending,
  COUNT(*) AS total_rows
FROM fact_credit_metrics_qtr;

-- Business sanity (roll-up by year)
SELECT d.year,
       SUM(originations_cnt) AS originations_cnt,
       SUM(origination_amt)  AS orig_amt,
       SUM(balance_amt)      AS balance_amt
FROM fact_credit_metrics_qtr f
JOIN dim_date_qtr d USING (quarter_key)
GROUP BY d.year
ORDER BY d.year;


Quick view:

SELECT * FROM vw_credit_quarterly ORDER BY year, quarter;

7) What’s working now

End-to-end pipeline loads originations, balances, and lending_rate (from World Bank XML).

Prime rate loader reads DPRIME.xlsx (FRED, daily) and averages by calendar quarter.

Warehouse schema, unique grain, and indexes are in place.

Debug logging (--debug) prints data-source presence, shapes, non-null counts, and a sample head.

8) Common issues & fixes

Prime rate is all NULL

The wrong XLSX was downloaded (README-only tab). Re-download DPRIME as XLSX and ensure it contains a sheet with date/value rows (we autodetect the date column). Put it at source_raw/DPRIME.xlsx. Re-run ETL.

Default rate is NULL

We haven’t locked one source yet. Two options your team can finish:

FRED DRALACBN.xlsx (quarterly delinquency). Add an extractor similar to prime, merge on (year, quarter), map to default_rate.

Loan_Default.csv (student dataset). Provide year and status (1=default) and we compute yearly default_rate (already coded; just ensure the file exists and headers match).

Lending rate missing

Make sure the WB XML is the full export (file in source_raw/ with <record><field name="Country or Area">United States</field>... entries). We parse only “United States”.

Schema mismatches / legacy columns

dim_product may have many GO-Sales columns; they’re harmless. We only need (product_code, product_type, segment).