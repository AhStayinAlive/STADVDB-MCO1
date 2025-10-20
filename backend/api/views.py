# backend/api/views.py
import os
from pathlib import Path
from django.conf import settings
from django.http import JsonResponse, HttpResponseBadRequest
from cubes import Workspace
from olap_backend import sqlalchemy_compat  # must come before cubes import


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

        print(f"[DEBUG] Loading model from {model_file}")
        _ws.import_model(str(model_file))
        print(f"[DEBUG] Cubes loaded: {list(_ws.list_cubes())}")
    return _ws


def _build_aggregates(measure_names):
    """Build Cubes-style aggregate names based on measure types."""
    agg_map = {
        "default_rate": "avg",
        "prime_rate": "avg",
        "lending_rate": "avg",
    }

    aggregates = []
    for m in measure_names:
        base = m.strip()
        func = agg_map.get(base, "sum")
        aggregates.append(f"{base}_{func}")
    print(f"📊 Aggregating: {aggregates}")
    return aggregates



def olap_aggregate(request):
    dim = request.GET.get("dim")
    if not dim:
        return HttpResponseBadRequest("Missing 'dim' parameter (e.g. dim=date_qtr.year)")

    drilldown = [d.strip() for d in dim.split(",") if d.strip()]
    measure_param = request.GET.get("measure", "origination_amt")
    measure_names = [m.strip() for m in measure_param.split(",") if m.strip()]

    aggregates = _build_aggregates(measure_names)
    print("📊 Aggregating:", aggregates)

    ws = get_workspace()
    browser = ws.browser("credit_metrics")

    try:
        result = browser.aggregate(drilldown=drilldown, aggregates=aggregates)
    except Exception as e:
        print("❌ Cubes aggregation failed:", e)
        return JsonResponse({"error": str(e)}, status=500)

    normalized_cells = []
    for cell in getattr(result, "cells", []):
        record = {}
        for d in drilldown:
            record[d] = cell.get(d) or getattr(cell, d, None)

        measures = {}
        for agg in aggregates:
            if agg in cell:
                measures[agg] = cell[agg]

        label = "-".join(str(record.get(d, "")) for d in drilldown)
        normalized_cells.append({
            "drilldown": record,
            "label": label,
            "measures": measures,
        })

    return JsonResponse({
        "summary": getattr(result, "summary", {}),
        "cells": normalized_cells,
    }, safe=False)
