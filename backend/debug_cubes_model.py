# --- compatibility shim for Python 3.10+ (grako/expressions) ---
import collections
import collections.abc as _abc
for name in ("Mapping", "MutableMapping", "MutableSet", "MutableSequence"):
    if not hasattr(collections, name) and hasattr(_abc, name):
        setattr(collections, name, getattr(_abc, name))
# ---------------------------------------------------------------

from cubes import Workspace
import os, pathlib

ENGINE_URL = os.environ.get("ENGINE_URL", "mysql+pymysql://dw:DwPass!123@127.0.0.1:3306/gosales_dw")
ws = Workspace()
ws.register_default_store("sql", url=ENGINE_URL)
model_path = pathlib.Path("backend/api/model.json").resolve()
print("Loading model:", model_path)
ws.import_model(str(model_path))

cube = ws.cube("credit_metrics")
print("Cube:", cube.name)
print("Measures:", [m.name for m in cube.measures])
print("Aggregates:", [a.name + ' -> ' + getattr(a, 'measure', getattr(a, 'attribute', '??')) for a in cube.aggregates])
print("Dimensions:", [d.name for d in cube.dimensions])
