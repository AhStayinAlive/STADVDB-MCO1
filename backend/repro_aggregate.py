# backend/repro_aggregate.py
# Repro: runs the same browser.aggregate() call used by the API and prints full traceback.
# Includes a compatibility shim for Python 3.10+ so old libs (grako/expressions/cubes) import.

# --- Compatibility shim for Python 3.10+ (collections -> collections.abc) ---
import collections
import collections.abc as _abc
for name in ("Mapping", "MutableMapping", "MutableSet", "MutableSequence"):
    if not hasattr(collections, name) and hasattr(_abc, name):
        setattr(collections, name, getattr(_abc, name))
# ---------------------------------------------------------------

import traceback
import os
from pathlib import Path

from olap_backend import sqlalchemy_compat  # must come before cubes import
from cubes import Workspace

ENGINE_URL = os.environ.get("ENGINE_URL", "mysql+pymysql://dw:DwPass!123@127.0.0.1:3306/gosales_dw")

def main():
    try:
        print("ENGINE_URL:", ENGINE_URL)
        ws = Workspace()
        ws.register_default_store("sql", url=ENGINE_URL)

        model_path = Path(__file__).resolve().parent / "api" / "model.json"
        print("Loading model:", model_path)
        ws.import_model(str(model_path))

        browser = ws.browser("credit_metrics")
        print("Browser ready. Running aggregate...")

        # adjust drilldown/aggregates here if you need a different call
        result = browser.aggregate(drilldown=["date_qtr.year"], aggregates=["origination_amt_sum"])
        print("Aggregate result:", result)
    except Exception:
        print("Exception while reproducing aggregate:")
        traceback.print_exc()

if __name__ == "__main__":
    main()
