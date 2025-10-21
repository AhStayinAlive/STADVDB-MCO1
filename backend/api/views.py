# backend/api/views.py
import os
import logging
from pathlib import Path
from django.conf import settings
from django.http import JsonResponse, HttpResponseBadRequest
from django.views.decorators.http import require_GET
from cubes import Workspace
from olap_backend import sqlalchemy_compat

logger = logging.getLogger(__name__)

# --------------------------------------------------------------------
# Workspace setup
_ws = None
def get_workspace():
    global _ws
    if _ws is None:
        _ws = Workspace()
        sql_url = getattr(settings, "CUBES_ENGINE_URL", os.environ.get("ENGINE_URL"))
        if not sql_url:
            raise RuntimeError("No ENGINE_URL / CUBES_ENGINE_URL configured for Cubes.")
        _ws.register_default_store("sql", url=sql_url)
        model_file = Path(__file__).parent / "model.json"
        if not model_file.exists():
            raise RuntimeError(f"model.json not found at {model_file}")
        _ws.import_model(str(model_file))
    return _ws

# --------------------------------------------------------------------
# OLAP aggregate endpoint
def olap_aggregate(request):
    dim = request.GET.get("dim")
    if not dim:
        return HttpResponseBadRequest("Missing 'dim' parameter")
    drilldown = [d.strip() for d in dim.split(",") if d.strip()]
    measure_param = request.GET.get("measure", "origination_amt")
    measure_names = [m.strip() for m in measure_param.split(",") if m.strip()]
    aggregates = [f"{m}_sum" for m in measure_names]

    ws = get_workspace()
    browser = ws.browser("credit_metrics")
    result = browser.aggregate(drilldown=drilldown, aggregates=aggregates)
    normalized_cells = []
    for cell in getattr(result, "cells", []):
        record = {}
        if hasattr(cell, "key_dict"):
            record.update(cell.key_dict)
        measures = getattr(cell, "record", {}) or getattr(cell, "aggregates", {})
        normalized_cells.append({"drilldown": record, "measures": measures})
    return JsonResponse({"cells": normalized_cells})

# --------------------------------------------------------------------
# Quarter helper functions
def parse_quarter(q):
    """Parse 'YYYYQn' or 'YYYY-Qn' or 'YYYY Qn' into (year, quarter)"""
    if q is None:
        return None
    s = str(q).upper().replace("-", "Q").replace(" ", "Q")
    import re
    m = re.match(r"^(\d{4}).*?Q?([1-4])$", s)
    if not m:
        m = re.match(r"^(\d{4})([1-4])$", s)
    if not m:
        return None
    return (int(m.group(1)), int(m.group(2)))

def quarter_to_key(y, q): return f"{y}Q{q}"

def prev_quarter(qkey):
    parsed = parse_quarter(qkey)
    if not parsed: return None
    y, q = parsed
    return quarter_to_key(y - 1, 4) if q == 1 else quarter_to_key(y, q - 1)

def same_quarter_last_year(qkey):
    parsed = parse_quarter(qkey)
    if not parsed: return None
    y, q = parsed
    return quarter_to_key(y - 1, q)

def pct_change(curr, prev):
    try:
        if prev is None: return None
        prev = float(prev); curr = float(curr)
        if prev == 0: return None
        return (curr - prev) / prev
    except Exception:
        return None

# --------------------------------------------------------------------
# Portfolio KPI Snapshot
@require_GET
def portfolio_kpis(request):
    """
    API: GET /api/olap/portfolio_kpis
    Optional params:
      product=<product_code>
      quarters=<comma separated>
    """
    product_filter = request.GET.get("product")
    quarters_param = request.GET.get("quarters")
    quarter_whitelist = [q.strip() for q in quarters_param.split(",") if q.strip()] if quarters_param else None

    aggregates = [
        "origination_amt_sum",
        "balance_amt_sum",
        "delinquent_amt_sum",
        "chargeoff_amt_sum"
    ]

    try:
        ws = get_workspace()
        browser = ws.browser("credit_metrics")
    except Exception as e:
        logger.exception("Failed to obtain cubes workspace/browser")
        return JsonResponse({"error": f"workspace error: {str(e)}"}, status=500)

    drilldown = ["date_qtr.quarter", "product.product_code"]
    cut = {"product.product_code": product_filter} if product_filter else None

    try:
        raw = browser.aggregate(drilldown=drilldown, aggregates=aggregates, cut=cut)
    except Exception as e:
        logger.exception("Cubes aggregation failed")
        return JsonResponse({"error": str(e)}, status=500)

    cells = getattr(raw, "cells", []) or raw.get("cells", [])
    summary = getattr(raw, "summary", {}) if hasattr(raw, "summary") else raw.get("summary", {})

    # normalize data
    normalized = []
    for c in cells:
        drill = c.get("drilldown", {}) if isinstance(c, dict) else getattr(c, "drilldown", {})
        measures = c.get("measures", {}) if isinstance(c, dict) else getattr(c, "measures", {})
        q = drill.get("date_qtr.quarter") or c.get("date_qtr.quarter", "UNKNOWN")
        product = drill.get("product.product_code") or c.get("product.product_code", "UNKNOWN")
        normalized.append({
            "quarter": q,
            "product": product,
            "measures": measures
        })

    # build pivot
    pivot, quarter_set = {}, set()
    for r in normalized:
        q = r["quarter"]; p = r["product"]
        if quarter_whitelist and q not in quarter_whitelist: continue
        quarter_set.add(q)
        pivot.setdefault(p, {})[q] = {
            k.replace("_sum", ""): float(r["measures"].get(k, 0))
            for k in aggregates
        }

    def quarter_sort_key(q):
        parsed = parse_quarter(q)
        return (parsed[0], parsed[1]) if parsed else (9999, q)

    quarters = sorted(quarter_set, key=quarter_sort_key)
    totals = {q: {"origination_amt":0,"balance_amt":0,"delinquent_amt":0,"chargeoff_amt":0} for q in quarters}
    rows = []

    for product, qmap in pivot.items():
        for q in quarters:
            cell = qmap.get(q, {"origination_amt":0,"balance_amt":0,"delinquent_amt":0,"chargeoff_amt":0})
            prev_cell = qmap.get(prev_quarter(q), {"origination_amt":0,"balance_amt":0})
            ly_cell = qmap.get(same_quarter_last_year(q), {"origination_amt":0,"balance_amt":0})

            originations = cell["origination_amt"]
            balance = cell["balance_amt"]
            delinquent_amt = cell["delinquent_amt"]
            chargeoff_amt = cell["chargeoff_amt"]

            rows.append({
                "product": product,
                "quarter": q,
                "originations": originations,
                "originations_qoq": pct_change(originations, prev_cell["origination_amt"]),
                "originations_yoy": pct_change(originations, ly_cell["origination_amt"]),
                "balance": balance,
                "balance_qoq": pct_change(balance, prev_cell["balance_amt"]),
                "balance_yoy": pct_change(balance, ly_cell["balance_amt"]),
                "delinquency_pct": (delinquent_amt / balance) if balance else None,
                "chargeoff_pct": (chargeoff_amt / balance) if balance else None,
            })

            tq = totals[q]
            tq["origination_amt"] += originations
            tq["balance_amt"] += balance
            tq["delinquent_amt"] += delinquent_amt
            tq["chargeoff_amt"] += chargeoff_amt

    totals_out = []
    for q in quarters:
        t = totals[q]
        totals_out.append({
            "quarter": q,
            **t,
            "delinquency_pct": (t["delinquent_amt"] / t["balance_amt"]) if t["balance_amt"] else None,
            "chargeoff_pct": (t["chargeoff_amt"] / t["balance_amt"]) if t["balance_amt"] else None,
        })

    return JsonResponse({
        "quarters": quarters,
        "rows": rows,
        "totals": totals_out,
        "summary": summary
    }, safe=False)
