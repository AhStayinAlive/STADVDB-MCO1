// src/adapters/OLAPAdapter.js
const BASE_URL = "http://127.0.0.1:8000/api/olap/aggregate";

/**
 * Generic fetch wrapper for the OLAP endpoint.
 * Accepts a query string (everything after BASE_URL?) or an object with params.
 */
async function _fetchRaw(params) {
  const qs = typeof params === "string"
    ? params
    : new URLSearchParams(params).toString();
  const url = `${BASE_URL}?${qs}`;

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`OLAP fetch failed (${res.status}): ${res.statusText}`);
  }
  return res.json();
}

/**
 * Parse a cubes OLAP response into an array of rows like:
 * { year: "...", product?: "...", <measureKey>: number, ... }
 *
 * The cubes response in different setups can be:
 *  - { cells: [ { drilldown: { "date_qtr.year": "2021" }, measures: { balance_amt_sum: "123" } }, ... ] }
 *  - { cells: [ { "date_qtr.year": "2021", "date_qtr.quarter": "Q1", "balance_amt_sum": "123" }, ... ] }
 *
 * This parser supports both forms.
 */
function _normalizeCells(json) {
  if (!json || !Array.isArray(json.cells)) return [];

  return json.cells.map((cell) => {
    // case A: nested { drilldown, measures } (older/some workspace versions)
    if (cell.drilldown || cell.measures) {
      const row = {};
      const dd = cell.drilldown || {};
      // copy drilldown keys, normalize `date_qtr.year` -> year
      Object.entries(dd).forEach(([k, v]) => {
        // prefer a short key when possible
        if (k.endsWith("date_qtr.year") || k === "date_qtr.year") row.year = v;
        else if (k.endsWith("date_qtr.quarter") || k === "date_qtr.quarter") row.quarter = v;
        else row[k] = v;
      });

      // copy measures; measures keys often end with _sum/_avg etc.
      const measures = cell.measures || {};
      Object.entries(measures).forEach(([mk, mv]) => {
        // preserve original measure key (e.g. balance_amt_sum)
        row[mk] = Number(mv ?? 0);
      });

      return row;
    }

    // case B: flattened map like { 'date_qtr.year': '2021', 'balance_amt_sum': '123' }
    const row = {};
    Object.entries(cell).forEach(([k, v]) => {
      if (k === "date_qtr.year" || k.endsWith(".year")) row.year = v;
      else if (k === "date_qtr.quarter" || k.endsWith(".quarter")) row.quarter = v;
      else row[k] = isNaN(Number(v)) ? v : Number(v);
    });

    return row;
  });
}

/**
 * Utility to find measure column name in a normalized row.
 * e.g. for measure 'balance_amt' it will try balance_amt_sum, balance_amt_avg, balance_amt
 */
function _findMeasureKey(row, measureBase) {
  const candidates = Object.keys(row);
  const prefer = [
    `${measureBase}_sum`,
    `${measureBase}_avg`,
    `${measureBase}`,
    `${measureBase}_count`,
  ];
  for (const p of prefer) if (candidates.includes(p)) return p;
  // fallback: return first candidate containing measureBase
  const fallback = candidates.find((k) => k.includes(measureBase));
  return fallback || null;
}

/**
 * Fetch a single-measure time-series (year -> value). Returns [{ year, <measure>: value }, ...]
 */
async function fetchOLAPSingleMeasure(measure, extraParams = {}) {
  const params = { dim: "date_qtr.year", measure, ...extraParams };
  const raw = await _fetchRaw(params);
  const rows = _normalizeCells(raw);

  // convert to { year, [measure]: value } using measure key discovery
  return rows.map((r) => {
    const mk = _findMeasureKey(r, measure);
    const val = mk ? Number(r[mk] ?? 0) : 0;
    return {
      year: String(r.year ?? r["year"] ?? r.label ?? r["date_qtr.year"] ?? ""),
      [measure]: val,
      // keep any percent fields if present
      delinquency_pct: r.delinquency_pct ?? r["delinquency_pct"] ?? r["delinquency_pct_sum"] ?? null,
      chargeoff_pct: r.chargeoff_pct ?? r["chargeoff_pct"] ?? r["chargeoff_pct_sum"] ?? null,
      // keep raw amounts by name if they exist
      delinquent_amt: r.delinquent_amt ?? r["delinquent_amt"] ?? null,
      chargeoff_amt: r.chargeoff_amt ?? r["chargeoff_amt"] ?? null,
      // keep any product or quarter if present (useful for pivoting)
      product: r.product ?? r["product.product_code"] ?? r["product_code"] ?? null,
      quarter: r.quarter ?? r["quarter"] ?? null,
      // preserve original row in case caller needs it
      _raw: r,
    };
  });
}

/**
 * Try product-level origination first (drilldown by year + product), fallback to year-only.
 * If product-level response is present, returns rows like:
 *  [{ year, product, origination_amt }, ... ]
 * Otherwise, returns [{ year, origination_amt }, ... ]
 */
async function fetchOriginationByYearOrProduct() {
  // try product-level first
  try {
    const json = await _fetchRaw({ dim: "date_qtr.year,product", measure: "origination_amt" });
    const rows = _normalizeCells(json);
    // detect product presence
    const hasProduct = rows.some((r) => r.product || r["product.product_code"] || r["product_code"]);
    if (rows.length > 0 && hasProduct) {
      // normalize fields
      return rows.map((r) => {
        const year = String(r.year ?? r["year"] ?? r["date_qtr.year"] ?? "");
        const product = r.product ?? r["product.product_code"] ?? r["product_code"] ?? "UNKNOWN";
        const mk = _findMeasureKey(r, "origination_amt");
        const val = mk ? Number(r[mk] ?? 0) : Number(r.origination_amt ?? 0);
        return { year, product, origination_amt: val, _raw: r };
      });
    }
    // if empty or no product, fallback to year-only
  } catch (e) {
    // ignore and fallback
    console.debug("product-level origination fetch failed/fallback:", e.message);
  }

  // fallback: year-only
  const single = await fetchOLAPSingleMeasure("origination_amt");
  // map to simple shape (year, origination_amt)
  return single.map((r) => ({ year: r.year, origination_amt: r.origination_amt, _raw: r._raw }));
}

/**
 * Fetch balance by year (keeps it simple)
 */
async function fetchBalanceByYear() {
  return fetchOLAPSingleMeasure("balance_amt");
}

/**
 * Fetch default_rate by year (avg or similar)
 */
async function fetchDefaultRateByYear() {
  return fetchOLAPSingleMeasure("default_rate");
}

/**
 * Fetch risk data: delinquent_amt + chargeoff_amt + optional percents.
 * Implementation: fetch each measure then merge by year.
 * Returns rows: { year, delinquent_amt, chargeoff_amt, delinquency_pct?, chargeoff_pct? }
 */
async function fetchRiskByYear() {
  // fetch amounts
  const [delRows, chargeRows] = await Promise.all([
    fetchOLAPSingleMeasure("delinquent_amt"),
    fetchOLAPSingleMeasure("chargeoff_amt"),
  ]);

  // try to fetch percent fields (if available from the endpoint named e.g. delinquency_pct)
  // If your API doesn't have percent measure, the percent fields will remain null.
  let pctRows = [];
  try {
    const res = await _fetchRaw({ dim: "date_qtr.year", measure: "delinquency_pct,chargeoff_pct" });
    pctRows = _normalizeCells(res).map(r => ({
      year: String(r.year ?? r["year"] ?? ""),
      delinquency_pct: r.delinquency_pct ?? r["delinquency_pct"] ?? null,
      chargeoff_pct: r.chargeoff_pct ?? r["chargeoff_pct"] ?? null,
    }));
  } catch (_) {
    // ignore; not all models expose percent measures
    pctRows = [];
  }

  // merge by year
  const map = new Map();
  delRows.forEach(r => {
    map.set(r.year, { year: r.year, delinquent_amt: Number(r.delinquent_amt ?? r.delinquent_amt ?? r["delinquent_amt"] ?? r["delinquent_amt_sum"] ?? r["delinquent_amt_sum"] ?? r["delinquent_amt"] ?? r["delinquent_amt"] ?? r["delinquent_amt"] ?? r.delinquent_amt ?? 0) || Number(r["delinquent_amt"] ?? 0) || 0 });
  });
  chargeRows.forEach(r => {
    const entry = map.get(r.year) || { year: r.year };
    entry.chargeoff_amt = Number(r.chargeoff_amt ?? r.chargeoff_amt ?? r["chargeoff_amt"] ?? r["chargeoff_amt_sum"] ?? 0) || 0;
    map.set(r.year, entry);
  });
  pctRows.forEach(r => {
    const entry = map.get(r.year) || { year: r.year };
    if (r.delinquency_pct != null) entry.delinquency_pct = Number(r.delinquency_pct);
    if (r.chargeoff_pct != null) entry.chargeoff_pct = Number(r.chargeoff_pct);
    map.set(r.year, entry);
  });

  // If map is empty (maybe different shapes), attempt an alternate single-call approach
  if (map.size === 0) {
    // attempt single call returning both measures (some API variations include both in measures)
    try {
      const raw = await _fetchRaw({ dim: "date_qtr.year", measure: "delinquent_amt,chargeoff_amt" });
      const rows = _normalizeCells(raw);
      rows.forEach(r => {
        const year = String(r.year ?? "");
        const entry = map.get(year) || { year };
        const dm = _findMeasureKey(r, "delinquent_amt");
        const cm = _findMeasureKey(r, "chargeoff_amt");
        if (dm) entry.delinquent_amt = Number(r[dm] ?? 0);
        if (cm) entry.chargeoff_amt = Number(r[cm] ?? 0);
        if (r.delinquency_pct != null) entry.delinquency_pct = Number(r.delinquency_pct);
        if (r.chargeoff_pct != null) entry.chargeoff_pct = Number(r.chargeoff_pct);
        map.set(year, entry);
      });
    } catch (e) {
      // give up — return empty array
      console.debug("fetchRiskByYear: alternate single-call failed:", e.message);
    }
  }

  // return sorted array by numeric year when possible
  const arr = Array.from(map.values());
  arr.sort((a, b) => {
    const an = Number(a.year), bn = Number(b.year);
    if (!isNaN(an) && !isNaN(bn)) return an - bn;
    return (a.year || "").localeCompare(b.year || "");
  });

  return arr;
}

/**
 * Exported adapter functions (used by the Dashboard component)
 */
export const OLAPAdapter = {
  fetchOriginationByYearOrProduct,
  fetchOriginationByYear: () => fetchOLAPSingleMeasure("origination_amt"),
  fetchBalanceByYear,
  fetchDefaultRateByYear,
  fetchPrimeRateByYear: () => fetchOLAPSingleMeasure("prime_rate"),
  fetchLendingRateByYear: () => fetchOLAPSingleMeasure("lending_rate"),
  fetchOriginationsCountByYear: () => fetchOLAPSingleMeasure("originations_cnt"),
  fetchRiskByYear,
};
