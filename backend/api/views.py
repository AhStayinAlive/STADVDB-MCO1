# backend/api/views.py
import os
from pathlib import Path
from django.conf import settings
from django.http import JsonResponse, HttpResponseBadRequest
from cubes import Workspace
from olap_backend import sqlalchemy_compat  # must come before cubes import


_ws = None
def get_workspace():
    """Initialize or reuse the Cubes workspace."""
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


def _build_aggregates(measure_names):
    """Build Cubes-style aggregate names (e.g., origination_amt_sum)."""
    return [f"{m.strip()}_sum" for m in measure_names if m.strip()]


def olap_aggregate(request):
    """
    Example:
        /api/olap/aggregate?dim=date_qtr.year&measure=origination_amt
    Query Params:
        dim:     required, comma-separated drilldowns
        measure: optional, comma-separated measure names (default: origination_amt)
    """
    dim = request.GET.get("dim")
    if not dim:
        return HttpResponseBadRequest("Missing 'dim' parameter (e.g. dim=date_qtr.year)")

    drilldown = [d.strip() for d in dim.split(",") if d.strip()]
    measure_param = request.GET.get("measure", "origination_amt")
    measure_names = [m.strip() for m in measure_param.split(",") if m.strip()]
    if not measure_names:
        return HttpResponseBadRequest("No valid 'measure' specified")

    aggregates = _build_aggregates(measure_names)

    ws = get_workspace()
    browser = ws.browser("credit_metrics")

    try:
        result = browser.aggregate(drilldown=drilldown, aggregates=aggregates)
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)

    # --- Normalize result to JSON-safe format ---
    normalized_cells = []
    for cell in getattr(result, "cells", []):
        record = {}
        # Collect dimension values
        for d in drilldown:
            if d in cell:
                record[d] = cell[d]
            elif hasattr(cell, "key_dict"):
                record.update(cell.key_dict)

        # Collect aggregate values
        measures = {}
        # Cubes 1.1 sometimes puts aggregates in 'record' or 'aggregates'
        if hasattr(cell, "record"):
            measures.update(cell.record)
        elif hasattr(cell, "aggregates"):
            measures.update(cell.aggregates)
        else:
            # fallback: check if they exist as direct keys
            for agg in aggregates:
                if agg in cell:
                    measures[agg] = cell[agg]

        label = "-".join(str(record.get(d)) for d in drilldown if d in record)
        normalized_cells.append({
            "drilldown": record,
            "label": label,
            "measures": measures,
        })

    response_data = {
        "summary": getattr(result, "summary", {}),
        "cells": normalized_cells,
    }

    return JsonResponse(response_data, safe=False)
