import os
import json
import pandas as pd
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from geopy.distance import geodesic
from fpdf import FPDF
from dotenv import load_dotenv
from google import genai
from google.genai import types

load_dotenv()

OUTPUT_DIR = "outputs"
OUTPUTS_DIR = OUTPUT_DIR
os.makedirs(OUTPUT_DIR, exist_ok=True)

PORT_COORDS = {
    "Shanghai": (31.2304, 121.4737),
    "Shenzhen": (22.5431, 114.0579),
    "Rotterdam": (51.9244, 4.4777),
    "Los Angeles": (33.7405, -118.2786),
    "Singapore": (1.2644, 103.8220),
    "Hamburg": (53.5461, 9.9661),
    "Mumbai": (18.9490, 72.8354),
    "Dubai": (25.0138, 55.0616),
    "Suez": (29.9668, 32.5498),
    "Cape_Good_Hope": (-34.3568, 18.4740),
}

REQUIRED_COLUMNS = [
    "shipment_id", "supplier", "origin", "destination",
    "route", "cargo_value_usd", "lead_time_days",
    "factory_utilization_pct", "current_stock", "daily_burn_rate"
]


def _get_gemini_client():
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        return None
    return genai.Client(api_key=api_key)


def load_manifest_df(csv_path: str) -> pd.DataFrame:
    if not os.path.exists(csv_path):
        # Generate realistic 25-row sample data automatically if missing
        sample_rows = []
        suppliers = [
            ("Apex Electronics", "Shenzhen", "Rotterdam", "Red Sea / Suez", 1850000, 18, 94, 420, 45),
            ("Nordic Precision", "Shanghai", "Hamburg", "Red Sea / Suez", 1420000, 16, 89, 310, 38),
            ("Pacific Motors", "Shanghai", "Los Angeles", "Trans-Pacific", 980000, 11, 76, 890, 50),
            ("Deccan Alloys", "Mumbai", "Rotterdam", "Red Sea / Suez", 1150000, 19, 96, 190, 30),
            ("Vanguard Chips", "Singapore", "Hamburg", "Malacca / Suez", 2100000, 15, 91, 260, 35),
        ]
        for i in range(1, 26):
            s = suppliers[(i - 1) % len(suppliers)]
            sample_rows.append({
                "shipment_id": f"SHP-{1000 + i}",
                "supplier": f"{s[0]} #{(i % 3) + 1}",
                "origin": s[1],
                "destination": s[2],
                "route": s[3],
                "cargo_value_usd": s[4] + (i * 15000),
                "lead_time_days": s[5] + (i % 4),
                "factory_utilization_pct": min(99, s[6] + (i % 5)),
                "current_stock": max(80, s[7] - (i * 8)),
                "daily_burn_rate": s[8],
            })
        df = pd.DataFrame(sample_rows)
        df.to_csv(csv_path, index=False)
        return df
    return pd.read_csv(csv_path)


def validate_and_load_manifest(csv_path: str):
    if not os.path.exists(csv_path):
        return {
            "valid": False,
            "row_count": 0,
            "error": f"Manifest file not found: {csv_path}",
            "data": None,
        }

    try:
        df = pd.read_csv(csv_path)
    except Exception as exc:
        return {
            "valid": False,
            "row_count": 0,
            "error": f"Could not read CSV file: {exc}",
            "data": None,
        }

    required = [
        "shipment_id", "supplier", "raw_material", "lead_time_days", "factory_line",
        "capacity_target", "actual_output", "origin_lat", "origin_lon", "dest_lat",
        "dest_lon", "route_zone", "cargo_value_usd", "current_stock", "daily_demand",
    ]
    missing = [c for c in required if c not in df.columns]
    if missing:
        return {
            "valid": False,
            "row_count": len(df),
            "error": f"Missing required columns: {', '.join(missing)}",
            "data": df,
        }

    if df.empty:
        return {
            "valid": False,
            "row_count": 0,
            "error": "Manifest is empty.",
            "data": df,
        }

    null_rows = df[df[required].isnull().any(axis=1)]
    if not null_rows.empty:
        bad_ids = ", ".join(null_rows["shipment_id"].fillna("UNKNOWN").astype(str).tolist()[:5])
        return {
            "valid": False,
            "row_count": len(df),
            "error": f"Found {len(null_rows)} incomplete rows with missing values (Shipments: {bad_ids}).",
            "data": df,
        }

    invalid_numeric = (df["cargo_value_usd"] <= 0).any() or (df["daily_demand"] <= 0).any()
    if invalid_numeric:
        return {
            "valid": False,
            "row_count": len(df),
            "error": "Invalid negative or zero values found in cargo value or daily demand.",
            "data": df,
        }

    return {
        "valid": True,
        "row_count": len(df),
        "error": "",
        "data": df,
    }


def validate_manifest(csv_path: str):
    result = validate_and_load_manifest(csv_path)
    if not result["valid"]:
        return False, result["error"], result["data"]
    return True, "All columns and data rows verified.", result["data"]


def sub_agent_sourcing_audit(csv_path: str = "supply_chain_manifest.csv") -> dict:
    result = validate_and_load_manifest(csv_path)
    if not result["valid"]:
        return {"node": "Sourcing", "status": "BLOCKED", "high_risk_vendors_count": 0, "total_at_risk_usd": 0.0, "top_at_risk_suppliers": [], "message": result["error"]}

    df = result["data"].copy()
    high_risk = df[df["lead_time_days"] > 14].sort_values("lead_time_days", ascending=False)
    records = []
    for _, row in high_risk.iterrows():
        records.append({
            "supplier": row["supplier"],
            "lead_time_days": int(row["lead_time_days"]),
            "cargo_value_usd": float(row["cargo_value_usd"]),
            "backup_action": "Trigger dual-source compliance and expedite alternate supplier allocation.",
        })

    total_at_risk_usd = float(high_risk["cargo_value_usd"].sum()) if not high_risk.empty else 0.0
    status = "CRITICAL" if not high_risk.empty else "OK"
    return {
        "node": "Sourcing",
        "status": status,
        "high_risk_vendors_count": len(records),
        "total_at_risk_usd": total_at_risk_usd,
        "top_at_risk_suppliers": records[:5],
        "message": f"{len(records)} vendors exceed the 14-day lead time threshold.",
    }


def sub_agent_production_capacity(csv_path: str = "supply_chain_manifest.csv") -> dict:
    result = validate_and_load_manifest(csv_path)
    if not result["valid"]:
        return {"node": "Production", "status": "BLOCKED", "bottleneck_count": 0, "lines": [], "message": result["error"]}

    df = result["data"].copy()
    df["utilization_pct"] = (df["actual_output"] / df["capacity_target"]) * 100
    lines = []
    for _, row in df.groupby("factory_line", as_index=False).agg({"actual_output": "sum", "capacity_target": "sum"}).iterrows():
        utilization = (row["actual_output"] / row["capacity_target"]) * 100 if row["capacity_target"] else 0.0
        lines.append({
            "factory_line": row["factory_line"],
            "utilization_pct": float(utilization),
            "is_bottleneck": utilization >= 90,
        })

    bottleneck_count = sum(1 for line in lines if line["is_bottleneck"])
    status = "BOTTLENECK" if bottleneck_count else "STABLE"
    return {
        "node": "Production",
        "status": status,
        "bottleneck_count": bottleneck_count,
        "lines": lines,
        "message": f"{bottleneck_count} factory lines are operating at or above 90% of target capacity.",
    }


def sub_agent_logistics_reroute(csv_path: str = "supply_chain_manifest.csv") -> dict:
    result = validate_and_load_manifest(csv_path)
    if not result["valid"]:
        return {"node": "Logistics", "status": "BLOCKED", "disrupted_count": 0, "total_detour_nm": 0.0, "total_fuel_surcharge_usd": 0.0, "schedule": [], "message": result["error"]}

    df = result["data"].copy()
    rows = []
    total_detour_nm = 0.0
    total_fuel = 0.0
    disrupted_count = 0
    for _, row in df.iterrows():
        route = str(row["route_zone"])
        if "Red Sea" in route or "Suez" in route or "Hormuz" in route:
            disrupted_count += 1
            origin = (float(row["origin_lat"]), float(row["origin_lon"]))
            dest = (float(row["dest_lat"]), float(row["dest_lon"]))
            direct_km = geodesic(origin, dest).km
            cape = (float(-34.3568), float(18.4740))
            detour_nm = max(100.0, geodesic(origin, cape).km + geodesic(cape, dest).km - direct_km)
            detour_nm = detour_nm / 1.852
            fuel = detour_nm * 18.5
            total_detour_nm += detour_nm
            total_fuel += fuel
            revised_window = f"{int(row['lead_time_days']) + 7} to {int(row['lead_time_days']) + 10} days"
            route_label = "Cape of Good Hope detour"
        else:
            detour_nm = 0.0
            fuel = 0.0
            revised_window = f"{int(row['lead_time_days'])} days"
            route_label = route
        rows.append({
            "shipment_id": row["shipment_id"],
            "supplier": row["supplier"],
            "route_zone": route_label,
            "detour_nm": round(detour_nm, 2),
            "fuel_surcharge_usd": round(fuel, 2),
            "revised_delivery_window": revised_window,
        })

    schedule = pd.DataFrame(rows)
    output_path = os.path.join(OUTPUTS_DIR, "revised_logistics_schedule.csv")
    os.makedirs(OUTPUTS_DIR, exist_ok=True)
    schedule.to_csv(output_path, index=False)
    status = "DISRUPTED" if disrupted_count else "STABLE"
    return {
        "node": "Logistics",
        "status": status,
        "disrupted_count": disrupted_count,
        "total_detour_nm": round(total_detour_nm, 2),
        "total_fuel_surcharge_usd": round(total_fuel, 2),
        "schedule": rows,
        "message": f"{disrupted_count} shipments were rerouted away from risky maritime chokepoints.",
    }


def sub_agent_demand_inventory(csv_path: str = "supply_chain_manifest.csv") -> dict:
    result = validate_and_load_manifest(csv_path)
    if not result["valid"]:
        return {"node": "Inventory", "status": "BLOCKED", "critical_stockout_count": 0, "overstock_count": 0, "critical_skus": [], "message": result["error"]}

    df = result["data"].copy()
    df["days_of_cover"] = (df["current_stock"] / df["daily_demand"]).round(2)
    critical = df[df["days_of_cover"] < 7].copy()
    critical["reorder_units"] = (7 - critical["days_of_cover"]).clip(lower=0) * critical["daily_demand"]
    critical = critical.sort_values("days_of_cover")
    critical_records = [{
        "shipment_id": row["shipment_id"],
        "supplier": row["supplier"],
        "days_of_cover": float(row["days_of_cover"]),
        "reorder_units": max(1, int(round(row["reorder_units"]))),
    } for _, row in critical.iterrows()]

    overstock_count = int((df["days_of_cover"] > 60).sum())
    status = "CRITICAL_STOCKOUT" if not critical.empty else "HEALTHY"
    return {
        "node": "Inventory",
        "status": status,
        "critical_stockout_count": len(critical_records),
        "overstock_count": overstock_count,
        "critical_skus": critical_records,
        "message": f"{len(critical_records)} SKUs are below seven days of cover; {overstock_count} are overstocked.",
    }


def sub_agent_artifact_engine(csv_path: str = "supply_chain_manifest.csv") -> dict:
    result = validate_and_load_manifest(csv_path)
    if not result["valid"]:
        return {"status": "blocked", "message": result["error"], "files": []}

    df = result["data"].copy()
    df["days_of_cover"] = (df["current_stock"] / df["daily_demand"]).round(2)
    df["utilization_pct"] = (df["actual_output"] / df["capacity_target"]) * 100
    png_path = os.path.join(OUTPUTS_DIR, "supply_chain_matrix.png")
    pdf_path = os.path.join(OUTPUTS_DIR, "Executive_Supply_Chain_Audit.pdf")
    os.makedirs(OUTPUTS_DIR, exist_ok=True)

    plt.style.use("dark_background")
    fig, axes = plt.subplots(2, 2, figsize=(12, 9), dpi=200)
    fig.patch.set_facecolor("#0f172a")
    for ax in axes.flat:
        ax.set_facecolor("#111827")
    top = df.nlargest(5, "cargo_value_usd")
    axes[0, 0].barh(top["shipment_id"], top["cargo_value_usd"] / 1_000_000, color="#38bdf8")
    axes[0, 0].set_title("Cargo Value at Risk ($M)")
    axes[0, 1].bar(df["shipment_id"].head(6), df["utilization_pct"].head(6), color=["#ff4d4d" if x >= 90 else "#36cfc9" for x in df["utilization_pct"].head(6)])
    axes[0, 1].axhline(90, color="#fbbf24", linestyle="--")
    axes[0, 1].set_title("Factory Utilization")
    route_counts = df["route_zone"].value_counts()
    axes[1, 0].pie(route_counts.values, labels=route_counts.index, autopct="%1.0f%%")
    axes[1, 0].set_title("Route Risk Mix")
    low = df.nsmallest(6, "days_of_cover")
    axes[1, 1].bar(low["shipment_id"], low["days_of_cover"], color=["#f87171" if x <= 14 else "#60a5fa" for x in low["days_of_cover"]])
    axes[1, 1].axhline(14, color="#facc15", linestyle="--")
    axes[1, 1].set_title("Days of Cover")
    fig.tight_layout()
    fig.savefig(png_path, dpi=200)
    plt.close(fig)

    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
    from reportlab.lib.styles import getSampleStyleSheet
    from reportlab.lib import colors

    doc = SimpleDocTemplate(pdf_path, pagesize=(595, 842))
    styles = getSampleStyleSheet()
    story = []
    story.append(Paragraph("Atlas Supply Chain Audit", styles['Title']))
    story.append(Spacer(1, 12))
    story.append(Paragraph(f"Total shipments: {len(df)}", styles['BodyText']))
    story.append(Paragraph(f"Critical suppliers: {len(df[df['lead_time_days'] > 14])}", styles['BodyText']))
    story.append(Paragraph(f"Critical stockout SKUs: {len(df[df['days_of_cover'] < 7])}", styles['BodyText']))
    story.append(Spacer(1, 12))
    table_data = [["Shipment", "Supplier", "Lead Days", "Stock Cover"], *[[row["shipment_id"], row["supplier"], row["lead_time_days"], f"{row['days_of_cover']}d"] for _, row in df.head(8).iterrows()]]
    table = Table(table_data)
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0f172a")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
    ]))
    story.append(table)
    doc.build(story)

    return {"status": "generated", "files": [png_path, pdf_path]}


class MasterOrchestrator:
    def run(self, query: str, csv_path: str = "supply_chain_manifest.csv"):
        q = (query or "").strip().lower()
        if not q or q in {"hi", "hello", "hey", "greetings", "greeting"}:
            return {
                "status": "warning",
                "title": "Atlas needs a bit more context",
                "reply": "Atlas (SupplyChain360 AI) needs a little more context before it can quantify risk. Run demo audit to generate a full supply-chain evaluation.",
                "total_at_risk_usd": 0.0,
                "artifacts": {},
            }

        if not os.path.exists(csv_path):
            return {
                "status": "warning",
                "title": "Missing spreadsheet",
                "reply": "Atlas (SupplyChain360 AI) could not find the manifest. Run demo audit to generate a full supply-chain evaluation.",
                "total_at_risk_usd": 0.0,
                "artifacts": {},
            }

        if any(keyword in q for keyword in ["audit", "check", "analyze", "reroute", "risk", "stock", "supplier", "production", "inventory", "demo"]):
            result = run_full_audit(csv_path)
            return {
                "status": "success",
                "title": "Audit Generated",
                "reply": result["reply"],
                "total_at_risk_usd": float(result["metrics"]["money_at_risk"].replace("$", "").replace("M", "")) * 1_000_000 if "M" in result["metrics"]["money_at_risk"] else 0.0,
                "artifacts": result["artifacts"],
            }

        return {
            "status": "warning",
            "title": "Atlas needs a bit more context",
            "reply": "Atlas (SupplyChain360 AI) needs a little more context before it can quantify risk. Run demo audit to generate a full supply-chain evaluation.",
            "total_at_risk_usd": 0.0,
            "artifacts": {},
        }


def run_full_audit(csv_path: str = "supply_chain_manifest.csv") -> dict:
    result = validate_and_load_manifest(csv_path)
    if not result["valid"]:
        return {
            "status": "blocked",
            "title": "Spreadsheet Blocked — Data Issues Found",
            "reply": (
                f"**File Check Failed:** `{os.path.basename(csv_path)}` could not be processed safely.\n\n"
                f"**What went wrong:** {result['error']}\n\n"
                "**How to fix it:** Fill in the missing cells or ensure all required columns are present, then re-upload."
            ),
            "metrics": {
                "money_at_risk": "$0",
                "ships_rerouted": "0",
                "items_running_low": "Blocked",
            },
            "steps": [{"name": "1. Data Guardrail Check", "detail": result['error'], "state": "error"}],
            "artifacts": {},
        }

    df = result["data"].copy()
    df["utilization_pct"] = (df["actual_output"] / df["capacity_target"]) * 100
    df["days_of_cover"] = (df["current_stock"] / df["daily_demand"]).round(1)
    delayed_suppliers = df[df["lead_time_days"] > 14]
    supplier_risk_usd = float(delayed_suppliers["cargo_value_usd"].sum())
    overloaded_factories = df[df["utilization_pct"] >= 90]
    reroute_count = 0
    rerouted_records = []
    for _, row in df.iterrows():
        route_str = str(row["route_zone"])
        if "Suez" in route_str or "Red Sea" in route_str or "Hormuz" in route_str:
            origin = (float(row["origin_lat"]), float(row["origin_lon"]))
            dest = (float(row["dest_lat"]), float(row["dest_lon"]))
            cape = (-34.3568, 18.4740)
            direct_km = geodesic(origin, dest).km
            detour_km = geodesic(origin, cape).km + geodesic(cape, dest).km
            extra_days = max(7, int(round((detour_km - direct_km) / 750)))
            reroute_count += 1
            new_route = "Cape of Good Hope (Safe Detour)"
            new_eta = int(row["lead_time_days"]) + extra_days
        else:
            extra_days = 0
            new_route = route_str
            new_eta = int(row["lead_time_days"]) 
        rerouted_records.append({
            "Shipment ID": row["shipment_id"],
            "Supplier": row["supplier"],
            "Origin": row["origin_lat"],
            "Destination": row["dest_lat"],
            "Updated Route": new_route,
            "Extra Days": f"+{extra_days}d" if extra_days else "0d",
            "New ETA (Days)": new_eta,
            "Cargo Value ($)": f"${row['cargo_value_usd']:,.0f}",
        })
    revised_df = pd.DataFrame(rerouted_records)
    revised_df.to_csv(os.path.join(OUTPUT_DIR, "revised_logistics_schedule.csv"), index=False)
    low_stock_count = int((df["days_of_cover"] <= 14).sum())
    _generate_chart(df, os.path.join(OUTPUT_DIR, "supply_chain_matrix.png"))
    _generate_pdf(df, supplier_risk_usd, reroute_count, low_stock_count, os.path.join(OUTPUT_DIR, "Executive_Supply_Chain_Audit.pdf"))
    money_fmt = f"${supplier_risk_usd / 1_000_000:.2f}M"
    summary_text = (
        f"I checked all **{len(df)} shipments** in `{os.path.basename(csv_path)}`. Here is what needs your attention today:\n\n"
        f"- **Delayed Suppliers ({len(delayed_suppliers)} shipments):** Worth **{money_fmt}**, running past the 14-day delivery target.\n"
        f"- **Safer Sea Routes ({reroute_count} ships rerouted):** Moved off the Red Sea / Suez corridor onto the Cape of Good Hope route (+7 to +10 days transit).\n"
        f"- **Warehouse Stock Alerts ({low_stock_count} items):** Will run out within 14 days unless restocked early.\n"
        f"- **Factory Capacity ({len(overloaded_factories)} lines):** Running above 90% load and need shift balancing.\n\n"
        "@Procurement: lock in alternate suppliers and expedite delayed component orders.\n"
        "@Logistics: confirm Cape of Good Hope detours and reallocate vessel capacity.\n"
        "@Operations: rebalance overloaded lines and release stock replenishment orders immediately."
    )
    return {
        "status": "success",
        "title": "Shipment Check Complete",
        "reply": summary_text,
        "metrics": {
            "money_at_risk": money_fmt,
            "ships_rerouted": f"{reroute_count} Ships",
            "items_running_low": f"{low_stock_count} Items",
        },
        "steps": [
            {"name": "1. Data Check", "detail": f"Verified {len(df)} rows cleanly", "state": "ok"},
            {"name": "2. Supplier Delays", "detail": f"{len(delayed_suppliers)} late deliveries ({money_fmt} at risk)", "state": "warn"},
            {"name": "3. Factory Load", "detail": f"{len(overloaded_factories)} facilities above 90% capacity", "state": "warn"},
            {"name": "4. Sea Route Safety", "detail": f"Rerouted {reroute_count} vessels via Cape of Good Hope", "state": "ok"},
            {"name": "5. Warehouse Stock", "detail": f"{low_stock_count} items under 14 days of stock", "state": "warn"},
        ],
        "artifacts": {
            "png": "/outputs/supply_chain_matrix.png",
            "pdf": "/outputs/Executive_Supply_Chain_Audit.pdf",
            "csv": "/outputs/revised_logistics_schedule.csv",
        },
    }


def ask_atlas_chat(user_message: str, history: list, csv_path: str = "supply_chain_manifest.csv") -> str:
    if not os.path.exists(csv_path):
        return "I could not find the manifest file. Please upload a valid CSV or run the demo audit."

    df = load_manifest_df(csv_path)
    df["days_of_cover"] = (df["current_stock"] / df["daily_demand"]).round(1)

    user_text = (user_message or "").strip().lower()
    supplier_risk = df.sort_values("lead_time_days", ascending=False).head(3)
    worst_supplier = supplier_risk.iloc[0]["supplier"] if not supplier_risk.empty else "N/A"
    worst_lead = int(supplier_risk.iloc[0]["lead_time_days"]) if not supplier_risk.empty else 0
    second_supplier = supplier_risk.iloc[1]["supplier"] if len(supplier_risk) > 1 else worst_supplier
    second_lead = int(supplier_risk.iloc[1]["lead_time_days"]) if len(supplier_risk) > 1 else worst_lead

    if "which supplier is worst" in user_text or "worst supplier" in user_text:
        return f"The worst supplier is {worst_supplier} with a lead time of {worst_lead} days. That is the most at-risk vendor in the current manifest."

    if "tell me more about the second one" in user_text or "second one" in user_text:
        return f"The second-most risky supplier is {second_supplier}. It is currently running at about {second_lead} days of lead time, which is still above the 14-day alert threshold."

    if "draft an email to that supplier" in user_text or "email" in user_text:
        return (
            f"Subject: Action Required - Supplier Risk Escalation\n\n"
            f"Hi {second_supplier},\n\n"
            "We are monitoring recent lead-time and logistics risk on your current supply commitments. "
            "Please confirm delivery timing and backup capacity to protect our production plan.\n\n"
            "Regards,\nAtlas Operations"
        )

    if "red sea detour" in user_text or "detour" in user_text:
        return (
            "The Red Sea detour routes cargo around the Cape of Good Hope instead of using the Suez route, because the route is exposed to high-risk maritime disruption. "
            "This adds roughly 38% longer travel distance and usually pushes delivery by roughly 7 to 10 days."
        )

    if "hello" in user_text or "hi" in user_text or "hey" in user_text:
        return "Hello! I’m Atlas, your supply chain operations assistant. I can review risk, explain detours, and help with supplier follow-ups."

    if "price" in user_text or "cost" in user_text:
        return "The current high-risk supplier exposure is driven by delayed lead times and the Red Sea reroute risk, not by a single pricing issue."

    client = _get_gemini_client()
    if not client:
        return (
            "I’m connected to your shipment data, but `GEMINI_API_KEY` is missing in `.env`. "
            "Add your key to `.env` so I can answer custom follow-up questions."
        )

    data_context = df.head(25).to_string(index=False)
    system_prompt = (
        "You are Atlas, a professional, friendly, and sharp supply chain operations assistant. "
        "Answer the user's question clearly in plain, everyday business English. "
        "Keep answers concise, helpful, and structured with clean bullet points. "
        "Use ONLY the exact shipment numbers provided below—never invent fake numbers.\n\n"
        f"CURRENT SHIPMENT DATA ({os.path.basename(csv_path)}):\n{data_context}"
    )

    conversation = []
    for msg in history[-6:]:
        role = "user" if msg.get("role") == "user" else "model"
        conversation.append(types.Content(role=role, parts=[types.Part.from_text(text=msg.get("text", ""))]))
    conversation.append(types.Content(role="user", parts=[types.Part.from_text(text=user_message)]))

    try:
        resp = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=conversation,
            config=types.GenerateContentConfig(
                system_instruction=system_prompt,
                temperature=0.3,
            ),
        )
        return resp.text.strip()
    except Exception as e:
        return f"I couldn't reach Gemini right now ({str(e)}). Try clicking **Run Full Check** to run the offline math engine."


def _generate_chart(df: pd.DataFrame, out_path: str):
    plt.style.use("dark_background")
    fig, axes = plt.subplots(2, 2, figsize=(11, 7), dpi=150)
    fig.patch.set_facecolor("#0A1024")

    if "utilization_pct" not in df.columns:
        df = df.copy()
        df["utilization_pct"] = (df["actual_output"] / df["capacity_target"]) * 100
    if "days_of_cover" not in df.columns:
        df = df.copy()
        df["days_of_cover"] = (df["current_stock"] / df["daily_demand"]).round(1)

    for ax in axes.flat:
        ax.set_facecolor("#101935")
        ax.spines["top"].set_visible(False)
        ax.spines["right"].set_visible(False)
        ax.spines["left"].set_color("#334155")
        ax.spines["bottom"].set_color("#334155")
        ax.tick_params(colors="#94A3B8", labelsize=8)

    top_val = df.nlargest(6, "cargo_value_usd")
    axes[0, 0].barh(top_val["shipment_id"], top_val["cargo_value_usd"] / 1e6, color="#38BDF8")
    axes[0, 0].set_title("Highest Value Shipments ($ Millions)", color="#F8FAFC", fontsize=10, pad=8)

    sample_f = df.head(7)
    colors_f = ["#F43F5E" if v >= 90 else "#10B981" for v in sample_f["utilization_pct"]]
    axes[0, 1].bar(sample_f["shipment_id"], sample_f["utilization_pct"], color=colors_f)
    axes[0, 1].axhline(90, color="#F59E0B", linestyle="--", linewidth=1)
    axes[0, 1].set_title("Factory Load % (Red = Overloaded)", color="#F8FAFC", fontsize=10, pad=8)

    route_counts = df["route_zone"].value_counts()
    axes[1, 0].pie(route_counts.values, labels=route_counts.index, autopct="%1.0f%%",
                   colors=["#38BDF8", "#818CF8", "#34D399"], textprops={"color": "#E2E8F0", "fontsize": 8})
    axes[1, 0].set_title("Shipping Corridor Share", color="#F8FAFC", fontsize=10, pad=8)

    low_s = df.nsmallest(7, "days_of_cover")
    colors_s = ["#F43F5E" if d <= 14 else "#38BDF8" for d in low_s["days_of_cover"]]
    axes[1, 1].bar(low_s["shipment_id"], low_s["days_of_cover"], color=colors_s)
    axes[1, 1].axhline(14, color="#F59E0B", linestyle="--", linewidth=1)
    axes[1, 1].set_title("Lowest Warehouse Stock (Days Left)", color="#F8FAFC", fontsize=10, pad=8)

    plt.tight_layout(pad=2.0)
    plt.savefig(out_path, facecolor=fig.get_facecolor())
    plt.close(fig)


def _generate_pdf(df: pd.DataFrame, risk_usd: float, reroutes: int, low_stock: int, out_path: str):
    if "days_of_cover" not in df.columns:
        df = df.copy()
        df["days_of_cover"] = (df["current_stock"] / df["daily_demand"]).round(1)
    pdf = FPDF()
    pdf.add_page()
    pdf.set_font("Helvetica", "B", 16)
    pdf.cell(0, 10, "Atlas AI - Supply Chain Operations Report", ln=True)
    pdf.set_font("Helvetica", "", 11)
    pdf.ln(4)
    pdf.cell(0, 8, f"Total Shipments Checked: {len(df)}", ln=True)
    pdf.cell(0, 8, f"Money at Risk (Delayed Suppliers): ${risk_usd:,.2f}", ln=True)
    pdf.cell(0, 8, f"Ships Rerouted to Safer Corridors: {reroutes}", ln=True)
    pdf.cell(0, 8, f"Warehouse Items Running Low (<14 Days): {low_stock}", ln=True)
    pdf.ln(6)
    pdf.set_font("Helvetica", "B", 12)
    pdf.cell(0, 8, "Recommended Actions:", ln=True)
    pdf.set_font("Helvetica", "", 10)
    pdf.multi_cell(0, 7, (
        "1. Contact delayed suppliers exceeding 14-day lead times to expedite priority components.\n"
        "2. Notify downstream warehouses of +7 to +10 day transit updates on Cape of Good Hope detours.\n"
        "3. Trigger immediate replenishment orders for SKUs with fewer than 14 days of cover."
    ))
    pdf.output(out_path)