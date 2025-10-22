# backend_api/routers/visuals.py
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text
from ..db import SessionLocal

router = APIRouter(prefix="/visuals", tags=["Visualizations"])

# Dependency for DB session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# === V1: Delinquency & Charge-off Trends (by Product) ===
@router.get("/delinquency_trend")
def delinquency_trend(db: Session = Depends(get_db)):
    """
    Returns product-level delinquency and derived charge-off rate (quarterly).
    Charge-off = delinquency rate lagged by 1 quarter within each product.
    """
    stmt = text("""
        WITH ranked AS (
            SELECT 
                dp.product_code,
                dq.year,
                dq.quarter,
                AVG(f.default_rate) AS delinquency,
                ROW_NUMBER() OVER (
                    PARTITION BY dp.product_code 
                    ORDER BY dq.year, dq.quarter
                ) AS rn
            FROM fact_credit_metrics_qtr f
            JOIN dim_date_qtr dq ON f.quarter_key = dq.quarter_key
            JOIN dim_product dp ON f.product_key = dp.product_key
            GROUP BY dp.product_code, dq.year, dq.quarter
        ),
        lagged AS (
            SELECT 
                product_code,
                year,
                quarter,
                delinquency,
                LAG(delinquency) OVER (
                    PARTITION BY product_code ORDER BY year, quarter
                ) AS chargeoff_rate
            FROM ranked
        )
        SELECT 
            product_code,
            year,
            quarter,
            delinquency,
            COALESCE(chargeoff_rate, 0) AS chargeoff_rate
        FROM lagged
        ORDER BY product_code, year, quarter;
    """)
    return [dict(r._mapping) for r in db.execute(stmt)]



@router.get("/prime_vs_delinquency")
def prime_vs_delinquency(db: Session = Depends(get_db)):
    stmt = text("""
        SELECT 
            dq.year, dq.quarter,
            AVG(f.prime_rate) AS prime_rate,
            AVG(f.default_rate) AS delinquency
        FROM fact_credit_metrics_qtr f
        JOIN dim_date_qtr dq ON f.quarter_key = dq.quarter_key
        GROUP BY dq.year, dq.quarter
        ORDER BY dq.year, dq.quarter;
    """)
    return [dict(r._mapping) for r in db.execute(stmt)]

@router.get("/lead_lag")
def lead_lag_analysis(db: Session = Depends(get_db), max_lag: int = 2):
    """
    Compute lead-lag correlation between macro delinquency (DRALACBN) and each product's delinquency.
    Tests if macro delinquency from prior quarters predicts current product delinquency.
    Returns product delinquency with macro delinquency from 0, 1, and 2 quarters ago.
    """
    stmt = text(f"""
        WITH product_delinq AS (
            SELECT dp.product_code, dq.year, dq.quarter,
                   AVG(f.default_rate) AS delinquency
            FROM fact_credit_metrics_qtr f
            JOIN dim_date_qtr dq ON f.quarter_key = dq.quarter_key
            JOIN dim_product dp ON f.product_key = dp.product_key
            GROUP BY dp.product_code, dq.year, dq.quarter
        ),
        macro_delinq AS (
            SELECT dq.year, dq.quarter,
                   AVG(f.default_rate) AS macro_delinquency
            FROM fact_credit_metrics_qtr f
            JOIN dim_date_qtr dq ON f.quarter_key = dq.quarter_key
            GROUP BY dq.year, dq.quarter
        ),
        joined AS (
            SELECT
                p.product_code,
                m.year,
                m.quarter,
                p.delinquency,
                m.macro_delinquency
            FROM product_delinq p
            JOIN macro_delinq m USING (year, quarter)
        )
        SELECT
            product_code,
            year,
            quarter,
            delinquency,
            macro_delinquency AS macro_lag_0,
            LAG(macro_delinquency, 1) OVER (PARTITION BY product_code ORDER BY year, quarter) AS macro_lag_1,
            LAG(macro_delinquency, 2) OVER (PARTITION BY product_code ORDER BY year, quarter) AS macro_lag_2
        FROM joined
        ORDER BY product_code, year, quarter;
    """)
    return [
        {
            "product_code": r.product_code,
            "year": r.year,
            "quarter": r.quarter,
            "delinquency": float(r.delinquency or 0),
            "macro_lag_0": float(r.macro_lag_0 or 0),
            "macro_lag_1": float(r.macro_lag_1 or 0) if r.macro_lag_1 is not None else None,
            "macro_lag_2": float(r.macro_lag_2 or 0) if r.macro_lag_2 is not None else None,
        }
        for r in db.execute(stmt)
    ]


@router.get("/event_ribbons")
def event_ribbons():
    """
    Returns known external events for overlay on KPI trends.
    """
    events = [
        {"name": "Pandemic Onset", "start": "2020Q2", "end": "2020Q2"},
        {"name": "Hiking Cycle", "start": "2022Q1", "end": "2023Q4"},
    ]
    return events