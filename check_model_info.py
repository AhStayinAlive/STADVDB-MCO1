import collections
if not hasattr(collections, "Mapping"):
    import collections.abc
    collections.Mapping = collections.abc.Mapping
if not hasattr(collections, "MutableMapping"):
    import collections.abc
    collections.MutableMapping = collections.abc.MutableMapping

from cubes import Workspace


ws = Workspace()
ws.register_default_store("sql", url="mysql+pymysql://dw:DwPass!123@127.0.0.1:3306/gosales_dw")
ws.import_model("backend/api/model.json")

cube = ws.cube("credit_metrics")

print("📦 Cube:", cube.name)
print("\n🧩 Dimensions & Levels:")
for dim in cube.dimensions:
    print(f" - {dim.name}")
    for lvl in dim.levels:
        print(f"    • {lvl.name}")
