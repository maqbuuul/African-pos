from fastapi import FastAPI, HTTPException, Header
from pydantic import BaseModel
import os

ML_SERVICE_SECRET = os.getenv("ML_SERVICE_SECRET", "internal_ml_secret")

app = FastAPI(
    title="African POS — ML Service",
    description="Internal ML service. Not exposed to the internet. Called by BullMQ worker.",
    version="0.1.0",
    docs_url="/docs",
)


def verify_secret(x_service_secret: str) -> None:
    if x_service_secret != ML_SERVICE_SECRET:
        raise HTTPException(status_code=401, detail="Unauthorized")


# ─── HEALTH ──────────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {"status": "ok"}


# ─── MODEL 1: DEMAND FORECASTING (Prophet) ────────────────────────────────────
# Used by: morning briefing, purchase order suggestions

class ForecastRequest(BaseModel):
    business_id: str
    location_id: str | None = None
    horizon_days: int = 7


@app.post("/forecast/{business_id}")
def forecast(business_id: str, req: ForecastRequest, x_service_secret: str = Header(...)):
    verify_secret(x_service_secret)
    # TODO Week 14: Train Prophet on order history per product per business
    # Input: SELECT product_id, DATE(created_at), SUM(quantity) FROM order_items WHERE business_id=...
    # Output: 7-day demand forecast + items with predicted_demand > current_stock (stockout risk)
    return {
        "business_id": business_id,
        "forecast": [],
        "at_risk_items": [],
        "message": "Prophet model not trained yet — implement in Week 14",
    }


# ─── MODEL 2: MENU ENGINEERING (LightGBM) ────────────────────────────────────
# Used by: Owner Dashboard intelligence page, menu optimization

class MenuEngineeringRequest(BaseModel):
    business_id: str
    period_days: int = 30


@app.post("/menu-engineering")
def menu_engineering(req: MenuEngineeringRequest, x_service_secret: str = Header(...)):
    verify_secret(x_service_secret)
    # TODO Week 8 (Month 8): LightGBM classifies each item as:
    # Stars: high margin, high volume → promote, protect price
    # Plowhorses: low margin, high volume → raise price or reduce cost
    # Puzzles: high margin, low volume → promote, reposition on menu
    # Dogs: low margin, low volume → remove or completely rethink
    # Features: volume_rank, margin_rank, trend_direction, price_elasticity
    return {
        "business_id": req.business_id,
        "stars": [],
        "plowhorses": [],
        "puzzles": [],
        "dogs": [],
        "message": "LightGBM model not trained yet — implement in Month 8",
    }


# ─── MODEL 3: ANOMALY DETECTION (Isolation Forest) ───────────────────────────
# Used by: Real-time fraud alerts, owner WhatsApp alerts

class AnomalyRequest(BaseModel):
    business_id: str
    event_type: str  # 'void_spike' | 'discount_abuse' | 'cash_discrepancy' | 'staff_fraud'


@app.post("/anomaly-detect")
def anomaly_detect(req: AnomalyRequest, x_service_secret: str = Header(...)):
    verify_secret(x_service_secret)
    # TODO Week 14: Isolation Forest on:
    # - Voids per staff per hour vs. baseline
    # - Discount rate per cashier vs. peers
    # - Cash variance at end of shift
    # - Orders opened and closed without payment (walkouts)
    return {
        "business_id": req.business_id,
        "anomalies": [],
        "score": 0.0,
        "message": "Isolation Forest not trained yet — implement in Week 14",
    }


# ─── MODEL 4: PRODUCT RECOMMENDATION (Co-occurrence Matrix) ──────────────────
# Used by: POS checkout screen ("Customers also order...")

class RecommendRequest(BaseModel):
    business_id: str
    cart_item_ids: list[str]  # product UUIDs currently in the cart
    limit: int = 3


@app.post("/recommend")
def recommend(req: RecommendRequest, x_service_secret: str = Header(...)):
    verify_secret(x_service_secret)
    # TODO Week 16: Build item co-occurrence matrix from order_items history
    # co_occurrence[item_a][item_b] = count of orders containing both
    # Given cart items, return top N items most frequently bought alongside them
    # Rebuild matrix weekly via BullMQ job
    # Very effective even with small datasets (100+ orders is enough)
    return {
        "business_id": req.business_id,
        "recommendations": [],
        "message": "Co-occurrence matrix not built yet — implement in Week 16",
    }


# ─── MODEL 5: CHURN PREDICTION (LightGBM Classifier) ────────────────────────
# Used by: Win-back campaign trigger, at-risk customer list in Owner Dashboard

class ChurnRequest(BaseModel):
    business_id: str
    customer_ids: list[str] | None = None  # None = score all customers


@app.post("/churn-predict")
def churn_predict(req: ChurnRequest, x_service_secret: str = Header(...)):
    verify_secret(x_service_secret)
    # TODO Week 19: LightGBM trained on RFM features
    # Recency: days since last visit
    # Frequency: visit count in last 90 days
    # Monetary: total spend in last 90 days
    # Trend: visit frequency trend (increasing/decreasing)
    # Label: churned = no visit in 60+ days after being a regular (≥3 visits)
    # Output: { customer_id, churn_probability, days_since_visit, recommended_action }
    return {
        "business_id": req.business_id,
        "at_risk_customers": [],
        "message": "Churn model not trained yet — implement in Week 19",
    }


# ─── MODEL 6: CUSTOMER LIFETIME VALUE (BG/NBD) ───────────────────────────────
# Used by: Credit limit decisions, VIP identification, loyalty tier setting

class CLVRequest(BaseModel):
    business_id: str
    customer_id: str
    horizon_days: int = 90


@app.post("/clv")
def customer_lifetime_value(req: CLVRequest, x_service_secret: str = Header(...)):
    verify_secret(x_service_secret)
    # TODO Week 20: BG/NBD model (lifetimes library)
    # Predicts: expected number of future transactions in horizon_days
    # × avg order value → predicted 90-day spend
    # Uses: frequency, recency, T (customer age), monetary_value
    # Low CLV + high credit balance → reduce credit limit
    # High CLV → increase loyalty tier, offer premium perks
    return {
        "business_id": req.business_id,
        "customer_id": req.customer_id,
        "predicted_spend_kes": 0,
        "predicted_visits": 0,
        "confidence": 0.0,
        "message": "BG/NBD model not trained yet — implement in Week 20",
    }


# ─── MODEL 7: WHATSAPP FAST-PATH NLP ─────────────────────────────────────────
# Used by: WhatsApp ordering — routes simple orders without calling Claude

class WhatsAppParseRequest(BaseModel):
    business_id: str
    message: str
    language: str = "sw"  # 'sw' | 'en'


class ParsedOrder(BaseModel):
    items: list[dict]   # [{ product_name, quantity, confidence }]
    intent: str         # 'order' | 'inquiry' | 'payment' | 'cancel' | 'unknown'
    confidence: float   # 0.0–1.0. If < 0.85 → escalate to Claude
    escalate_to_claude: bool


@app.post("/whatsapp-parse", response_model=ParsedOrder)
def whatsapp_parse(req: WhatsAppParseRequest, x_service_secret: str = Header(...)):
    verify_secret(x_service_secret)
    # TODO Month 7: Two-tier NLP pipeline
    # Tier 1 (this endpoint): rule-based + fuzzy match against product catalog
    #   - Regex patterns: "(\d+)\s*(x\s*)?(product_name)" → {"qty": n, "name": product}
    #   - Fuzzy match: "ugali mbili" → product_id=... with confidence 0.96
    #   - If confidence > 0.85 and all items resolved → return order, skip Claude
    # Tier 2 (Claude): if confidence < 0.85 OR intent unclear → escalate
    # Result: ~65% of orders handled locally, ~35% go to Claude
    return ParsedOrder(
        items=[],
        intent="unknown",
        confidence=0.0,
        escalate_to_claude=True,
    )
