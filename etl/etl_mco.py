# etl/etl_mco.py
# ------------------------------------------------------------
# DW / ETL for MCO proposal (MySQL)
# ------------------------------------------------------------

from __future__ import annotations
import os, re
from pathlib import Path
from typing import Dict, List, Optional
from datetime import date
from xml.etree import ElementTree as ET

import numpy as np
import pandas as pd
from sqlalchemy import create_engine, text

# ---------- config / locations ----------

ROOT = Path(__file__).resolve().parents[1]
RAW  = ROOT / "source_raw"

FILE_ORIG   = RAW / "25Q1-CreditCardOrigination.csv"
FILE_BAL    = RAW / "25Q1-CreditCardBalances.csv"
FILE_DEF    = RAW / "Loan_Default.csv"  # fallback yearly default file (optional)
FILE_PRIME  = RAW / "DPRIME.xlsx"       # FRED prime rate (xlsx download)
# DRALACBN may be CSV or XLSX; we’ll detect either
FILE_DFLT_Q = RAW / "DRALACBN.csv"
FILE_DFLT_Q_XLSX = RAW / "DRALACBN.xlsx"

FILE_XML    = RAW / "API_FR.INR.LEND_DS2_en_xml_v2_1223050.xml"  # World Bank lending XML

MYSQL_HOST = os.getenv("MYSQL_HOST", "127.0.0.1")
MYSQL_PORT = int(os.getenv("MYSQL_PORT", "3306"))
MYSQL_USER = os.getenv("MYSQL_USER", "dw")
MYSQL_PASS = os.getenv("MYSQL_PASS", "DwPass!123")
MYSQL_DB   = os.getenv("MYSQL_DB",   "gosales_dw")

ENGINE_URL = f"mysql+pymysql://{MYSQL_USER}:{MYSQL_PASS}@{MYSQL_HOST}:{MYSQL_PORT}/{MYSQL_DB}"

# ---------- helpers: parsing & cleaning ----------

def _strip_money_commas_perc(s: pd.Series) -> pd.Series:
    return (
        s.astype(str)
         .str.replace(r"[\$,]", "", regex=True)
         .str.replace("%", "", regex=False)
         .replace({"null": np.nan, "None": np.nan, "": np.nan, ".": np.nan})
    )

def to_float(s: pd.Series) -> pd.Series:
    return pd.to_numeric(_strip_money_commas_perc(s), errors="coerce")

def billions_to_amount(s: pd.Series) -> pd.Series:
    return to_float(s) * 1_000_000_000

def millions_to_count(s: pd.Series) -> pd.Series:
    return to_float(s) * 1_000_000

# --- Quarter parsing + augmentation helpers ---

_QUARTER_TOKEN_RE = re.compile(r"^(?:\d{4}\s*Q[1-4]|Q[1-4]\s*\d{4})$")

def _normalize_quarter_token(s: str) -> str:
    if s is None:
        return ""
    t = str(s).strip().upper().replace("\ufeff", "")
    t = re.sub(r"\s+", " ", t)
    if not _QUARTER_TOKEN_RE.match(t):
        return ""
    if t.startswith("Q"):  # 'Q3 2012' -> '2012Q3'
        q, y = t.split(" ")
        return f"{y}{q}"
    return t.replace(" ", "")  # '2012 Q3' -> '2012Q3'

def parse_quarter_to_yq(qstr: str) -> dict:
    token = _normalize_quarter_token(qstr)
    if not token or "Q" not in token:
        raise ValueError(f"Unrecognized quarter format: {qstr}")

    year = int(token[:4])
    q    = int(token[-1])
    start_month = (q - 1) * 3 + 1
    end_month   = q * 3
    q_start = date(year, start_month, 1)
    q_end   = pd.Period(f"{year}-{end_month:02d}").end_time.date()
    q_key   = int(f"{year}{q}")  # 2012Q3 -> 20123

    return {
        "year": year,
        "quarter_num": q,
        "quarter_start": q_start,
        "quarter_end": q_end,
        "quarter_key": q_key,
    }

def add_year_quarter(df: pd.DataFrame) -> pd.DataFrame:
    if "quarter" not in df.columns:
        for c in df.columns:
            if str(c).strip().upper() in {"YRQTR", "QUARTER"}:
                df = df.rename(columns={c: "quarter"})
                break
    if "quarter" not in df.columns:
        raise KeyError("No 'quarter' column to parse.")

    qnorm = df["quarter"].astype(str).map(_normalize_quarter_token)
    mask = qnorm.astype(bool)
    df = df.loc[mask].copy()
    qnorm = qnorm.loc[mask]

    parts = qnorm.apply(parse_quarter_to_yq).apply(pd.Series)
    return df.reset_index(drop=True).join(parts.reset_index(drop=True))

# ---------- CSV readers (skip 'Source:' banner) ----------

def read_fed_csv(path: Path, **kwargs) -> pd.DataFrame:
    skip = 0
    with open(path, "r", encoding="utf-8-sig", errors="ignore") as f:
        first = f.readline().strip().lower()
        if first.startswith("source:"):
            skip = 1
    return pd.read_csv(path, skiprows=skip, **kwargs)

def read_csv_map(path: Path, colmap: Dict[str, str]) -> pd.DataFrame:
    df = read_fed_csv(path)
    df.columns = [c.strip().strip('"') for c in df.columns]
    df = df.rename(columns=colmap)

    if "quarter" not in df.columns:
        for c in df.columns:
            if c.strip().upper() in {"YRQTR", "QUARTER"}:
                df = df.rename(columns={c: "quarter"})
                break

    keep = {"quarter"} | set(colmap.values())
    df = df[[c for c in df.columns if c in keep]].copy()
    return df

# ---------- extract ----------

def extract_origination() -> pd.DataFrame:
    colmap = {
        "YRQTR": "quarter",
        "New Originations ($Billions)": "origination_amt_bil",
        "Number of New Accounts (Millions)": "originations_cnt_mil",
    }
    df = read_csv_map(FILE_ORIG, colmap)
    df["origination_amt"]  = billions_to_amount(df["origination_amt_bil"])
    df["originations_cnt"] = millions_to_count(df["originations_cnt_mil"])
    return df[["quarter", "origination_amt", "originations_cnt"]]

def extract_balances() -> pd.DataFrame:
    colmap = {
        "YRQTR": "quarter",
        "Total Balances ($Billions)": "balance_bil",
    }
    df = read_csv_map(FILE_BAL, colmap)
    df["balance_amt"] = billions_to_amount(df["balance_bil"])
    return df[["quarter", "balance_amt"]]

def extract_defaults_quarterly_from_fred() -> Optional[pd.DataFrame]:
    """
    FRED delinquency rate DRALACBN (quarterly, percent).
    Accepts CSV or XLSX. Returns: year, quarter, default_rate (fraction 0..1).
    """
    path = FILE_DFLT_Q if FILE_DFLT_Q.exists() else (FILE_DFLT_Q_XLSX if FILE_DFLT_Q_XLSX.exists() else None)
    if not path:
        return None

    if path.suffix.lower() in {".xlsx", ".xls"}:
        df = pd.read_excel(path)
    else:
        df = pd.read_csv(path)

    cols = [str(c).strip() for c in df.columns]
    df.columns = cols

    # date column
    date_col = next((c for c in df.columns if c.lower() in {"date", "observation_date"}), None)
    if date_col is None:
        return None

    # pick the first non-date column as value
    val_col = next((c for c in df.columns if c != date_col), None)
    if val_col is None:
        return None

    df = df.rename(columns={date_col: "date", val_col: "rate_pct"})
    df["date"] = pd.to_datetime(df["date"], errors="coerce")
    df["rate_pct"] = pd.to_numeric(df["rate_pct"].replace(".", np.nan), errors="coerce")
    df = df.dropna(subset=["date", "rate_pct"]).sort_values("date")

    df["year"]    = df["date"].dt.year
    df["quarter"] = df["date"].dt.quarter

    q = (
        df.groupby(["year", "quarter"], as_index=False)
          .last()[["year", "quarter", "rate_pct"]]
          .rename(columns={"rate_pct": "default_rate"})
    )
    q["default_rate"] = q["default_rate"] / 100.0  # percent → fraction
    return q
def _read_fred_series(path: Path, value_candidates=()):
    """
    Read a FRED CSV/XLSX (which can have metadata rows before the header).
    Returns columns: date(datetime64[ns]), value(float).
    """
    if path is None or not path.exists():
        return pd.DataFrame(columns=["date", "value"])

    if path.suffix.lower() == ".csv":
        df = pd.read_csv(path)
    else:  # .xlsx: scan for header row containing 'date'/'observation_date'
        tmp = pd.read_excel(path, header=None, dtype=str)
        hdr_row = None
        for i in range(min(30, len(tmp))):
            row_lower = tmp.iloc[i].astype(str).str.strip().str.lower()
            if row_lower.str.contains("^date$|^observation_date$", regex=True).any():
                hdr_row = i
                break
        df = pd.read_excel(path, header=hdr_row) if hdr_row is not None else pd.read_excel(path)

    # normalize columns
    df = df.rename(columns={c: str(c).strip().lower() for c in df.columns})
    date_col = next((c for c in df.columns if c in {"date", "observation_date"}), df.columns[0])

    # choose value col
    val_col = None
    wanted = [v.lower() for v in value_candidates] + ["value"]
    for c in df.columns:
        if c == date_col:
            continue
        if c.lower() in wanted:
            val_col = c; break
    if val_col is None:
        for c in df.columns:
            if c == date_col:
                continue
            if pd.to_numeric(df[c], errors="coerce").notna().any():
                val_col = c; break

    out = pd.DataFrame({
        "date":  pd.to_datetime(df[date_col], errors="coerce"),
        "value": pd.to_numeric(df[val_col], errors="coerce") if val_col else np.nan
    }).dropna(subset=["date", "value"])
    return out

def extract_prime_quarterly() -> pd.DataFrame:
    """FRED DPRIME → quarterly average."""
    src = FILE_PRIME if FILE_PRIME.exists() else (RAW / "DPRIME.csv")
    x = _read_fred_series(src, value_candidates=("dprime", "bank prime loan rate"))
    if x.empty:
        return pd.DataFrame(columns=["quarter_key", "year", "quarter", "prime_rate"])
    x["year"] = x["date"].dt.year
    x["quarter"] = x["date"].dt.quarter
    q = x.groupby(["year", "quarter"], as_index=False)["value"].mean().rename(columns={"value": "prime_rate"})
    q["quarter_key"] = q["year"] * 10 + q["quarter"]
    return q[["quarter_key", "year", "quarter", "prime_rate"]]

def extract_defaults_quarterly_from_fred() -> pd.DataFrame:
    """FRED DRALACBN → quarterly value."""
    src = FILE_DFLT_Q if FILE_DFLT_Q.exists() else FILE_DFLT_Q_XLSX
    x = _read_fred_series(src, value_candidates=("dralacbn", "delinquency rate"))
    if x.empty:
        return pd.DataFrame(columns=["year", "quarter_num", "default_rate"])
    x["year"] = x["date"].dt.year
    x["quarter_num"] = x["date"].dt.quarter
    return (x.groupby(["year", "quarter_num"], as_index=False)["value"]
              .mean()
              .rename(columns={"value": "default_rate"}))
# ---------- default-rate fallback (yearly, from Loan_Default.csv) ----------

def extract_defaults_yearly() -> pd.DataFrame:
    """
    Compute an annual default_rate from Loan_Default.csv.
    Returns cols: year, default_rate (0–100 if your file is in %, else 0–1).
    If the file/columns aren't present, returns an empty frame.
    """
    try:
        if FILE_DEF is None or not FILE_DEF.exists():
            return pd.DataFrame(columns=["year", "default_rate"])

        df = pd.read_csv(FILE_DEF)
        df.columns = [str(c).strip() for c in df.columns]

        # find a year column and a default indicator column
        year_col = next((c for c in df.columns if c.lower() == "year"), None)
        status_col = next(
            (c for c in df.columns
             if c.lower() in {"status", "default", "default_flag", "chargeoff", "charge_off"}),
            None
        )
        if year_col is None or status_col is None:
            return pd.DataFrame(columns=["year", "default_rate"])

        # normalize to a 0/1 default flag
        s = df[status_col]
        default_flag = (
            (s == 1)
            | (s.astype(str).str.strip().str.lower().isin({"1", "true", "default", "charge-off", "chargeoff"}))
        ).astype(int)

        out = (
            pd.DataFrame({"year": pd.to_numeric(df[year_col], errors="coerce"), "default_flag": default_flag})
              .dropna(subset=["year"])
              .astype({"year": int})
              .groupby("year", as_index=False)["default_flag"].mean()
              .rename(columns={"default_flag": "default_rate"})
        )
        return out
    except Exception:
        # fail-safe: return empty so merges won’t break
        return pd.DataFrame(columns=["year", "default_rate"])

# simple alias so your old call won’t crash if it still appears
def extract_defaults_yearly_fallback() -> pd.DataFrame:
    return extract_defaults_yearly()

def extract_lending_yearly(country: str = "United States") -> Optional[pd.DataFrame]:
    if FILE_XML is None or not FILE_XML.exists():
        return None
    try:
        tree = ET.parse(FILE_XML)
    except Exception:
        return None

    rows = []
    for rec in tree.findall(".//record"):
        kv = {f.get("name"): (f.text.strip() if f.text else None) for f in rec.findall("./field")}
        ctry = kv.get("Country or Area") or kv.get("Country")
        if ctry != country:
            continue
        year_txt = kv.get("Year") or kv.get("date") or kv.get("Date")
        val_txt  = kv.get("Value") or kv.get("value")
        if not year_txt or not val_txt:
            continue
        try:
            y = int(float(year_txt))
            v = float(val_txt)
        except Exception:
            continue
        rows.append((y, v))

    if not rows:
        return None

    out = pd.DataFrame(rows, columns=["year", "lending_rate"]).sort_values("year").reset_index(drop=True)
    return out

# ---------- load helpers (SQL) ----------

def upsert_dim_date_rows(cx, rows: List[Dict]):
    sql = text("""
        INSERT INTO dim_date_qtr(quarter_key, year, quarter, quarter_start, quarter_end)
        VALUES (:quarter_key, :year, :quarter, :quarter_start, :quarter_end)
        ON DUPLICATE KEY UPDATE
          year=VALUES(year),
          quarter=VALUES(quarter),
          quarter_start=VALUES(quarter_start),
          quarter_end=VALUES(quarter_end)
    """)
    for r in rows:
        cx.execute(sql, r)

def get_or_make_geo(cx, country: str, state: Optional[str], city: Optional[str]) -> int:
    sel = text("""
        SELECT geo_key FROM dim_geo
        WHERE country <=> :c AND state_province <=> :s AND city <=> :t
        LIMIT 1
    """)
    row = cx.execute(sel, {"c": country, "s": state, "t": city}).fetchone()
    if row:
        return int(row[0])
    ins = text("INSERT INTO dim_geo(country, state_province, city) VALUES (:c, :s, :t)")
    cx.execute(ins, {"c": country, "s": state, "t": city})
    return int(cx.execute(text("SELECT LAST_INSERT_ID()")).scalar_one())

def ensure_dim_product_schema(cx):
    rows = cx.execute(text("""
        SELECT COLUMN_NAME, IS_NULLABLE
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'dim_product'
    """)).fetchall()
    cols = {r[0]: r[1] for r in rows}

    alter_bits = []
    if "product_code" not in cols: alter_bits.append("ADD COLUMN product_code VARCHAR(64) NULL")
    if "product_type" not in cols: alter_bits.append("ADD COLUMN product_type VARCHAR(64) NULL")
    if "segment" not in cols:      alter_bits.append("ADD COLUMN segment      VARCHAR(64) NULL")
    if alter_bits:
        cx.execute(text(f"ALTER TABLE dim_product {', '.join(alter_bits)}"))

    if "product_number" in cols and cols["product_number"] == "NO":
        try:
            cx.execute(text("ALTER TABLE dim_product MODIFY product_number INT NULL DEFAULT NULL"))
        except Exception:
            pass

    exists = cx.execute(text("""
        SELECT COUNT(*) FROM information_schema.statistics
        WHERE table_schema = DATABASE() AND table_name='dim_product' AND index_name='uq_prod'
    """)).scalar_one()
    if int(exists) == 0:
        try:
            cx.execute(text("ALTER TABLE dim_product ADD UNIQUE KEY uq_prod (product_code, product_type, segment)"))
        except Exception:
            pass

def get_or_make_product(cx, code: Optional[str], ptype: Optional[str], seg: Optional[str]) -> int:
    sel = text("""
        SELECT product_key FROM dim_product
        WHERE product_code <=> :code AND product_type <=> :ptype AND segment <=> :seg
        LIMIT 1
    """)
    row = cx.execute(sel, {"code": code, "ptype": ptype, "seg": seg}).fetchone()
    if row:
        return int(row[0])
    ins = text("INSERT INTO dim_product(product_code, product_type, segment) VALUES (:code, :ptype, :seg)")
    cx.execute(ins, {"code": code, "ptype": ptype, "seg": seg})
    return int(cx.execute(text("SELECT LAST_INSERT_ID()")).scalar_one())

def upsert_fact_rows(cx, rows: List[Dict]):
    sql = text("""
        INSERT INTO fact_credit_metrics_qtr (
            quarter_key, geo_key, product_key,
            originations_cnt, origination_amt, balance_amt,
            default_rate, prime_rate, lending_rate
        )
        VALUES (
            :quarter_key, :geo_key, :product_key,
            :originations_cnt, :origination_amt, :balance_amt,
            :default_rate, :prime_rate, :lending_rate
        )
        ON DUPLICATE KEY UPDATE
            originations_cnt = VALUES(originations_cnt),
            origination_amt  = VALUES(origination_amt),
            balance_amt      = VALUES(balance_amt),
            default_rate     = VALUES(default_rate),
            prime_rate       = VALUES(prime_rate),
            lending_rate     = VALUES(lending_rate)
    """)
    for r in rows:
        cx.execute(sql, r)

def table_count(cx, name: str) -> int:
    return int(cx.execute(text(f"SELECT COUNT(*) FROM {name}")).scalar_one())

# ---------- main pipeline ----------
# ---- add near the top (under imports) ----
DEBUG = False
def log(*a, **k):
    if DEBUG:
        print(*a, **k)

# ---- replace your existing main() and CLI block with the version below ----
def main(recreate: bool = False, debug: bool = False):
    global DEBUG
    DEBUG = debug

    eng = create_engine(ENGINE_URL, future=True)

    log("\n[FILES]")
    log(f"  ORIG        = {FILE_ORIG}   exists={FILE_ORIG.exists()}")
    log(f"  BAL         = {FILE_BAL}    exists={FILE_BAL.exists()}")
    log(f"  DPRIME.xlsx = {FILE_PRIME}  exists={FILE_PRIME.exists()}")
    # show which DRALACBN we’ll use
    dflt_path = FILE_DFLT_Q if FILE_DFLT_Q.exists() else (FILE_DFLT_Q_XLSX if FILE_DFLT_Q_XLSX.exists() else None)
    log(f"  DRALACBN    = {dflt_path}   exists={bool(dflt_path)}")
    log(f"  WB XML      = {FILE_XML}    exists={FILE_XML.exists()}")

    # 1) extract
    orig     = extract_origination()
    bal      = extract_balances()
    dflt_q   = extract_defaults_quarterly_from_fred()
    dflt_yfb = extract_defaults_yearly_fallback()
    prime_q  = extract_prime_quarterly()
    lending_y = extract_lending_yearly()

    # quick extract summaries
    log("\n[EXTRACT SUMMARY]")
    log(f"  orig rows={len(orig)} cols={list(orig.columns)}")
    log(f"  bal  rows={len(bal)}  cols={list(bal.columns)}")
    log(f"  prime_q rows={0 if prime_q is None else len(prime_q)}")
    if prime_q is not None and not prime_q.empty:
        log("    prime_q sample:\n", prime_q.head(3).to_string(index=False))
        log("    prime_q quarter_key range:",
            int(prime_q['quarter_key'].min()), "→", int(prime_q['quarter_key'].max()))
    else:
        log("    prime_q is EMPTY")

    log(f"  dflt_q rows={0 if dflt_q is None else len(dflt_q)}")
    if dflt_q is not None and not dflt_q.empty:
        log("    dflt_q sample:\n", dflt_q.head(3).to_string(index=False))
    else:
        log("    dflt_q is EMPTY")
    log(f"  dflt_yfb rows={len(dflt_yfb)} (yearly fallback)")
    if lending_y is not None:
        log(f"  lending_y rows={len(lending_y)} years {lending_y['year'].min()}→{lending_y['year'].max()}")
    else:
        log("  lending_y is EMPTY")

    # 2) transform
    base = orig.merge(bal, on="quarter", how="left")
    base = add_year_quarter(base)

    # defaults: prefer quarterly, else yearly
    if dflt_q is not None and not dflt_q.empty:
        base = base.merge(dflt_q.rename(columns={"quarter": "quarter_num"}),
                          on=["year", "quarter_num"], how="left")
    elif not dflt_yfb.empty:
        base = base.merge(dflt_yfb, on="year", how="left")
    else:
        base["default_rate"] = np.nan

    # prime: quarterly via quarter_key
    if prime_q is not None and not prime_q.empty:
        base = base.merge(prime_q[["quarter_key", "prime_rate"]], on="quarter_key", how="left")
    else:
        base["prime_rate"] = np.nan

    # lending: yearly
    if lending_y is not None and not lending_y.empty:
        base = base.merge(lending_y, on="year", how="left")
    else:
        base["lending_rate"] = np.nan

    # show merge health
    log("\n[MERGE CHECKS]")
    log(f"  base rows after merges = {len(base)}")
    log("  non-null counts:",
        base[["prime_rate","default_rate","lending_rate"]].notna().sum().to_dict())
    log("  base sample:\n", base[[
        "year","quarter_num","quarter_key","prime_rate","default_rate","lending_rate"
    ]].head(8).to_string(index=False))

    # 3) load
    with eng.begin() as cx:
        if recreate:
            cx.execute(text("DELETE FROM fact_credit_metrics_qtr"))

        # dims: date
        dim_rows = (
            base[["quarter_key", "year", "quarter_num", "quarter_start", "quarter_end"]]
            .drop_duplicates()
            .rename(columns={"quarter_num": "quarter"})
            .to_dict("records")
        )
        upsert_dim_date_rows(cx, dim_rows)

        ensure_dim_product_schema(cx)
        geo_key = get_or_make_geo(cx, "United States", None, None)
        product_key = get_or_make_product(cx, code="ALL", ptype="Credit Card", seg="Consumer")

        fact_rows = []
        for _, r in base.iterrows():
            fact_rows.append({
                "quarter_key":     int(r["quarter_key"]),
                "geo_key":         int(geo_key),
                "product_key":     int(product_key),
                "originations_cnt": float(r["originations_cnt"]) if pd.notna(r["originations_cnt"]) else None,
                "origination_amt":  float(r["origination_amt"])  if pd.notna(r["origination_amt"])  else None,
                "balance_amt":      float(r["balance_amt"])      if pd.notna(r["balance_amt"])      else None,
                "default_rate":     float(r["default_rate"])     if pd.notna(r["default_rate"])     else None,
                "prime_rate":       float(r["prime_rate"])       if pd.notna(r["prime_rate"])       else None,
                "lending_rate":     float(r["lending_rate"])     if pd.notna(r["lending_rate"])     else None,
            })
        upsert_fact_rows(cx, fact_rows)

        out = {
            "dim_date_cnt":    table_count(cx, "dim_date_qtr"),
            "dim_geo_cnt":     table_count(cx, "dim_geo"),
            "dim_product_cnt": table_count(cx, "dim_product"),
            "fact_cnt":        table_count(cx, "fact_credit_metrics_qtr"),
        }

    print("ETL completed ✓")
    print(out)

if __name__ == "__main__":
    import argparse
    ap = argparse.ArgumentParser()
    ap.add_argument("--recreate", action="store_true", help="clear fact table then reload")
    ap.add_argument("--debug", action="store_true", help="print extract/merge diagnostics")
    args = ap.parse_args()
    main(recreate=args.recreate, debug=args.debug)
