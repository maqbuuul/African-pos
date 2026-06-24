# Technology Architecture Blueprint

> What to build, how to build it, and the technical decisions that define the best POS systems in the world.

---

## Architecture Principles (From Industry Leaders)

### Principle 1: Offline-First (Non-Negotiable for Africa)
Every global POS leader regrets not building offline-first from day one. Build offline-first from day zero.

```
Architecture Rule:
NEVER block a transaction due to connectivity.
ALL transactions write locally first.
Cloud sync is background, not blocking.
```

### Principle 2: API-First Microservices
Qu POS, Revel, and Shopify all succeed because they expose everything as an API. The platform outlives any single feature because third parties extend it.

### Principle 3: Local + Cloud Hybrid
TouchBistro's approach: local processing + background cloud sync. Best reliability profile for any market.

### Principle 4: Mobile-First (not just mobile-friendly)
African merchants use phones more than computers. The POS interface must work beautifully on a 6" Android phone.

---

## Core Technical Stack (Recommended)

### Frontend — POS Terminal Application
```
Framework:    React Native (single codebase for iOS + Android)
Local DB:     SQLite via expo-sqlite or MMKV
Sync:         Custom sync engine with CouchDB/PouchDB pattern
Offline:      Service Worker + IndexedDB for web fallback
State:        Zustand or Jotai (lightweight, fast)
UI:           React Native Paper or Tamagui
Receipts:     Bluetooth thermal printer SDK + in-app preview
```

### Backend — Cloud Services
```
API:          Node.js (Fastify) or Go — high throughput
Database:     PostgreSQL (primary) + Redis (cache/session)
Queue:        BullMQ on Redis for async jobs
Search:       Elasticsearch or Meilisearch for product search
File storage: Cloudflare R2 or AWS S3
Auth:         JWT + refresh tokens, TOTP 2FA
```

### AI/ML Layer
```
LLM:          Claude API (claude-sonnet-4-6) for conversational AI
Embeddings:   For semantic product search
Forecasting:  Python microservice (Prophet + sklearn)
Analytics:    DuckDB for fast analytics queries on POS data
Reports:      Auto-generated SQL from natural language (LLM → SQL)
```

### Payments Integration Layer
```
Mobile Money: Daraja API (M-Pesa Kenya)
              MTN MoMo API (Ghana, Uganda, Rwanda)
              Airtel Money API
              Orange Money API
Card:         Flutterwave, Paystack, DPO Group, Stripe
USSD:         Africa's Talking API
SMS/WhatsApp: Africa's Talking SMS + WhatsApp Business API
              Twilio fallback
```

---

## Offline Architecture Deep Dive

### The Offline Transaction Flow

```
[Customer pays]
     │
     ▼
[Local SQLite write] ←─── ALWAYS succeeds regardless of connectivity
     │
     ▼
[Generate local receipt] ←── Uses local data only
     │
     ├── [Online?] ──YES──► [Sync to cloud immediately]
     │                              │
     └── [Offline] ────────► [Add to sync queue]
                                    │
                             [When online] ──► [Process queue]
                                                     │
                                              [Conflict check]
                                                     │
                                              [Merge or flag]
```

### Sync Conflict Resolution Rules
```
1. Inventory conflicts:
   - Local write wins for sales (can't unsell something)
   - Cloud wins for restocks and adjustments

2. Customer data conflicts:
   - Last-write-wins with timestamp
   - Flag if loyalty points differ by >10% for manual review

3. Payment conflicts:
   - Idempotency keys prevent double-processing
   - Transaction ID = {device_id}_{timestamp}_{random_6}

4. Menu conflicts:
   - Cloud menu wins (manager may have updated remotely)
   - Local orders already taken are preserved
```

### Offline Payment Storage
```javascript
// Store card data encrypted for offline processing
const offlinePayment = {
  transactionId: generateIdempotencyKey(),
  encryptedCardData: encrypt(cardData, deviceKey),
  amount: 1500,
  currency: 'KES',
  timestamp: Date.now(),
  deviceId: getDeviceId(),
  status: 'PENDING_SYNC'
}

// On reconnect: decrypt and submit to processor
// Processor must support store-and-forward
```

---

## Database Schema (Core Entities)

```sql
-- Core entities every POS needs
CREATE TABLE businesses (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT, -- 'restaurant' | 'retail' | 'hybrid'
  country TEXT,
  currency TEXT,
  timezone TEXT,
  tax_rate DECIMAL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE locations (
  id UUID PRIMARY KEY,
  business_id UUID REFERENCES businesses,
  name TEXT,
  address TEXT,
  mobile_money_number TEXT, -- M-Pesa till number
  paybill_number TEXT
);

CREATE TABLE products (
  id UUID PRIMARY KEY,
  location_id UUID,
  name TEXT NOT NULL,
  name_local TEXT, -- name in local language
  category_id UUID,
  sku TEXT,
  barcode TEXT,
  price DECIMAL NOT NULL,
  cost DECIMAL,
  unit TEXT, -- 'each' | 'kg' | 'litre'
  stock_quantity DECIMAL,
  stock_alert_threshold DECIMAL,
  image_url TEXT,
  is_variant_parent BOOLEAN DEFAULT FALSE,
  parent_id UUID REFERENCES products, -- for variants
  variant_attributes JSONB -- {size: 'L', color: 'Red'}
);

CREATE TABLE orders (
  id UUID PRIMARY KEY,
  location_id UUID,
  order_number TEXT,
  channel TEXT, -- 'pos' | 'online' | 'qr' | 'delivery' | 'whatsapp'
  status TEXT,
  staff_id UUID,
  customer_id UUID,
  table_number TEXT, -- for restaurants
  subtotal DECIMAL,
  tax_amount DECIMAL,
  discount_amount DECIMAL,
  total DECIMAL,
  synced BOOLEAN DEFAULT FALSE, -- offline sync status
  created_at TIMESTAMPTZ
);

CREATE TABLE order_items (
  id UUID PRIMARY KEY,
  order_id UUID REFERENCES orders,
  product_id UUID,
  product_name TEXT, -- snapshot at time of order
  quantity DECIMAL,
  unit_price DECIMAL,
  modifiers JSONB, -- [{name: 'Extra Cheese', price: 50}]
  notes TEXT,
  kitchen_status TEXT -- 'pending' | 'cooking' | 'ready'
);

CREATE TABLE payments (
  id UUID PRIMARY KEY,
  order_id UUID,
  method TEXT, -- 'mpesa' | 'cash' | 'card' | 'credit'
  amount DECIMAL,
  reference TEXT, -- M-Pesa transaction code, card auth code
  status TEXT, -- 'pending' | 'completed' | 'failed'
  offline_stored BOOLEAN DEFAULT FALSE,
  synced_at TIMESTAMPTZ
);

CREATE TABLE customers (
  id UUID PRIMARY KEY,
  business_id UUID,
  name TEXT,
  phone TEXT, -- universal ID
  email TEXT,
  loyalty_points INTEGER DEFAULT 0,
  credit_balance DECIMAL DEFAULT 0, -- for running tabs
  total_spent DECIMAL DEFAULT 0,
  visit_count INTEGER DEFAULT 0,
  last_visit TIMESTAMPTZ,
  notes TEXT -- staff notes
);

-- Restaurant-specific
CREATE TABLE tables (
  id UUID PRIMARY KEY,
  location_id UUID,
  name TEXT, -- 'Table 1', 'Terrace 5'
  capacity INTEGER,
  status TEXT, -- 'available' | 'occupied' | 'reserved' | 'cleaning'
  current_order_id UUID
);

CREATE TABLE reservations (
  id UUID PRIMARY KEY,
  location_id UUID,
  customer_id UUID,
  party_size INTEGER,
  datetime TIMESTAMPTZ,
  duration_minutes INTEGER,
  status TEXT, -- 'confirmed' | 'seated' | 'cancelled' | 'no-show'
  notes TEXT,
  whatsapp_sent BOOLEAN
);

-- Kitchen
CREATE TABLE kds_stations (
  id UUID PRIMARY KEY,
  location_id UUID,
  name TEXT, -- 'Grill', 'Fryer', 'Cold', 'Bar'
  categories JSONB, -- which menu categories route here
  display_timeout_seconds INTEGER DEFAULT 600
);

-- Inventory
CREATE TABLE purchase_orders (
  id UUID PRIMARY KEY,
  location_id UUID,
  supplier_id UUID,
  status TEXT, -- 'draft' | 'sent' | 'received' | 'partial'
  items JSONB,
  total_amount DECIMAL,
  expected_date DATE,
  created_at TIMESTAMPTZ
);

-- Financial
CREATE TABLE layaway_accounts (
  id UUID PRIMARY KEY,
  customer_id UUID,
  product_id UUID,
  total_price DECIMAL,
  deposit_paid DECIMAL,
  balance_due DECIMAL,
  payment_schedule JSONB,
  status TEXT -- 'active' | 'completed' | 'cancelled'
);
```

---

## AI/ML Features — Technical Implementation

### Natural Language Reporting
```javascript
// How to implement "Ask your POS anything"
async function naturalLanguageQuery(userQuestion, businessId) {
  // Step 1: Get schema context
  const schema = await getBusinessSchemaContext(businessId);
  
  // Step 2: LLM converts question to SQL
  const sqlQuery = await claude.messages.create({
    model: 'claude-sonnet-4-6',
    messages: [{
      role: 'user',
      content: `
        Database schema: ${schema}
        Business context: ${businessContext}
        
        Convert this question to SQL:
        "${userQuestion}"
        
        Return only valid SQL, no explanation.
        Always filter by business_id = '${businessId}'.
      `
    }]
  });
  
  // Step 3: Execute query safely (read-only connection)
  const results = await readonlyDb.query(sqlQuery);
  
  // Step 4: Format results in natural language
  const answer = await claude.messages.create({
    messages: [{
      role: 'user',
      content: `
        Question: "${userQuestion}"
        Data: ${JSON.stringify(results)}
        
        Answer the question in 1-3 sentences in plain language.
        Use the local currency (KES) and format numbers with commas.
      `
    }]
  });
  
  return answer;
}
```

### Demand Forecasting
```python
# Simple but effective forecasting
from prophet import Prophet
import pandas as pd

def forecast_demand(product_id, historical_sales, days_ahead=30):
    df = pd.DataFrame({
        'ds': historical_sales['date'],
        'y': historical_sales['quantity']
    })
    
    model = Prophet(
        yearly_seasonality=True,
        weekly_seasonality=True,
        daily_seasonality=False
    )
    
    # Add African holidays (school terms, public holidays)
    model.add_country_holidays(country_name='KE')
    
    model.fit(df)
    future = model.make_future_dataframe(periods=days_ahead)
    forecast = model.predict(future)
    
    return forecast[['ds', 'yhat', 'yhat_lower', 'yhat_upper']].tail(days_ahead)
```

### Menu Engineering Calculation
```javascript
function calculateMenuEngineering(menuItems, period = '30days') {
  const avgPopularity = menuItems.reduce((sum, item) => 
    sum + item.salesCount, 0) / menuItems.length;
  
  const avgMargin = menuItems.reduce((sum, item) => 
    sum + (item.price - item.cost) / item.price, 0) / menuItems.length;
  
  return menuItems.map(item => {
    const popularity = item.salesCount >= avgPopularity ? 'HIGH' : 'LOW';
    const itemMargin = (item.price - item.cost) / item.price;
    const profitability = itemMargin >= avgMargin ? 'HIGH' : 'LOW';
    
    const category = {
      'HIGH_HIGH': 'STAR',      // Promote these
      'HIGH_LOW': 'PLOWHORSE',  // Reprice or reduce portion
      'LOW_HIGH': 'PUZZLE',     // Needs promotion
      'LOW_LOW': 'DOG'          // Consider removing
    }[`${popularity}_${profitability}`];
    
    return { ...item, menuCategory: category, margin: itemMargin };
  });
}
```

---

## Mobile Money Integration — M-Pesa Deep Dive

### STK Push (Customer Pays via Phone Prompt)
```javascript
const daraja = require('daraja.js'); // Safaricom Daraja SDK

async function initiateMpesaPayment(phoneNumber, amount, orderId) {
  const response = await daraja.lipaNaMpesaOnline({
    BusinessShortCode: process.env.MPESA_SHORTCODE,
    Amount: Math.ceil(amount), // M-Pesa requires integers
    PartyA: normalizePhone(phoneNumber), // 254XXXXXXXXX format
    PartyB: process.env.MPESA_SHORTCODE,
    PhoneNumber: normalizePhone(phoneNumber),
    CallBackURL: `${process.env.API_URL}/webhooks/mpesa/${orderId}`,
    AccountReference: `Order-${orderId}`,
    TransactionDesc: 'Payment for order'
  });
  
  return response.CheckoutRequestID; // Poll this for status
}

// Webhook handler for M-Pesa callback
app.post('/webhooks/mpesa/:orderId', async (req, res) => {
  const { ResultCode, ResultDesc, CallbackMetadata } = req.body.Body.stkCallback;
  
  if (ResultCode === 0) {
    const mpesaCode = CallbackMetadata.Item.find(i => i.Name === 'MpesaReceiptNumber').Value;
    await markOrderPaid(req.params.orderId, mpesaCode);
    await sendWhatsAppReceipt(orderId, mpesaCode);
  }
  
  res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
});
```

### WhatsApp Receipt
```javascript
async function sendWhatsAppReceipt(orderId, paymentRef) {
  const order = await getOrderDetails(orderId);
  
  const receiptText = `
✅ *Payment Confirmed*

📋 *Order #${order.orderNumber}*
📅 ${new Date().toLocaleString('en-KE', { timeZone: 'Africa/Nairobi' })}

${order.items.map(item => 
  `• ${item.name} × ${item.quantity} — KSh ${item.total}`
).join('\n')}

💰 *Total: KSh ${order.total}*
📱 M-Pesa Ref: ${paymentRef}

Thank you for your business! 🙏
*${order.businessName}*
  `;
  
  await whatsappClient.sendMessage({
    to: `254${order.customerPhone}@c.us`,
    body: receiptText
  });
}
```

---

## KDS Architecture

### Real-Time Kitchen Updates
```javascript
// WebSocket-based KDS updates
const { Server } = require('socket.io');

io.on('connection', (socket) => {
  socket.join(`kitchen:${socket.data.locationId}`);
});

// When an order is placed
async function placeOrder(order) {
  await saveOrder(order);
  
  // Route to correct kitchen stations
  const stations = await routeOrderToStations(order);
  
  stations.forEach(station => {
    io.to(`kitchen:${order.locationId}:${station.id}`).emit('new_order', {
      orderId: order.id,
      orderNumber: order.orderNumber,
      items: station.items,
      tableNumber: order.tableNumber,
      channel: order.channel, // color-code by channel
      timestamp: Date.now()
    });
  });
}

// Server bump (item ready)
socket.on('bump_item', async ({ orderId, itemId }) => {
  await markItemReady(orderId, itemId);
  
  // Notify expo station
  io.to(`expo:${locationId}`).emit('item_ready', { orderId, itemId });
  
  // If all items ready, notify server
  const allReady = await checkAllItemsReady(orderId);
  if (allReady) {
    io.to(`server:${order.serverId}`).emit('order_ready', { orderId });
  }
});
```

---

## Competitive Benchmarking Architecture

### How to Build Lightspeed's Killer Feature
```javascript
// Anonymize and aggregate merchant data for benchmarking
async function calculateBenchmarks(businessId, period = '30days') {
  const business = await getBusiness(businessId);
  
  // Find similar businesses (anonymized)
  const peers = await db.query(`
    SELECT 
      AVG(avg_check_size) as peer_avg_check,
      AVG(table_turn_minutes) as peer_avg_turn,
      AVG(labor_pct) as peer_avg_labor,
      AVG(food_cost_pct) as peer_avg_food_cost,
      COUNT(*) as peer_count
    FROM business_analytics
    WHERE 
      country = $1
      AND city = $2
      AND business_type = $3
      AND id != $4
      AND peer_benchmarking_consent = TRUE
  `, [business.country, business.city, business.type, businessId]);
  
  const myMetrics = await getBusinessMetrics(businessId, period);
  
  return {
    myMetrics,
    peerMetrics: peers[0],
    insights: generateInsights(myMetrics, peers[0])
  };
}

function generateInsights(mine, peers) {
  const insights = [];
  
  if (mine.avg_check < peers.peer_avg_check * 0.85) {
    insights.push({
      type: 'OPPORTUNITY',
      title: 'Average check below area average',
      description: `Your average check (KSh ${mine.avg_check}) is ${Math.round((1 - mine.avg_check/peers.peer_avg_check) * 100)}% below similar restaurants in your area (KSh ${peers.peer_avg_check}).`,
      action: 'Review your menu pricing and upsell strategy'
    });
  }
  
  return insights;
}
```

---

## QR Code Ordering Architecture

```javascript
// Generate table QR code
function generateTableQR(tableId, locationId) {
  const url = `https://order.yourpos.com/${locationId}/table/${tableId}`;
  return QRCode.toDataURL(url);
}

// QR ordering page — React SPA
// Route: /[locationId]/table/[tableId]
function QROrderingPage() {
  const { locationId, tableId } = useParams();
  const [cart, setCart] = useState([]);
  const [menu, setMenu] = useState(null);
  
  // Fetch menu (cached on CDN, updates when manager changes menu)
  useEffect(() => {
    fetch(`/api/menu/${locationId}`)
      .then(r => r.json())
      .then(setMenu);
  }, [locationId]);
  
  const placeOrder = async () => {
    const order = await fetch('/api/orders', {
      method: 'POST',
      body: JSON.stringify({
        locationId,
        tableId,
        items: cart,
        channel: 'qr'
      })
    });
    
    // Real-time order status via SSE
    const eventSource = new EventSource(`/api/orders/${order.id}/status`);
    eventSource.onmessage = (e) => {
      setOrderStatus(JSON.parse(e.data));
    };
  };
}
```

---

## Hardware Recommendations

### Minimum Viable Hardware (Africa-Optimized)

| Component | Recommendation | Why |
|-----------|---------------|-----|
| Main Terminal | Samsung Galaxy Tab A8 (10.5") | Widely available, good support, affordable |
| Receipt Printer | Xprinter XP-80C (Bluetooth) | Most supported BT thermal printer in Africa |
| Cash Drawer | Generic RJ11 connected | Standard, inexpensive |
| Card Reader | Sunmi P2 mini | Android-based, dual-screen, wide Africa support |
| Kitchen Display | Samsung Galaxy Tab A7 + wall mount | Affordable, bright screen |
| Handheld | Sunmi M2 or Urovo DT50 | Purpose-built, with built-in scanner |

**Total Starter Kit Cost**: ~$250-350 (vs. Toast's $800-2,000+)

### Sunmi (Chinese POS hardware optimized for emerging markets)
Sunmi is the Toast equivalent hardware company for developing markets:
- **Sunmi T2s**: 15.6" all-in-one with customer display
- **Sunmi P2**: Dual-screen handheld payment terminal
- **Sunmi V2s**: Handheld with thermal printer + scanner built in
- **Sunmi D3**: 14" portable all-in-one
Available across Africa at 60-70% lower cost than Western equivalents

---

## Security Requirements

### PCI DSS Compliance
- Never store full card numbers (PAN) on device
- Use tokenization for all card data
- Encrypt all data at rest (AES-256)
- TLS 1.3 for all API communication

### Mobile Money Security
- Store M-Pesa API keys in secure vault (AWS Secrets Manager or HashiCorp Vault)
- Webhook signature verification for all M-Pesa callbacks
- Idempotency keys prevent double-processing
- Amount validation: never trust client-side amount

### Multi-Tenant Data Isolation
- Every query filtered by `business_id`
- Row-level security in PostgreSQL
- JWT payload includes `business_id` — validated on every request
- Staff cannot access other businesses' data

### Audit Trail
```sql
-- Every destructive action logged
CREATE TABLE audit_log (
  id UUID PRIMARY KEY,
  business_id UUID,
  user_id UUID,
  action TEXT, -- 'delete_order', 'refund', 'price_change', 'comp_item'
  entity_type TEXT,
  entity_id UUID,
  old_value JSONB,
  new_value JSONB,
  reason TEXT,
  ip_address INET,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```
