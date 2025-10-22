# backend_api/models.py
from sqlalchemy import Column, Integer, String, Numeric, Date, ForeignKey
from sqlalchemy.orm import declarative_base, relationship

Base = declarative_base()

class DimDateQtr(Base):
    __tablename__ = "dim_date_qtr"
    quarter_key = Column(Integer, primary_key=True)
    year = Column(Integer)
    quarter = Column(Integer)
    quarter_start = Column(Date)
    quarter_end = Column(Date)

class DimGeo(Base):
    __tablename__ = "dim_geo"
    geo_key = Column(Integer, primary_key=True)
    country = Column(String)
    state_province = Column(String)
    city = Column(String)

class DimProduct(Base):
    __tablename__ = "dim_product"
    product_key = Column(Integer, primary_key=True)
    product_code = Column(String)
    product_type = Column(String)
    segment = Column(String)

class FactCreditMetricsQtr(Base):
    __tablename__ = "fact_credit_metrics_qtr"
    quarter_key = Column(Integer, ForeignKey("dim_date_qtr.quarter_key"), primary_key=True)
    geo_key = Column(Integer, ForeignKey("dim_geo.geo_key"), primary_key=True)
    product_key = Column(Integer, ForeignKey("dim_product.product_key"), primary_key=True)
    originations_cnt = Column(Numeric)
    origination_amt = Column(Numeric)
    balance_amt = Column(Numeric)
    default_rate = Column(Numeric)
    prime_rate = Column(Numeric)
    lending_rate = Column(Numeric)
