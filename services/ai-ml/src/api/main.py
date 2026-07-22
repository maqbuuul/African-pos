from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel
import os


SERVICE_SECRET = os.getenv("AI_ML_SERVICE_SECRET", "dev_internal_ai_ml_secret_change_me")

app = FastAPI(
    title="Hospitality OS AI/ML Service",
    version="0.1.0",
    description="Internal forecasting, recommendations, anomaly detection, and AI briefings.",
)


def verify_service_secret(x_service_secret: str) -> None:
    if x_service_secret != SERVICE_SECRET:
        raise HTTPException(status_code=401, detail="Unauthorized")


class BriefingRequest(BaseModel):
    organization_id: str
    location_id: str | None = None
    vertical: str = "restaurant"


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "ai-ml"}


@app.post("/briefings/daily")
def daily_briefing(req: BriefingRequest, x_service_secret: str = Header(...)) -> dict:
    verify_service_secret(x_service_secret)
    return {
        "organization_id": req.organization_id,
        "location_id": req.location_id,
        "vertical": req.vertical,
        "summary": "AI briefing pipeline planned.",
        "recommendations": [],
    }

