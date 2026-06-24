# What to Steal — The Ultimate Feature Blueprint

> This is the master document. Everything here is a synthesis of the best features across every global POS leader, validated by live market data from 2025-2026. Build this and you build the best POS system ever made.

---

## SECTION 1: RESTAURANT POS — FEATURES TO STEAL

### From Toast

#### 1.1 Toast IQ — Conversational AI That Executes
**What it is**: Natural-language AI assistant that doesn't just answer — it acts. "Remove the salmon from the dinner menu tonight" → done instantly across all channels.
**Steal it**: Build a conversational AI layer from day one. Use Claude API or GPT-4 to understand intent, then route to action APIs. The actions matter more than the conversation.
**Enhancement**: Add voice input. Restaurant owners should be able to use this from their phone while driving.

#### 1.2 Menu Engineering Report (BCG Matrix for Menu)
**What it is**: Every menu item plotted on profitability (high/low) × popularity (high/low). Stars, plowhorses, puzzles, dogs.
**Steal it**: Calculate this automatically from POS data. Display it visually as a 2×2 grid with item bubbles sized by revenue. Auto-highlight action recommendations per quadrant.
**Enhancement**: Add cost-of-goods overlay. If you track ingredient costs, the profitability axis becomes true gross margin not just selling price.

#### 1.3 Table Turn Time Prediction
**What it is**: AI predicts how long a table will take based on party size, order pattern, and historical data.
**Steal it**: Feed table data + historical turn times to an ML model. Show predicted end time on floor plan. Alert manager if table runs over predicted time.

#### 1.4 Toast Capital (Embedded Lending)
**What it is**: Merchant cash advances based on POS transaction history. Approved in minutes, repaid as % of daily sales.
**Steal it**: Partner with a local bank or MFI (microfinance institution) in each market. Use POS transaction data as the underwriting model. This builds deep loyalty — the merchant will never leave a system that also funds their business.
**Enhancement for Africa**: Mobile money repayment instead of daily card sales deduction. Integrate M-Pesa/Airtel Money repayment schedule.

#### 1.5 Split Check by Seat via Text Link
**What it is**: Each person at the table gets a text link to pay their share. They pay on their phone, you get paid instantly.
**Steal it**: Generate a unique payment URL per seat at bill-time. Customer opens link, sees their items, pays with mobile money or card. Works with any phone.
**Enhancement for Africa**: WhatsApp payment link instead of SMS (higher penetration). M-Pesa STK push integration.

#### 1.6 Pre-Auth Bar Tabs
**What it is**: Open a bar tab with card authorization without immediately charging. Close at end of night.
**Steal it**: Pre-authorize for a set amount (e.g., $50), accumulate charges, charge final amount at close. Mobile money equivalent: collect a hold deposit, settle at end.

---

### From Square

#### 1.7 Zero-Friction Onboarding (The Game-Changer)
**What it is**: Business can start accepting payments in under 5 minutes. No contracts, no credit checks, no setup fees.
**Steal it**: Make self-signup the default. Email → phone verification → business details → start selling. Hardware optional. Use existing smartphone + mobile money APIs.
**Enhancement for Africa**: Local business registration (CAC, NHIF etc.) lookup API to auto-fill business details from official databases.

#### 1.8 AI Voice Ordering for Phone Orders
**What it is**: AI answers 100% of incoming phone calls, takes orders in natural language, pushes to kitchen.
**Steal it**: Integrate with a voice AI platform (ElevenLabs + GPT-4o, or local language models). Route incoming calls to AI, transcribe to order, inject to POS, send confirmation via WhatsApp.
**Enhancement for Africa**: Train on Swahili, Yoruba, Amharic, Sheng, Pidgin English — local language voice models.

#### 1.9 Slow-Moving Inventory AI Alerts
**What it is**: AI identifies items sitting too long in stock, suggests markdown or promotion.
**Steal it**: Calculate days-in-inventory per SKU. Alert when any SKU exceeds threshold. Suggest: "Price X dropped 15%" or "Feature in today's special."

#### 1.10 External Signal Integration in Analytics
**What it is**: AI blends weather, local events, and news with internal POS data to contextualize performance.
**Steal it**: Pull weather API data, local events calendar API, school holidays, payday dates for the market. Overlay with sales data. Alert: "Sales down 20% today — likely due to the football match drawing customers to the stadium area."

#### 1.11 Embedded Banking (The Stickiness Layer)
**What it is**: Square's own checking account, savings account, debit card — funded by POS sales.
**Steal it**: Partner with a licensed payment institution or bank. Offer a business wallet where sales flow directly. Offer sub-accounts for tax savings, supplier payments.
**Enhancement for Africa**: Mobile money wallet as the primary business account. M-Pesa business till → sweep to savings account automatically.

---

### From Lightspeed

#### 1.12 Competitive Benchmarking (The Killer Feature)
**What it is**: Daily updated comparison of your restaurant's key metrics against similar restaurants in your area, using anonymized network data.
**Steal it**: As your network grows, aggregate anonymized data by: restaurant type, location, size, and price tier. Show merchants: "Your average check: $12. Similar restaurants in your area: $15. Here's what to do."
**Enhancement**: Make benchmarks feel positive, not judgemental. Frame as "Your top quartile peers are doing X" not "You're below average."

#### 1.13 Hotel F&B Integration (Room Charge)
**What it is**: Hotel guest can charge restaurant bill to their room. Charge appears on checkout folio.
**Steal it**: Integrate with hotel PMS (Opera, Protel, Mews). Expose API endpoint: `POST /charge-to-room` with room number + amount. Hotel PMS reflects the charge instantly.

#### 1.14 B2B Wholesale Ordering (NuOrder concept)
**What it is**: Retailers order directly from suppliers/brands inside the POS. No phone calls, no emails, no external platform.
**Steal it**: Build a supplier catalog inside the POS. Each product has a "reorder" button. When stock hits threshold, auto-create a PO. Supplier gets email/WhatsApp with PO. Supplier confirms → stock expected date appears in POS.

---

### From HungerRush

#### 1.15 AI Phone Ordering with Caller ID Memory
**What it is**: When a customer calls, system recognizes their number, loads their profile, and shows their last order. AI can take the same order again with one voice confirmation.
**Steal it**: Store customer phone numbers against order history. On incoming call: lookup number → load profile → AI greets by name → asks "Same as last time?" → one confirmation → order placed.

#### 1.16 Visual Pizza/Complex Item Builder
**What it is**: Drag-and-drop visual item configurator — draw toppings on the pizza, see the split half-and-half visually.
**Steal it**: Build a configurable visual builder component. Works for any customizable item (pizza toppings, build-your-own bowls, customizable burgers).

#### 1.17 Driver Dispatch Console with GPS
**What it is**: Assign deliveries to drivers, see all drivers on a map in real time, track delivery times per order.
**Steal it**: Build a dispatcher view showing order status + driver status on a map. Integrate with Google Maps for routing. Driver uses mobile app — GPS position reported every 30 seconds.

---

### From SpotOn

#### 1.18 AI P&L Analysis (Profit Assist)
**What it is**: AI ingests full P&L (not just POS sales) and delivers specific cost anomaly alerts and savings recommendations before service.
**Steal it**: Connect to accounting data (via Xero/QuickBooks API or manual entry of expense categories). Run daily: compare this period vs. last period. Flag deviations. "Food cost up 4% — check for supplier price changes or waste."
**Enhancement**: Build OCR invoice scanning. Restaurant takes photo of supplier invoice → AI extracts items + prices → auto-compares to last invoice → alerts if price changed.

#### 1.19 Phone Number as Loyalty ID (No App, No Card)
**What it is**: Customer gives their phone number at checkout. Points accrue. No app download, no loyalty card needed.
**Steal it**: Store loyalty against phone number. At checkout: "Phone number for loyalty?" → enter → points applied. Auto-send WhatsApp with balance update after each transaction.

---

### From Lavu's Marty AI

#### 1.20 Multi-Agent AI Morning Briefing
**What it is**: 6 AI agents, each specialized, deliver one morning brief card by 5 AM covering: promotions, pricing, scheduling, waste, staff coaching, and P&L digest.
**Steal it**: Build a "Daily Briefing" feature. Runs nightly, analyzes all yesterday's data, generates 3-5 action points. Delivered via WhatsApp or email by 6 AM. Example output:
- "Your kitchen was 8 minutes slower than average yesterday — check if staffing was sufficient at lunch"
- "Item: Grilled Fish hasn't sold in 3 days. Consider a promotion or 86 it"
- "Server Ali had the highest table turn time yesterday (+15 min vs. average) — consider a coaching conversation"

---

### From Presto

#### 1.21 AI Drive-Thru Voice Ordering
**What it is**: AI answers every drive-thru speaker, takes the order, upsells, confirms — 90%+ accuracy, 4× more upsell attempts than humans.
**Steal it**: Partner with an AI voice company or build on AWS Nova Sonic. For African markets: start with phone ordering AI (larger use case) then extend to drive-thru once hardware is in place.

---

### From TouchBistro

#### 1.22 Hybrid Local + Cloud Architecture
**What it is**: Local server processes all transactions. Cloud syncs in background. Works for weeks without internet.
**Steal it**: Use a local SQLite database on the POS device. Every transaction writes locally first. Background sync to cloud. Conflict resolution on reconnect. Never block a transaction due to connectivity.

#### 1.23 Time-Based Automatic Menu Switching
**What it is**: Breakfast menu auto-switches to lunch at 11:00 AM, lunch to dinner at 4:00 PM. No staff action required.
**Steal it**: Let merchants define day-parts with start times and which menu is active. POS switches automatically. Alert manager 5 minutes before switch: "Lunch menu activates in 5 minutes."

#### 1.24 Two-Way SMS Waitlist
**What it is**: Customer added to waitlist → gets SMS. Customer texts "here" when they arrive → host is notified.
**Steal it**: Build WhatsApp-based waitlist (Africa-relevant). Send WhatsApp message when table is ready: "Your table at Mama's Kitchen is ready! Reply 'HERE' when you arrive." Staff see notification when customer replies.

---

### From Adora/HungerRush/Revel

#### 1.25 AI Text Ordering (SMS)
**What it is**: Customer texts their order to a number. AI parses the text, confirms the order, charges them, sends to kitchen.
**Steal it**: Integrate with WhatsApp Business API. Customer sends order via WhatsApp → NLP parses intent → confirms with formatted order summary → payment link sent → order to kitchen.
**Enhancement for Africa**: This is HUGE for Africa. WhatsApp ordering is already happening informally everywhere. Build the formal infrastructure for it.

---

### From Qu POS

#### 1.26 API-First Architecture (Replace Any Component)
**What it is**: Every function is an API. Replace your loyalty system, your online ordering, your analytics — without touching the core POS.
**Steal it**: Build microservices from the start. Every feature exposes an API. Document it. Let third parties build on it. Earn revenue from the platform, not just the product.

---

## SECTION 2: RETAIL POS — FEATURES TO STEAL

### From Shopify

#### 2.1 Unified Online + Offline — One Inventory Truth
**What it is**: Sell online and in-store from the same stock. Online sale decrements store inventory in milliseconds.
**Steal it**: Build a unified inventory service. Every sale (regardless of channel) writes to the same inventory record. No sync, no lag, no reconciliation.

#### 2.2 Shopify Flow — No-Code Automation
**What it is**: Merchants build automation rules: IF [trigger] THEN [action]. No code.
**Steal it**: Build a "Rules Engine" in the POS:
- "When stock drops below 5, send me a WhatsApp"
- "When a customer spends over KSh 5,000, tag them as VIP"
- "Every Monday at 8 AM, send me a week's sales summary"
- "When any item hasn't sold in 30 days, alert me"

#### 2.3 Sidekick AI (Inventory Recommendations)
**What it is**: AI suggests reorder quantities, flags slow movers, recommends stock transfers between locations.
**Steal it**: Run a daily inventory intelligence job: predict sell-through rate per SKU, calculate days-of-stock remaining, auto-generate reorder suggestions. Present as a "Reorder Queue" the merchant can approve with one tap.

#### 2.4 BOPIS/BORIS/Ship-from-Store (Omnichannel Fulfillment)
**What it is**: Buy online, pick up in store. Buy online, return in store. Ship from nearest store to online customer.
**Steal it**: Build these fulfillment modes. Especially "ship from store" — for retailers with multiple branches, the nearest branch fulfills the online order rather than a central warehouse.

#### 2.5 Unified Customer Profile Across All Channels
**What it is**: Customer who bought online last week is recognized in-store. Staff see full history.
**Steal it**: Every customer record is a global record — not store-specific. Phone number or email as universal lookup. In-store staff can see: "This customer last ordered online 3 days ago, spent KSh 2,500, last item was X."

#### 2.6 Shop Pay / One-Tap Repeat Purchase
**What it is**: Returning customer's card details stored. One tap to pay. No re-entry.
**Steal it**: Save payment method for returning customers (with consent). Pre-populate at checkout. For mobile money markets: save M-Pesa number → send STK push automatically.

---

### From Lightspeed Retail

#### 2.7 Matrix Inventory (Variant Management)
**What it is**: One product record with size × color × style variants. Each variant has its own stock count, price, barcode.
**Steal it**: Build a variant system. Parent product "T-Shirt Nike" → children: Small/Red, Small/Blue, Medium/Red, etc. Single screen to manage all variants. Bulk price updates across variants.

#### 2.8 Pre-loaded Supplier Catalog (8M+ SKUs)
**What it is**: Merchants can search a supplier catalog and add products without manual data entry.
**Steal it**: Partner with local distributors and brands to import their product catalogs. Merchant searches "Indomie" → finds the product → clicks "Add to inventory" → product data (name, description, image, barcode) auto-filled.

#### 2.9 Advanced Purchase Orders
**What it is**: Create POs, send to suppliers, receive shipments, reconcile discrepancies.
**Steal it**: Full purchase order workflow:
1. Create PO (auto-generate from low stock alerts or manually)
2. Email/WhatsApp PO to supplier
3. Supplier confirms (email/WhatsApp back, or portal)
4. Goods received → PO closes → inventory updated
5. Discrepancy report if received quantity ≠ ordered

#### 2.10 Price Books (Multiple Price Tiers)
**What it is**: Different price lists for different customer types (retail, wholesale, VIP, employee), different times (happy hour), different locations.
**Steal it**: Build a Price Book engine:
- Retail price (default)
- Wholesale price (for B2B customers)
- Employee/staff price
- Loyalty member price
- Happy hour price (time-based, auto-activates)
- Guest prices can see their price tier on their receipt

---

### From Clover

#### 2.11 App Marketplace Model
**What it is**: Third-party developers build apps that merchants can install on their POS. Clover earns revenue share.
**Steal it**: Build an API-first POS → open developer program → attract local African software companies to build vertical-specific apps (veterinary practice management, beauty salon scheduling, auto parts lookup, etc.).

#### 2.12 All-in-One Handheld with Printer (Clover Flex concept)
**What it is**: Single device with screen + card reader + barcode scanner + receipt printer. Truly portable.
**Steal it**: Source or design a Flex-equivalent device. In informal markets, having a portable all-in-one is critical — no power outlet dependency, no cord tangle.
**Enhancement for Africa**: Solar charging case. Battery pack for areas with frequent power cuts.

---

### From NCR Counterpoint

#### 2.13 Layaway Management
**What it is**: Customer puts down deposit on item, item is held, payments collected over time, item released when paid in full.
**Steal it**: Build a layaway/lay-by module. Especially critical in African markets where credit card penetration is low but installment buying is culturally embedded.
- Create layaway record → set deposit amount → generate payment schedule
- Customer pays installments → WhatsApp receipt each time
- Item released on final payment → inventory decremented
- Reminders sent via WhatsApp as payment dates approach

#### 2.14 Serial Number Tracking
**What it is**: Track individual items by serial number. Know which specific unit was sold to which customer.
**Steal it**: For electronics, appliances, vehicles, equipment — track serial numbers. Critical for warranty management and theft recovery.

#### 2.15 Rentals Management
**What it is**: Track items rented out — due dates, customer details, damage assessment, deposits.
**Steal it**: Build a rentals module (equipment, events, vehicles, tools). Daily/weekly/monthly pricing. Security deposit management. Overdue alerts via WhatsApp.

#### 2.16 Work Order / Repairs Tracking
**What it is**: Customer drops off item for repair. Track status, parts used, labor time, notify when ready.
**Steal it**: Build a job card system for repair businesses (phone repair, electronics, tailoring, car garages):
- Create job card → assign to technician → track parts → customer notified via WhatsApp when ready → payment at collection

---

### From KORONA POS

#### 2.17 Ticketing + Retail in One Platform
**What it is**: Sell event tickets AND retail merchandise in same transaction. No separate system.
**Steal it**: Build an events/ticketing module. Concert promoters, museums, amusement parks, sports events — all can sell tickets through the POS. QR code ticket generation. Capacity management.

#### 2.18 Processor Agnostic (No Lock-In)
**What it is**: Merchant brings their own payment processor. KORONA doesn't force their own payments.
**Steal it**: Build integrations with multiple payment processors. In Africa: M-Pesa, Airtel Money, MTN MoMo, Flutterwave, Paystack, DPO. Let merchants choose and switch.

---

### From Erply

#### 2.19 Franchise Management Architecture
**What it is**: HQ controls everything. Franchisees see only their data. Royalty auto-calculated. Compliance enforced.
**Steal it**: Build a multi-tenant "Brand + Branch" hierarchy:
- Brand owner: sees all branches, sets prices/menus/products, sees consolidated reports
- Branch operator: sees only their branch
- Royalty engine: calculate % of sales to remit to brand owner
- Compliance scoring: flag branches not following brand standards

#### 2.20 Unlimited Offline Mode
**What it is**: Works forever without internet. No time limit on offline operation.
**Steal it**: This is non-negotiable for Africa. Local SQLite database, local auth, local payment processing (store-and-forward for card, mobile money offline QR). Test explicitly for 72-hour offline scenarios.

---

### From Rain POS

#### 2.21 Rent-to-Own Module
**What it is**: Customer rents item, portion of each payment applies to purchase price, they eventually own it.
**Steal it**: Very relevant for African markets (household goods, electronics, appliances). Build full rent-to-own workflow with automatic payment tracking, ownership transfer, and insurance tracking.

---

### From ConnectPOS

#### 2.22 Customer Phone as Self-Checkout (PWA)
**What it is**: Customer scans items with their own phone, pays on their phone, walks out. No queue.
**Steal it**: Build a QR-based self-scanning flow. Customer scans item barcodes → basket builds on their phone → they pay → exit code generated → staff verify exit code. Especially useful for large stores.

#### 2.23 Live Promotion Impact Analysis
**What it is**: AI shows you how a promotion is performing while it's still running — so you can adjust mid-campaign, not after.
**Steal it**: Promotion analytics should update in real time. If a "20% off shoes" campaign is running, the dashboard should show: items sold under promo, revenue, margin impact, vs. baseline — updating every 15 minutes.

---

### From Cin7

#### 2.24 AI Demand Forecasting (24-Month Horizon)
**What it is**: ML model using 100+ algorithms predicts demand 24 months ahead, auto-generates purchase orders.
**Steal it**: Start with simpler 4-week forecasting, grow to 12-month. Use linear regression + seasonality detection + trend analysis. Auto-generate suggested POs that merchants approve with one tap.

---

### From Epos Now

#### 2.25 Sidekick AI Pricing (External Market Data)
**What it is**: AI analyzes your margins AND external competitor prices to recommend optimal pricing.
**Steal it**: Use web scraping or market data APIs to gather local competitor pricing. Alert merchants: "Your Panadol price (KSh 50) is 15% above average for pharmacies in your area." Let merchant decide whether to adjust.

---

## SECTION 3: CROSS-CUTTING FEATURES TO STEAL

### From the AI Theme

#### 3.1 Natural Language Reporting ("Just Ask")
**Steal this first** — build it into the reporting layer from day one.
- "How did we do last week vs. the week before?"
- "Which items haven't sold in 30 days?"
- "What was my busiest hour yesterday?"
- "How much did I spend on M-Pesa fees this month?"
Use LLM function calling: parse the question → map to a SQL query → return formatted answer.

#### 3.2 AI Waste Prediction
Before service starts, show: "Based on today's reservations and current inventory, you have excess stock of: [item X] - consider featuring it as today's special."

#### 3.3 Staff Performance AI
Calculate per-employee metrics: sales per hour, average transaction value, tip percentage, table turn time. Weekly summary delivered to manager: "Top performer this week: Grace. Area for development: David's table turn time was 15% above average."

---

### From the KDS Theme

#### 3.4 AI-Adjusted Cook Times
**Steal it**: Learn actual cook times vs. assumed cook times per item. Adjust firing sequences. "The burger takes 9 minutes, not 6 as assumed — fire it earlier."

#### 3.5 Cross-Station Coordination Alerts
**Steal it**: "Steak is 2 minutes from done — fire the fries now." Alert the fry station when the grill is approaching completion.

#### 3.6 Order Consolidation
**Steal it**: If 3 different tickets all have "Fries" → show the kitchen "12 fries needed now" rather than three separate "4 fries" lines.

---

### From the Kiosk Theme

#### 3.7 Self-Ordering Kiosk with AI Upsell
**Steal it**: AI upsell at every step:
- After adding burger → "89% of customers who ordered this added fries"
- Before payment → "Add a drink for just [price]?"
- Use A/B testing to discover which upsell messages convert best

#### 3.8 Gamified Loyalty at Kiosk
**Steal it**: After payment, show a mini-game or progress bar:
- "You're 2 visits from a free item!"
- Scratch-card animation revealing their earned points
- Tiered progress: "Bronze → Silver: 3 more visits!"

---

### From the QR Ordering Theme

#### 3.9 Full-Cycle QR Ordering + Payment
**Steal it**: QR code on every table. Customer scans → sees menu → orders → pays → gets WhatsApp receipt. Server brings food. No queue, no card machine journey.

#### 3.10 QR Order Status (Kitchen Tracker)
**Steal it**: Customer sees real-time order status on their phone after ordering:
- ✅ Order received
- 🍳 Being prepared
- 🛎️ On its way to your table

#### 3.11 Group QR Ordering (Each Person Orders Own Items)
**Steal it**: One table, multiple phones. Each person scans same table QR. Orders are linked to one table. Server delivers one by one or together. Each person pays their own items via their phone.

---

### From the Loyalty Theme

#### 3.12 Hyper-Personalized Rewards
**Steal it**: AI determines what reward type drives this specific customer back:
- Customer A: always responds to free item rewards
- Customer B: responds to discounts
- Customer C: responds to VIP/recognition

Personalize the reward, not just the points balance.

#### 3.13 Churn Prediction + Win-Back Automation
**Steal it**: Track visit frequency per customer. If frequency drops below baseline → trigger automatic win-back:
- "We miss you! Come back this week for 20% off your next order"
- Sent via WhatsApp, targeted to their known preferences
- Track whether win-back worked

#### 3.14 Card-Linked Loyalty (No Scan Needed)
**Steal it**: Register a customer's payment card or mobile money number against their loyalty profile. Points accrue automatically on every transaction — no staff prompt, no card scan, no app needed.

---

### From the Analytics Theme

#### 3.15 Real-Time Shift P&L
**Steal it**: Manager opens dashboard mid-service and sees:
- Revenue so far this shift: KSh 45,000
- Labor cost so far (staff clocked in): KSh 8,000
- Food cost (from orders): KSh 15,000
- Estimated gross profit this shift: KSh 22,000
- Comparison to same shift last week: +12%

#### 3.16 Heatmap Dashboard
**Steal it**: Hourly sales heatmap (like a calendar but by hour × day). Instantly shows busiest and quietest periods. Use to schedule staff and promotions.

---

### From the Ghost Kitchen Theme

#### 3.17 Multi-Brand/Virtual Brand Management
**Steal it**: One kitchen, multiple brands (e.g., "Mama's Jollof" + "Lagos Burgers" + "Abuja Wings" — all from same kitchen). Each brand:
- Has its own menu visible on delivery apps
- Has its own KDS lane color
- Has its own reporting
- Orders consolidated into one queue for the kitchen

#### 3.18 Delivery Aggregator Integration
**Steal it**: One tablet/screen shows orders from all delivery platforms (Bolt Food, Jumia Food, Glovo, UberEats, etc.). Orders auto-injected into kitchen queue. No manual re-entry.

---

### From the Drive-Thru Theme

#### 3.19 AI Drive-Thru Voice (Africas Use Case: Matatu Lunch Spots)
**Steal it**: High-traffic food stalls or drive-through-style restaurants. AI voice takes orders at the window. In Africa: this could be adapted to ordering via WhatsApp voice note (customer sends a voice note → AI transcribes → confirms order).

---

## SECTION 4: AFRICA-SPECIFIC FEATURES (ORIGINAL — NOBODY HAS THESE)

### 4.1 Mobile Money Native Integration
No global POS treats M-Pesa as a first-class payment method. Build it natively:
- M-Pesa STK push (customer receives popup on phone)
- Paybill and Till Number QR codes on receipts
- Airtel Money, MTN MoMo, Orange Money, Equitel
- Auto-reconcile mobile money vs. cash vs. card by shift
- Mobile money fee tracking (deducted from revenue automatically)

### 4.2 Offline Mobile Money Payments
In areas with poor connectivity:
- Generate a static QR code that works without internet
- Merchant's device stores the transaction locally
- Confirm receipt once connectivity returns
- Works with M-Pesa's offline QR standard

### 4.3 Multi-Currency and Forex-Aware Pricing
For East and West African cross-border merchants:
- Price items in local currency
- Allow payment in USD/EUR (common in tourism/export)
- Real-time exchange rate from Central Bank API
- Alert when exchange rate moves >2% since last price update
- Tax-compliant receipts in both currencies

### 4.4 USSD POS (Feature Phone Support)
For markets where not everyone has smartphones:
- Merchant can access basic POS functions via USSD (*123#)
- Customer can pay by dialing USSD to authorize
- Supports dumb phones, no internet required
- Critical for rural markets

### 4.5 WhatsApp Business Integration (First-Class)
- Send receipts via WhatsApp (not SMS — cheaper, richer)
- WhatsApp ordering flow (catalog → order → payment link)
- Loyalty balance notifications via WhatsApp
- Restock alerts to suppliers via WhatsApp
- Customer support chat on WhatsApp

### 4.6 Load Shedding / Power Cut Mode
- UPS battery integration tracking
- Alert when on battery: "Power out — X minutes of battery remaining"
- Auto-enter low-power mode: dim screen, disable non-essential features
- Compact receipt printing (reduce paper/power use)
- Mobile hotspot failover: auto-switch to 4G when power router dies

### 4.7 Informal Sector Features (Jua Kali / Street Trading)
- No-barcode inventory (photo + name + price only)
- Quick price lookup by item photo
- Bulk/loose item selling (e.g., "maize flour per kilo")
- "Cash only" mode with drawer management
- Daily summary in local language

### 4.8 Tax Compliance (KRA, FIRS, SARS, GRA etc.)
- Auto-calculate VAT/GST per jurisdiction
- Generate ETR (Electronic Tax Register) compliant receipts
- Submit daily Z-reports to tax authority API (where required)
- Tax exemption handling (NGOs, medical items, etc.)
- EFRIS integration (Uganda), ESD integration (Kenya), TIMS compliance

### 4.9 Local Language Support
- Swahili, Yoruba, Hausa, Amharic, Zulu, Shona — UI in local languages
- Staff can use the POS in their mother tongue
- Receipts printed in customer's preferred language
- AI assistant understands voice commands in local languages

### 4.10 Supplier Credit (Mkopo/Kauli)
Common in informal African retail — supplier extends credit, merchant pays later:
- Track what you owe each supplier
- Record supplier credit taken
- Payment schedule with WhatsApp reminders
- "Wipe out" when paid
- Report: total supplier credit outstanding

### 4.11 Customer Credit ("Oweame" / Running Tab)
In many African markets, trusted regular customers buy on credit:
- Open a credit account per customer
- Add purchases to their running tab
- Track outstanding balance
- Alert when customer hits credit limit
- Payment collection tracking
- WhatsApp statement sending

### 4.12 Group Savings (ROSCA/Chama) Integration
Many African business owners are part of savings groups (Chamas, SACCOs, Susus):
- Integrate with Chama management platforms
- Route a portion of daily profits to SACCO savings automatically
- Track business savings goals

### 4.13 Low-Bandwidth Mode
For 2G/edge connectivity areas:
- Compress all API calls
- Text-only mode (no images)
- Batch sync instead of real-time
- Work fully offline with queue sync
- SMS-based backup for critical alerts

---

## THE TOP 10 FEATURES TO BUILD FIRST

Based on impact × uniqueness × African market fit:

| Priority | Feature | Why First |
|---------|---------|-----------|
| 1 | **Mobile Money Native** (M-Pesa/MTN MoMo) | Without this, you can't sell in Africa |
| 2 | **True Offline Mode** (72-hour capable) | Without this, you can't operate in Africa |
| 3 | **WhatsApp Integration** (receipts, orders, alerts) | WhatsApp is Africa's operating system |
| 4 | **AI Natural Language Reports** | Differentiator that nobody else delivers locally |
| 5 | **Customer Credit (Running Tab)** | Critical for informal market fit |
| 6 | **Menu Engineering AI** (BCG matrix) | High-value insight that wins restaurants |
| 7 | **Competitive Benchmarking** | Unique intelligence feature — build as network grows |
| 8 | **Multi-Brand Ghost Kitchen** | Huge growth segment |
| 9 | **Layaway/Installment Module** | Retail feature that fits African purchase behavior |
| 10 | **Tax Compliance (ETR/TIMS/EFRIS)** | Legal requirement, builds trust |
