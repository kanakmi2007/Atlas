# Atlas AI Co-Pilot 

> **Autonomous Supply Chain Intelligence & Risk Mitigation Engine**
> Atlas is a high-performance AI co-pilot built for real-time supply chain auditing, maritime reroute simulation, vendor SLA breach tracking, and automated emergency purchase order generation.

---

## Key Features

* **Instant Manifest Auditing**: Analyzes CSV manifests (`supply_chain_manifest.csv`) to calculate total financial exposure, rerouted vessels, and stockout timelines in real time.
* **Context-Sliced AI Engine**: Powered by Google GenAI (`gemini-3.8-flash`) with sliced RAG context targeting 500+ FAQ/SLA knowledge base items for sub-second operational queries.
* **Interactive Risk Analytics**: Live visual dashboards for vendor reliability scores, corridor risk breakdown, and emergency action tracking.
* **Automated Action Center**: One-click generation of SLA breach escalation emails and emergency buffer Purchase Orders (POs).
* **What-If Risk Simulator**: Simulates multi-day port delays and calculates lead-time adjustments when shifting shipments to air freight corridors.
* **Intuitive UX & Prompt Discovery**: Built-in empty-state preset cards and quick-action chips designed for fast, seamless user interaction.

---

## Tech Stack

* **Frontend**: React, Vite, Tailwind CSS, Lucide Icons, React Markdown
* **Backend**: Python 3.10+, FastAPI, Uvicorn, Python-Dotenv, Pydantic
* **AI Model & SDK**: Google GenAI SDK (`gemini-3.8-flash`)
* **Proxy & Middleware**: Vite Development Proxy, FastAPI CORS Middleware

---

## Project Structure

```text
Atlas/
├── atlas-ui/                    # Frontend React/Vite application
│   ├── src/
│   │   ├── components/          # Analytics, Action Center, & Simulator UI
│   │   ├── App.jsx              # Main workspace & chat interaction logic
│   │   └── index.css            # Soft pastel theme & typography styles
│   ├── vite.config.js           # Proxy rules routing /api to http://127.0.0.1:8080
│   └── package.json
│
├── main.py                      # FastAPI server & Gemini AI execution engine
├── supply_chain_manifest.csv    # Live operational manifest data
├── requirements.txt             # Python dependencies
└── README.md                    # Project documentation

```

---

## Quickstart Guide

### Prerequisites

* **Node.js** (v18+) & **npm**
* **Python** (v3.10+)
* **GEMINI_API_KEY** set in your environment

---

### 1. Backend Setup (FastAPI)

1. Navigate to the root directory and set up your environment:
```bash
cd Atlas
python -m venv .venv

```


2. Activate the virtual environment:
* **Windows (PowerShell)**:
```powershell
.\.venv\Scripts\Activate.ps1

```


* **macOS/Linux**:
```bash
source .venv/bin/activate

```




3. Install dependencies:
```bash
pip install -r requirements.txt

```


4. Add your API key to `.env`:
```env
GEMINI_API_KEY=your_google_gemini_api_key_here

```


5. Launch the backend server:
```bash
uvicorn main:app --reload --port 8080

```


*The server runs locally at `[http://127.0.0.1:8080](http://127.0.0.1:8080)`.*

---

### 2. Frontend Setup (React / Vite)

1. Open a second terminal window and navigate to `atlas-ui`:
```bash
cd Atlas/atlas-ui

```


2. Install dependencies:
```bash
npm install

```


3. Start the Vite development server:
```bash
npm run dev

```


4. Open your browser at `http://localhost:5173`.

---

## API Endpoints

| Endpoint | Method | Description |
| --- | --- | --- |
| `/api/query` | `POST` | Accepts `{ "prompt": "..." }` and returns structured AI supply chain analysis. |
| `/v1/audit` | `GET` | Parses `supply_chain_manifest.csv` and returns aggregated metric benchmarks. |
| `/health` | `GET` | Health check route verifying API & Gemini SDK availability. |

---

## Example Scenario Queries

* **Risk Audit**: `"Audit supply_chain_manifest.csv for top financial risk exposure."`
* **Vendor Escalation**: `"Draft a formal SLA breach escalation notice for SHP-1004 (Taiwan Semi Foundry)."`
* **Inventory Defense**: `"Which critical SKUs are running under 14 days of warehouse stock cover?"`
* **What-If Simulation**: `"Simulate a 14-day global delay across semiconductor vendors with a 35% air freight reroute switch."`