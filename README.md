# Atlas AI Co-Pilot
> Autonomous Supply Chain Intelligence & Risk Mitigation Engine

Atlas is an end-to-end, real-time supply chain operational co-pilot. It automatically audits logistics manifests (supply_chain_manifest.csv), detects vendor SLA breaches, quantifies financial risk exposure, simulates maritime corridor detours (e.g., Cape of Good Hope rerouting), and automates emergency buffer purchase orders.

---

## Table of Contents
- Key Features
- System Architecture
- Tech Stack
- Quick Start Guide (Local Setup)
  - 1. Backend Setup (FastAPI)
  - 2. Frontend Setup (React/Vite)
- Render Deployment Guide
- Example Scenario Queries
- API Endpoints Reference

---

## Key Features

- Manifest Risk Auditing: Parses supply chain manifests in real time to highlight total financial exposure at risk ($), stockout timelines, and delayed shipments past 14-day SLAs.
- Maritime Detour & Air Freight Simulator: Interactive What-If simulation engine to model multi-day global delays and calculate cost/lead-time trade-offs when switching components to air freight.
- Autonomous Action Center: One-click resolution interface to issue emergency buffer Purchase Orders (POs) and dispatch formal SLA breach escalation emails to vendors.
- Soft Pastel Executive UI: Built with a clean, pastel-themed design system (Slate, Coral, Periwinkle, Sage) replacing dark robotic AI aesthetics.
- Intuitive Prompt Discovery: Includes an interactive welcome screen with instant 1-click scenario preset cards and action chips for effortless user onboarding.

---

## System Architecture

```text
[ React / Vite Frontend ]  <--->  [ FastAPI Backend (Port 8080) ]
        │                                       │
        ├── Action Center UI                    ├── CSV Manifest Parser (Pandas)
        ├── Risk Simulator                      ├── RAG Context & SLA Knowledge Base
        └── Interactive Chat                    └── Google GenAI Engine (Gemini 1.5/3.8 Flash)

```

---

## Tech Stack

* Frontend: React 18, Vite, Tailwind CSS, Lucide Icons, React Markdown
* Backend: Python 3.10+, FastAPI, Uvicorn, Pandas, Pydantic
* AI Engine: Google GenAI SDK (gemini-1.5-flash / gemini-3.8-flash)
* Networking: Vite Dev Proxy, FastAPI CORS Middleware

---

## Quick Start Guide (Local Setup)

Follow these simple steps to get Atlas running locally on your machine.

### Prerequisites

* Node.js (v18 or higher)
* Python (v3.10 or higher)
* Google Gemini API Key

---

### 1. Backend Setup (FastAPI)

1. Clone the repository and navigate to project root:
```bash
git clone [https://github.com/kanakmi2007/Atlas.git](https://github.com/kanakmi2007/Atlas.git)
cd Atlas

```


2. Create and activate a Python virtual environment:
* Windows (PowerShell):
```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1

```


* macOS / Linux:
```bash
python3 -m venv .venv
source .venv/bin/activate

```




3. Install dependencies:
```bash
pip install -r requirements.txt

```


4. Create a .env file in the root folder:
```env
GEMINI_API_KEY=your_actual_gemini_api_key_here

```


5. Start the FastAPI backend server:
```bash
uvicorn main:app --reload --port 8080

```


Backend will run locally at http://127.0.0.1:8080.

---

### 2. Frontend Setup (React/Vite)

1. Open a new terminal window and navigate to atlas-ui:
```bash
cd Atlas/atlas-ui

```


2. Install Node modules:
```bash
npm install

```


3. Launch the development server:
```bash
npm run dev

```


4. Open your browser:
Navigate to http://localhost:5173 to interact with Atlas Co-Pilot!

---

## Render Deployment Guide

To host Atlas online for live demonstrations:

### Backend Deployment (Render Web Service)

1. Create a new Web Service on Render connected to this repository.
2. Set Root Directory to . (project root).
3. Set Environment to Python 3.
4. Set Build Command: `pip install -r requirements.txt`
5. Set Start Command: `uvicorn main:app --host 0.0.0.0 --port $PORT`
6. Add Environment Variable: `GEMINI_API_KEY` = `<your-api-key>`

### Frontend Deployment (Render Static Site)

1. Create a new Static Site on Render.
2. Set Root Directory to atlas-ui.
3. Set Build Command: `npm install && npm run build`
4. Set Publish Directory: `dist`
5. Ensure your API endpoint points to your live Render backend URL.

---

## Example Scenario Queries

You can test Atlas using these built-in operational prompts:

| Category | Example Prompt |
| --- | --- |
| Audit & Exposure | "Audit supply_chain_manifest.csv for top risk exposure" |
| Vendor Escalation | "Draft an SLA escalation email for SHP-2004 (Taiwan Semi Foundry)" |
| What-If Simulation | "Simulate a 14-day delay with 35% air freight reroute" |
| Stockout Defense | "Which items are under 14 days of warehouse stock cover?" |

---

## API Endpoints Reference

| Route | Method | Payload / Params | Description |
| --- | --- | --- | --- |
| `/api/query` | `POST` | `{"prompt": "string"}` | Primary AI engine query endpoint |
| `/v1/audit` | `GET` | None | Manifest CSV summary metric parser |
| `/health` | `GET` | None | API health status check |