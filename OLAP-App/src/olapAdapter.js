// src/adapters/olapAdapter.js
const BASE_URL = "http://127.0.0.1:8000/api/olap/aggregate";

export const OLAPAdapter = {
  async fetchAggregate(dim, measure) {
    const url = `${BASE_URL}?dim=${encodeURIComponent(dim)}&measure=${encodeURIComponent(measure)}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`OLAP fetch failed: ${response.statusText}`);
    return await response.json();
  },

  async fetchOriginationByYear() {
    const data = await this.fetchAggregate("date_qtr.year", "origination_amt");
    return data.cells.map(c => ({
      year: c.drilldown["date_qtr.year"],
      origination_amt: parseFloat(c.measures.origination_amt_sum)
    }));
  },

  async fetchBalanceByYear() {
    const data = await this.fetchAggregate("date_qtr.year", "balance_amt");
    return data.cells.map(c => ({
      year: c.drilldown["date_qtr.year"],
      balance_amt: parseFloat(c.measures.balance_amt_sum)
    }));
  },

  async fetchDefaultRateByYear() {
    const data = await this.fetchAggregate("date_qtr.year", "default_rate");
    return data.cells.map(c => ({
      year: c.drilldown["date_qtr.year"],
      default_rate: parseFloat(c.measures.default_rate_avg)
    }));
  }
};
