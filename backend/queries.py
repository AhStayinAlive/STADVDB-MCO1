import pandas as pd
from sqlalchemy import text
from .db import engine

def get_portfolio_kpi():
    sql = """
    SELECT d.year, d.quarter,
           ROUND(SUM(f.origination_amt)/1e9, 2) AS orig_amt_bil,
           ROUND(SUM(f.balance_amt)/1e9, 2) AS bal_amt_bil,
           ROUND(AVG(f.default_rate)*100, 2) AS default_rate_pct,
           ROUND(AVG(f.prime_rate), 2) AS prime_rate
    FROM fact_credit_metrics_qtr f
    JOIN dim_date_qtr d ON f.quarter_key = d.quarter_key
    GROUP BY d.year, d.quarter
    ORDER BY d.year, d.quarter;
    """
    with engine.connect() as cx:
        df = pd.read_sql(sql, cx)
    return df
