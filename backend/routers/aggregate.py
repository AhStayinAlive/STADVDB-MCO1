# backend_api/routers/aggregate.py
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from ..db import SessionLocal
from ..models import FactCreditMetricsQtr, DimDateQtr
from sqlalchemy import func, select

router = APIRouter(prefix="/aggregate", tags=["OLAP"])

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

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
