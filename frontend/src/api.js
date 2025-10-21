const API_BASE_URL = "http://127.0.0.1:8000";

export async function fetchKPISummary() {
  const res = await fetch(`${API_BASE_URL}/kpi/summary`);
  if (!res.ok) throw new Error("Failed to fetch KPI summary");
  return res.json();
}

export async function fetchQuarterlyMetrics() {
  const res = await fetch(`${API_BASE_URL}/aggregate/quarterly`);
  if (!res.ok) throw new Error("Failed to fetch quarterly metrics");
  return res.json();
}
