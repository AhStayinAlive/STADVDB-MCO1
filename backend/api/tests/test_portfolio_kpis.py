# backend/api/tests/test_portfolio_kpis.py
from django.test import TestCase, Client
from unittest.mock import patch, MagicMock

class PortfolioKPIsTest(TestCase):
    def setUp(self):
        self.client = Client()

        # create fake cells replicating cubes response shape
        # two products (P1,P2), three quarters (2020Q4,2021Q1,2021Q2)
        self.fake_cells = [
            # product P1: 2020Q4
            {"drilldown": {"date_qtr.quarter": "2020Q4", "product.product_code": "P1"},
             "measures": {"origination_amt_sum": "1000", "balance_amt_sum": "10000", "delinquent_amt_sum": "100", "chargeoff_amt_sum": "10"}},
            # product P1: 2021Q1 (prev -> 2020Q4)
            {"drilldown": {"date_qtr.quarter": "2021Q1", "product.product_code": "P1"},
             "measures": {"origination_amt_sum": "1100", "balance_amt_sum": "10500", "delinquent_amt_sum": "120", "chargeoff_amt_sum": "12"}},
            # product P1: 2021Q2
            {"drilldown": {"date_qtr.quarter": "2021Q2", "product.product_code": "P1"},
             "measures": {"origination_amt_sum": "1210", "balance_amt_sum": "10600", "delinquent_amt_sum": "130", "chargeoff_amt_sum": "13"}},

            # product P2: simple values
            {"drilldown": {"date_qtr.quarter": "2020Q4", "product.product_code": "P2"},
             "measures": {"origination_amt_sum": "2000", "balance_amt_sum": "20000", "delinquent_amt_sum": "200", "chargeoff_amt_sum": "20"}},
            {"drilldown": {"date_qtr.quarter": "2021Q1", "product.product_code": "P2"},
             "measures": {"origination_amt_sum": "2200", "balance_amt_sum": "20200", "delinquent_amt_sum": "210", "chargeoff_amt_sum": "21"}},
            {"drilldown": {"date_qtr.quarter": "2021Q2", "product.product_code": "P2"},
             "measures": {"origination_amt_sum": "2420", "balance_amt_sum": "20500", "delinquent_amt_sum": "230", "chargeoff_amt_sum": "23"}},
        ]

        # fake aggregation result returned by workspace.browser.aggregate(...)
        self.fake_result = {"cells": self.fake_cells, "summary": {"origination_amt_sum": "8940"}}

    def fake_browser(self, *args, **kwargs):
        fake_browser = MagicMock()
        fake_browser.aggregate.return_value = self.fake_result
        return fake_browser

    @patch("api.views.get_workspace")
    def test_portfolio_kpis_basic(self, mock_get_ws):
        # mock workspace.browser to return a fake browser object
        fake_ws = MagicMock()
        fake_ws.browser.return_value = self.fake_browser()
        mock_get_ws.return_value = fake_ws

        resp = self.client.get("/api/olap/portfolio_kpis")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        # basic shape checks
        self.assertIn("quarters", data)
        self.assertIn("rows", data)
        self.assertIn("totals", data)

        # ensure quarters include expected ones and are sorted
        self.assertEqual(data["quarters"], ["2020Q4", "2021Q1", "2021Q2"])

        # find a row for P1,2021Q1 and validate QoQ calculation:
        p1q1 = next((r for r in data["rows"] if r["product"]=="P1" and r["quarter"]=="2021Q1"), None)
        self.assertIsNotNone(p1q1)
        # originations for P1 2021Q1 was 1100; prev quarter (2020Q4) was 1000 => qoq = 0.1
        self.assertAlmostEqual(p1q1["originations_qoq"], 0.1, places=3)
        # check delinquency_pct = delinquent_amt / balance_amt
        self.assertAlmostEqual(p1q1["delinquency_pct"], 120/10500, places=6)
