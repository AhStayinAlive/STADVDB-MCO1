# compatibility shim for libraries that import ABCs from 'collections'
# (works around older packages that use `from collections import MutableMapping`)
try:
    import collections
    import collections.abc as _cabcs
    # only set if missing to avoid overriding newer installations
    if not hasattr(collections, "MutableMapping"):
        collections.MutableMapping = _cabcs.MutableMapping
    if not hasattr(collections, "MutableSet"):
        collections.MutableSet = _cabcs.MutableSet
    if not hasattr(collections, "MutableSequence"):
        collections.MutableSequence = _cabcs.MutableSequence
except Exception:
    # defensive: do nothing if something unexpected happens — we'll surface later
    pass

import os
from pathlib import Path
from urllib.parse import urlparse, unquote

# --- Optional: MySQL via pymysql shim (if mysqlclient not installed)
try:
    import pymysql
    pymysql.install_as_MySQLdb()
except ImportError:
    pass

# --- Base paths ---
BASE_DIR = Path(__file__).resolve().parent.parent

# --- Basic Django settings ---
SECRET_KEY = os.environ.get("SECRET_KEY", "dev-secret-key")
DEBUG = os.environ.get("DEBUG", "1") == "1"
ALLOWED_HOSTS = ["*"]

# --- Installed apps ---
INSTALLED_APPS = [
    "django.contrib.contenttypes",
    "django.contrib.staticfiles",
    "corsheaders",
    "api",
]

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.common.CommonMiddleware",
]

CORS_ALLOW_ALL_ORIGINS = True

ROOT_URLCONF = "olap_backend.urls"
STATIC_URL = "static/"

# ---------------------------------------------------------
# 🔗 DATABASE CONFIGURATION (works with ETL’s ENGINE_URL)
# ---------------------------------------------------------
DEFAULT_DB = {
    "scheme": "mysql",
    "user": os.environ.get("MYSQL_USER", "dw"),
    "password": os.environ.get("MYSQL_PASS", "DwPass!123"),
    "host": os.environ.get("MYSQL_HOST", "127.0.0.1"),
    "port": os.environ.get("MYSQL_PORT", "3306"),
    "name": os.environ.get("MYSQL_DB", "gosales_dw"),
}

ENGINE_URL = os.environ.get(
    "ENGINE_URL",
    f"mysql+pymysql://{DEFAULT_DB['user']}:{DEFAULT_DB['password']}@{DEFAULT_DB['host']}:{DEFAULT_DB['port']}/{DEFAULT_DB['name']}"
)

def _db_from_engine_url(engine_url: str):
    """Parse ENGINE_URL and return Django DATABASES['default'] dict."""
    parsed = urlparse(engine_url)
    scheme = parsed.scheme.split("+", 1)[0] if "+" in parsed.scheme else parsed.scheme

    if scheme in ("postgres", "postgresql"):
        backend = "django.db.backends.postgresql"
    elif scheme == "mysql":
        backend = "django.db.backends.mysql"
    elif scheme == "sqlite":
        backend = "django.db.backends.sqlite3"
    else:
        raise ValueError(f"Unsupported database scheme: {scheme}")

    username = unquote(parsed.username or "")
    password = unquote(parsed.password or "")
    host = parsed.hostname or DEFAULT_DB["host"]
    port = parsed.port or DEFAULT_DB["port"]
    dbname = parsed.path.lstrip("/") if parsed.path else DEFAULT_DB["name"]

    if backend == "django.db.backends.sqlite3":
        dbname = dbname or str(BASE_DIR / "db.sqlite3")

    return {
        "ENGINE": backend,
        "NAME": dbname,
        "USER": username,
        "PASSWORD": password,
        "HOST": host,
        "PORT": str(port),
    }

try:
    DATABASES = {"default": _db_from_engine_url(ENGINE_URL)}
except Exception as e:
    print(f"[WARN] Failed to parse ENGINE_URL: {e}")
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.mysql",
            "NAME": DEFAULT_DB["name"],
            "USER": DEFAULT_DB["user"],
            "PASSWORD": DEFAULT_DB["password"],
            "HOST": DEFAULT_DB["host"],
            "PORT": DEFAULT_DB["port"],
        }
    }

# --- Print summary on startup (for sanity check) ---
# replace the print block with this
masked = DATABASES["default"]["PASSWORD"]
if masked:
    masked = masked[0] + "***" + masked[-1] if len(masked) > 2 else "***"
print("\n[DB CONFIG]")
print(f"  ENGINE_URL = {ENGINE_URL}")
print(f"  Django DB: {DATABASES['default']['ENGINE']} → {DATABASES['default']['HOST']}:{DATABASES['default']['PORT']}/{DATABASES['default']['NAME']}")
print(f"  DB user: {DATABASES['default']['USER']}, password: {masked}")
print()


# --- Make available for Cubes (use same ENGINE_URL) ---
CUBES_ENGINE_URL = ENGINE_URL
