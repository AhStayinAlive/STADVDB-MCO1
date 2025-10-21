# backend_api/routers/kpi.py
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from ..db import SessionLocal
from ..models import FactCreditMetricsQtr, DimDateQtr
from sqlalchemy import func, select

router = APIRouter(prefix="/kpi", tags=["KPIs"])

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@router.get("/summary")
def get_kpi_summary(db: Session = Depends(get_db)):
    stmt = (
        select(
            DimDateQtr.year,
            func.sum(FactCreditMetricsQtr.origination_amt).label("total_origination"),
            func.sum(FactCreditMetricsQtr.balance_amt).label("total_balance"),
            func.avg(FactCreditMetricsQtr.default_rate).label("avg_default"),
            func.avg(FactCreditMetricsQtr.prime_rate).label("avg_prime"),
            func.avg(FactCreditMetricsQtr.lending_rate).label("avg_lending")
        )
        .join(DimDateQtr, FactCreditMetricsQtr.quarter_key == DimDateQtr.quarter_key)
        .group_by(DimDateQtr.year)
        .order_by(DimDateQtr.year)
    )
    results = db.execute(stmt).all()
    return [
        {
            "year": r.year,
            "total_origination": float(r.total_origination or 0),
            "total_balance": float(r.total_balance or 0),
            "avg_default": float(r.avg_default or 0),
            "avg_prime": float(r.avg_prime or 0),
            "avg_lending": float(r.avg_lending or 0),
        }
        for r in results
    ]
