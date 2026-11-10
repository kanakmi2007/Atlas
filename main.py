"""
FastAPI Server for Atlas (SupplyChain360 AI).
Autonomous Multi-Agent Supply Chain Orchestrator for Nonilion.com Virtual Office Ecosystem.

Features:
- Webhook receiver (POST /webhook) supporting flexible Nonilion JSON payloads & multipart CSV uploads
- Ambiguity guardrails & automatic schema validation
- Static asset serving for visual matrix, logistics CSV, and executive PDF audit
- Built-in interactive test dashboard at /demo-ui
"""

import os
import sys
import json
import uuid
import shutil
from datetime import datetime
from typing import Optional, Dict, Any

from fastapi import FastAPI, Request, File, UploadFile, Form, BackgroundTasks
from fastapi.responses import HTMLResponse, JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

import data_generator
from schemas import (
    WebhookRequest,
    WebhookResponse,
    WebhookAttachment,
    NodeDiagnostic,
    ServiceStatusResponse,
)
from agents import MasterOrchestrator, OUTPUTS_DIR

load_dotenv()

BASE_URL = os.getenv("BASE_URL", "http://localhost:8000").rstrip("/")
UPLOAD_DIR = os.path.join(os.getcwd(), "uploads")
os.makedirs(OUTPUTS_DIR, exist_ok=True)
os.makedirs(UPLOAD_DIR, exist_ok=True)

# Generate baseline datasets on startup if missing
if not os.path.exists("supply_chain_manifest.csv"):
    print("[Startup] Generating baseline supply_chain_manifest.csv...")
    data_generator.generate_supply_chain_manifest("supply_chain_manifest.csv")

if not os.path.exists("corrupt_test_manifest.csv"):
    print("[Startup] Generating corrupt_test_manifest.csv...")
    data_generator.generate_corrupt_manifest("corrupt_test_manifest.csv")

app = FastAPI(
    title="Atlas (SupplyChain360 AI)",
    description="Autonomous Multi-Agent Supply Chain Orchestrator for Nonilion.com",
    version="4.0.0",
)

# Enable CORS for external Nonilion ecosystem integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount outputs directory for static files (PNG matrix, PDF audit, CSV schedule)
app.mount("/outputs", StaticFiles(directory="outputs"), name="outputs")

# Initialize Master Orchestrator
orchestrator = MasterOrchestrator(base_url=BASE_URL)


@app.get("/", response_model=ServiceStatusResponse)
async def root():
    """Service status and discovery endpoint."""
    return {
        "service": "SupplyChain360 AI (Atlas)",
        "status": "online",
        "docs": "/docs",
        "demo_ui": "/demo-ui",
    }


@app.get("/health")
async def health_check():
    """Health check endpoint for Render and uptime monitors."""
    return {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "outputs_ready": os.path.exists(OUTPUTS_DIR),
        "manifest_ready": os.path.exists("supply_chain_manifest.csv"),
    }


@app.post("/webhook")
async def handle_webhook(request: Request):
    """
    Primary webhook receiver for Nonilion.com virtual office messages and direct API clients.
    Supports both flexible JSON payloads and multipart/form-data with CSV uploads.
    """
    content_type = request.headers.get("content-type", "").lower()
    query = ""
    room_id = None
    sender = None
    csv_path = None

    # Case 1: multipart/form-data upload
    if "multipart/form-data" in content_type:
        form = await request.form()
        print(f"\n[NONILION WEBHOOK INCOMING FORM-DATA] Keys: {list(form.keys())}")

        file_obj: Optional[UploadFile] = form.get("file")
        if file_obj and hasattr(file_obj, "filename") and file_obj.filename:
            safe_filename = f"upload_{uuid.uuid4().hex[:8]}_{file_obj.filename}"
            csv_path = os.path.join(UPLOAD_DIR, safe_filename)
            with open(csv_path, "wb") as buffer:
                shutil.copyfileobj(file_obj.file, buffer)
            print(f"[Upload] Saved uploaded manifest to {csv_path}")

        # Extract text from various standard parameters
        for key in ["message", "text", "content", "prompt"]:
            val = form.get(key)
            if val and str(val).strip():
                query = str(val).strip()
                break

        room_id = form.get("room_id")
        sender = form.get("sender")

    # Case 2: application/json payload
    else:
        try:
            raw_body = await request.json()
        except Exception:
            raw_body = {}

        print(f"\n[NONILION WEBHOOK INCOMING JSON]:\n{json.dumps(raw_body, indent=2)}")

        req = WebhookRequest(**raw_body)
        query = req.get_query()
        room_id = req.room_id
        sender = req.sender
        file_url = req.get_attached_csv_url()

        if file_url:
            # If URL is local filename or direct path
            if os.path.exists(file_url):
                csv_path = file_url
            elif file_url.startswith("http"):
                try:
                    import requests
                    r = requests.get(file_url, timeout=10)
                    if r.status_code == 200:
                        safe_filename = f"url_upload_{uuid.uuid4().hex[:8]}.csv"
                        csv_path = os.path.join(UPLOAD_DIR, safe_filename)
                        with open(csv_path, "wb") as f:
                            f.write(r.content)
                except Exception as e:
                    print(f"[Warning] Failed to fetch remote CSV from {file_url}: {e}")

    # Fallback to default demo manifest if explicit audit is requested without custom file
    query_lower = query.lower()
    wants_demo = any(
        term in query_lower
        for term in ["demo", "audit", "manifest", "run", "supply_chain_manifest", "analyze"]
    )
    if not csv_path and (wants_demo or query_lower == ""):
        if os.path.exists("supply_chain_manifest.csv"):
            csv_path = "supply_chain_manifest.csv"

    # Execute orchestrator pipeline with Ambiguity Guardrail
    result = orchestrator.run(query=query, csv_path=csv_path or "supply_chain_manifest.csv")

    response_payload = {
        "status": result.get("status", "success"),
        "reply": result.get("reply", ""),
        "message": result.get("reply", ""),
        "text": result.get("reply", ""),
        "total_at_risk_usd": result.get("total_at_risk_usd"),
        "diagnostics": result.get("diagnostics", []),
        "attachments": result.get("attachments", []),
        "room_id": room_id,
    }

    return JSONResponse(content=response_payload)


@app.get("/demo-ui", response_class=HTMLResponse)
async def demo_ui():
    """
    Interactive test dashboard for local verification and live hackathon demonstrations.
    Provides 1-click demo audit, corrupt manifest testing, inline matrix preview, and artifact downloads.
    """
    html_content = """<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Atlas // SupplyChain360 AI Console</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
    <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" rel="stylesheet">
    <style>
        body { background-color: #0b1120; color: #f1f5f9; font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
        .glass-card { background: rgba(15, 23, 42, 0.85); border: 1px solid #1e293b; backdrop-filter: blur(12px); }
        .prose h3 { color: #38bdf8; font-weight: 700; margin-top: 1rem; margin-bottom: 0.5rem; }
        .prose h4 { color: #e2e8f0; font-weight: 600; margin-top: 0.75rem; margin-bottom: 0.5rem; }
        .prose table { width: 100%; border-collapse: collapse; margin-top: 0.75rem; margin-bottom: 0.75rem; font-size: 0.875rem; }
        .prose th { background: #1e293b; color: #94a3b8; padding: 6px 10px; border: 1px solid #334155; text-align: left; }
        .prose td { padding: 6px 10px; border: 1px solid #334155; }
        .prose a { color: #38bdf8; text-decoration: underline; }
        .prose ul { list-style-type: disc; margin-left: 1.25rem; margin-top: 0.5rem; }
    </style>
</head>
<body class="min-h-screen p-4 md:p-8">

    <div class="max-w-7xl mx-auto space-y-6">

        <!-- Header Banner -->
        <header class="glass-card rounded-2xl p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-l-4 border-sky-400">
            <div>
                <div class="flex items-center gap-3">
                    <span class="p-2.5 bg-sky-500/10 text-sky-400 rounded-xl text-xl">
                        <i class="fa-solid fa-network-wired"></i>
                    </span>
                    <div>
                        <h1 class="text-2xl font-black tracking-tight text-white flex items-center gap-2">
                            Atlas <span class="text-sky-400 font-medium text-lg">// SupplyChain360 AI</span>
                        </h1>
                        <p class="text-xs text-slate-400 mt-0.5">Autonomous Multi-Agent Orchestrator for Nonilion.com Virtual Office</p>
                    </div>
                </div>
            </div>
            <div class="flex items-center gap-3">
                <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span> SYSTEM ONLINE
                </span>
                <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-sky-500/10 text-sky-400 border border-sky-500/20">
                    <i class="fa-solid fa-robot"></i> 5 Sub-Agents Active
                </span>
                <a href="/docs" target="_blank" class="px-3 py-1 rounded-lg text-xs font-medium bg-slate-800 text-slate-300 hover:bg-slate-700 transition">
                    <i class="fa-solid fa-book mr-1"></i> API Docs
                </a>
            </div>
        </header>

        <!-- Command & Control Bar -->
        <div class="grid grid-cols-1 md:grid-cols-3 gap-6">

            <!-- Control Box -->
            <div class="glass-card rounded-2xl p-6 space-y-5 md:col-span-1">
                <h2 class="text-sm font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                    <i class="fa-solid fa-bolt text-amber-400"></i> Autonomous Actions
                </h2>

                <div class="space-y-3">
                    <button onclick="runAudit('Run demo audit')" class="w-full py-3 px-4 rounded-xl font-bold text-sm bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white shadow-lg shadow-sky-500/20 flex items-center justify-center gap-2 transition active:scale-[0.98]">
                        <i class="fa-solid fa-play"></i> Run Full Demo Audit (25 Shipments)
                    </button>

                    <button onclick="testCorruptManifest()" class="w-full py-2.5 px-4 rounded-xl font-semibold text-xs bg-slate-800 hover:bg-rose-950/40 text-rose-300 border border-rose-500/30 flex items-center justify-center gap-2 transition">
                        <i class="fa-solid fa-shield-halved text-rose-400"></i> Test Guardrail: Corrupt Manifest
                    </button>

                    <button onclick="runAudit('hi')" class="w-full py-2.5 px-4 rounded-xl font-semibold text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 flex items-center justify-center gap-2 transition">
                        <i class="fa-solid fa-comment-dots text-sky-400"></i> Test Ambiguity Guardrail ("hi")
                    </button>
                </div>

                <div class="pt-4 border-t border-slate-800 space-y-3">
                    <h3 class="text-xs font-bold uppercase tracking-wider text-slate-400">
                        <i class="fa-solid fa-upload mr-1 text-sky-400"></i> Upload Custom CSV Manifest
                    </h3>
                    <input type="file" id="csvFileInput" accept=".csv" class="block w-full text-xs text-slate-400 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-sky-500/10 file:text-sky-400 hover:file:bg-sky-500/20 cursor-pointer">
                    <button onclick="uploadAndAudit()" class="w-full py-2 px-3 rounded-lg text-xs font-semibold bg-sky-600 hover:bg-sky-500 text-white transition">
                        Upload & Run Multi-Agent Audit
                    </button>
                </div>

                <!-- Generated Artifacts Quick Links -->
                <div class="pt-4 border-t border-slate-800 space-y-2" id="artifactLinksBox">
                    <h3 class="text-xs font-bold uppercase tracking-wider text-slate-400">
                        <i class="fa-solid fa-folder-open mr-1 text-emerald-400"></i> Production Artifacts
                    </h3>
                    <div class="space-y-1.5 text-xs">
                        <a href="/outputs/supply_chain_matrix.png" target="_blank" class="flex items-center justify-between p-2 rounded-lg bg-slate-800/60 hover:bg-slate-800 text-slate-300 transition">
                            <span class="flex items-center gap-2"><i class="fa-solid fa-image text-sky-400"></i> supply_chain_matrix.png</span>
                            <i class="fa-solid fa-arrow-up-right-from-square text-[10px]"></i>
                        </a>
                        <a href="/outputs/revised_logistics_schedule.csv" download class="flex items-center justify-between p-2 rounded-lg bg-slate-800/60 hover:bg-slate-800 text-slate-300 transition">
                            <span class="flex items-center gap-2"><i class="fa-solid fa-file-csv text-emerald-400"></i> revised_logistics_schedule.csv</span>
                            <i class="fa-solid fa-download text-[10px]"></i>
                        </a>
                        <a href="/outputs/Executive_Supply_Chain_Audit.pdf" target="_blank" class="flex items-center justify-between p-2 rounded-lg bg-slate-800/60 hover:bg-slate-800 text-slate-300 transition">
                            <span class="flex items-center gap-2"><i class="fa-solid fa-file-pdf text-rose-400"></i> Executive_Supply_Chain_Audit.pdf</span>
                            <i class="fa-solid fa-arrow-up-right-from-square text-[10px]"></i>
                        </a>
                    </div>
                </div>
            </div>

            <!-- Audit Overview & Diagnostic Cards -->
            <div class="glass-card rounded-2xl p-6 md:col-span-2 space-y-6">

                <!-- Exposure Metric Banner -->
                <div class="bg-gradient-to-r from-slate-900 to-slate-800/80 p-5 rounded-xl border border-slate-700/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div>
                        <span class="text-xs uppercase font-bold text-slate-400 tracking-wider">Identified Systemic Financial Exposure</span>
                        <div class="text-3xl font-black text-rose-400 mt-1" id="totalExposureVal">$11,990,000.00 USD</div>
                    </div>
                    <div class="flex gap-2 text-xs">
                        <span class="px-3 py-1.5 rounded-lg bg-rose-500/10 text-rose-400 border border-rose-500/20 font-bold">
                            <i class="fa-solid fa-triangle-exclamation mr-1"></i> High Exposure
                        </span>
                        <span class="px-3 py-1.5 rounded-lg bg-sky-500/10 text-sky-400 border border-sky-500/20 font-bold">
                            <i class="fa-solid fa-compass mr-1"></i> Nonilion 4.0
                        </span>
                    </div>
                </div>

                <!-- 4 Node Diagnostics -->
                <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div class="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1">
                        <span class="text-[10px] uppercase font-bold text-slate-400">1. Sourcing</span>
                        <div class="text-xs font-bold text-rose-400">CRITICAL</div>
                        <div class="text-[11px] text-slate-300" id="diagSourcing">4 vendors >14d</div>
                    </div>
                    <div class="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1">
                        <span class="text-[10px] uppercase font-bold text-slate-400">2. Production</span>
                        <div class="text-xs font-bold text-amber-400">BOTTLENECK</div>
                        <div class="text-[11px] text-slate-300" id="diagProd">3 lines >=90%</div>
                    </div>
                    <div class="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1">
                        <span class="text-[10px] uppercase font-bold text-slate-400">3. Logistics</span>
                        <div class="text-xs font-bold text-rose-400">DISRUPTED</div>
                        <div class="text-[11px] text-slate-300" id="diagLogistics">6 vessels Cape Detour</div>
                    </div>
                    <div class="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1">
                        <span class="text-[10px] uppercase font-bold text-slate-400">4. Inventory</span>
                        <div class="text-xs font-bold text-rose-400">STOCKOUT</div>
                        <div class="text-[11px] text-slate-300" id="diagInv">5 SKUs <7d cover</div>
                    </div>
                </div>

                <!-- Markdown Narrative & Escalations -->
                <div class="space-y-2">
                    <div class="flex items-center justify-between">
                        <h3 class="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                            <i class="fa-solid fa-terminal text-sky-400"></i> Multi-Agent Escalation Log (Markdown)
                        </h3>
                        <span id="loader" class="hidden text-xs text-sky-400 font-semibold animate-pulse">
                            <i class="fa-solid fa-spinner fa-spin mr-1"></i> Running Sub-Agents...
                        </span>
                    </div>
                    <div id="markdownOutput" class="glass-card rounded-xl p-5 text-sm prose max-w-none text-slate-200 overflow-x-auto max-h-[380px] overflow-y-auto border border-slate-800">
                        <p class="text-slate-400 italic">Click <b>"Run Full Demo Audit"</b> above to trigger the 5 sub-agents and view the live Nonilion response...</p>
                    </div>
                </div>

            </div>
        </div>

        <!-- 4-Panel Visual Matrix Preview -->
        <div class="glass-card rounded-2xl p-6 space-y-4">
            <div class="flex items-center justify-between">
                <div>
                    <h2 class="text-base font-bold text-white flex items-center gap-2">
                        <i class="fa-solid fa-chart-pie text-sky-400"></i> Panel 1-4 Operational Diagnostic Matrix Preview
                    </h2>
                    <p class="text-xs text-slate-400">Polar Risk Radar • Bottleneck Squeeze • Maritime Corridors • 14-Day Stockout Curve</p>
                </div>
                <a href="/outputs/supply_chain_matrix.png" target="_blank" class="px-3 py-1.5 rounded-lg text-xs font-semibold bg-sky-500/10 text-sky-400 border border-sky-500/30 hover:bg-sky-500/20 transition">
                    <i class="fa-solid fa-expand mr-1"></i> Open Full High-Res (DPI=200)
                </a>
            </div>
            <div class="rounded-xl overflow-hidden border border-slate-800 bg-[#0f172a] p-2 flex justify-center items-center">
                <img id="matrixImg" src="/outputs/supply_chain_matrix.png" alt="Operational Diagnostic Matrix" class="w-full max-h-[640px] object-contain rounded-lg">
            </div>
        </div>

    </div>

    <script>
        async function runAudit(queryText) {
            const loader = document.getElementById('loader');
            const output = document.getElementById('markdownOutput');
            loader.classList.remove('hidden');
            output.innerHTML = '<p class="text-slate-400 animate-pulse"><i class="fa-solid fa-spinner fa-spin mr-2"></i>Atlas orchestrator dispatching sub-agents...</p>';

            try {
                const res = await fetch('/webhook', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ message: queryText })
                });
                const data = await res.json();
                renderResponse(data);
            } catch (err) {
                output.innerHTML = `<p class="text-rose-400">Error: ${err.message}</p>`;
            } finally {
                loader.classList.add('hidden');
            }
        }

        async function testCorruptManifest() {
            const loader = document.getElementById('loader');
            const output = document.getElementById('markdownOutput');
            loader.classList.remove('hidden');
            output.innerHTML = '<p class="text-slate-400 animate-pulse"><i class="fa-solid fa-shield-halved mr-2"></i>Testing validation guardrail against corrupt_test_manifest.csv...</p>';

            try {
                const res = await fetch('/webhook', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        message: "Audit this corrupt manifest",
                        file_url: "corrupt_test_manifest.csv"
                    })
                });
                const data = await res.json();
                renderResponse(data);
            } catch (err) {
                output.innerHTML = `<p class="text-rose-400">Error: ${err.message}</p>`;
            } finally {
                loader.classList.add('hidden');
            }
        }

        async function uploadAndAudit() {
            const fileInput = document.getElementById('csvFileInput');
            if (!fileInput.files || fileInput.files.length === 0) {
                alert('Please select a CSV file first.');
                return;
            }
            const loader = document.getElementById('loader');
            const output = document.getElementById('markdownOutput');
            loader.classList.remove('hidden');
            output.innerHTML = '<p class="text-slate-400 animate-pulse"><i class="fa-solid fa-spinner fa-spin mr-2"></i>Uploading and analyzing custom manifest...</p>';

            const formData = new FormData();
            formData.append('file', fileInput.files[0]);
            formData.append('message', 'Audit this custom manifest');

            try {
                const res = await fetch('/webhook', {
                    method: 'POST',
                    body: formData
                });
                const data = await res.json();
                renderResponse(data);
            } catch (err) {
                output.innerHTML = `<p class="text-rose-400">Error: ${err.message}</p>`;
            } finally {
                loader.classList.add('hidden');
            }
        }

        function renderResponse(data) {
            const output = document.getElementById('markdownOutput');
            const replyText = data.reply || data.message || data.text || '';
            output.innerHTML = marked.parse(replyText);

            if (data.total_at_risk_usd !== undefined && data.total_at_risk_usd !== null) {
                document.getElementById('totalExposureVal').innerText = '$' + Number(data.total_at_risk_usd).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' USD';
            }

            // Reload matrix image with cache busting
            const matrixImg = document.getElementById('matrixImg');
            matrixImg.src = '/outputs/supply_chain_matrix.png?t=' + new Date().getTime();
        }
    </script>
</body>
</html>
"""
    return HTMLResponse(content=html_content)


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
