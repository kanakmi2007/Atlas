"""
End-to-end Automated Verification Test Suite for Atlas (SupplyChain360 AI).
Tests all 5 sub-agents, validation guardrails, ambiguity guardrails, artifact engines,
and FastAPI endpoints.
"""

import os
import sys
import unittest
import pandas as pd
from fastapi.testclient import TestClient

import data_generator
from agents import (
    validate_and_load_manifest,
    sub_agent_sourcing_audit,
    sub_agent_production_capacity,
    sub_agent_logistics_reroute,
    sub_agent_demand_inventory,
    sub_agent_artifact_engine,
    MasterOrchestrator,
    OUTPUTS_DIR,
)
from main import app


class TestSupplyChain360(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        """Ensure test datasets are generated."""
        data_generator.generate_supply_chain_manifest("supply_chain_manifest.csv")
        data_generator.generate_corrupt_manifest("corrupt_test_manifest.csv")
        cls.client = TestClient(app)

    def test_01_manifest_generation(self):
        """Verifies synthetic dataset structure and columns."""
        self.assertTrue(os.path.exists("supply_chain_manifest.csv"))
        df = pd.read_csv("supply_chain_manifest.csv")
        self.assertEqual(len(df), 25, "Manifest must contain exactly 25 rows")
        self.assertEqual(len(df.columns), 15, "Manifest must contain exactly 15 columns")

        # Verify planted multi-node failures
        disrupted = df[df["route_zone"].str.contains("Red Sea|Hormuz", case=False, na=False)]
        self.assertGreaterEqual(len(disrupted), 6, "At least 6 shipments must be in geopolitical risk zones")

        high_lead = df[df["lead_time_days"] > 14]
        self.assertGreaterEqual(len(high_lead), 4, "At least 4 suppliers must exceed 14 days lead time")

        critical_stock = df[(df["current_stock"] / df["daily_demand"]) < 7.0]
        self.assertGreaterEqual(len(critical_stock), 5, "At least 5 SKUs must face critical stockouts (<7 days)")

    def test_02_validation_guardrails(self):
        """Tests validation tool against both valid and corrupt manifests."""
        # Valid manifest
        res_valid = validate_and_load_manifest("supply_chain_manifest.csv")
        self.assertTrue(res_valid["valid"])
        self.assertEqual(res_valid["row_count"], 25)

        # Corrupt manifest (missing columns)
        res_corrupt = validate_and_load_manifest("corrupt_test_manifest.csv")
        self.assertFalse(res_corrupt["valid"])
        self.assertIn("Missing required columns", res_corrupt["error"])
        self.assertIn("origin_lat", res_corrupt["error"])
        self.assertIn("cargo_value_usd", res_corrupt["error"])

    def test_03_sourcing_sub_agent(self):
        """Tests supplier risk audit and lead time thresholds."""
        res = sub_agent_sourcing_audit("supply_chain_manifest.csv")
        self.assertEqual(res["node"], "Sourcing")
        self.assertEqual(res["status"], "CRITICAL")
        self.assertGreater(res["high_risk_vendors_count"], 0)
        self.assertGreater(res["total_at_risk_usd"], 0.0)
        for supp in res["top_at_risk_suppliers"]:
            self.assertGreater(supp["lead_time_days"], 14)
            self.assertIn("backup_action", supp)

    def test_04_production_sub_agent(self):
        """Tests line capacity utilization and bottleneck detection."""
        res = sub_agent_production_capacity("supply_chain_manifest.csv")
        self.assertEqual(res["node"], "Production")
        self.assertEqual(res["status"], "BOTTLENECK")
        self.assertGreaterEqual(res["bottleneck_count"], 3)
        # Check specific bottleneck lines
        bottleneck_line_names = [l["factory_line"] for l in res["lines"] if l["is_bottleneck"]]
        self.assertIn("Line-Alpha-CN", bottleneck_line_names)
        self.assertIn("Line-Beta-IN", bottleneck_line_names)
        self.assertIn("Line-Gamma-DE", bottleneck_line_names)

    def test_05_logistics_sub_agent(self):
        """Tests maritime chokepoints, Cape of Good Hope detours, and fuel surcharges."""
        res = sub_agent_logistics_reroute("supply_chain_manifest.csv")
        self.assertEqual(res["node"], "Logistics")
        self.assertEqual(res["status"], "DISRUPTED")
        self.assertGreaterEqual(res["disrupted_count"], 6)
        self.assertGreater(res["total_detour_nm"], 0.0)
        self.assertGreater(res["total_fuel_surcharge_usd"], 0.0)

        # Verify output CSV schedule was written and has contents
        schedule_file = os.path.join(OUTPUTS_DIR, "revised_logistics_schedule.csv")
        self.assertTrue(os.path.exists(schedule_file))
        sched_df = pd.read_csv(schedule_file)
        self.assertEqual(len(sched_df), 25)
        self.assertIn("fuel_surcharge_usd", sched_df.columns)
        self.assertIn("revised_delivery_window", sched_df.columns)

    def test_06_demand_inventory_sub_agent(self):
        """Tests days of cover, stockout flags, and recommended reorder quantities."""
        res = sub_agent_demand_inventory("supply_chain_manifest.csv")
        self.assertEqual(res["node"], "Inventory")
        self.assertEqual(res["status"], "CRITICAL_STOCKOUT")
        self.assertGreaterEqual(res["critical_stockout_count"], 5)
        self.assertGreaterEqual(res["overstock_count"], 1)
        for sku in res["critical_skus"]:
            self.assertLess(sku["days_of_cover"], 7.0)
            self.assertGreater(sku["reorder_units"], 0)

    def test_07_artifact_engine(self):
        """Tests rendering of 4-panel visual matrix (PNG) and Executive Audit PDF."""
        res = sub_agent_artifact_engine("supply_chain_manifest.csv")
        self.assertEqual(res["status"], "generated")

        matrix_path = os.path.join(OUTPUTS_DIR, "supply_chain_matrix.png")
        pdf_path = os.path.join(OUTPUTS_DIR, "Executive_Supply_Chain_Audit.pdf")

        self.assertTrue(os.path.exists(matrix_path))
        self.assertGreater(os.path.getsize(matrix_path), 50000, "Matrix PNG must be >50KB (high-res)")

        self.assertTrue(os.path.exists(pdf_path))
        self.assertGreater(os.path.getsize(pdf_path), 2000, "Executive PDF must be >2KB")

    def test_08_orchestrator_ambiguity_guardrail(self):
        """Verifies Orchestrator responds politely to vague prompts without hallucinating numbers."""
        orchestrator = MasterOrchestrator()
        res = orchestrator.run(query="hi", csv_path="non_existent_file.csv")
        self.assertEqual(res["status"], "warning")
        self.assertEqual(res["total_at_risk_usd"], 0.0)
        self.assertIn("Atlas (SupplyChain360 AI)", res["reply"])
        self.assertIn("Run demo audit", res["reply"])

    def test_09_fastapi_endpoints(self):
        """Tests FastAPI service discovery and webhook execution."""
        # Test Root GET /
        resp_root = self.client.get("/")
        self.assertEqual(resp_root.status_code, 200)
        data_root = resp_root.json()
        self.assertEqual(data_root["service"], "SupplyChain360 AI (Atlas)")
        self.assertEqual(data_root["status"], "online")

        # Test Health GET /health
        resp_health = self.client.get("/health")
        self.assertEqual(resp_health.status_code, 200)

        # Test Demo UI GET /demo-ui
        resp_ui = self.client.get("/demo-ui")
        self.assertEqual(resp_ui.status_code, 200)
        self.assertIn("Atlas", resp_ui.text)

        # Test POST /webhook with Demo Audit
        resp_webhook = self.client.post("/webhook", json={"message": "Run demo audit"})
        self.assertEqual(resp_webhook.status_code, 200)
        wh_data = resp_webhook.json()
        self.assertEqual(wh_data["status"], "success")
        self.assertGreater(wh_data["total_at_risk_usd"], 0)
        self.assertEqual(len(wh_data["attachments"]), 3)
        self.assertIn("@Procurement", wh_data["reply"])
        self.assertIn("@Logistics", wh_data["reply"])
        self.assertIn("@Operations", wh_data["reply"])


if __name__ == "__main__":
    unittest.main(verbosity=2)
