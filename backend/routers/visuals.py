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
    stmt = text("""
        SELECT 
            dp.product_code,
            dq.year,
            dq.quarter,
            AVG(f.default_rate) AS delinquency
        FROM fact_credit_metrics_qtr f
        JOIN dim_date_qtr dq ON f.quarter_key = dq.quarter_key
        JOIN dim_product dp ON f.product_key = dp.product_key
        GROUP BY dp.product_code, dq.year, dq.quarter
        ORDER BY dp.product_code, dq.year, dq.quarter;
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
    Returns delinquency values shifted by 0..max_lag quarters for lead analysis.
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
            macro_delinquency,
            LEAD(macro_delinquency, 1) OVER (PARTITION BY product_code ORDER BY year, quarter) AS lag_1,
            LEAD(macro_delinquency, 2) OVER (PARTITION BY product_code ORDER BY year, quarter) AS lag_2
        FROM joined
        ORDER BY product_code, year, quarter;
    """)
    return [
        {
            "product_code": r.product_code,
            "year": r.year,
            "quarter": r.quarter,
            "delinquency": float(r.delinquency or 0),
            "macro_delinquency": float(r.macro_delinquency or 0),
            "lag_1": float(r.lag_1 or 0),
            "lag_2": float(r.lag_2 or 0),
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