from django.shortcuts import render

# Create your views here.
import os
from django.http import JsonResponse, HttpResponseBadRequest
from cubes import Workspace

# Use ENGINE_URL from environment; fallback to a read-only default
SQL_URL = os.environ.get("ENGINE_URL", "mysql+pymysql://dw:DwPass!123@127.0.0.1:3306/gosales_dw")

# Initialize workspace once
workspace = Workspace()
workspace.register_default_store("sql", url=SQL_URL)
workspace.import_model(os.path.join(os.path.dirname(__file__), "model.json"))
browser = workspace.browser("credit_metrics")

def olap_aggregate(request):
    # params: dim=year,dim=country measure=origination_amt
    dims = request.GET.get("dim")
    if not dims:
        return HttpResponseBadRequest("missing 'dim' query param (e.g. dim=year)")
    # allow multiple dims comma-separated
    drilldown = [d.strip() for d in dims.split(",") if d.strip()]
    measures = [request.GET.get("measure", "origination_amt")]
    result = browser.aggregate(drilldown=drilldown, measures=measures)
    return JsonResponse(result.to_dict(), safe=False)
