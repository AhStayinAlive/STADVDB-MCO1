// src/adapters/OLAPAdapter.js
const BASE_URL = "http://127.0.0.1:8000/api/olap/aggregate";

/**
 * Helper to fetch OLAP data from backend and normalize it for Recharts.
 * @param {string} measure - base measure name (e.g. "balance_amt", "default_rate")
 * @returns {Promise<Array<{year:number, [key:string]:number}>>}
 */
async function fetchOLAP(measure) {
  // ✅ matches your Django endpoint signature
  const url = `${BASE_URL}?dim=date_qtr.year&measure=${measure}`;

  const res = await fetch(url);
  if (!res.ok) {
    console.error(`❌ OLAP fetch failed for ${measure}:`, res.statusText);
    return [];
  }

  const json = await res.json();
  if (!json?.cells) {
    console.warn(`⚠️ No cells returned for ${measure}`);
    return [];
  }

  // Determine which aggregation was returned (_sum or _avg)
  const cell0 = json.cells[0]?.measures || {};
  const aggKey = Object.keys(cell0).find(k => k.startsWith(measure)) || `${measure}_sum`;

  // Normalize for Recharts
  return json.cells.map(c => ({
    year: c.drilldown?.["date_qtr.year"] ?? c.label,
    [measure]: parseFloat(c.measures?.[aggKey] ?? 0),
  }));
}

export const OLAPAdapter = {
  fetchOriginationByYear: () => fetchOLAP("origination_amt"),
  fetchBalanceByYear: () => fetchOLAP("balance_amt"),
  fetchDefaultRateByYear: () => fetchOLAP("default_rate"),
  fetchPrimeRateByYear: () => fetchOLAP("prime_rate"),
  fetchLendingRateByYear: () => fetchOLAP("lending_rate"),
  fetchOriginationsCountByYear: () => fetchOLAP("originations_cnt"),
};
