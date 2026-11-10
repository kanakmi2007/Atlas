
import os
import shutil
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, UploadFile, File
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from agents import run_full_audit, ask_atlas_chat, OUTPUT_DIR

BASE_DIR = Path(__file__).resolve().parent

app = FastAPI(title="Atlas Supply Chain AI Agent")

# Create required directories
os.makedirs(OUTPUT_DIR, exist_ok=True)
os.makedirs(BASE_DIR / "uploads", exist_ok=True)

# Mount static files (IMPORTANT FIX)
app.mount(
    "/static",
    StaticFiles(directory=str(BASE_DIR / "static")),
    name="static"
)

app.mount("/outputs", StaticFiles(directory=OUTPUT_DIR), name="outputs")



STATE = {
    "active_csv": "supply_chain_manifest.csv",
    "history": {},
}


class ChatPayload(BaseModel):
    message: str
    csv_file: Optional[str] = None
    session_id: Optional[str] = None


@app.get("/")
def root():
    return {"service": "SupplyChain360 AI (Atlas)", "status": "online"}


@app.get("/health")
def health_check():
    return {"status": "online", "active_manifest": STATE["active_csv"]}


@app.get("/demo-ui", response_class=HTMLResponse)
def serve_ui():
    with open("templates/dashboard.html", "r", encoding="utf-8") as f:
        return HTMLResponse(content=f.read())

@app.get("/landing", response_class=HTMLResponse)
async def landing_page():
    landing_file = BASE_DIR / "templates" / "landing.html"
    return HTMLResponse(
        content=landing_file.read_text(encoding="utf-8")
    )


@app.post("/upload-csv")
async def upload_csv(file: UploadFile = File(...)):
    save_path = os.path.join("uploads", file.filename)
    with open(save_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    STATE["active_csv"] = save_path
    result = run_full_audit(save_path)
    return JSONResponse(content=result)


@app.post("/webhook")
async def webhook(payload: ChatPayload):
    msg = payload.message.strip()
    lower = msg.lower()
    session_id = payload.session_id or "default"
    history = STATE["history"].setdefault(session_id, [])

    if payload.csv_file:
        if os.path.exists(payload.csv_file):
            STATE["active_csv"] = payload.csv_file
        elif os.path.exists(os.path.join("uploads", payload.csv_file)):
            STATE["active_csv"] = os.path.join("uploads", payload.csv_file)

    if lower in {"hi", "hello", "hey", "greetings", "greeting"}:
        resp = {
            "status": "success",
            "intent": "greeting",
            "reply": "Hello! I’m Atlas, your supply chain operations assistant. I can review risk, explain detours, and help with supplier follow-ups.",
            "total_at_risk_usd": 0.0,
            "attachments": [],
        }
        history.append({"role": "user", "text": msg})
        history.append({"role": "assistant", "text": resp["reply"]})
        return JSONResponse(content=resp)

    if "corrupt" in lower or "broken" in lower or "validate" in lower:
        corrupt_path = "corrupt_test_manifest.csv"
        if not os.path.exists(corrupt_path):
            with open(corrupt_path, "w", encoding="utf-8") as f:
                f.write("shipment_id,supplier,cargo_value_usd\nSHP-999,,\n")
        result = run_full_audit(corrupt_path)
        history.append({"role": "user", "text": msg})
        history.append({"role": "assistant", "text": result["reply"]})
        resp = {
            "status": "success",
            "intent": "audit",
            "title": result.get("title", "Shipment Check Complete"),
            "reply": result["reply"],
            "total_at_risk_usd": 0.0,
            "attachments": [
                "/outputs/supply_chain_matrix.png" if os.path.exists(os.path.join(OUTPUT_DIR, "supply_chain_matrix.png")) else None,
                "/outputs/Executive_Supply_Chain_Audit.pdf" if os.path.exists(os.path.join(OUTPUT_DIR, "Executive_Supply_Chain_Audit.pdf")) else None,
                "/outputs/revised_logistics_schedule.csv" if os.path.exists(os.path.join(OUTPUT_DIR, "revised_logistics_schedule.csv")) else None,
            ],
        }
        resp["attachments"] = [p for p in resp["attachments"] if p]
        return JSONResponse(content=resp)

    audit_keywords = ["audit", "run demo audit", "check all", "check sample", "run check", "reroute", "safer sea", "analyze manifest", "check shipments"]
    if any(k in lower for k in audit_keywords):
        result = run_full_audit(STATE["active_csv"])
        history.append({"role": "user", "text": msg})
        history.append({"role": "assistant", "text": result["reply"]})
        total = 0.0
        if "money_at_risk" in result.get("metrics", {}):
            money = result["metrics"]["money_at_risk"]
            if money.startswith("$"):
                total = float(money.replace("$", "").replace("M", "")) * 1_000_000 if "M" in money else float(money.replace("$", ""))
        resp = {
            "status": "success",
            "intent": "audit",
            "title": result.get("title", "Shipment Check Complete"),
            "reply": result["reply"],
            "total_at_risk_usd": total,
            "attachments": [
                "/outputs/supply_chain_matrix.png" if os.path.exists(os.path.join(OUTPUT_DIR, "supply_chain_matrix.png")) else None,
                "/outputs/Executive_Supply_Chain_Audit.pdf" if os.path.exists(os.path.join(OUTPUT_DIR, "Executive_Supply_Chain_Audit.pdf")) else None,
                "/outputs/revised_logistics_schedule.csv" if os.path.exists(os.path.join(OUTPUT_DIR, "revised_logistics_schedule.csv")) else None,
            ],
        }
        resp["attachments"] = [p for p in resp["attachments"] if p]
        return JSONResponse(content=resp)

    reply_text = ask_atlas_chat(msg, history, STATE["active_csv"])
    history.append({"role": "user", "text": msg})
    history.append({"role": "assistant", "text": reply_text})

    return JSONResponse(content={
        "status": "success",
        "intent": "conversation",
        "reply": reply_text,
        "total_at_risk_usd": 0.0,
        "attachments": [],
    })
