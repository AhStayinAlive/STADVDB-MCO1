# db_check_counts.py
from sqlalchemy import create_engine, text
import os

# prefer ENGINE_URL env var (same used by ETL); fallback to typical local MySQL
ENGINE_URL = os.environ.get("ENGINE_URL", "mysql+pymysql://dw:DwPass!123@127.0.0.1:3306/gosales_dw")

print("Using ENGINE_URL:", ENGINE_URL)

eng = create_engine(ENGINE_URL, future=True)

tables = ["dim_date_qtr", "dim_geo", "dim_product", "fact_credit_metrics_qtr"]

with eng.begin() as cx:
    for t in tables:
        try:
            cnt = int(cx.execute(text(f"SELECT COUNT(*) FROM {t}")).scalar_one())
        except Exception as e:
            cnt = f"ERROR: {e}"
        print(f"{t:30} {cnt}")