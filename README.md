# Atlas (SupplyChain360 AI)
### Autonomous Multi-Agent Supply Chain Orchestrator for Nonilion.com
**Event:** INNOVORTEX 4.0 Hackathon  
**Target Platform:** Nonilion Virtual Office Ecosystem  
**Runtime:** Python 3.11+ / FastAPI / Google GenAI (`gemini-2.5-flash`)

---

## 🌟 Executive Overview

**Atlas (SupplyChain360 AI)** is a production-grade, autonomous multi-agent backend built to orchestrate and safeguard global supply chains within the **Nonilion.com** virtual office ecosystem. 

When disruption strikes maritime corridors, single-source suppliers face delays, or factory assembly lines hit capacity ceilings, Atlas autonomously detects the systemic failure, models the Cape of Good Hope nautical detour, calculates dynamic fuel surcharges, projects stockout exhaustion curves, and issues targeted departmental escalations directly into Nonilion channels (`@Procurement`, `@Logistics`, `@Operations`).

---

## 🏗️ Multi-Agent Architecture

Atlas employs a **Master Orchestrator** commanding **5 specialized sub-agents** using `google-genai` automatic function calling and deterministic mathematical fallbacks:

```
                          ┌─────────────────────────────────────┐
                          │         Master Orchestrator         │
                          │     Atlas (SupplyChain360 AI)       │
                          │   [gemini-2.5-flash + Nonilion Bot] │
                          └──────────────────┬──────────────────┘
                                             │
      ┌──────────────────┬───────────────────┼───────────────────┬──────────────────┐
      ▼                  ▼                   ▼                   ▼                  ▼
┌───────────┐      ┌───────────┐       ┌───────────┐       ┌───────────┐      ┌───────────┐
│ Sub-Agent │      │ Sub-Agent │       │ Sub-Agent │       │ Sub-Agent │      │ Sub-Agent │
│  Sourcing │      │Production │       │ Logistics │       │  Demand   │      │ Artifact  │
│   Audit   │      │ Capacity  │       │  Reroute  │       │ Inventory │      │  Engine   │
└─────┬─────┘      └─────┬─────┘       └─────┬─────┘       └─────┬─────┘      └─────┬─────┘
      │                  │                   │                   │                  │
      ▼                  ▼                   ▼                   ▼                  ▼
 Lead Time >14d     Line Utilization   Red Sea / Hormuz     Days of Cover        2x2 Matrix
 $ at Risk USD      >=90% Bottleneck    Cape Detour +38%    <7d Stockouts        (PNG 200DPI)
 Dual-Sourcing      Rebalancing Units  $18.50/NM Surcharge  21d Safety Buffer   Audit PDF
```

### 1. Master Orchestrator (`agents.py`)
- Coordinates the 5 sub-agents through `google-genai` automatic tool calling.
- Enforces strict **Ambiguity Guardrails**: if a user says *"hi"* or *"fix my supply chain"* without providing data, Atlas asks clarifying questions instead of hallucinating metrics.
- Synthesizes findings into high-visibility virtual office escalations and provides clickable links to all generated artifacts.

### 2. Sourcing Audit Sub-Agent (`sub_agent_sourcing_audit`)
- Analyzes vendor reliability and flags single-source suppliers where `lead_time_days > 14`.
- Computes exact `$ at risk` per vendor and overall sourcing exposure.
- Formulates dual-sourcing playbooks (e.g. 60/40 volume splits with nearshore suppliers).

### 3. Production Capacity Sub-Agent (`sub_agent_production_capacity`)
- Audits factory line utilization (`actual_output / capacity_target`).
- Flags bottlenecked lines operating at `utilization_pct >= 90%`.
- Calculates unit deficits and recommends factory line batch rebalancing.

### 4. Logistics Reroute Sub-Agent (`sub_agent_logistics_reroute`)
- Identifies maritime vessels transiting high-risk geopolitical chokepoints (`"Red Sea"`, `"Suez Canal"`, `"Strait of Hormuz"`).
- Computes baseline nautical miles via `geopy.distance.geodesic`.
- Models the **Cape of Good Hope maritime detour** (+38% distance multiplier, extra days at 420 NM/day, dynamic fuel surcharge at $18.50 per detour NM).
- Generates and exports `./outputs/revised_logistics_schedule.csv`.

### 5. Demand & Inventory Sub-Agent (`sub_agent_demand_inventory`)
- Evaluates stock health by calculating `days_of_cover = current_stock / daily_demand`.
- Flags imminent stockouts (`< 7 days`) and overstock capital traps (`> 60 days`).
- Calculates dynamic 21-day safety buffer replenishment quantities.

### 6. Multi-Modal Artifact Engine (`sub_agent_artifact_engine`)
- **Artifact 1 — 4-Panel Operational Matrix (`./outputs/supply_chain_matrix.png`)**:
  - Rendered in high-resolution (DPI=200, 16x11 inches) using a modern dark-slate theme (`#0f172a`):
  - **Panel 1 (Top-Left):** Supplier Risk Radar Chart (Polar Projection).
  - **Panel 2 (Top-Right):** Factory Line Capacity vs Output with 90% Bottleneck Threshold.
  - **Panel 3 (Bottom-Left):** Global Maritime Corridors Map Plot (Crimson chokepoints vs Emerald Cape detours).
  - **Panel 4 (Bottom-Right):** 14-Day Stockout Timeline Depletion Curve.
- **Artifact 2 — Executive Audit Report (`./outputs/Executive_Supply_Chain_Audit.pdf`)**:
  - Executive-grade multi-page PDF generated via `reportlab.platypus` featuring financial KPI cards, diagnostic tables, and actionable virtual office directives for `@Procurement`, `@Logistics`, and `@Operations`.

---

## 📁 Repository Structure

```
Atlas/
├── requirements.txt                 # Exact, battle-tested Python dependencies
├── .env.example                     # Environment template (GEMINI_API_KEY, BASE_URL)
├── .env                             # Local environment configuration
├── schemas.py                       # Pydantic schemas for Nonilion webhooks & validation
├── data_generator.py                # 25-row realistic manifest + 5-row corrupt test manifest
├── agents.py                        # Master Orchestrator + 5 specialized domain sub-agents
├── main.py                          # FastAPI server, webhook receiver, /demo-ui & static hosting
├── test_system.py                   # Automated zero-dependency end-to-end test suite
├── supply_chain_manifest.csv        # 25-row realistic production dataset
├── corrupt_test_manifest.csv        # 5-row corrupt manifest (missing columns) for guardrails
├── outputs/                         # Hosted static assets
│   ├── supply_chain_matrix.png      # 4-Panel 200 DPI visual diagnostic matrix
│   ├── revised_logistics_schedule.csv# Cape detour logistics schedule
│   └── Executive_Supply_Chain_Audit.pdf # Executive audit PDF report
└── README.md                        # Documentation and deployment manual
```

---

## 🚀 Quick Start Guide

### 1. Clone & Set Up Environment
```bash
git clone <repo-url>
cd Atlas

# Optional: Create and activate virtual environment
python -m venv venv
# Windows:
venv\Scripts\activate
# Linux/macOS:
source venv/bin/activate
```

### 2. Install Dependencies
```bash
pip install -r requirements.txt
```

### 3. Configure Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Edit `.env` (optional for local deterministic mode; provide key for GenAI conversational mode):
```env
GEMINI_API_KEY=your_gemini_api_key_here
BASE_URL=http://localhost:8000
```

### 4. Generate Datasets & Run Verification Test
```bash
python data_generator.py
python test_system.py
```

### 5. Launch FastAPI Backend
```bash
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

---

## 🖥️ Live Testing Dashboard (`/demo-ui`)

Open your browser to:
**`http://localhost:8000/demo-ui`**

From this interactive dark-slate control console, you can:
1. **Click "Run Full Demo Audit":** Executes all 5 sub-agents, updates the $ Total at Risk KPI, renders the Markdown audit log, and refreshes the 4-panel visual matrix.
2. **Click "Test Guardrail: Corrupt Manifest":** Sends `corrupt_test_manifest.csv` and verifies that schema validation gracefully catches missing columns without crashing.
3. **Click 'Test Ambiguity Guardrail ("hi")':** Demonstrates that Atlas avoids hallucinating numbers and politely prompts the user for specific datasets.
4. **Upload Custom Manifests:** Drag-and-drop any CSV to trigger the multi-agent diagnostic on the fly.
5. **Download Artifacts:** 1-click links for PNG matrix, CSV schedule, and Executive Audit PDF.

---

## 🔌 API Endpoints & Nonilion Webhook Integration

### `GET /`
Returns service status and discovery links:
```json
{
  "service": "SupplyChain360 AI (Atlas)",
  "status": "online",
  "docs": "/docs",
  "demo_ui": "/demo-ui"
}
```

### `POST /webhook`
Unified webhook receiver supporting Nonilion virtual offices:
- **Headers:** `Content-Type: application/json` or `multipart/form-data`
- **Request Body (JSON):**
```json
{
  "message": "Run demo audit",
  "sender": "OperationsDirector",
  "room_id": "room-supply-chain-war-room"
}
```
- **Response Body:**
```json
{
  "status": "success",
  "reply": "### 🛡️ ATLAS (SupplyChain360 AI) — Autonomous Multi-Agent Audit...",
  "message": "### 🛡️ ATLAS (SupplyChain360 AI) — Autonomous Multi-Agent Audit...",
  "text": "### 🛡️ ATLAS (SupplyChain360 AI) — Autonomous Multi-Agent Audit...",
  "total_at_risk_usd": 11990000.0,
  "diagnostics": [
    {
      "node": "Sourcing",
      "status": "CRITICAL",
      "metric": "4 vendors >14d lead time",
      "financial_impact_usd": 3290000.0
    },
    {
      "node": "Production",
      "status": "BOTTLENECK",
      "metric": "3 lines >=90% capacity squeeze",
      "financial_impact_usd": 3190000.0
    },
    {
      "node": "Logistics",
      "status": "DISRUPTED",
      "metric": "6 vessels rerouted via Cape (+38% distance)",
      "financial_impact_usd": 4560000.0
    },
    {
      "node": "Inventory",
      "status": "CRITICAL_STOCKOUT",
      "metric": "5 SKUs with <7 days cover",
      "financial_impact_usd": 4140000.0
    }
  ],
  "attachments": [
    {
      "type": "image",
      "name": "supply_chain_matrix.png",
      "url": "http://localhost:8000/outputs/supply_chain_matrix.png"
    },
    {
      "type": "file",
      "name": "revised_logistics_schedule.csv",
      "url": "http://localhost:8000/outputs/revised_logistics_schedule.csv"
    },
    {
      "type": "file",
      "name": "Executive_Supply_Chain_Audit.pdf",
      "url": "http://localhost:8000/outputs/Executive_Supply_Chain_Audit.pdf"
    }
  ],
  "room_id": "room-supply-chain-war-room"
}
```

---

## ☁️ Deployment Guide (Render)

Deploying to Render takes under 3 minutes:

1. **Push this repository to GitHub.**
2. **Log into [Render Dashboard](https://dashboard.render.com/)** and click **New + > Web Service**.
3. **Connect your repository.**
4. **Configure the Web Service Settings:**
   - **Environment:** `Python 3`
   - **Build Command:**
     ```bash
     pip install -r requirements.txt && python data_generator.py
     ```
   - **Start Command:**
     ```bash
     uvicorn main:app --host 0.0.0.0 --port $PORT
     ```
5. **Set Environment Variables in Render:**
   - `BASE_URL`: `https://your-service-name.onrender.com`
   - `GEMINI_API_KEY`: `<your_gemini_api_key>`
6. Click **Deploy Web Service**.

---

## 🛡️ Hackathon Validation & Guardrails Verified

- **15-Column Manifest Validation:** Tested with missing columns (`corrupt_test_manifest.csv`) — caught gracefully with informative error messages.
- **Ambiguity Guardrail:** Tested with ambiguous prompts (`"hi"`, `"help"`) — prompts user for dataset clarification without hallucinating numbers.
- **Deterministic Math Layer:** All 5 sub-agents execute deterministically and generate PNG matrix, CSV schedule, and ReportLab PDF even without a live LLM API key.
- **Production-Grade Error Handling:** Headless Matplotlib configuration, zero memory leaks, and thread-safe file handling.

---
*Built with precision for INNOVORTEX 4.0 Hackathon // Nonilion.com Virtual Office.*
