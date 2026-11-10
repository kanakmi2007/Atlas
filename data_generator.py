"""
Data generator for Atlas (SupplyChain360 AI).
Generates realistic multi-modal supply chain datasets:
1. supply_chain_manifest.csv: 25-row realistic manifest with planted multi-node failures.
2. corrupt_test_manifest.csv: 5-row corrupt manifest missing required columns for guardrail testing.
"""

import os
import pandas as pd


PORTS = {
    "Shanghai": (31.23, 121.47),
    "Shenzhen": (22.54, 114.05),
    "Singapore": (1.29, 103.85),
    "Nhava Sheva Mumbai": (18.95, 72.95),
    "Rotterdam": (51.92, 4.47),
    "Hamburg": (53.55, 9.99),
    "Los Angeles": (33.74, -118.27),
    "New York": (40.71, -74.00),
}

MANIFEST_COLUMNS = [
    "shipment_id",
    "supplier",
    "raw_material",
    "lead_time_days",
    "factory_line",
    "capacity_target",
    "actual_output",
    "origin_lat",
    "origin_lon",
    "dest_lat",
    "dest_lon",
    "route_zone",
    "cargo_value_usd",
    "current_stock",
    "daily_demand",
]


def generate_supply_chain_manifest(file_path: str = "supply_chain_manifest.csv") -> str:
    """
    Generates 25-row realistic supply chain manifest with planted multi-node failures:
    - 6 shipments routed via 'Red Sea / Suez Canal' or 'Strait of Hormuz' ($250k - $950k)
    - 4 suppliers with lead_time_days between 18 and 32 days (> 14 days threshold)
    - 3 factory lines (Line-Alpha-CN, Line-Beta-IN, Line-Gamma-DE) where actual_output >= 92% capacity_target
    - 5 critical SKUs where current_stock / daily_demand < 7 days
    """
    data = [
        # 1. Critical Geopolitical Zone (Red Sea / Suez) - High Value Electronics & Sourcing Risk (>14 days) & Stockout (<7 days)
        {
            "shipment_id": "SHP-1001",
            "supplier": "Apex Microelectronics",
            "raw_material": "3nm Wafer Substrates",
            "lead_time_days": 28,  # >14 days risk
            "factory_line": "Line-Alpha-CN",
            "capacity_target": 10000,
            "actual_output": 9650,  # 96.5% bottleneck
            "origin_lat": PORTS["Shanghai"][0],
            "origin_lon": PORTS["Shanghai"][1],
            "dest_lat": PORTS["Rotterdam"][0],
            "dest_lon": PORTS["Rotterdam"][1],
            "route_zone": "Red Sea / Suez Canal",
            "cargo_value_usd": 920000.0,
            "current_stock": 350,
            "daily_demand": 100,  # 3.5 days -> CRITICAL STOCKOUT
        },
        # 2. Critical Geopolitical Zone (Strait of Hormuz) - High Value Semiconductors & Stockout
        {
            "shipment_id": "SHP-1002",
            "supplier": "Global Lithium Corp",
            "raw_material": "Battery-Grade Lithium",
            "lead_time_days": 22,  # >14 days risk
            "factory_line": "Line-Beta-IN",
            "capacity_target": 8000,
            "actual_output": 7600,  # 95.0% bottleneck
            "origin_lat": PORTS["Nhava Sheva Mumbai"][0],
            "origin_lon": PORTS["Nhava Sheva Mumbai"][1],
            "dest_lat": PORTS["Hamburg"][0],
            "dest_lon": PORTS["Hamburg"][1],
            "route_zone": "Strait of Hormuz",
            "cargo_value_usd": 780000.0,
            "current_stock": 240,
            "daily_demand": 60,  # 4.0 days -> CRITICAL STOCKOUT
        },
        # 3. Critical Geopolitical Zone (Red Sea / Suez Canal) - High Value
        {
            "shipment_id": "SHP-1003",
            "supplier": "Shenzhen Precision Fab",
            "raw_material": "Automotive Microcontrollers",
            "lead_time_days": 12,
            "factory_line": "Line-Gamma-DE",
            "capacity_target": 5000,
            "actual_output": 4720,  # 94.4% bottleneck
            "origin_lat": PORTS["Shenzhen"][0],
            "origin_lon": PORTS["Shenzhen"][1],
            "dest_lat": PORTS["Rotterdam"][0],
            "dest_lon": PORTS["Rotterdam"][1],
            "route_zone": "Red Sea / Suez Canal",
            "cargo_value_usd": 850000.0,
            "current_stock": 180,
            "daily_demand": 45,  # 4.0 days -> CRITICAL STOCKOUT
        },
        # 4. Critical Geopolitical Zone (Red Sea / Suez Canal) - High Value
        {
            "shipment_id": "SHP-1004",
            "supplier": "Taiwan Semi Foundry",
            "raw_material": "AI Accelerator ASICs",
            "lead_time_days": 32,  # >14 days risk
            "factory_line": "Line-Alpha-CN",
            "capacity_target": 10000,
            "actual_output": 9650,
            "origin_lat": PORTS["Singapore"][0],
            "origin_lon": PORTS["Singapore"][1],
            "dest_lat": PORTS["Hamburg"][0],
            "dest_lon": PORTS["Hamburg"][1],
            "route_zone": "Red Sea / Suez Canal",
            "cargo_value_usd": 950000.0,
            "current_stock": 120,
            "daily_demand": 30,  # 4.0 days -> CRITICAL STOCKOUT
        },
        # 5. Critical Geopolitical Zone (Strait of Hormuz) - High Value
        {
            "shipment_id": "SHP-1005",
            "supplier": "Bavaria Spec Alloys",
            "raw_material": "Titanium Aerospace Ingots",
            "lead_time_days": 19,  # >14 days risk
            "factory_line": "Line-Beta-IN",
            "capacity_target": 8000,
            "actual_output": 7600,
            "origin_lat": PORTS["Nhava Sheva Mumbai"][0],
            "origin_lon": PORTS["Nhava Sheva Mumbai"][1],
            "dest_lat": PORTS["Rotterdam"][0],
            "dest_lon": PORTS["Rotterdam"][1],
            "route_zone": "Strait of Hormuz",
            "cargo_value_usd": 640000.0,
            "current_stock": 250,
            "daily_demand": 50,  # 5.0 days -> CRITICAL STOCKOUT
        },
        # 6. Critical Geopolitical Zone (Red Sea / Suez Canal) - High Value
        {
            "shipment_id": "SHP-1006",
            "supplier": "Nippon High-Tech Chem",
            "raw_material": "Optical Transceiver Diodes",
            "lead_time_days": 10,
            "factory_line": "Line-Gamma-DE",
            "capacity_target": 5000,
            "actual_output": 4720,
            "origin_lat": PORTS["Shanghai"][0],
            "origin_lon": PORTS["Shanghai"][1],
            "dest_lat": PORTS["Rotterdam"][0],
            "dest_lon": PORTS["Rotterdam"][1],
            "route_zone": "Red Sea / Suez Canal",
            "cargo_value_usd": 420000.0,
            "current_stock": 900,
            "daily_demand": 45,  # 20 days -> STABLE
        },
        # 7. Trans-Pacific Route - Safe zone
        {
            "shipment_id": "SHP-1007",
            "supplier": "Apex Microelectronics",
            "raw_material": "Power MOSFETs",
            "lead_time_days": 14,
            "factory_line": "Line-Delta-US",
            "capacity_target": 6000,
            "actual_output": 4800,  # 80.0%
            "origin_lat": PORTS["Shenzhen"][0],
            "origin_lon": PORTS["Shenzhen"][1],
            "dest_lat": PORTS["Los Angeles"][0],
            "dest_lon": PORTS["Los Angeles"][1],
            "route_zone": "Trans-Pacific Corridor",
            "cargo_value_usd": 185000.0,
            "current_stock": 1400,
            "daily_demand": 70,  # 20 days
        },
        # 8. Trans-Pacific Route - Safe zone
        {
            "shipment_id": "SHP-1008",
            "supplier": "Pacific Silicon Works",
            "raw_material": "Ceramic Resonators",
            "lead_time_days": 8,
            "factory_line": "Line-Delta-US",
            "capacity_target": 6000,
            "actual_output": 4800,
            "origin_lat": PORTS["Shanghai"][0],
            "origin_lon": PORTS["Shanghai"][1],
            "dest_lat": PORTS["Los Angeles"][0],
            "dest_lon": PORTS["Los Angeles"][1],
            "route_zone": "Trans-Pacific Corridor",
            "cargo_value_usd": 110000.0,
            "current_stock": 2500,
            "daily_demand": 80,  # 31.2 days
        },
        # 9. Trans-Atlantic Express - Safe zone
        {
            "shipment_id": "SHP-1009",
            "supplier": "Hanseatic Polymer AG",
            "raw_material": "Thermal Polyimide Film",
            "lead_time_days": 7,
            "factory_line": "Line-Delta-US",
            "capacity_target": 6000,
            "actual_output": 4800,
            "origin_lat": PORTS["Rotterdam"][0],
            "origin_lon": PORTS["Rotterdam"][1],
            "dest_lat": PORTS["New York"][0],
            "dest_lon": PORTS["New York"][1],
            "route_zone": "Trans-Atlantic Express",
            "cargo_value_usd": 95000.0,
            "current_stock": 3800,
            "daily_demand": 50,  # 76 days -> OVERSTOCK (>60)
        },
        # 10. Malacca / Indian Ocean - Safe zone
        {
            "shipment_id": "SHP-1010",
            "supplier": "Bharat Electronics Hub",
            "raw_material": "Multi-Layer PCB Boards",
            "lead_time_days": 9,
            "factory_line": "Line-Epsilon-SG",
            "capacity_target": 7500,
            "actual_output": 5800,  # 77.3%
            "origin_lat": PORTS["Nhava Sheva Mumbai"][0],
            "origin_lon": PORTS["Nhava Sheva Mumbai"][1],
            "dest_lat": PORTS["Singapore"][0],
            "dest_lon": PORTS["Singapore"][1],
            "route_zone": "Malacca / Indian Ocean",
            "cargo_value_usd": 140000.0,
            "current_stock": 1600,
            "daily_demand": 80,  # 20 days
        },
        # 11. Trans-Pacific Corridor
        {
            "shipment_id": "SHP-1011",
            "supplier": "Shenzhen Precision Fab",
            "raw_material": "OLED Display Drivers",
            "lead_time_days": 11,
            "factory_line": "Line-Delta-US",
            "capacity_target": 6000,
            "actual_output": 4800,
            "origin_lat": PORTS["Shenzhen"][0],
            "origin_lon": PORTS["Shenzhen"][1],
            "dest_lat": PORTS["Los Angeles"][0],
            "dest_lon": PORTS["Los Angeles"][1],
            "route_zone": "Trans-Pacific Corridor",
            "cargo_value_usd": 175000.0,
            "current_stock": 2100,
            "daily_demand": 75,  # 28 days
        },
        # 12. Trans-Pacific Corridor
        {
            "shipment_id": "SHP-1012",
            "supplier": "Taiwan Semi Foundry",
            "raw_material": "Flash Memory Chips",
            "lead_time_days": 13,
            "factory_line": "Line-Delta-US",
            "capacity_target": 6000,
            "actual_output": 4800,
            "origin_lat": PORTS["Singapore"][0],
            "origin_lon": PORTS["Singapore"][1],
            "dest_lat": PORTS["Los Angeles"][0],
            "dest_lon": PORTS["Los Angeles"][1],
            "route_zone": "Trans-Pacific Corridor",
            "cargo_value_usd": 220000.0,
            "current_stock": 1800,
            "daily_demand": 90,  # 20 days
        },
        # 13. North Sea Coastal
        {
            "shipment_id": "SHP-1013",
            "supplier": "Nordic Rare Earths",
            "raw_material": "Neodymium Magnet Blocks",
            "lead_time_days": 6,
            "factory_line": "Line-Gamma-DE",
            "capacity_target": 5000,
            "actual_output": 4720,
            "origin_lat": PORTS["Rotterdam"][0],
            "origin_lon": PORTS["Rotterdam"][1],
            "dest_lat": PORTS["Hamburg"][0],
            "dest_lon": PORTS["Hamburg"][1],
            "route_zone": "North Sea Coastal",
            "cargo_value_usd": 135000.0,
            "current_stock": 4200,
            "daily_demand": 60,  # 70 days -> OVERSTOCK (>60)
        },
        # 14. Trans-Atlantic Express
        {
            "shipment_id": "SHP-1014",
            "supplier": "Hanseatic Polymer AG",
            "raw_material": "Epoxy Encapsulant Resin",
            "lead_time_days": 8,
            "factory_line": "Line-Delta-US",
            "capacity_target": 6000,
            "actual_output": 4800,
            "origin_lat": PORTS["Hamburg"][0],
            "origin_lon": PORTS["Hamburg"][1],
            "dest_lat": PORTS["New York"][0],
            "dest_lon": PORTS["New York"][1],
            "route_zone": "Trans-Atlantic Express",
            "cargo_value_usd": 88000.0,
            "current_stock": 2900,
            "daily_demand": 100,  # 29 days
        },
        # 15. Malacca / Indian Ocean
        {
            "shipment_id": "SHP-1015",
            "supplier": "Bharat Electronics Hub",
            "raw_material": "Copper Clad Laminates",
            "lead_time_days": 10,
            "factory_line": "Line-Beta-IN",
            "capacity_target": 8000,
            "actual_output": 7600,
            "origin_lat": PORTS["Singapore"][0],
            "origin_lon": PORTS["Singapore"][1],
            "dest_lat": PORTS["Nhava Sheva Mumbai"][0],
            "dest_lon": PORTS["Nhava Sheva Mumbai"][1],
            "route_zone": "Malacca / Indian Ocean",
            "cargo_value_usd": 92000.0,
            "current_stock": 1500,
            "daily_demand": 75,  # 20 days
        },
        # 16. Trans-Pacific Corridor
        {
            "shipment_id": "SHP-1016",
            "supplier": "Pacific Silicon Works",
            "raw_material": "High-Purity Quartz",
            "lead_time_days": 12,
            "factory_line": "Line-Alpha-CN",
            "capacity_target": 10000,
            "actual_output": 9650,
            "origin_lat": PORTS["Singapore"][0],
            "origin_lon": PORTS["Singapore"][1],
            "dest_lat": PORTS["Shanghai"][0],
            "dest_lon": PORTS["Shanghai"][1],
            "route_zone": "Trans-Pacific Corridor",
            "cargo_value_usd": 160000.0,
            "current_stock": 1950,
            "daily_demand": 65,  # 30 days
        },
        # 17. Trans-Atlantic Express
        {
            "shipment_id": "SHP-1017",
            "supplier": "Bavaria Spec Alloys",
            "raw_material": "Cobalt-Chrome Wire",
            "lead_time_days": 9,
            "factory_line": "Line-Delta-US",
            "capacity_target": 6000,
            "actual_output": 4800,
            "origin_lat": PORTS["Rotterdam"][0],
            "origin_lon": PORTS["Rotterdam"][1],
            "dest_lat": PORTS["New York"][0],
            "dest_lon": PORTS["New York"][1],
            "route_zone": "Trans-Atlantic Express",
            "cargo_value_usd": 145000.0,
            "current_stock": 1200,
            "daily_demand": 50,  # 24 days
        },
        # 18. Malacca / Indian Ocean
        {
            "shipment_id": "SHP-1018",
            "supplier": "Nippon High-Tech Chem",
            "raw_material": "Photoresist Polymers",
            "lead_time_days": 11,
            "factory_line": "Line-Epsilon-SG",
            "capacity_target": 7500,
            "actual_output": 5800,
            "origin_lat": PORTS["Shanghai"][0],
            "origin_lon": PORTS["Shanghai"][1],
            "dest_lat": PORTS["Singapore"][0],
            "dest_lon": PORTS["Singapore"][1],
            "route_zone": "Malacca / Indian Ocean",
            "cargo_value_usd": 190000.0,
            "current_stock": 1350,
            "daily_demand": 45,  # 30 days
        },
        # 19. Trans-Pacific Corridor
        {
            "shipment_id": "SHP-1019",
            "supplier": "Apex Microelectronics",
            "raw_material": "Precision Inductors",
            "lead_time_days": 13,
            "factory_line": "Line-Delta-US",
            "capacity_target": 6000,
            "actual_output": 4800,
            "origin_lat": PORTS["Shenzhen"][0],
            "origin_lon": PORTS["Shenzhen"][1],
            "dest_lat": PORTS["Los Angeles"][0],
            "dest_lon": PORTS["Los Angeles"][1],
            "route_zone": "Trans-Pacific Corridor",
            "cargo_value_usd": 125000.0,
            "current_stock": 2600,
            "daily_demand": 100,  # 26 days
        },
        # 20. Trans-Pacific Corridor
        {
            "shipment_id": "SHP-1020",
            "supplier": "Shenzhen Precision Fab",
            "raw_material": "SMD Connectors",
            "lead_time_days": 7,
            "factory_line": "Line-Alpha-CN",
            "capacity_target": 10000,
            "actual_output": 9650,
            "origin_lat": PORTS["Shenzhen"][0],
            "origin_lon": PORTS["Shenzhen"][1],
            "dest_lat": PORTS["Shanghai"][0],
            "dest_lon": PORTS["Shanghai"][1],
            "route_zone": "Trans-Pacific Corridor",
            "cargo_value_usd": 75000.0,
            "current_stock": 3100,
            "daily_demand": 90,  # 34.4 days
        },
        # 21. Trans-Atlantic Express
        {
            "shipment_id": "SHP-1021",
            "supplier": "Nordic Rare Earths",
            "raw_material": "Dysprosium Oxide",
            "lead_time_days": 10,
            "factory_line": "Line-Gamma-DE",
            "capacity_target": 5000,
            "actual_output": 4720,
            "origin_lat": PORTS["Rotterdam"][0],
            "origin_lon": PORTS["Rotterdam"][1],
            "dest_lat": PORTS["Hamburg"][0],
            "dest_lon": PORTS["Hamburg"][1],
            "route_zone": "North Sea Coastal",
            "cargo_value_usd": 165000.0,
            "current_stock": 1700,
            "daily_demand": 50,  # 34 days
        },
        # 22. Malacca / Indian Ocean
        {
            "shipment_id": "SHP-1022",
            "supplier": "Bharat Electronics Hub",
            "raw_material": "Ferrite Core Assemblies",
            "lead_time_days": 9,
            "factory_line": "Line-Beta-IN",
            "capacity_target": 8000,
            "actual_output": 7600,
            "origin_lat": PORTS["Singapore"][0],
            "origin_lon": PORTS["Singapore"][1],
            "dest_lat": PORTS["Nhava Sheva Mumbai"][0],
            "dest_lon": PORTS["Nhava Sheva Mumbai"][1],
            "route_zone": "Malacca / Indian Ocean",
            "cargo_value_usd": 115000.0,
            "current_stock": 2200,
            "daily_demand": 80,  # 27.5 days
        },
        # 23. Trans-Pacific Corridor
        {
            "shipment_id": "SHP-1023",
            "supplier": "Taiwan Semi Foundry",
            "raw_material": "Gallium Nitride Wafers",
            "lead_time_days": 14,
            "factory_line": "Line-Epsilon-SG",
            "capacity_target": 7500,
            "actual_output": 5800,
            "origin_lat": PORTS["Shanghai"][0],
            "origin_lon": PORTS["Shanghai"][1],
            "dest_lat": PORTS["Singapore"][0],
            "dest_lon": PORTS["Singapore"][1],
            "route_zone": "Trans-Pacific Corridor",
            "cargo_value_usd": 210000.0,
            "current_stock": 1100,
            "daily_demand": 40,  # 27.5 days
        },
        # 24. Trans-Atlantic Express
        {
            "shipment_id": "SHP-1024",
            "supplier": "Hanseatic Polymer AG",
            "raw_material": "Silicon Underfill Gel",
            "lead_time_days": 8,
            "factory_line": "Line-Delta-US",
            "capacity_target": 6000,
            "actual_output": 4800,
            "origin_lat": PORTS["Rotterdam"][0],
            "origin_lon": PORTS["Rotterdam"][1],
            "dest_lat": PORTS["New York"][0],
            "dest_lon": PORTS["New York"][1],
            "route_zone": "Trans-Atlantic Express",
            "cargo_value_usd": 85000.0,
            "current_stock": 2750,
            "daily_demand": 55,  # 50 days
        },
        # 25. Malacca / Indian Ocean
        {
            "shipment_id": "SHP-1025",
            "supplier": "Global Lithium Corp",
            "raw_material": "Electrolyte Solution",
            "lead_time_days": 11,
            "factory_line": "Line-Epsilon-SG",
            "capacity_target": 7500,
            "actual_output": 5800,
            "origin_lat": PORTS["Nhava Sheva Mumbai"][0],
            "origin_lon": PORTS["Nhava Sheva Mumbai"][1],
            "dest_lat": PORTS["Singapore"][0],
            "dest_lon": PORTS["Singapore"][1],
            "route_zone": "Malacca / Indian Ocean",
            "cargo_value_usd": 155000.0,
            "current_stock": 1600,
            "daily_demand": 60,  # 26.6 days
        },
    ]

    df = pd.DataFrame(data)
    df = df[MANIFEST_COLUMNS]
    df.to_csv(file_path, index=False)
    print(f"Successfully generated {len(df)} rows to {file_path}")
    return file_path


def generate_corrupt_manifest(file_path: str = "corrupt_test_manifest.csv") -> str:
    """
    Generates a 5-row corrupt manifest missing required columns (origin_lat, cargo_value_usd)
    to test the validation guardrails.
    """
    corrupt_columns = [
        "shipment_id",
        "supplier",
        "raw_material",
        "lead_time_days",
        "factory_line",
        "capacity_target",
        "actual_output",
        # missing origin_lat
        "origin_lon",
        "dest_lat",
        "dest_lon",
        "route_zone",
        # missing cargo_value_usd
        "current_stock",
        "daily_demand",
    ]
    corrupt_data = [
        {
            "shipment_id": f"CORRUPT-{100 + i}",
            "supplier": "Corrupt Supply Partner",
            "raw_material": "Unknown Fragment",
            "lead_time_days": 15,
            "factory_line": "Line-Fail",
            "capacity_target": 5000,
            "actual_output": 4000,
            "origin_lon": 121.47,
            "dest_lat": 51.92,
            "dest_lon": 4.47,
            "route_zone": "Red Sea / Suez Canal",
            "current_stock": 200,
            "daily_demand": 50,
        }
        for i in range(5)
    ]
    df = pd.DataFrame(corrupt_data)[corrupt_columns]
    df.to_csv(file_path, index=False)
    print(f"Successfully generated corrupt test manifest ({len(df)} rows) to {file_path}")
    return file_path


if __name__ == "__main__":
    generate_supply_chain_manifest()
    generate_corrupt_manifest()
