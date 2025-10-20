# backend/sqlalchemy_compat.py
"""
Safe compatibility shim: add a .count() method to SQLAlchemy Select/Subquery objects
so older libraries (cubes) that call statement.alias().count() keep working.

This is minimal and does not replace any Cubes code.
Import this module before importing cubes (e.g. at top of repro script or settings).
"""

# defensive imports
try:
    import sqlalchemy as sa
    from sqlalchemy import select, func
    # Try the usual class locations
    try:
        from sqlalchemy.sql.selectable import Subquery, Select
    except Exception:
        # fallback: attributes under sa.sql
        Subquery = getattr(sa.sql, "Subquery", None)
        Select = getattr(sa.sql, "Select", None)
except Exception:
    sa = None
    select = None
    func = None
    Subquery = None
    Select = None

def _count_from_subquery(obj):
    """
    Return a SQLAlchemy selectable: SELECT COUNT(*) FROM (<obj>) AS alias
    Works for Subquery objects or Select objects (we convert to subquery()).
    """
    if select is None or func is None:
        raise RuntimeError("SQLAlchemy not available for count shim.")
    try:
        # If obj is already a Subquery (has no subquery() method), use it directly.
        return select(func.count()).select_from(obj)
    except Exception:
        # If obj is a Select, convert to subquery() then use it
        try:
            sub = obj.subquery()
            return select(func.count()).select_from(sub)
        except Exception:
            # As a last resort, try alias()
            alias = getattr(obj, "alias", None)
            if callable(alias):
                return select(func.count()).select_from(obj.alias())
            raise

# Attach method only if class exists and does not already have .count
try:
    if Subquery is not None and not hasattr(Subquery, "count"):
        Subquery.count = lambda self: _count_from_subquery(self)
    if Select is not None and not hasattr(Select, "count"):
        Select.count = lambda self: _count_from_subquery(self)
except Exception:
    # Don't crash on import if we can't patch for some reason
    pass
