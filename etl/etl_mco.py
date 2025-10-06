# etl/etl_mco.py
# ------------------------------------------------------------
# Production-grade, idempotent ETL for MCO DW (MySQL / Postgres)
# - Cleans, types, merges quarterly credit-card facts with macro rates
# - Data quality gates, dedupe, fan-out detection, and validation reports
# - Strong DDL/contracts + indexes; idempotent upserts
# ------------------------------------------------------------

from __future__ import annotations

import os, re, time, json, math
from pathlib import Path
from typing import Dict, List, Optional, Tuple
from datetime import date
from xml.etree import ElementTree as ET
import tempfile

import numpy as np
import pandas as pd
from sqlalchemy import create_engine, text

# ------------------------------------------------------------
# CONFIG
# ------------------------------------------------------------

ROOT = Path(__file__).resolve().parents[1]
RAW  = ROOT / "source_raw"

# Sources (Excel only for FRED, per your request)
FILE_ORIG    = RAW / "25Q1-CreditCardOrigination.csv"
FILE_BAL     = RAW / "25Q1-CreditCardBalances.csv"
FILE_PRIME_X = RAW / "DPRIME.xlsx"      # FRED DPRIME
FILE_DFLT_X  = RAW / "DRALACBN.xlsx"    # FRED DRALACBN (quarterly)
FILE_WB_XML  = RAW / "API_FR.INR.LEND_DS2_en_xml_v2_1223050.xml"

# DB connection (supports MySQL or Postgres)
MYSQL_HOST = os.getenv("MYSQL_HOST", "127.0.0.1")
MYSQL_PORT = int(os.getenv("MYSQL_PORT", "3306"))
MYSQL_USER = os.getenv("MYSQL_USER", "dw")
MYSQL_PASS = os.getenv("MYSQL_PASS", "DwPass!123")
MYSQL_DB   = os.getenv("MYSQL_DB",   "gosales_dw")

ENGINE_URL = os.getenv(
    "ENGINE_URL",
    f"mysql+pymysql://{MYSQL_USER}:{MYSQL_PASS}@{MYSQL_HOST}:{MYSQL_PORT}/{MYSQL_DB}"
)

# Null-handling policy:
# - prime_rate, lending_rate: forward-fill within each YEAR; do not cross year boundaries
# - default_rate: quarterly mean if multiple points; if missing -> leave NULL
# - negative monetary values: set to NULL and record to rejects

# ------------------------------------------------------------
# LOGGING / UTILS
# ------------------------------------------------------------

DEBUG = False
def log(*a, **k):
    if DEBUG:
        print(*a, **k)

TMP = Path(tempfile.gettempdir())
DQ_JSON   = TMP / "etl_quality.json"
DQ_REJECT = TMP / "etl_rejects.csv"
REJECTS: List[pd.DataFrame] = []

def dq_capture(df: pd.DataFrame, mask: pd.Series, reason: str, keep_cols=None):
    """Append bad rows to rejects list."""
    if keep_cols is None:
        keep_cols = [c for c in
                     ["year","quarter_num","quarter_key","quarter",
                      "originations_cnt","origination_amt","balance_amt",
                      "default_rate","prime_rate","lending_rate"]
                     if c in df.columns]
    if mask.any():
        snap = df.loc[mask, keep_cols].copy()
        snap["dq_reason"] = reason
        REJECTS.append(snap)

def write_dq_outputs():
    out = {"reject_rows": int(sum(len(x) for x in REJECTS)) if REJECTS else 0}
    if REJECTS:
        rej = pd.concat(REJECTS, ignore_index=True)
        rej.to_csv(DQ_REJECT, index=False)
        out["rejects_path"] = str(DQ_REJECT)
    DQ_JSON.write_text(json.dumps(out, indent=2))
    log(f"[DQ] summary -> {DQ_JSON}")
    if REJECTS:
        log(f"[DQ] rejects -> {DQ_REJECT}")

# ------------------------------------------------------------
# NORMALIZERS
# ------------------------------------------------------------

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

# Accepts "2012Q3", "2012 Q3", or "Q3 2012"
_QUARTER_TOKEN_RE = re.compile(r"^(?:\d{4}\s*Q[1-4]|Q[1-4]\s*\d{4})$")

def _normalize_quarter_token(s: str) -> str:
    if s is None:
        return ""
    t = str(s).strip().upper().replace("\ufeff", "")
    t = re.sub(r"\s+", " ", t)
    if not _QUARTER_TOKEN_RE.match(t):
        return ""
    if t.startswith("Q"):  # "Q3 2012" -> "2012Q3"
        q, y = t.split(" ")
        return f"{y}{q}"
    return t.replace(" ", "")  # "2012 Q3" -> "2012Q3"

def parse_quarter_to_yq(qstr: str) -> dict:
    token = _normalize_quarter_token(qstr)
    if not token or "Q" not in token:
        raise ValueError(f"Unrecognized quarter format: {qstr}")
    year = int(token[:4]); q = int(token[-1])
    start_month = (q - 1) * 3 + 1
    end_month   = q * 3
    q_start = date(year, start_month, 1)
    q_end   = pd.Period(f"{year}-{end_month:02d}").end_time.date()
    q_key   = int(f"{year}{q}")  # e.g., 2012Q3 -> 20123
    return {"year": year, "quarter_num": q,
            "quarter_start": q_start, "quarter_end": q_end,
            "quarter_key": q_key}

def add_year_quarter(df: pd.DataFrame) -> pd.DataFrame:
    if "quarter" not in df.columns:
        for c in df.columns:
            if str(c).strip().upper() in {"YRQTR", "QUARTER"}:
                df = df.rename(columns={c: "quarter"}); break
    if "quarter" not in df.columns:
        raise KeyError("No 'quarter' column to parse.")
    qnorm = df["quarter"].astype(str).map(_normalize_quarter_token)
    mask = qnorm.astype(bool)
    df = df.loc[mask].copy(); qnorm = qnorm.loc[mask]
    parts = qnorm.apply(parse_quarter_to_yq).apply(pd.Series)
    return df.reset_index(drop=True).join(parts.reset_index(drop=True))

# ------------------------------------------------------------
# READERS
# ------------------------------------------------------------

def read_fed_csv_skip_source(path: Path) -> pd.DataFrame:
    """Philadelphia Fed CSVs sometimes have a leading 'Source:' line."""
    skip = 0
    with open(path, "r", encoding="utf-8-sig", errors="ignore") as f:
        first = f.readline().strip().lower()
        if first.startswith("source:"):
            skip = 1
    return pd.read_csv(path, skiprows=skip)

def read_csv_map(path: Path, colmap: Dict[str, str]) -> pd.DataFrame:
    df = read_fed_csv_skip_source(path)
    df.columns = [c.strip().strip('"') for c in df.columns]
    df = df.rename(columns=colmap)
    if "quarter" not in df.columns:
        for c in df.columns:
            if c.strip().upper() in {"YRQTR", "QUARTER"}:
                df = df.rename(columns={c: "quarter"}); break
    keep = {"quarter"} | set(colmap.values())
    return df[[c for c in df.columns if c in keep]].copy()

def _read_fred_xlsx(path: Path) -> pd.DataFrame:
    """
    Reads a FRED xlsx with a 'README' sheet and one data sheet
    ('Daily', 'Monthly', 'Quarterly', or 'Data'). Returns columns:
    date (datetime64[ns]), value (float). Empty if not found.
    """
    if not path.exists():
        return pd.DataFrame(columns=["date","value"])
    xl = pd.ExcelFile(path)
    # prefer likely data sheets
    sheet_names = [s for s in xl.sheet_names if s.strip().lower() not in {"readme","README".lower()}]
    pref = ["Quarterly", "Daily", "Monthly", "Data"]
    sheet = next((s for p in pref for s in sheet_names if s.lower().startswith(p.lower())),
                 (sheet_names[0] if sheet_names else None))
    if sheet is None:
        return pd.DataFrame(columns=["date","value"])
    df = xl.parse(sheet_name=sheet)
    # Normalize column names
    df.columns = [str(c).strip().lower() for c in df.columns]
    # find date
    date_col = next((c for c in df.columns if c in {"date","observation_date"}), None)
    if not date_col:
        # heuristics: first column with parseable dates
        for c in df.columns:
            if pd.to_datetime(df[c], errors="coerce").notna().any():
                date_col = c; break
    if not date_col:
        return pd.DataFrame(columns=["date","value"])
    # value = first numeric column that's not date
    val_col = next((c for c in df.columns if c != date_col and
                    pd.to_numeric(df[c], errors="coerce").notna().any()), None)
    if not val_col:
        return pd.DataFrame(columns=["date","value"])
    raw_dates = df[date_col]
    dates = pd.to_datetime(raw_dates, errors="coerce")
    vals  = pd.to_numeric(df[val_col], errors="coerce")
    out = pd.DataFrame({"date": dates, "value": vals}).dropna(subset=["date","value"])
    return out.sort_values("date")

# ------------------------------------------------------------
# EXTRACT
# ------------------------------------------------------------

def extract_origination() -> pd.DataFrame:
    colmap = {
        "YRQTR": "quarter",
        "New Originations ($Billions)": "origination_amt_bil",
        "Number of New Accounts (Millions)": "originations_cnt_mil",
    }
    df = read_csv_map(FILE_ORIG, colmap)
    df["origination_amt"]  = billions_to_amount(df["origination_amt_bil"])
    df["originations_cnt"] = millions_to_count(df["originations_cnt_mil"])
    return df[["quarter","origination_amt","originations_cnt"]]

def extract_balances() -> pd.DataFrame:
    colmap = {"YRQTR":"quarter", "Total Balances ($Billions)":"balance_bil"}
    df = read_csv_map(FILE_BAL, colmap)
    df["balance_amt"] = billions_to_amount(df["balance_bil"])
    return df[["quarter","balance_amt"]]

def extract_prime_quarterly() -> pd.DataFrame:
    """DPRIME.xlsx -> quarterly mean."""
    if not FILE_PRIME_X.exists(): return pd.DataFrame()
    x = _read_fred_xlsx(FILE_PRIME_X)
    if x.empty: return pd.DataFrame()
    x["year"] = x["date"].dt.year
    x["quarter"] = x["date"].dt.quarter
    q = (x.groupby(["year","quarter"], as_index=False)["value"]
           .mean().rename(columns={"value":"prime_rate"}))
    q["quarter_key"] = q["year"]*10 + q["quarter"]
    return q[["quarter_key","year","quarter","prime_rate"]]

def extract_default_quarterly_from_dralacbn() -> pd.DataFrame:
    """DRALACBN.xlsx -> quarterly (already quarterly or we average). Percent -> fraction."""
    if not FILE_DFLT_X.exists(): return pd.DataFrame()
    x = _read_fred_xlsx(FILE_DFLT_X)
    if x.empty: return pd.DataFrame()
    x["year"] = x["date"].dt.year
    x["quarter_num"] = x["date"].dt.quarter
    q = (x.groupby(["year","quarter_num"], as_index=False)["value"]
           .mean().rename(columns={"value":"default_rate"}))
    q["default_rate"] = q["default_rate"]/100.0
    return q

def extract_lending_yearly(country: str="United States") -> Optional[pd.DataFrame]:
    """World Bank XML -> annual lending_rate (%) as float (not divided by 100)."""
    if not FILE_WB_XML.exists(): return None
    try:
        tree = ET.parse(FILE_WB_XML)
    except Exception:
        return None
    rows = []
    for rec in tree.findall(".//record"):
        kv = {f.get("name"): (f.text.strip() if f.text else None) for f in rec.findall("./field")}
        ctry = kv.get("Country or Area") or kv.get("Country")
        if ctry != country: continue
        y, v = kv.get("Year") or kv.get("date"), kv.get("Value") or kv.get("value")
        if not y or not v: continue
        try:
            rows.append((int(float(y)), float(v)))
        except Exception:
            continue
    if not rows: return None
    return pd.DataFrame(rows, columns=["year","lending_rate"]).sort_values("year")

# ------------------------------------------------------------
# DQ helpers (dedupe / fan-out)
# ------------------------------------------------------------

def ensure_unique(df: pd.DataFrame, keys: List[str], name: str) -> pd.DataFrame:
    dup = df.duplicated(subset=keys, keep="first")
    dq_capture(df, dup, f"{name}_duplicate_keys", keep_cols=keys)
    if dup.any():
        log(f"[WARN] {name}: dropped {int(dup.sum())} duplicate rows on {keys}")
        df = df[~dup].copy()
    return df

def fanout_guard(before_rows: int, merged: pd.DataFrame, label: str):
    if before_rows == 0: return
    ratio = len(merged)/before_rows
    if ratio > 1.01:
        log(f"[WARN] Join fan-out on {label}: {before_rows} -> {len(merged)} (x{ratio:.3f})")

# ------------------------------------------------------------
# WAREHOUSE DDL / UPSERTS
# ------------------------------------------------------------

def detect_dialect(engine):
    name = engine.dialect.name
    return "postgresql" if "postgres" in name else "mysql"

def create_tables_if_missing(cx, dialect: str):
    if dialect == "postgresql":
        cx.execute(text("""
        CREATE TABLE IF NOT EXISTS dim_date_qtr(
          quarter_key INTEGER PRIMARY KEY,
          year        INTEGER NOT NULL,
          quarter     SMALLINT NOT NULL,
          quarter_start DATE,
          quarter_end   DATE
        );
        """))
        cx.execute(text("""
        CREATE TABLE IF NOT EXISTS dim_geo(
          geo_key SERIAL PRIMARY KEY,
          country TEXT,
          state_province TEXT,
          city TEXT
        );
        """))
        cx.execute(text("""
        CREATE TABLE IF NOT EXISTS dim_product(
          product_key SERIAL PRIMARY KEY,
          product_code TEXT,
          product_type TEXT,
          segment     TEXT,
          CONSTRAINT uq_prod UNIQUE (product_code, product_type, segment)
        );
        """))
        cx.execute(text("""
        CREATE TABLE IF NOT EXISTS fact_credit_metrics_qtr(
          quarter_key   INTEGER NOT NULL,
          geo_key       INTEGER NOT NULL,
          product_key   INTEGER NOT NULL,
          originations_cnt BIGINT,
          origination_amt  NUMERIC(18,2),
          balance_amt      NUMERIC(18,2),
          default_rate     NUMERIC(6,5),
          prime_rate       NUMERIC(6,3),
          lending_rate     NUMERIC(6,3),
          PRIMARY KEY (quarter_key, geo_key, product_key),
          FOREIGN KEY (quarter_key) REFERENCES dim_date_qtr(quarter_key),
          FOREIGN KEY (geo_key)    REFERENCES dim_geo(geo_key),
          FOREIGN KEY (product_key)REFERENCES dim_product(product_key)
        );
        """))
        cx.execute(text("CREATE INDEX IF NOT EXISTS idx_fact_q ON fact_credit_metrics_qtr(quarter_key);"))
        cx.execute(text("CREATE INDEX IF NOT EXISTS idx_fact_p ON fact_credit_metrics_qtr(product_key);"))
        cx.execute(text("CREATE INDEX IF NOT EXISTS idx_fact_g ON fact_credit_metrics_qtr(geo_key);"))

    else:  # mysql
        cx.execute(text("""
        CREATE TABLE IF NOT EXISTS dim_date_qtr(
          quarter_key INT PRIMARY KEY,
          year        SMALLINT NOT NULL,
          quarter     TINYINT NOT NULL,
          quarter_start DATE NULL,
          quarter_end   DATE NULL
        ) ENGINE=InnoDB;
        """))
        cx.execute(text("""
        CREATE TABLE IF NOT EXISTS dim_geo(
          geo_key INT NOT NULL AUTO_INCREMENT,
          country VARCHAR(80) NULL,
          state_province VARCHAR(80) NULL,
          city VARCHAR(120) NULL,
          PRIMARY KEY (geo_key)
        ) ENGINE=InnoDB;
        """))
        cx.execute(text("""
        CREATE TABLE IF NOT EXISTS dim_product(
          product_key INT NOT NULL AUTO_INCREMENT,
          product_code VARCHAR(64) NULL,
          product_type VARCHAR(64) NULL,
          segment      VARCHAR(64) NULL,
          PRIMARY KEY (product_key),
          UNIQUE KEY uq_prod (product_code, product_type, segment)
        ) ENGINE=InnoDB;
        """))
        cx.execute(text("""
        CREATE TABLE IF NOT EXISTS fact_credit_metrics_qtr(
          quarter_key INT NOT NULL,
          geo_key     INT NOT NULL,
          product_key INT NOT NULL,
          originations_cnt BIGINT NULL,
          origination_amt  DECIMAL(18,2) NULL,
          balance_amt      DECIMAL(18,2) NULL,
          default_rate     DECIMAL(6,5)  NULL,
          prime_rate       DECIMAL(6,3)  NULL,
          lending_rate     DECIMAL(6,3)  NULL,
          PRIMARY KEY (quarter_key, geo_key, product_key),
          KEY idx_fact_q (quarter_key),
          KEY idx_fact_p (product_key),
          KEY idx_fact_g (geo_key),
          CONSTRAINT fk_fact_date FOREIGN KEY (quarter_key) REFERENCES dim_date_qtr(quarter_key),
          CONSTRAINT fk_fact_geo  FOREIGN KEY (geo_key)     REFERENCES dim_geo(geo_key),
          CONSTRAINT fk_fact_prod FOREIGN KEY (product_key) REFERENCES dim_product(product_key)
        ) ENGINE=InnoDB;
        """))

def upsert_dim_date_rows(cx, dialect: str, rows: List[Dict]):
    if not rows: return
    if dialect == "postgresql":
        sql = text("""
        INSERT INTO dim_date_qtr(quarter_key, year, quarter, quarter_start, quarter_end)
        VALUES (:quarter_key, :year, :quarter, :quarter_start, :quarter_end)
        ON CONFLICT (quarter_key) DO UPDATE SET
          year=EXCLUDED.year,
          quarter=EXCLUDED.quarter,
          quarter_start=EXCLUDED.quarter_start,
          quarter_end=EXCLUDED.quarter_end;
        """)
    else:
        sql = text("""
        INSERT INTO dim_date_qtr(quarter_key, year, quarter, quarter_start, quarter_end)
        VALUES (:quarter_key, :year, :quarter, :quarter_start, :quarter_end)
        ON DUPLICATE KEY UPDATE
          year=VALUES(year),
          quarter=VALUES(quarter),
          quarter_start=VALUES(quarter_start),
          quarter_end=VALUES(quarter_end);
        """)
    for r in rows:
        cx.execute(sql, r)

def get_or_make_geo(cx, country: Optional[str], state: Optional[str], city: Optional[str]) -> int:
    sel = text("""
        SELECT geo_key FROM dim_geo
        WHERE country <=> :c AND state_province <=> :s AND city <=> :t
        LIMIT 1
    """)
    row = cx.execute(sel, {"c": country, "s": state, "t": city}).fetchone()
    if row: return int(row[0])
    cx.execute(text("INSERT INTO dim_geo(country, state_province, city) VALUES (:c, :s, :t)"),
               {"c": country, "s": state, "t": city})
    return int(cx.execute(text("SELECT LAST_INSERT_ID()")).scalar_one())

def ensure_dim_product_schema(cx):
    # Already created with UNIQUE (product_code, product_type, segment)
    pass

def get_or_make_product(cx, code: Optional[str], ptype: Optional[str], seg: Optional[str]) -> int:
    sel = text("""
        SELECT product_key FROM dim_product
        WHERE product_code <=> :code AND product_type <=> :ptype AND segment <=> :seg
        LIMIT 1
    """)
    row = cx.execute(sel, {"code": code, "ptype": ptype, "seg": seg}).fetchone()
    if row: return int(row[0])
    cx.execute(text("INSERT INTO dim_product(product_code, product_type, segment) VALUES (:code, :ptype, :seg)"),
               {"code": code, "ptype": ptype, "seg": seg})
    return int(cx.execute(text("SELECT LAST_INSERT_ID()")).scalar_one())

def upsert_fact_rows(cx, dialect: str, rows: List[Dict]):
    if not rows: return
    if dialect == "postgresql":
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
        ON CONFLICT (quarter_key, geo_key, product_key) DO UPDATE SET
          originations_cnt = EXCLUDED.originations_cnt,
          origination_amt  = EXCLUDED.origination_amt,
          balance_amt      = EXCLUDED.balance_amt,
          default_rate     = EXCLUDED.default_rate,
          prime_rate       = EXCLUDED.prime_rate,
          lending_rate     = EXCLUDED.lending_rate;
        """)
    else:
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
          lending_rate     = VALUES(lending_rate);
        """)
    for r in rows:
        cx.execute(sql, r)

def table_count(cx, name: str) -> int:
    return int(cx.execute(text(f"SELECT COUNT(*) FROM {name}")).scalar_one())

# ---- Big run log helpers -----------------------------------------------------
from datetime import datetime
import json
from collections import OrderedDict

def _pct(n, d): 
    return 0.0 if d == 0 else round(100.0 * n / d, 2)

def write_run_report(base, orig, bal, prime, dfltq, lendy, out_path="/tmp/etl_quality.json"):
    """Compute a richer one-shot report and write to JSON; also pretty-print to console."""
    rep = OrderedDict()
    # Source shapes
    rep["sources"] = {
        "orig_rows":   len(orig),
        "bal_rows":    len(bal),
        "prime_rows":  0 if prime is None else len(prime),
        "dfltq_rows":  0 if dfltq is None else len(dfltq),
        "lendy_rows":  0 if lendy is None else len(lendy),
    }
    # Coverage
    if not base.empty:
        rep["coverage"] = {
            "min_year":       int(base["year"].min()),
            "max_year":       int(base["year"].max()),
            "min_quarter_key": int(base["quarter_key"].min()),
            "max_quarter_key": int(base["quarter_key"].max()),
            "rows_after_merge": int(len(base)),
        }
    else:
        rep["coverage"] = {}

    # Null profile (key measures)
    cols = ["originations_cnt","origination_amt","balance_amt","default_rate","prime_rate","lending_rate"]
    nn = base[cols].notna().sum().to_dict()
    nz = base[cols].isna().sum().to_dict()
    total = len(base)
    rep["null_profile"] = {
        c: {"non_null": int(nn[c]), "null": int(nz[c]), "null_pct": _pct(nz[c], total)} for c in cols
    }

    # Range checks / violations
    viol = {}
    viol["default_rate_out_of_range"] = int(((base["default_rate"] < 0) | (base["default_rate"] > 1)).sum(skipna=True))
    viol["neg_originations_cnt"] = int((base["originations_cnt"] < 0).sum(skipna=True))
    viol["neg_origination_amt"]  = int((base["origination_amt"]  < 0).sum(skipna=True))
    viol["neg_balance_amt"]      = int((base["balance_amt"]      < 0).sum(skipna=True))
    rep["violations"] = viol

    # Duplicate check on natural grain (qtr, geo, product)
    dup = (base.groupby(["quarter_key"])
                .size()
                .reset_index(name="c")
                .query("c>1"))
    rep["dupes_on_quarter_key"] = int(len(dup))

    rep["generated_at"] = datetime.utcnow().isoformat() + "Z"

    # Write JSON
    try:
        Path(out_path).parent.mkdir(parents=True, exist_ok=True)
        with open(out_path, "w", encoding="utf-8") as f:
            json.dump(rep, f, indent=2)
        print(f"[DQ] summary → {out_path}")
    except Exception as e:
        print(f"[DQ] (could not write {out_path}): {e}")

    # Pretty console view
    print("\n[RUN SUMMARY]")
    for k, v in rep["sources"].items():  print(f"  {k:18} {v}")
    if rep.get("coverage"):
        cov = rep["coverage"]
        print(f"  coverage years    {cov['min_year']}–{cov['max_year']} | qkeys {cov['min_quarter_key']}→{cov['max_quarter_key']}")
        print(f"  rows after merge  {cov['rows_after_merge']}")
    print("  null profile (%, by column):")
    for c, s in rep["null_profile"].items():
        print(f"    {c:16} null {s['null']:>3} ({s['null_pct']:>5}%)  non-null {s['non_null']:>3}")
    print("  violations:")
    for k, v in rep["violations"].items(): 
        print(f"    {k:28} {v}")
    print(f"  dupes on quarter_key: {rep['dupes_on_quarter_key']}")
    print()


# ------------------------------------------------------------
# MAIN PIPELINE
# ------------------------------------------------------------

def validate_report(base: pd.DataFrame):
    msg = {}
    msg["rows"] = len(base)
    msg["null_rates"] = base[[
        c for c in ["originations_cnt","origination_amt","balance_amt",
                    "default_rate","prime_rate","lending_rate"] if c in base.columns
    ]].isna().mean().round(3).to_dict()
    msg["range_bad_default"] = int((~(base["default_rate"].between(0,1) | base["default_rate"].isna())).sum()) \
                               if "default_rate" in base else 0
    (TMP / "etl_validate.json").write_text(json.dumps(msg, indent=2))
    log("[VALIDATE] ->", TMP / "etl_validate.json")

def perfcheck(engine):
    qry = """
    SELECT d.year, SUM(originations_cnt) cnt, SUM(origination_amt) amt, AVG(prime_rate) avg_prime
    FROM fact_credit_metrics_qtr f
    JOIN dim_date_qtr d ON d.quarter_key = f.quarter_key
    GROUP BY d.year
    """
    t0 = time.time()
    with engine.begin() as cx:
        cx.execute(text(qry)).fetchall()
    t1 = time.time()
    print(f"[PERFCHECK] query elapsed: {t1-t0:.3f}s")

def main(recreate=False, validate=False, perfcheck_flag=False, debug=False, dryrun=False, no_indexes=False):
    global DEBUG
    DEBUG = debug

    print(">>")
    eng = create_engine(ENGINE_URL, future=True)
    dialect = detect_dialect(eng)

    # --- Extract
    orig  = extract_origination()
    bal   = extract_balances()
    prime = extract_prime_quarterly()
    dfltq = extract_default_quarterly_from_dralacbn()
    lendy = extract_lending_yearly()

    print("[EXTRACT]")
    print("  orig rows:", len(orig), "cols:", list(orig.columns))
    print("  bal  rows:", len(bal),  "cols:", list(bal.columns))
    print("  prime rows:", len(prime))
    print("  dfltq rows:", len(dfltq))
    print("  lendy rows:", (0 if lendy is None else len(lendy)))

    # Uniqueness before joins
    orig  = ensure_unique(orig,  ["quarter"], "orig")
    bal   = ensure_unique(bal,   ["quarter"], "bal")
    prime = ensure_unique(prime, ["quarter_key"], "prime") if not prime.empty else prime
    dfltq = ensure_unique(dfltq, ["year","quarter_num"], "dfltq") if not dfltq.empty else dfltq
    if lendy is not None and not lendy.empty:
        lendy = ensure_unique(lendy, ["year"], "lendy")

    # --- Transform & Merge (guard fan-outs)
    base = add_year_quarter(orig.merge(bal, on="quarter", how="left"))
    base = ensure_unique(base, ["quarter_key"], "base_add_year")

    # default rate (prefer quarterly)
    if not dfltq.empty:
        n0 = len(base); base = base.merge(dfltq, on=["year","quarter_num"], how="left"); fanout_guard(n0, base, "default_q")
    else:
        base["default_rate"] = np.nan

    # prime by quarter_key
    if not prime.empty:
        n0 = len(base); base = base.merge(prime[["quarter_key","prime_rate"]], on="quarter_key", how="left"); fanout_guard(n0, base, "prime")

    # lending by year
    if lendy is not None and not lendy.empty:
        n0 = len(base); base = base.merge(lendy, on="year", how="left"); fanout_guard(n0, base, "lending")
    else:
        base["lending_rate"] = np.nan

    # Deterministic order
    base = base.sort_values(["year","quarter_num","quarter_key"], kind="mergesort").reset_index(drop=True)

    # Constraint gate
    if "default_rate" in base.columns:
        bad_def = ~(base["default_rate"].between(0,1) | base["default_rate"].isna())
        dq_capture(base, bad_def, "default_rate_out_of_range", keep_cols=["year","quarter_num","default_rate"])
        base.loc[bad_def, "default_rate"] = np.nan

    for c in ["originations_cnt","origination_amt","balance_amt"]:
        if c in base.columns:
            bad = base[c] < 0
            dq_capture(base, bad, f"negative_{c}", keep_cols=["year","quarter_num",c])
            base.loc[bad, c] = np.nan

    # Missing values policy
    # forward-fill within year for prime/lending; default left as-is
    for col in ["prime_rate","lending_rate"]:
        if col in base.columns:
            base[col] = base.groupby("year", group_keys=False)[col].apply(lambda s: s.ffill())

    # Final dedupe on grain (single geo/product)
    before = len(base)
    base = base.drop_duplicates(subset=["quarter_key"], keep="first")
    if len(base) != before:
        log(f"[WARN] final dedupe dropped {before-len(base)} rows on quarter_key")

    # Validation snapshot
    if validate:
        validate_report(base)

    write_dq_outputs()
    # diagnostics just before load
    write_run_report(base, orig, bal, prime, dfltq, lendy,
                     out_path=os.getenv("ETL_QUALITY_PATH", "/tmp/etl_quality.json"))

    # --- Load
    if dryrun:
        print("[DRYRUN] Skipping DB load; rows ready:", len(base))
        return

    with eng.begin() as cx:
        # Tables + indexes (idempotent)
        create_tables_if_missing(cx, dialect)

        if recreate:
            cx.execute(text("DELETE FROM fact_credit_metrics_qtr"))

        # dim_date upsert
        dim_rows = (base[["quarter_key","year","quarter_num","quarter_start","quarter_end"]]
                    .drop_duplicates()
                    .rename(columns={"quarter_num":"quarter"})
                    .to_dict("records"))
        upsert_dim_date_rows(cx, dialect, dim_rows)

        # dims (geo/product)
        geo_key = get_or_make_geo(cx, "United States", None, None)
        ensure_dim_product_schema(cx)
        product_key = get_or_make_product(cx, code="ALL", ptype="Credit Card", seg="Consumer")

        # fact upserts
        fact_rows = []
        for _, r in base.iterrows():
            fact_rows.append({
                "quarter_key": int(r["quarter_key"]),
                "geo_key": int(geo_key),
                "product_key": int(product_key),
                "originations_cnt": float(r["originations_cnt"]) if pd.notna(r["originations_cnt"]) else None,
                "origination_amt":  float(r["origination_amt"])  if pd.notna(r["origination_amt"])  else None,
                "balance_amt":      float(r["balance_amt"])      if pd.notna(r["balance_amt"])      else None,
                "default_rate":     float(r["default_rate"])     if pd.notna(r["default_rate"])     else None,
                "prime_rate":       float(r["prime_rate"])       if pd.notna(r["prime_rate"])       else None,
                "lending_rate":     float(r["lending_rate"])     if pd.notna(r["lending_rate"])     else None,
            })
        upsert_fact_rows(cx, dialect, fact_rows)

        out = {
            "dim_date_cnt":    table_count(cx, "dim_date_qtr"),
            "dim_geo_cnt":     table_count(cx, "dim_geo"),
            "dim_product_cnt": table_count(cx, "dim_product"),
            "fact_cnt":        table_count(cx, "fact_credit_metrics_qtr"),
        }

    print("ETL completed ✓")
    print(out)

    if perfcheck_flag:
        perfcheck(eng)

# ------------------------------------------------------------
# CLI
# ------------------------------------------------------------
if __name__ == "__main__":
    import argparse
    ap = argparse.ArgumentParser()
    ap.add_argument("--recreate",   action="store_true", help="clear fact table before load")
    ap.add_argument("--validate",   action="store_true", help="write validation snapshot")
    ap.add_argument("--perfcheck",  action="store_true", help="run a quick timing query")
    ap.add_argument("--debug",      action="store_true", help="verbose logging")
    ap.add_argument("--dryrun",     action="store_true", help="skip DB writes")
    ap.add_argument("--no-indexes", action="store_true", help="reserved (indexes created by default)")
    args = ap.parse_args()
    main(recreate=args.recreate, validate=args.validate,
         perfcheck_flag=args.perfcheck, debug=args.debug,
         dryrun=args.dryrun, no_indexes=args.no_indexes)
