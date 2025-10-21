# streamlit_app/app.py
import streamlit as st
import requests
import pandas as pd
import plotly.express as px
from typing import Any, Dict, List, Optional

# CONFIG: change if your backend URL differs
OLAP_BASE = "http://127.0.0.1:8000/api/olap/aggregate"

st.set_page_config(page_title="Credit Metrics - Streamlit", layout="wide")


# ---------- Helpers to call and normalize cubes responses ----------
def _call_olap(params: Dict[str, Any]) -> Dict[str, Any]:
    """Call the OLAP API and return JSON (raises on network errors)."""
    try:
        resp = requests.get(OLAP_BASE, params=params, timeout=10)
        resp.raise_for_status()
        return resp.json()
    except Exception as e:
        raise RuntimeError(f"OLAP fetch error: {e}")


def _normalize_cells(json_obj: Dict[str, Any]) -> List[Dict[str, Any]]:
    """
    Normalize cubes JSON.cells into a list of simple dict rows.
    Support both:
      - { cells: [ { drilldown: {...}, measures: {...} }, ... ] }
      - { cells: [ { 'date_qtr.year': '2021', 'balance_amt_sum': 123 }, ... ] }
    """
    cells = json_obj.get("cells") or []
    rows = []

    for c in cells:
        # case A: nested drilldown + measures
        if isinstance(c, dict) and ("drilldown" in c or "measures" in c):
            row = {}
            dd = c.get("drilldown", {}) or {}
            for k, v in dd.items():
                # normalize keys for convenience
                if k.endswith("date_qtr.year") or k == "date_qtr.year":
                    row["year"] = v
                elif k.endswith("date_qtr.quarter") or k == "date_qtr.quarter":
                    row["quarter"] = v
                elif "." in k:
                    # e.g. product.product_code
                    row[k.replace(".", "_")] = v
                else:
                    row[k] = v

            measures = c.get("measures", {}) or {}
            # copy measures (keep original key names)
            for mk, mv in measures.items():
                # numeric conversion attempt
                try:
                    row[mk] = float(mv)
                except Exception:
                    row[mk] = mv
            rows.append(row)
            continue

        # case B: flattened row
        if isinstance(c, dict):
            row = {}
            for k, v in c.items():
                if k == "date_qtr.year" or k.endswith(".year"):
                    row["year"] = v
                elif k == "date_qtr.quarter" or k.endswith(".quarter"):
                    row["quarter"] = v
                else:
                    # parse numeric-like values
                    try:
                        row[k] = float(v)
                    except Exception:
                        row[k] = v
            rows.append(row)
            continue

    return rows


def _find_measure_key(row: Dict[str, Any], measure_base: str) -> Optional[str]:
    """
    For a normalized row, find the concrete measure key (balance_amt_sum, balance_amt_avg, ...)
    """
    prefer = [f"{measure_base}_sum", f"{measure_base}_avg", measure_base, f"{measure_base}_count"]
    for p in prefer:
        if p in row:
            return p
    # fallback: any key containing base
    for k in row.keys():
        if measure_base in k:
            return k
    return None


def fetch_time_series(measure: str, dim: str = "date_qtr.year", extra_params: Dict[str, Any] = None):
    """
    Fetch a single-measure time-series. Returns DataFrame with columns 'year' and measure (value).
    """
    params = {"dim": dim, "measure": measure}
    if extra_params:
        params.update(extra_params)
    raw = _call_olap(params)
    rows = _normalize_cells(raw)
    if not rows:
        return pd.DataFrame(columns=["year", measure])

    normalized = []
    for r in rows:
        year = str(r.get("year") or r.get("label") or "")
        mk = _find_measure_key(r, measure)
        val = float(r.get(mk, 0) if mk else r.get(measure, 0) or 0)
        # carry through common percent fields if present
        normalized.append({"year": year, measure: val, **{k: v for k, v in r.items() if k not in ["year"]}})
    df = pd.DataFrame(normalized)
    # try to sort by numeric year if possible
    try:
        df["year_sort"] = pd.to_numeric(df["year"], errors="coerce")
        df = df.sort_values("year_sort").drop(columns=["year_sort"])
    except Exception:
        df = df.sort_values("year")
    df = df.reset_index(drop=True)
    return df


# ---------- UI: sidebar filters ----------
st.sidebar.header("Filters")
with st.sidebar.form("filters_form"):
    yr_from = st.number_input("Year from", min_value=1900, max_value=2100, value=2018)
    yr_to = st.number_input("Year to", min_value=1900, max_value=2100, value=2024)
    product = st.text_input("Product code (optional)", value="")
    apply = st.form_submit_button("Apply / Refresh")

# small helper to build extra params for OLAP calls
extra = {}
if yr_from:
    extra["year_from"] = yr_from
if yr_to:
    extra["year_to"] = yr_to
if product:
    extra["product"] = product

# ---------- Fetch data (with feedback) ----------
st.title("Credit Metrics — Streamlit Explorer")
st.caption("Connected to OLAP backend: " + OLAP_BASE)

progress = st.progress(0)
try:
    progress.progress(10)
    # main series
    df_orig = fetch_time_series("origination_amt", extra_params={})
    progress.progress(40)
    df_balance = fetch_time_series("balance_amt", extra_params={})
    progress.progress(70)
    df_default = fetch_time_series("default_rate", extra_params={})
    progress.progress(95)

    # product breakdown: try drilldown by year + product
    try:
        raw_pb = _call_olap({"dim": "date_qtr.year,product", "measure": "origination_amt"})
        rows_pb = _normalize_cells(raw_pb)
        df_pb = pd.DataFrame(rows_pb)
        # normalize product column candidates
        if "product" not in df_pb.columns:
            if "product_product_code" in df_pb.columns:
                df_pb = df_pb.rename(columns={"product_product_code": "product"})
            elif "product_code" in df_pb.columns:
                df_pb = df_pb.rename(columns={"product_code": "product"})
    except Exception:
        df_pb = pd.DataFrame()
    progress.progress(100)
except Exception as e:
    st.error(f"Failed to load OLAP data: {e}")
    st.stop()


# ---------- Top KPIs ----------
col1, col2, col3, col4 = st.columns(4)
try:
    total_orig = df_orig["origination_amt"].sum() if "origination_amt" in df_orig.columns else df_orig.iloc[:, 1].sum()
except Exception:
    total_orig = None
try:
    total_balance = df_balance["balance_amt"].sum() if "balance_amt" in df_balance.columns else None
except Exception:
    total_balance = None
try:
    latest_def = None
    if not df_default.empty:
        # normalize default_rate value: could be fraction (0.02) or percent (2.0)
        val = df_default.iloc[-1]
        mk = _find_measure_key(val.to_dict(), "default_rate")
        raw_val = float(val[mk]) if mk else float(val.get("default_rate", 0))
        latest_def = raw_val if raw_val <= 1.0 else raw_val / 100.0
except Exception:
    latest_def = None

col1.metric("Total Origination (sum)", f"₱{int(total_orig):,}" if total_orig is not None else "—")
col2.metric("Total Balance (sum)", f"₱{int(total_balance):,}" if total_balance is not None else "—")
col3.metric("Latest Default Rate", f"{latest_def:.2%}" if latest_def is not None else "—")
col4.metric("Rows (orig/bal/def)", f"{len(df_orig)}/{len(df_balance)}/{len(df_default)}")


# ---------- Charts ----------
st.markdown("### Time series")

c1, c2 = st.columns(2)

with c1:
    if not df_orig.empty:
        # ensure column names
        val_col = _find_measure_key(df_orig.iloc[0].to_dict(), "origination_amt") or "origination_amt"
        fig = px.bar(df_orig, x="year", y=val_col, labels={val_col: "Origination (PHP)", "year": "Year"},
                     title="Origination Amount by Year")
        st.plotly_chart(fig, use_container_width=True)
    else:
        st.info("No origination data")

with c2:
    if not df_balance.empty:
        val_col = _find_measure_key(df_balance.iloc[0].to_dict(), "balance_amt") or "balance_amt"
        fig = px.line(df_balance, x="year", y=val_col, markers=True,
                      labels={val_col: "Balance (PHP)", "year": "Year"},
                      title="Balance Amount by Year")
        st.plotly_chart(fig, use_container_width=True)
    else:
        st.info("No balance data")

st.markdown("### Default Rate")
if not df_default.empty:
    mk = _find_measure_key(df_default.iloc[0].to_dict(), "default_rate")
    col_name = mk or "default_rate"
    # convert values to fraction for plotting
    df_default_plot = df_default.copy()
    df_default_plot[col_name] = df_default_plot[col_name].apply(lambda x: x if x <= 1.0 else x / 100.0)
    fig = px.line(df_default_plot, x="year", y=col_name, markers=True, labels={col_name: "Default Rate", "year": "Year"},
                  title="Default Rate by Year")
    fig.update_yaxes(tickformat=".1%")
    st.plotly_chart(fig, use_container_width=True)
else:
    st.info("No default rate data.")

# ---------- Product breakdown ----------
st.markdown("### Product breakdown (origination by product)")
if not df_pb.empty:
    # try to pivot into stacked bars per year
    df_pb = df_pb.copy()
    # find origination measure key
    mk = _find_measure_key(df_pb.iloc[0].to_dict(), "origination_amt")
    mk = mk or "origination_amt"
    # ensure product column exists
    if "product" not in df_pb.columns:
        # attempt common alternate column names
        for alt in ["product_product_code", "product_code", "product.product_code"]:
            if alt in df_pb.columns:
                df_pb["product"] = df_pb[alt]
                break
    pivot = df_pb.pivot_table(index="year", columns="product", values=mk, aggfunc="sum", fill_value=0).reset_index()
    # plot
    fig = px.bar(pivot, x="year", y=[c for c in pivot.columns if c != "year"], title="Origination by Product (stacked)")
    st.plotly_chart(fig, use_container_width=True)
else:
    st.info("No product-level breakdown returned by OLAP model. (Try running origination by product in API)")

# ---------- Data tables ----------
st.expander("Show raw tables (origination, balance, default, product breakdown)", expanded=False)
with st.expander("Data preview", expanded=False):
    ctab1, ctab2 = st.columns(2)
    with ctab1:
        st.write("Origination sample")
        st.dataframe(df_orig.head(50))
        st.write("Balance sample")
        st.dataframe(df_balance.head(50))
    with ctab2:
        st.write("Default rate sample")
        st.dataframe(df_default.head(50))
        st.write("Product breakdown sample")
        st.dataframe(df_pb.head(50))

st.caption("If data looks wrong, check backend API directly in your browser: e.g. " +
           f"{OLAP_BASE}?dim=date_qtr.year&measure=balance_amt")
