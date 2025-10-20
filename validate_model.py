# --- Compatibility patch for old libraries ---
import collections
import collections.abc as cabc
for name in ("Mapping", "MutableMapping", "MutableSet", "MutableSequence"):
    if not hasattr(collections, name):
        setattr(collections, name, getattr(cabc, name))

from cubes import Workspace

print("🔍 Validating model.json ...")

try:
    ws = Workspace()
    ws.import_model("backend/api/model.json")

    # If this line runs, the model parsed correctly
    print("✅ Model validated successfully!")

    # Try to get cube names
    try:
        cubes = [c.name for c in ws.list_cubes()]
        print("Cubes found:", cubes)
    except Exception:
        print("ℹ️  Could not list cubes (this Cubes version might not expose them).")

except Exception as e:
    print("❌ Model validation failed:")
    print(e)
