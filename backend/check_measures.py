# --- Compatibility patch for Python 3.10+ ---
import collections
import collections.abc as cabc
for name in ("Mapping", "MutableMapping", "MutableSet", "MutableSequence"):
    if not hasattr(collections, name):
        setattr(collections, name, getattr(cabc, name))
# --------------------------------------------

from cubes import Workspace
from olap_backend import sqlalchemy_compat  # keep this line

# Load workspace and cube
ws = Workspace()
ws.register_default_store("sql", url="mysql+pymysql://dw:DwPass!123@127.0.0.1:3306/gosales_dw")
ws.import_model("api/model.json")

cube = ws.cube("credit_metrics")  # adjust if name differs

print("✅ Loaded cube:", cube.name)
print("📏 Measures:")
for m in cube.measures:
    print(" -", m.name)
