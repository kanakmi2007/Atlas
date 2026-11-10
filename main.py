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
from pathlib import Path
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
BASE_DIR = Path(__file__).resolve().parent
UPLOAD_DIR = os.path.join(BASE_DIR, "uploads")
TEMPLATES_DIR = os.path.join(BASE_DIR, "templates")
STATIC_DIR = os.path.join(BASE_DIR, "static")

os.makedirs(OUTPUTS_DIR, exist_ok=True)
os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(TEMPLATES_DIR, exist_ok=True)
os.makedirs(STATIC_DIR, exist_ok=True)

# Generate baseline datasets on startup if missing
default_manifest = os.path.join(BASE_DIR, "supply_chain_manifest.csv")
corrupt_manifest = os.path.join(BASE_DIR, "corrupt_test_manifest.csv")

if not os.path.exists(default_manifest):
    print("[Startup] Generating baseline supply_chain_manifest.csv...")
    data_generator.generate_supply_chain_manifest(default_manifest)

if not os.path.exists(corrupt_manifest):
    print("[Startup] Generating corrupt_test_manifest.csv...")
    data_generator.generate_corrupt_manifest(corrupt_manifest)

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
app.mount("/outputs", StaticFiles(directory=OUTPUTS_DIR), name="outputs")

# Mount static assets for the landing page UI (CSS, JS, SVG assets)
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

# Initialize Master Orchestrator
orchestrator = MasterOrchestrator(base_url=BASE_URL)


@app.get("/", response_class=HTMLResponse)
async def root(request: Request):
    """
    Root entrypoint:
    - Serves the animated 3D Landing Page for browser visits.
    - Preserves Nonilion discovery JSON when client requests application/json.
    """
    accept = request.headers.get("accept", "").lower()
    if "application/json" in accept and "text/html" not in accept:
        return JSONResponse(content={
            "service": "SupplyChain360 AI (Atlas)",
            "status": "online",
            "docs": "/docs",
            "demo_ui": "/demo-ui",
            "dashboard": "/dashboard",
            "landing": "/landing",
        })
    template_file = os.path.join(TEMPLATES_DIR, "landing.html")
    if os.path.exists(template_file):
        with open(template_file, "r", encoding="utf-8") as f:
            return HTMLResponse(content=f.read())
    return JSONResponse(content={
        "service": "SupplyChain360 AI (Atlas)",
        "status": "online",
        "docs": "/docs",
        "demo_ui": "/demo-ui"
    })


@app.get("/api/status", response_model=ServiceStatusResponse)
@app.get("/status", response_model=ServiceStatusResponse)
async def service_status():
    """Service status and discovery endpoint for Nonilion / API clients."""
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

    # Detect if user specifically requested corrupt / broken test file
    query_lower = query.lower()
    if not csv_path and any(k in query_lower for k in ["corrupt", "broken", "guardrail"]):
        if os.path.exists("corrupt_test_manifest.csv"):
            csv_path = "corrupt_test_manifest.csv"

    # Fallback to default demo manifest if explicit audit is requested without custom file
    wants_demo = any(
        term in query_lower
        for term in ["demo", "audit", "manifest", "run", "supply_chain_manifest", "analyze", "shipment", "route", "sea"]
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


@app.post("/upload-csv")
async def upload_csv(file: UploadFile = File(...), message: Optional[str] = Form(None)):
    """
    Dedicated CSV upload endpoint that saves uploaded CSV and runs audit directly.
    """
    safe_filename = f"upload_{uuid.uuid4().hex[:8]}_{file.filename}"
    csv_path = os.path.join(UPLOAD_DIR, safe_filename)
    with open(csv_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    query = message or f"Audit uploaded manifest: {file.filename}"
    result = orchestrator.run(query=query, csv_path=csv_path)
    
    return JSONResponse(content={
        "status": result.get("status", "success"),
        "reply": result.get("reply", ""),
        "message": result.get("reply", ""),
        "text": result.get("reply", ""),
        "total_at_risk_usd": result.get("total_at_risk_usd"),
        "diagnostics": result.get("diagnostics", []),
        "attachments": result.get("attachments", []),
        "filename": file.filename,
    })


@app.get("/landing", response_class=HTMLResponse)
@app.get("/landing.html", response_class=HTMLResponse)
@app.get("/index.html", response_class=HTMLResponse)
async def landing_page():
    """
    Animated landing page for Atlas – SupplyChain360 AI.
    Three.js globe, GSAP animations, glassmorphic UI.
    """
    template_file = os.path.join(TEMPLATES_DIR, "landing.html")
    if os.path.exists(template_file):
        with open(template_file, "r", encoding="utf-8") as f:
            return HTMLResponse(content=f.read())
    return HTMLResponse(
        content="<h1>Landing page template not found.</h1>",
        status_code=404,
    )


@app.get("/dashboard", response_class=HTMLResponse)
@app.get("/dashboard.html", response_class=HTMLResponse)
@app.get("/demo-ui", response_class=HTMLResponse)
async def demo_ui():
    """
    Hybrid Control Tower + Nonilion Virtual Office Split-Screen UI.
    Serves the modern dark-slate control dashboard from templates/dashboard.html.
    """
    template_file = os.path.join(TEMPLATES_DIR, "dashboard.html")
    if os.path.exists(template_file):
        with open(template_file, "r", encoding="utf-8") as f:
            return HTMLResponse(content=f.read())
    return HTMLResponse(
        content="<h1>Dashboard template not found. Please ensure templates/dashboard.html exists.</h1>",
        status_code=404,
    )


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
