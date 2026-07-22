# Data & ML System — Real Intelligence, Not Guesses

> Stock alerts powered by actual ML models trained on your own sales patterns. Anomaly detection that catches problems before they hurt you. Forecasting that accounts for African market rhythms — payday weeks, school terms, market days, weather, local events.

---

## Core Principle: Data That Earns Its Screen Space

Every chart, number, and alert must answer one question: **"What should I do because of this?"**

If a data point doesn't lead to action, it doesn't belong in the interface. No vanity metrics. No charts that look impressive but tell you nothing useful.

**Examples of data that earns its space:**
- "You will run out of rice in 3 days." → Order now
- "Your food cost jumped 4% this week." → Check supplier invoices
- "Tuesday lunch is your slowest period." → Run a promotion
- "Server James has the highest void rate this week." → Have a conversation

**Examples of data that wastes screen space:**
- A pie chart showing "payment methods breakdown" when 95% is M-Pesa
- A graph of hourly sales that looks identical every day
- "Total lifetime transactions: 4,721"

---

## Data Architecture

### The 3-Layer Data Model

```
Layer 1 — OPERATIONAL DATA (real-time, transactional)
  • Orders, payments, inventory changes
  • Written to PostgreSQL, replicated to read replica
  • Accessed by POS terminals
  • Retention: forever

Layer 2 — ANALYTICS DATA (aggregated, fast queries)
  • Pre-computed aggregates refreshed every 15 minutes
  • DuckDB for in-process fast analytics
  • Powers dashboards and reports
  • Retention: forever

Layer 3 — ML FEATURE STORE (model inputs)
  • Derived features for ML models
  • Recomputed nightly in batch
  • Stored as Parquet files in object storage
  • Powers forecasting and anomaly detection
```

### Data Pipeline

```
[POS Transaction] 
       │
       ▼
[PostgreSQL write]──────────────────────────► [Replication]
       │                                            │
       │ (every 15 min)                             │
       ▼                                            ▼
[Aggregation job]                         [ML nightly batch]
       │                                            │
       ▼                                            ▼
[DuckDB analytics]                        [Feature store]
       │                                            │
       ▼                                            ▼
[Dashboard API]                           [Forecast models]
       │                                            │
       └──────────────────────────────────────────► ▼
                                          [Alert engine]
                                                    │
                                                    ▼
                                          [WhatsApp/push alerts]
```

---

## ML Stock Forecasting — Real Model, Not Threshold

### The Problem with "Threshold Alerts"

Every POS does this:
```
IF stock < threshold THEN alert
```

The problem: the threshold is a number the merchant guessed. 10 units of cooking oil. Is that 2 days or 10 days of stock? Depends on your sales. And sales change — your Friday is nothing like your Tuesday.

### Our Approach: Demand-Calibrated Stock Intelligence

**Model: What will I sell of each item over the next N days?**

Given that forecast, and the current stock level, the system calculates:
- **Days of stock remaining** (at predicted demand pace, not average)
- **Reorder point**: stock level at which you should order given your supplier lead time
- **Suggested order quantity**: how much to order to last until the next natural ordering cycle
- **Confidence interval**: "Between 8 and 14 days of stock — high confidence"

### Feature Engineering (What the Model Uses)

```python
# Features used to forecast demand per SKU per day
FEATURES = {
    # Temporal
    'day_of_week':       int,      # Monday=0 ... Sunday=6
    'day_of_month':      int,      # 1-31
    'week_of_month':     int,      # 1-5
    'month':             int,
    'is_weekend':        bool,
    'is_public_holiday': bool,     # country-specific holidays
    'is_school_term':    bool,     # term/holiday distinction matters for many businesses
    'days_after_payday': int,      # 0-30 (distance from month-end/mid-month payday)

    # Business context
    'location_id':       str,      # each location has its own model
    'is_rainy_season':   bool,     # derived from historical weather patterns
    'local_event_flag':  bool,     # manual flag or calendar API

    # Item-level history
    'sales_d1':          float,    # sales 1 day ago
    'sales_d7':          float,    # sales 7 days ago (same day last week)
    'sales_d14':         float,
    'sales_d28':         float,
    'rolling_7d_mean':   float,
    'rolling_28d_mean':  float,
    'rolling_7d_std':    float,    # volatility
    'trend_28d':         float,    # slope of 28-day trend

    # Promotional context
    'is_on_promotion':   bool,
    'promo_discount_pct': float,
    'days_since_last_promo': int,

    # Cross-item (for restaurants)
    'parent_dish_sales': float,    # if this is an ingredient, how much of the parent dish sold
}
```

### The Model: Gradient Boosted Tree (LightGBM)

```python
import lightgbm as lgb
import pandas as pd
import numpy as np
from datetime import datetime, timedelta

class StockForecastModel:
    """
    Per-location, per-item demand forecast.
    Trained on: 90 days of historical sales.
    Predicts: next 1, 3, 7, 14, 30 days of demand.
    Retrains: weekly (Sunday night, nightly if >100 transactions/day).
    """

    def __init__(self, location_id: str, item_id: str):
        self.location_id = location_id
        self.item_id = item_id
        self.model = None
        self.mae = None           # Mean Absolute Error (actual accuracy)
        self.mape = None          # Mean Absolute Percentage Error
        self.coverage = None      # % of time actual falls within prediction interval

    def train(self, df: pd.DataFrame):
        """
        df: historical daily sales for this item at this location
            columns: date, quantity_sold, + all features above
        """
        # Minimum data requirement
        if len(df) < 14:
            self.model = None
            return

        # Time-based train/val split (last 14 days = validation)
        split_date = df['date'].max() - timedelta(days=14)
        train = df[df['date'] <= split_date]
        val   = df[df['date'] > split_date]

        feature_cols = [c for c in df.columns if c not in ['date', 'quantity_sold']]

        params = {
            'objective':        'tweedie',      # handles count data with zeros well
            'tweedie_variance_power': 1.5,
            'learning_rate':    0.05,
            'num_leaves':       31,
            'min_child_samples': 20,
            'feature_fraction': 0.8,
            'bagging_fraction': 0.8,
            'bagging_freq':     5,
            'verbose':          -1
        }

        dtrain = lgb.Dataset(train[feature_cols], label=train['quantity_sold'])
        dval   = lgb.Dataset(val[feature_cols],   label=val['quantity_sold'])

        self.model = lgb.train(
            params,
            dtrain,
            num_boost_round=500,
            valid_sets=[dval],
            callbacks=[lgb.early_stopping(50), lgb.log_evaluation(0)]
        )

        # Calculate accuracy metrics on validation set
        preds = self.model.predict(val[feature_cols])
        actuals = val['quantity_sold'].values

        self.mae  = np.mean(np.abs(actuals - preds))
        # MAPE only for non-zero actuals
        nonzero_mask = actuals > 0
        self.mape = np.mean(np.abs((actuals[nonzero_mask] - preds[nonzero_mask])
                                   / actuals[nonzero_mask])) * 100

    def predict(self, future_features: pd.DataFrame, horizon_days: int = 7):
        """
        Returns: predicted quantity for each future day + confidence interval
        """
        if self.model is None:
            # Fallback for items with insufficient data: use simple moving average
            return self._simple_moving_average_forecast(future_features, horizon_days)

        predictions = self.model.predict(future_features)

        # Build confidence intervals using quantile regression
        # (Train separate models at 10th and 90th percentile)
        lower = predictions * 0.7  # simplified; production uses quantile models
        upper = predictions * 1.4

        return pd.DataFrame({
            'date':       future_features['date'],
            'forecast':   np.round(predictions, 1),
            'lower_80':   np.round(lower, 1),
            'upper_80':   np.round(upper, 1),
        })

    def _simple_moving_average_forecast(self, future_features, horizon_days):
        """Used when < 14 days of history. Transparent fallback."""
        recent_avg = future_features['rolling_7d_mean'].iloc[0]
        return pd.DataFrame({
            'date':      future_features['date'][:horizon_days],
            'forecast':  [recent_avg] * horizon_days,
            'lower_80':  [recent_avg * 0.6] * horizon_days,
            'upper_80':  [recent_avg * 1.4] * horizon_days,
            'is_fallback': True   # UI shows "estimated" vs "model-based"
        })
```

### Days-of-Stock Calculation

```python
def calculate_days_of_stock(
    current_stock: float,
    daily_forecasts: pd.DataFrame,  # from StockForecastModel.predict()
    supplier_lead_days: int = 2     # merchant configures this per supplier
) -> dict:
    """
    Returns: how many days until stockout + when to reorder.
    """
    cumulative_demand = 0.0
    days_until_stockout = 0

    for _, row in daily_forecasts.iterrows():
        cumulative_demand += row['forecast']
        if cumulative_demand >= current_stock:
            break
        days_until_stockout += 1

    # Reorder point: when you should order so stock doesn't hit zero
    # considering supplier lead time
    reorder_at_days = days_until_stockout - supplier_lead_days

    # Suggested order quantity: enough for 14 days at forecast pace
    forecast_14d = daily_forecasts['forecast'].sum()
    suggested_order = max(0, forecast_14d - current_stock)

    # Confidence
    avg_uncertainty = (daily_forecasts['upper_80'] - daily_forecasts['lower_80']).mean()
    if avg_uncertainty < daily_forecasts['forecast'].mean() * 0.3:
        confidence = 'HIGH'
    elif avg_uncertainty < daily_forecasts['forecast'].mean() * 0.7:
        confidence = 'MEDIUM'
    else:
        confidence = 'LOW'

    return {
        'days_until_stockout':  days_until_stockout,
        'reorder_in_days':      max(0, reorder_at_days),
        'suggested_order_qty':  round(suggested_order, 1),
        'confidence':           confidence,
        'model_accuracy_pct':   round(100 - (model.mape or 30), 1),
        'is_model_based':       model.model is not None
    }
```

### Alert Tiers (Clear, Not Noisy)

```
🔴 CRITICAL  → "Out of stock" or "Will run out TODAY"
              → WhatsApp alert immediately to manager + owner
              → Red badge on POS home screen

🟡 WARNING   → "Will run out in 1-3 days"
              → WhatsApp alert at 7 AM on the day
              → Amber badge on inventory screen

🟢 PLANNED   → "Will run out in 4-7 days" — included in weekly summary
              → No interrupt alert — shows in report only

⚪ WATCH     → "Will run out in 8-14 days" — visible on inventory page
              → No alerts
```

**Rule**: Merchant should not receive more than 3 stock alerts per day. If there are 10 items at critical level, send one consolidated WhatsApp: "3 items need urgent restocking — [link]". Not 10 separate messages.

---

## Anomaly Detection — Catch Problems Automatically

Problems a restaurant/retail owner needs to know about that they'll never notice themselves:

### Anomaly 1: Sales Drop (Unexplained)
```python
def detect_sales_anomaly(location_id, today_sales, historical_sales):
    # Compare today vs. same-weekday average over last 4 weeks
    expected = historical_sales.filter(same_weekday=True).last(4).mean()
    
    if today_sales < expected * 0.6:  # 40% below expected
        return {
            'type': 'SALES_DROP',
            'severity': 'HIGH',
            'message': f'Sales {round((1 - today_sales/expected)*100)}% below your usual {weekday_name}',
            'action': 'Check if there\'s an operational issue, or run a quick promotion'
        }
```

### Anomaly 2: Food Cost Spike
```python
def detect_food_cost_spike(business_id, period='week'):
    current_food_cost_pct = calculate_food_cost_pct(business_id, period)
    baseline = calculate_food_cost_pct(business_id, previous_period(period))

    if current_food_cost_pct > baseline * 1.08:  # 8% above baseline
        return Anomaly(
            type='FOOD_COST_SPIKE',
            message=f'Food cost {current_food_cost_pct:.1f}% vs usual {baseline:.1f}%',
            likely_causes=[
                'Supplier price increase',
                'Portion sizes larger than standard',
                'Waste/spoilage increase',
                'Theft'
            ]
        )
```

### Anomaly 3: High Void/Comp Rate
```python
# If a staff member's voids > 3x the location average → flag for review
# If total voids today > 5% of revenue → alert manager
```

### Anomaly 4: Payment Method Anomaly
```python
# If cash collected at end of shift ≠ cash expected from POS transactions
# Trigger: |actual_cash - expected_cash| > KSh 500
# Alert: "Cash variance of KSh 1,200 — drawer may need to be counted"
```

### Anomaly 5: Unusual Single Transaction
```python
# A transaction that is 5× the average order value
# Not necessarily bad — might be a large catering order
# But worth flagging: "Unusual large order: KSh 45,000 — was this correct?"
```

---

## African Market Features in the ML Model

### Payday Effect
In Kenya, Tanzania, Uganda: government and corporate employees are paid on the last working day of the month. Restaurants see 20-40% higher sales on those days. The model must know which days are paydays.

```python
def is_near_payday(date: datetime, country: str) -> dict:
    """Return payday proximity features for given country."""

    if country == 'KE':
        # Government: 27th. Corporate: last working day. Common combo.
        payday_targets = [27, 'last_working_day']
    elif country == 'NG':
        payday_targets = [25, 'last_working_day']
    elif country == 'GH':
        payday_targets = [25, 'last_working_day']
    # ... etc

    # Return distance to nearest payday this month
    # and whether it's already passed (post-payday spending rush vs. end-of-month drought)
    return {
        'days_to_payday':   days_to_next_payday(date, payday_targets),
        'days_after_payday': days_since_last_payday(date, payday_targets),
        'is_payday_week':   days_to_next_payday(date, payday_targets) <= 3
                            or days_since_last_payday(date, payday_targets) <= 3
    }
```

### School Term Effect
School proximity restaurants see large drops during school holidays, spikes on opening days.

### Market Day Effect
In many African towns, weekly market days drive huge traffic increases:
```python
MARKET_DAYS = {
    'Nairobi':    None,  # daily market
    'Kakamega':   'Monday',
    'Kisumu':     'Wednesday',
    # configured by merchant or detected automatically from traffic patterns
}
```

### Ramadan Effect
For Muslim-majority areas: fasting hours reduce daytime sales, evening (Iftar) sees a surge. Model accounts for this with a Ramadan calendar.

---

## The Accuracy Display (Honesty Principle)

Show merchants how accurate the forecasts are. Build trust through transparency.

```
┌─────────────────────────────────────────────┐
│ 📦 Rice (5kg bags)         🟡 Reorder soon  │
├─────────────────────────────────────────────┤
│ In stock:          23 bags                  │
│ Selling at:        ~3.2 bags/day            │
│ Will last:         7 days  ±1               │
│ Suggested order:   22 bags (2-week supply)  │
│                                             │
│ Forecast accuracy: 91%  ▓▓▓▓▓▓▓▓▓░          │
│ Based on: 68 days of your actual sales      │
└─────────────────────────────────────────────┘
```

If the model has poor accuracy (< 60%) or insufficient data:
```
│ Forecast accuracy: ~60%  ▓▓▓▓▓▓░░░░          │
│ ⚠️ Limited history — improving as you sell   │
```

---

## Demand Forecasting for Staffing

Same model infrastructure applied to staffing:

```
"Based on your history, next Saturday (29 Jun) is predicted to be 
your 3rd busiest day of the year. You usually do KSh 78,000+ on 
days like this. Consider scheduling 2 extra staff."
```

```python
def predict_staffing_needs(location_id, target_date):
    revenue_forecast = forecast_revenue(location_id, target_date)
    
    # Historical: at this revenue level, how many covers/transactions?
    expected_transactions = revenue_forecast / avg_transaction_value(location_id)
    
    # Historical: transactions per staff hour
    throughput = get_throughput_rate(location_id)
    
    # Hours of operation
    operating_hours = get_hours(location_id, target_date)
    
    suggested_staff = ceil(expected_transactions / (throughput * operating_hours))
    
    return {
        'date': target_date,
        'forecast_revenue': revenue_forecast,
        'forecast_transactions': expected_transactions,
        'suggested_staff_hours': suggested_staff * operating_hours,
        'suggested_staff_count': suggested_staff
    }
```

---

## Menu Engineering — Live, Not Manual

The BCG matrix for your menu — calculated automatically from real data:

```sql
-- Menu engineering calculation
WITH item_stats AS (
  SELECT
    p.id,
    p.name,
    p.price,
    p.cost,
    COUNT(oi.id)                              AS quantity_sold,
    SUM(oi.quantity * oi.unit_price)          AS total_revenue,
    SUM(oi.quantity * (oi.unit_price - p.cost)) AS total_profit,
    (p.price - COALESCE(p.cost, 0)) / p.price  AS margin_pct
  FROM products p
  JOIN order_items oi ON oi.product_id = p.id
  JOIN orders o ON o.id = oi.order_id
  WHERE o.business_id = :business_id
    AND o.created_at >= NOW() - INTERVAL '30 days'
  GROUP BY p.id, p.name, p.price, p.cost
),
averages AS (
  SELECT
    AVG(quantity_sold) AS avg_qty,
    AVG(margin_pct)    AS avg_margin
  FROM item_stats
)
SELECT
  i.*,
  CASE
    WHEN i.quantity_sold >= a.avg_qty AND i.margin_pct >= a.avg_margin THEN 'STAR'
    WHEN i.quantity_sold >= a.avg_qty AND i.margin_pct <  a.avg_margin THEN 'PLOWHORSE'
    WHEN i.quantity_sold <  a.avg_qty AND i.margin_pct >= a.avg_margin THEN 'PUZZLE'
    ELSE 'DOG'
  END AS menu_category,
  -- Specific action recommendation
  CASE
    WHEN i.quantity_sold >= a.avg_qty AND i.margin_pct >= a.avg_margin
      THEN 'Keep prominently on menu. Feature in promotions.'
    WHEN i.quantity_sold >= a.avg_qty AND i.margin_pct < a.avg_margin
      THEN 'Very popular — consider raising the price by 10-15% or reducing portion.'
    WHEN i.quantity_sold < a.avg_qty AND i.margin_pct >= a.avg_margin
      THEN 'Great margin — needs more visibility. Move it up the menu. Run a promotion.'
    ELSE 'Low profit, low popularity. Consider removing or refreshing this item.'
  END AS recommendation
FROM item_stats i CROSS JOIN averages a
ORDER BY total_profit DESC;
```

---

## Cross-Business ML (Owner-Level Intelligence)

When an owner has multiple businesses, the system can surface cross-business patterns:

```
"Your Westlands restaurant generates 2× more revenue per square meter 
than your CBD branch, despite being 30% smaller. The Westlands menu 
has 8 fewer items and 23% higher average margins."

→ Action: Consider simplifying the CBD menu and raising prices.
```

```
"Last 3 months: your salon revenue drops 18% the week after school 
reopens. Your Ngong minimart revenue increases 22% that same week. 
You may be able to schedule shared staff between these two locations."
```

These cross-business insights are only possible when one system sees all your data — which no global POS can do for multi-business owners.
