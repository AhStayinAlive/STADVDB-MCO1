# backend_api/routers/aggregate.py
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func, select, text
from ..db import SessionLocal
from ..models import FactCreditMetricsQtr, DimDateQtr

router = APIRouter(prefix="/aggregate", tags=["OLAP"])

# Dependency for DB session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# === R0: Quarterly metrics summary ===
@router.get("/quarterly")
def get_quarterly_metrics(db: Session = Depends(get_db)):
    stmt = (
        select(
            DimDateQtr.year,
            DimDateQtr.quarter,
            func.sum(FactCreditMetricsQtr.balance_amt).label("balance_total"),
            func.avg(FactCreditMetricsQtr.default_rate).label("avg_default"),
        )
        .join(DimDateQtr, FactCreditMetricsQtr.quarter_key == DimDateQtr.quarter_key)
        .group_by(DimDateQtr.year, DimDateQtr.quarter)
        .order_by(DimDateQtr.year, DimDateQtr.quarter)
    )
    results = db.execute(stmt).all()
    return [
        {
            "year": r.year,
            "quarter": r.quarter,
            "balance_total": float(r.balance_total or 0),
            "avg_default": float(r.avg_default or 0),
        }
        for r in results
    ]


# === R1: Portfolio KPI Snapshot (by Product × Quarter) ===
@router.get("/portfolio_snapshot")
def portfolio_snapshot(db: Session = Depends(get_db)):
    stmt = text("""
        SELECT 
            dp.product_code,
            dq.year,
            dq.quarter,
            SUM(f.balance_amt) AS balance,
            SUM(f.origination_amt) AS originations,
            AVG(f.default_rate) AS delinquency
        FROM fact_credit_metrics_qtr f
        JOIN dim_date_qtr dq ON f.quarter_key = dq.quarter_key
        JOIN dim_product dp ON f.product_key = dp.product_key
        GROUP BY ROLLUP (dp.product_code, dq.year, dq.quarter)
        ORDER BY dp.product_code NULLS LAST, dq.year NULLS LAST, dq.quarter NULLS LAST;
    """)
    result = db.execute(stmt).fetchall()
    return [dict(r._mapping) for r in result]