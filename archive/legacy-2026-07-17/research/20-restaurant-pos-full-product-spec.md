# The Restaurant POS: Full Product Specification
## Everything We Build, Why We Build It, and How We Win

> This is the product document. It answers three questions for every feature:
> **Where did this come from?** (which global leader built it and why it matters)
> **What does Kenya require?** (the Africa layer on top)
> **What makes ours better?** (the differentiator)
>
> Read this before writing a single line of code.

---

## THE PRODUCT THESIS

Every global POS leader was built on the same insight: **the existing solution was built for a different market, and operators were suffering because of it**.

Toast was built because Oracle MICROS was enterprise software pretending to be a restaurant tool. Square was built because credit card processing was a cartel protecting itself. Lightspeed was built because retailers needed multi-location management and nobody gave it to them.

Our insight: **every POS system in the world was built for markets with reliable power, reliable internet, bank accounts, and no M-Pesa**. The 150,000+ food service businesses in Kenya are running on a sticker on the wall, an exercise book, and a prayer that Kenya Power doesn't cut at 7PM.

We are building the system that actually works in their reality — and then we are adding everything the global leaders spent hundreds of millions of dollars figuring out. That combination is what no one else can build.

**The product in one sentence:** A restaurant POS that works offline during load shedding, accepts M-Pesa natively, sends every important thing via WhatsApp, and gives the owner the same AI intelligence that costs $10,000/month at a US restaurant group — for KES 2,500/month.

---

## WHAT WE STEAL FROM EACH GLOBAL LEADER (AND WHY)

Before the feature list, understand what each leader proved — and exactly what we take from them.

### From Toast ($14B, 120,000+ restaurants)

Toast's core insight: **a restaurant is not a retail store**. They built features for the specific workflow of a full-service restaurant — and got deeply embedded before anyone else.

**What we take:**
- Restaurant-only focus (not a horizontal tool trying to serve restaurants, salons, and pet stores)
- Android-first hardware (not iPad — Android is cheaper, more durable, more replaceable, and 90%+ of African hospitality devices run it)
- Kitchen Display System as a core feature, not an add-on
- Offline-first architecture where everything writes locally and syncs in background
- Toast Now live mobile dashboard concept (owner sees revenue from anywhere)
- Toast Go handheld (we call it Server Mode — tableside ordering on a phone)
- Menu Engineering Report (BCG matrix for menu items — Stars, Plowhorses, Puzzles, Dogs)
- Role-based staff access with PIN login (no typing full passwords on a touch screen during service)
- Void/refund distinction with mandatory reason and manager approval
- Split check by seat, by item, by custom amounts

**What we do on top:**
- Replace card terminal with M-Pesa STK Push from the handheld
- Make the live dashboard arrive via WhatsApp — owners already have WhatsApp open, not our app
- Add server assignment awareness to table turn time alerts

---

### From Square ($50B+, millions of merchants)

Square's core insight: **small business owners don't want to think about payment processing**. They built simplicity and a free entry point, then layered financial services on top.

**What we take:**
- Free/low-cost entry tier to remove the barrier to first transaction
- Simple flat-rate subscription pricing (no per-transaction POS fees)
- Month-to-month — no long-term contracts that scare small operators
- Hardware agnostic — works on any Android device the merchant already owns
- Financial services layer — Square Banking, Square Capital (merchant advances using POS data as credit score) — this is where real margin lives
- No proprietary hardware lock-in
- Instant onboarding — merchant can process first sale within 10 minutes

**What we do on top:**
- The financial services layer is even more powerful in Kenya where banks won't lend to restaurants. M-Pesa data + POS data = the best credit score available for a Nairobi restaurant owner.
- The entry tier includes eTIMS compliance (in Kenya this is table stakes, not a premium feature)

---

### From Lightspeed ($300M+ ARR)

Lightspeed's core insight: **data across a network of merchants is more valuable than data for a single merchant**. Their Benchmarks & Trends feature is their moat.

**What we take:**
- Competitive benchmarking: aggregate anonymized data across all merchants → show each merchant how they compare to similar businesses in their area
- Menu engineering matrix (we steal this more aggressively than Lightspeed's implementation)
- Multi-location inventory management with transfer between branches
- Recipe-level food cost tracking (ingredient quantities linked to menu items)
- Product variant matrix (size × color × style with individual stock tracking)
- Price books: multiple price tiers per product (retail, wholesale, employee, happy hour)
- Purchase orders to suppliers with discrepancy tracking

**What we do on top:**
- Lightspeed benchmarks are US/EU market data. Ours will be the **first benchmarking network with African restaurant data** — nyama choma economics, kibanda margins, jollof rice velocity. That data does not exist anywhere. When we have it, no one can replicate it without matching our merchant count.
- Supplier catalog integration with local distributors (Indomie, Tusker) — merchants search, product data pre-fills

---

### From SpotOn (fastest-growing US POS)

SpotOn's insight: **POS vendors give sales analytics; what operators need is P&L intelligence**. Their Profit Assist was the first POS feature to embed real cost analysis.

**What we take:**
- Profit Assist concept: connect revenue data to cost data, surface margin erosion before it kills the business
- Hyper-personalized loyalty: AI determines which reward type drives each specific customer back (free item, discount, or VIP recognition)
- Real-time shift P&L view for managers
- Anomaly detection with explanations ("voids up 40% in last hour, all from David's pin")

**What we do on top:**
- Supplier invoice OCR: owner photographs supplier delivery note → AI extracts items and prices → compares to last invoice → alerts if tomatoes went up 15% from last week
- Swahili-language P&L explanation: "Pesa yako ilifikia wapi?" (Where did your money go?)

---

### From TouchBistro (leading iPad POS)

TouchBistro's insight: **local-first architecture makes a restaurant POS reliable**. They wrote to local disk first, not the cloud.

**What we take:**
- True local-first: every transaction writes to device storage first, cloud sync is a background condition
- Two-way SMS waitlist — customer texts when they arrive, system seats them
- iPad tableside ordering concept (we do this on Android phones as Server Mode)
- Day-part menu switching (Breakfast → Lunch → Dinner auto-switches)
- Table capacity warnings

**What we do on top:**
- Replace SMS waitlist with WhatsApp waitlist (higher open rates, free for customers in Kenya)
- Day-part switching adds Ramadan mode: auto-switch to Iftar menu at sunset using location-based sunset time

---

### From Lavu (most advanced POS AI)

Lavu's insight: **proactive AI is more valuable than reactive reporting**. Their Marty AI runs 6 AI agents simultaneously in the background.

**What we take:**
- AI Morning Briefing concept: nightly analysis, delivered to owner at 6AM without them asking for it
- Proactive recommendations attached to data summaries
- AI-driven inventory alerts (not just "stock low" — "you will run out of this tomorrow based on yesterday's velocity")

**What we do on top:**
- Delivery channel: WhatsApp at 6AM (not an app push notification owners ignore). Owner reads it while making tea.
- Language: Swahili if owner preference is set
- African business intelligence: "Kesho ni Eid — historically your busiest day. Prepare extra stock."

---

### From Oracle MICROS (enterprise POS)

MICROS's insight: **in a high-cash, high-staff-turnover environment, every action must be logged**.

**What we take:**
- Complete audit trail architecture: every destructive action logged with who, what changed (before/after JSON), why (mandatory reason), when, where (device + IP)
- Void event logging with mandatory reason codes
- Manager override logging
- Cash drawer open events without a corresponding sale
- Failed login attempts

**What we do on top:**
- AI anomaly alerts: "5 voids in the last hour by Cashier David — this is unusual for a Tuesday"
- One-tap "Investigate order" — full lifecycle of any order in one view

---

### From NCR Counterpoint

NCR's insight: **African and emerging market retail has needs that don't exist in US markets** — layaway, job cards, rental management.

**What we take:**
- Layaway / installment purchase management
- Work order / job card system (repairs, service work)
- Rental item tracking
- Franchise management architecture

**What we do on top:**
- Layaway with WhatsApp payment reminders (automated, not manual)
- Job cards with customer WhatsApp status updates at each stage

---

### From Revel Systems

Revel's insight: **API-first architecture means the POS becomes a platform, not a product**.

**What we take:**
- Every module accessed only through a clean API — same API internal and external
- Multi-tenant from day one (one owner account → multiple businesses → multiple locations)
- Open API for third-party integrations (developer ecosystem)

**What we do on top:**
- The API is designed around African realities: M-Pesa as a first-class payment method with its own endpoints, WhatsApp as a first-class notification channel, offline state as a first-class data concern

---

### From Shopify

Shopify's insight: **merchants want to automate without writing code**. Shopify Flow (no-code automation) became a major retention driver.

**What we take:**
- No-code automation rules engine: IF [trigger] THEN [action], built with merchant-friendly templates
- Developer ecosystem concept: clean API + webhooks → third-party apps build on top → network effect

**What we do on top:**
- African-specific automation templates: "When M-Pesa balance on till drops below KES 50,000, alert me", "When it's 25th of the month, remind me to prepare extra staff (payday spike)"

---

### From HungerRush

HungerRush's insight: **caller ID memory turns every incoming call into a personalized experience**. Their OrderAI has processed 5M+ orders via phone AI.

**What we take:**
- Phone number as universal customer identity
- AI voice ordering (English first, Swahili phase 2)
- Caller-ID-based customer recognition ("Last time you ordered ugali na samaki — same again?")

**What we do on top:**
- WhatsApp voice note ordering in Swahili (this is more relevant in Kenya than phone call ordering)
- Sheng understanding: "Niongezee ketchup kama last time" — informal Nairobi slang

---

## THE COMPLETE FEATURE SPECIFICATION

Every feature below is organized as:
**[Feature Name]** → Source → What We Add → Market Justification

---

### DOMAIN 1: CORE SELLING ENGINE

#### 1.1 — Product Catalog

**Source:** Toast, Square, Lightspeed (universal baseline)

**Build:**
- Products with name, description, price, category, subcategory, images
- Barcode assignment per product (scan to add)
- Stock quantity per location with low-stock threshold
- Product images (required — most staff recognize items by photo)
- Soft delete (products never truly deleted — audit trail)
- Bulk import via CSV

**We add for Africa:**
- No-barcode mode: name + photo + price only. For informal market products, artisan goods, daily specials — no barcode exists.
- Bulk/loose item mode: sell by weight or count. Maize flour per kg, fabric per meter, roasted peanuts per cup.
- Photo-only search: find a product by tapping its image. No need to spell it.
- Multi-language item names: Swahili displayed alongside English on the same button. "Ugali" not "Stiff Porridge."
- Quick-add grid populated by ML: top 20 most-sold items in the last 7 days appear on the home grid automatically. No manual configuration.

**Market justification:** Most vibanda and informal traders don't use barcodes. Most Kenyan restaurant items are culturally named — a server who thinks in Swahili should work in Swahili.

---

#### 1.2 — Cart and Order Creation

**Source:** Toast, Square

**Build:**
- Add items by tap, barcode scan, or search
- Adjust quantity, remove items
- Item modifiers (extra cheese, no onion, spicy, half portion)
- Order notes per item and per order
- Hold / park an open order (return to it later)
- Transfer open order between staff members
- Open orders list with time elapsed

**We add for Africa:**
- Offline-first: every cart action writes locally first. Cloud sync is a background event.
- Multi-language modifier names
- Draft order recovery: if device crashes mid-order, the draft is still there on restart

---

#### 1.3 — Product Variants

**Source:** Lightspeed Retail, Shopify

**Build:**
- Parent product → child variants by attribute matrix (Size × Color × Style × Flavour)
- Each variant: own price, own stock count, own barcode, own image
- Bulk price update across all variants of a parent product
- Single management screen for all variants

**Market justification:** Every clothing retailer, shoe shop, and beverages stall needs this. A restaurant needs it for size variants (Small/Regular/Large chips).

---

#### 1.4 — Price Books (Multiple Price Tiers)

**Source:** Lightspeed Retail

**Build:**
- Retail (default), Wholesale, Employee, Loyalty Member, Happy Hour (time-activated)
- Customer's assigned price tier applied automatically at checkout from their profile
- Staff manually selects tier for one-off situations
- Tier shown on receipt
- Happy hour tier auto-activates and deactivates by time schedule

**We add for Africa:**
- Bulk customer price (for caterers buying 50 portions at once)
- NGO/charity price tier (common in Kenya — NGOs buy from hospitality businesses for events)

---

### DOMAIN 2: PAYMENT ENGINE

#### 2.1 — M-Pesa Native (STK Push + QR + Paybill)

**Source:** Nobody. This is ours.

**This is not a feature. It is the core payment infrastructure.**

**Build — Three M-Pesa flows:**

**Flow 1 — STK Push (primary):**
1. Cashier enters sale total, selects M-Pesa
2. System prompts for customer's phone number (or reads from loyalty profile)
3. Daraja API v3 sends STK Push request to Safaricom
4. Customer's phone shows payment prompt with exact amount pre-set
5. Customer enters M-Pesa PIN
6. Safaricom sends webhook to our server within 5–30 seconds
7. POS marks order as PAID automatically — no manual confirmation
8. M-Pesa reference code stored on payment record
9. WhatsApp receipt sent automatically

**Flow 2 — Paybill/Till QR (fallback if no phone number):**
1. QR code generated for the exact amount of this order
2. Customer scans QR with M-Pesa camera
3. Amount pre-fills, customer confirms
4. Confirmation via webhook

**Flow 3 — Offline QR (when internet is down):**
1. Static merchant QR code displayed (always pre-loaded)
2. Customer pays manually to the till
3. Transaction recorded locally as "M-Pesa QR — unconfirmed"
4. On internet reconnect: system pulls M-Pesa statement, auto-reconciles
5. Unconfirmed payments that match by amount + approximate time → auto-confirmed

**We add for Africa:**
- M-Pesa fee shown separately: 0.5% deducted from net revenue on reports (merchant pays this)
- Auto-reconciliation: end-of-shift M-Pesa statement vs. POS M-Pesa payments — discrepancies flagged
- Staff M-Pesa fraud detection: if payment came to an unregistered number, alert fires
- STK Push timeout recovery: if customer misses 60-second window, auto-retry prompt for staff
- Multi-currency M-Pesa: accept USD or EUR at current CBK rate, record in KES equivalent

**Market data:** M-Pesa holds 93.4% of Kenya's mobile money market. 675,860 formal merchants + 1.15M informal merchants accept Lipa Na M-Pesa. Daily M-Pesa transactions: ~50 million. This is not optional.

---

#### 2.2 — Cash Payment + Change Calculator

**Source:** Every POS ever built

**Build:**
- Enter cash received → POS calculates change due
- Denomination breakdown for till reconciliation (KES 1000, 500, 200, 100, 50, 20, 10, 5, 1)
- Cash drawer open event triggers audit log entry

**We add for Africa:**
- Short change alert: cashier gives wrong change 3× in a shift → manager notified
- Denomination counting UI at shift end: count the till, enter by denomination, compare to expected

---

#### 2.3 — Card Payment

**Source:** Toast, Square

**Build:**
- Flutterwave integration (primary — 34 African countries)
- Paystack (Nigeria/Ghana secondary)
- DPO Group (East/Southern Africa secondary)
- Physical card terminal integration (Pesapal Sabi PDQ machines)
- Card payment stored on order record with authorization code

**Market note:** Cards are 5.6% of Kenyans. Build it, but don't prioritize it over M-Pesa.

---

#### 2.4 — Multi-Payment (Split Across Methods)

**Source:** Toast, Square, Lightspeed

**Build:**
- Single transaction split across multiple payment methods
- E.g., KES 500 cash + KES 1,200 M-Pesa + KES 800 loyalty points
- Partial payment (deposit paid now, balance later)
- Each method tracked separately on the payment record

---

#### 2.5 — Split Bill

**Source:** Toast (split check), Square

**Build:**
- Split equally N ways
- Split by seat assignment
- Split by specific items (each person pays for what they ordered)
- Split by custom amounts
- Each split generates its own payment request

**We add for Africa:**
- WhatsApp split link (not SMS — 95%+ open rate on WhatsApp in Kenya)
- M-Pesa STK Push per person for their share amount
- One-person-pays override: one person accepts total, one STK Push covers the full bill

---

#### 2.6 — Refunds and Voids

**Source:** Oracle MICROS, Toast

**Build:**
- Void: order cancelled before payment completed. Zero financial impact. Audit log.
- Refund: payment reversed after completion. Financial impact. Requires manager PIN + mandatory reason.
- Partial refund: refund specific items or custom amount
- Refund to original payment method or to loyalty points (customer's choice)
- Void vs. refund distinction enforced at system level — cannot void a paid order

**We add for Africa:**
- Refund reason required from a dropdown (not free text — forces categorization for analysis)
- Anomaly alert: 3+ voids in 30 minutes from same staff member → manager notified via WhatsApp

---

### DOMAIN 3: RESTAURANT OPERATIONS

#### 3.1 — Table Management + Floor Plan

**Source:** Toast Tables, TouchBistro, Lightspeed

**Build:**
- Visual floor plan editor (drag-and-drop layout setup)
- Tables, booths, bar stools, outdoor sections all configurable
- Table status system: Available / Occupied / Reserved / Cleaning
- See per-table: occupancy time, current order total, assigned server, party size
- Transfer order between tables
- Merge tables (large party splits across two tables, bill them together)

**We add for Africa:**
- Table color coding by alert state: green (available), blue (ordered, waiting), yellow (food ready, not served), red (overdue — exceeded predicted turn time)
- Ghost table feature: add temporary tables for rooftop, outdoor event, overflow seating without redesigning the floor plan
- Capacity warning: "Table 4 seated 8, stated capacity is 6 — manager override required"
- Table time prediction: ML learns average turn time for each table size + day/time combination

---

#### 3.2 — Kitchen Display System (KDS)

**Source:** Toast KDS, Oracle MICROS KDS

**This is the feature that kills the WhatsApp group chat kitchen order system.**

**Build:**
- Real-time digital kitchen display replacing paper tickets and shouted orders
- WebSocket-powered (Socket.io) — orders appear on KDS within milliseconds of POS entry
- Color coding by ticket age: green (fresh) → yellow (approaching target) → red (overdue)
- Multi-station routing: bar gets drinks, main kitchen gets food, pastry station gets desserts
- Staff bumps items as complete (touch to mark done)
- Expo screen: shows what's ready for food runners — "Table 7: 2× Chicken, waiting for 1× Ugali"
- Station-level configuration: what categories route to which screen

**We add for Africa:**
- AI-adjusted cook times: system learns actual cook times per item and adjusts firing sequences ("Nyama choma takes 18 minutes, not 12 — the KDS now fires it 6 minutes earlier so everything hits the table together")
- Cross-station coordination: "Beef stew 2 minutes from done — fire the ugali now"
- Order consolidation: three separate orders of chips on the board → KDS shows "12 portions of chips needed — batch them"
- Rush/VIP order visual: rush orders appear with a different color and a pulsing border
- Production batching suggestion: "You have 8 burger orders in the last 20 minutes — batch them"
- Gamification: kitchen speed displayed as average ticket time vs. yesterday's average

---

#### 3.3 — Reservations + Waitlist

**Source:** Toast Tables, TouchBistro (two-way SMS waitlist)

**Build:**
- Reservation booking: party size, date/time, table assignment, special requests, dietary notes
- Reservation status: Confirmed / Seated / No-show / Cancelled
- Walk-in waitlist when fully occupied: add name, party size, phone
- Estimated wait time shown

**We add for Africa:**
- WhatsApp confirmation (not SMS — free for customer, higher open rate)
- Two-way WhatsApp waitlist: "Reply HERE when you arrive and we'll seat you immediately"
- Automated reminder: "Your reservation at Mama's Kitchen is in 2 hours! Reply CANCEL if you can't make it." — sent 2 hours before
- No-show tracking: customer marked as no-show 3× → loyalty tier downgrade (owner-configured)
- Google Calendar sync: reservation appears in owner's personal calendar

---

#### 3.4 — Server Mode (Tableside Handheld Ordering)

**Source:** Toast Go 2, Lightspeed

**Build:**
- "Server Mode" profile on the same React Native app — simplified one-handed UI
- Server selects their assigned tables, sees only their section
- Adds items to order from table, sends to KDS instantly
- Takes payment at table — M-Pesa STK Push to customer's phone from server's device
- Offline-capable: server moves to a dead zone (garden, rooftop) — orders queue locally and sync when back

**Runs on:** Sunmi M2, Sunmi V2s, any Android 6"+ phone

**We add for Africa:**
- "Pay at table in 60 seconds": server presents bill on tablet, customer receives M-Pesa STK Push to their phone, confirms, server sees confirmation — no physical card machine walk needed
- Server sees their own performance: orders taken, average ticket, tips received

---

#### 3.5 — QR Code Table Ordering

**Source:** Toast Order & Pay, Lightspeed Order Anywhere

**Build:**
- Static QR per table (UUID URL, scannable forever)
- Customer scans → branded ordering page (no app download required)
- Full menu with photos, descriptions, allergen info
- Add to cart, place order → goes to KDS instantly
- Payment via M-Pesa STK Push or card
- WhatsApp receipt sent automatically

**We add for Africa:**
- Real-time order status on customer's phone: "Being prepared... Ready in ~15 minutes... Served by Grace"
- QR dish rating: customer rates each dish as it arrives → kitchen sees ratings in real time
- Group QR ordering: one table, multiple phones — each person orders their own items, all linked to one table, each person pays their own share separately via M-Pesa
- Course-aware: "Ready for dessert?" button appears after main courses marked served
- WhatsApp ordering alternative: customer can order via WhatsApp instead of browser if they prefer

---

#### 3.6 — Menu Engineering AI (BCG Matrix)

**Source:** Toast Menu Engineering Report, Lightspeed

**Build:**
- Every menu item plotted on 2×2 matrix: profitability (high/low) × popularity (high/low)
- Four quadrants: Stars (promote), Plowhorses (reprice/reposition), Puzzles (needs marketing), Dogs (consider removing)
- Auto-calculated from actual POS data — no manual input needed
- True gross margin axis: uses actual ingredient cost from recipe module, not just selling price

**We add for Africa:**
- Auto-generated action recommendations per item: "Ugali is a Plowhorse — high sales but 18% margin. Reduce portion by 10g or raise price by KES 20 to reach 28%."
- Price simulation: drag item price on a slider → see which quadrant it moves to
- Seasonal overlay: "Tilapia is a Star in December, Dog in August — don't remove it, just adjust seasonal availability"
- Weekly WhatsApp digest to owner: "Your Dogs this week: Prawn Salad (4 sold), Garlic Bread (2 sold). Consider removing."

---

#### 3.7 — Time-Based Automatic Menu Switching

**Source:** TouchBistro (day-part switching)

**Build:**
- Define day-parts with start times and the active menu for each
- POS switches automatically at the configured time
- Alert to manager 5 minutes before switch
- Special event menu: override for a specific date/time range
- Menu "86" list: manager marks item as unavailable mid-service → removed from POS, QR ordering, and WhatsApp simultaneously

**We add for Africa:**
- Ramadan mode: auto-switch to Iftar menu at sunset (location-based sunset time from API)
- Ramadan pre-order mode: customers can pre-order Iftar meals up to 2 hours before
- Public holiday awareness: ML model knows Kenyan public holidays and suggests menu adjustments

---

#### 3.8 — Self-Ordering Kiosk Mode

**Source:** McDonald's kiosk effect (15–30% average check increase proven), Toast Kiosk

**Build:**
- "Kiosk Mode" profile on the same React Native app — large touch-optimized layout
- Photo-first menu: large food photos, minimal text (works across literacy levels)
- AI upsell prompts at add-to-cart: "89% of customers who ordered this added chips"
- Payment: M-Pesa STK Push (customer enters their own phone number), cash with cashier confirmation
- Loyalty login: customer enters phone number → profile loads, points shown

**We add for Africa:**
- Animated scratch-card reveals points earned after payment — gamification increases return visits
- Accessibility mode: larger text, high contrast, simplified navigation
- Swahili/English toggle on the kiosk screen
- A/B test upsell messages automatically — system learns which message increases check size more

---

### DOMAIN 4: STAFF AND ACCESS CONTROL

#### 4.1 — Staff Roles + PIN Login

**Source:** Toast (staff roles), Square (PIN login), Oracle MICROS

**Build:**
- Roles: Owner, Manager, Cashier, Server, Kitchen Staff, Bartender
- PIN-based login on POS terminal (4-digit PIN — no typing passwords during service)
- Role-based permissions table: cashiers cannot process refunds, servers cannot see reports, only managers can void orders, only owners can change pricing
- Clock in / clock out per shift with timestamps

**We add for Africa:**
- Staff invite via WhatsApp: send join link — no email account required (many staff don't have work email)
- Name on receipt: "Served by Grace" — shown on every receipt
- Clock-in photo (optional): accountability without CCTV requirement
- Manager overrides staff actions remotely via WhatsApp: "Approve this refund" → tap → approved
- PIN lockout after 5 failed attempts — alerts manager

---

#### 4.2 — Audit Log (Complete Investigation Trail)

**Source:** Oracle MICROS, NCR (enterprise-grade audit)

**This is non-negotiable. Build it early. It protects the merchant.**

**Every logged event:**
- `void_order` — full order cancelled
- `refund_payment` — payment reversed
- `discount_applied` — price reduced
- `comp_item` — item given free
- `price_change` — product price modified
- `delete_product` — product removed
- `stock_adjust` — inventory manually adjusted
- `cash_drawer_open` — till opened without sale
- `login_failed` — failed PIN attempt
- `manager_override` — manager approved restricted action
- `settings_change` — any system setting modified
- `staff_created` / `staff_deleted` — team changes
- `transfer_table` — order moved between tables
- `payment_method_change` — payment method changed after order placed

**Every log entry captures:** who (staff_id + name), what changed (old JSON → new JSON snapshot), why (mandatory reason for destructive actions), when (ISO 8601), where (device_id + IP address), which order/entity.

**We add for Africa:**
- Owner dashboard audit viewer: filterable by staff member, action type, date range, amount affected
- "Investigate order" single view: see every event in an order's lifecycle from creation to payment
- Anomaly alerts: "5 voids in the last hour by Cashier David — unusual for a Tuesday afternoon"
- Export audit report to PDF: for accountant or legal investigation

---

### DOMAIN 5: INVENTORY AND SUPPLY CHAIN

#### 5.1 — Inventory Management

**Source:** Lightspeed Retail, Square for Retail

**Build:**
- Stock quantity per product per location
- Low-stock threshold per product: alert fires when below threshold
- Receive stock: create goods receipt → inventory increases
- Stock transfer between locations
- Manual stock adjustment with mandatory reason (damage, wastage, donation)
- Inventory valuation: FIFO cost method

**We add for Africa:**
- No-barcode mode: count items by photo and name, not barcode
- Bulk/weight tracking: sell 500g of maize flour → 500g deducted from total kg stock
- Wastage log: food spoilage recorded as a cost line

---

#### 5.2 — Recipe-Level Food Cost Tracking

**Source:** Lightspeed (advanced inventory), Toast (food cost module)

**Build:**
- Define recipe for each menu item: ingredients + quantities
- When item is sold on POS → ingredients deducted from inventory automatically
- Food cost % per item calculated automatically: ingredient cost / selling price
- Total food cost % for the business tracked daily

**We add for Africa:**
- Alert when food cost % exceeds owner-set threshold: "Food cost has exceeded 35% today — investigate"
- Ingredient price update tracking: when tomato price changes, all recipes using tomatoes recalculate

---

#### 5.3 — Purchase Orders to Suppliers

**Source:** Lightspeed Retail, NCR

**Build:**
- Create PO from low-stock alerts (auto-generate suggested PO) or manually
- PO sent to supplier via WhatsApp or email
- Supplier confirms → expected delivery date appears in system
- Goods received: enter actual quantities, inventory updated
- Discrepancy report: received quantity ≠ ordered quantity → flagged

**We add for Africa:**
- Supplier WhatsApp integration: send PO to supplier's WhatsApp — no email account needed
- Supplier catalog: partner with local distributors (Indomie, Tusker, Crown Beverages) — merchant searches, product data pre-fills
- Reorder queue: ML generates suggested reorder list based on demand forecast — manager approves with one tap
- Supplier credit tracking (Mkopo): record what you owe each supplier, payment schedule, WhatsApp payment reminders before the rep visits

---

### DOMAIN 6: CUSTOMER INTELLIGENCE AND LOYALTY

#### 6.1 — Customer Profiles + Visit History

**Source:** Toast Loyalty, SpotOn, HungerRush (caller ID memory)

**Build:**
- Customer record: phone number as universal ID (not email — most customers don't share email with restaurants in Kenya)
- Auto-created from M-Pesa payment (phone number captured automatically)
- Full order history
- Total lifetime spend, visit count, last visit
- Tags: VIP, Credit Customer, At-Risk, Allergic to [x]
- Staff notes: "Prefers Table 7", "Always orders extra sauce", "Birthday is March 14"

**We add for Africa:**
- M-Pesa auto-capture: customer pays with M-Pesa → their phone number is their loyalty ID — zero staff effort
- WhatsApp capture: customer texts your WhatsApp number → automatically registered
- Customer recognition at POS: when customer phone number entered for STK Push → profile loads: "Grace Wanjiku — 14 visits, 340 loyalty points, prefers extra chilli"

---

#### 6.2 — Loyalty Program

**Source:** Toast Loyalty, SpotOn (hyper-personalized rewards), Square Loyalty

**Build:**
- Points earned per KES spent (owner-configured rate)
- Points redemption at checkout (1 point = KES 1 by default)
- Visit-based tier system: Bronze → Silver → Gold → Platinum
- Birthday recognition: auto-send WhatsApp birthday message + special offer

**We add for Africa:**
- Tiered loyalty creates aspiration — "Silver members get priority seating, Gold members get a free item monthly, Platinum members get a personal WhatsApp from the owner on their birthday"
- Points expiry warnings: "Your 340 points expire in 30 days! Visit this week to keep them."
- Group loyalty: family/household points pooling — one member earns, household redeems
- Gamified reveal: scratch-card animation on QR ordering page after payment shows points earned
- Win-back campaign: if customer hasn't visited in 2× their usual frequency → auto-send WhatsApp "We miss you! Here's 20% off your next visit" → track if they return

---

#### 6.3 — AI Personalized Loyalty

**Source:** SpotOn (hyper-personalization)

**Build:**
- AI classifies each customer by reward sensitivity:
  - Customer A always responds to free item offers
  - Customer B always responds to percentage discounts
  - Customer C responds to VIP recognition and priority seating
- System automatically sends the reward type that works for that specific customer

**Market justification:** A blanket "10% off" WhatsApp blast has 5% conversion. A personalized "We saved your favourite table — come in tonight" to a VIP customer has 40%+ conversion.

---

#### 6.4 — Running Customer Credit Tab (Oweame)

**Source:** Nobody has this natively. This is Africa-original.

**Build:**
- Open a credit account for a trusted regular customer
- Any purchase added to their tab with one tap
- Credit limit per customer (set by manager)
- Outstanding balance tracked, interest-free
- Alert when customer approaches credit limit
- "Pay tab" flow: customer comes to settle — one screen shows full itemized balance, takes partial or full payment

**We add for Africa:**
- WhatsApp monthly statement: sent on 1st of each month with itemized balance
- Credit risk flag: balances older than 30 days shown in risk dashboard
- Manager-only credit extension: increasing credit limit requires manager PIN
- Supplier credit mirror: the same module tracks what the restaurant owes suppliers (Mkopo) — same UI, different direction

**Market justification:** The Oweame (tab/credit) pattern is deeply embedded in African retail and food service. A trusted regular customer's credit tab builds loyalty stronger than any points program. No global POS has this. It is one of the most requested features from Kenyan restaurant owners.

---

#### 6.5 — Layaway / Installment Deposit

**Source:** NCR Counterpoint

**Build:**
- Layaway record per customer: item held, deposit paid, balance due, payment schedule
- Installment payments recorded against the layaway
- Item physically held/tagged — released only on full payment
- WhatsApp reminders sent before each payment due date

**We add for Africa:**
- Rent-to-own variant: portion of each payment goes toward ownership
- WhatsApp payment link for each installment
- Layaway dashboard: total stock held in layaway, total deposits collected, items at risk of abandonment

---

### DOMAIN 7: OWNER INTELLIGENCE

#### 7.1 — Live Owner Dashboard

**Source:** Toast Now (real-time mobile dashboard)

**Build:**
- Today's revenue: live, updates with every transaction
- Revenue vs. same day last week (with % change)
- Current open orders count
- Top 3 items sold today
- Payment method breakdown (Cash / M-Pesa / Card split in %)
- Active staff count (clocked in right now)
- Revenue milestone progress bar (vs. daily target)
- Multi-branch switcher: all branches visible on one screen

**We add for Africa:**
- Primary delivery: WhatsApp notification, not app notification. Owner already has WhatsApp open.
- Revenue milestone alerts: "You just hit KES 50,000 today!" — WhatsApp
- "Payday effect" awareness: "Today is the 25th — historically your 3rd busiest day. Your current revenue is 12% behind the 5:30PM pace from last month's 25th."
- Offline status indicator: "Branch Karen has been offline for 2 hours — last sync 14:32"

---

#### 7.2 — AI Natural Language Reports

**Source:** Toast IQ, Lightspeed AI

**Build:**
- Any staff member or owner types a question in plain English or Swahili → answer delivered in under 5 seconds
- Implementation: Claude claude-sonnet-4-6 receives question + business schema + 90-day compressed data → generates SQL → executes on read-only replica → Claude formats answer in natural language + optional chart

**Query examples:**
- "Niuambie mauzo yangu ya jana" → "Mauzo ya jana yalikuwa KES 87,400 — ongezeko la 12% ikilinganishwa na wiki iliyopita. Kipande kilichouza vizuri zaidi: Ugali wa Nguruwe (56 portions)."
- "Which items haven't sold in 30 days?"
- "What was my busiest hour last Friday?"
- "How much did Grace sell this week vs. last week?"
- "Compare this month to last month by category"
- "What's my food cost percentage this week?"

**We add for Africa:**
- Voice input: owner speaks question (English or Swahili) → AWS Transcribe → Claude → answer
- WhatsApp delivery: if asked via WhatsApp → answer delivered back via WhatsApp
- Action suggestions: "Your Prawn Salad hasn't sold in 8 days. Want me to add it to today's specials on the menu board?"

---

#### 7.3 — AI Morning Briefing (6AM WhatsApp)

**Source:** Lavu's Marty AI (most advanced POS AI currently)

**Build:**
Nightly job runs at 4AM. Claude claude-sonnet-4-6 analyzes all previous-day data. By 6AM, owner receives WhatsApp message with:

1. Revenue summary vs. same day last week (% change, not just numbers)
2. Best-selling and worst-performing item (with action suggestion)
3. Staff highlight: best performer + one coaching note for underperformer
4. Kitchen: average ticket time vs. target (and trend)
5. Inventory risk: items that will run out today based on yesterday's velocity
6. One specific AI insight: "Grilled Tilapia hasn't sold in 4 days — consider a lunch special today"
7. Operational note: "3 reservations tonight. Your second-busiest Saturday of the month."

**We add for Africa:**
- Multi-business version: one briefing covers all of the owner's businesses
- Event and pattern awareness: "Tomorrow is Eid al-Fitr — historically your highest revenue day of the year. Your current stock of [items] will run out by lunch."
- Owner can reply "MORE DETAIL on inventory" → expanded breakdown sent back
- Briefing in Swahili if owner preference is set to Swahili
- Public holiday awareness: briefs always note upcoming holidays with historical impact

---

#### 7.4 — Competitive Benchmarking

**Source:** Lightspeed Benchmarks & Trends (their moat feature)

**Build:**
- As merchant network grows, aggregate anonymized data by: restaurant type, location, city, price tier
- Show each merchant how they compare to their peers:
  - My average check vs. similar restaurants in my area
  - My table turn time vs. area average
  - My food cost % vs. area average
  - My busiest hour vs. area pattern
- Minimum 10 merchants in same city/category before benchmarks appear

**We add for Africa:**
- African restaurant categories that don't appear in global data: nyama choma spots, kibanda economics, mandazi stalls, piri piri takeaways, rolex stations
- Framed positively: "Top-performing restaurants in your category are doing X" — not "you are below average"
- Top quartile target: "If you reduce table turn time by 8 minutes, you'd join the top 25% of Nairobi restaurants in your category"
- This is our moat. Lightspeed has US/EU data. We will have African data. No one can replicate this without matching our merchant count.

---

#### 7.5 — AI P&L Analysis (Profit Assist)

**Source:** SpotOn Profit Assist (first POS to embed true P&L AI)

**Build:**
- Connect to accounting data (Xero/QuickBooks API) or use manual expense entry
- Nightly analysis: this period vs. last period vs. same period last year
- Flag cost anomalies automatically: "Labor cost increased 8% this week — 3 extra shifts were added"
- "Where did my money go?" plain-language monthly breakdown

**We add for Africa:**
- Supplier invoice OCR: owner photographs the Indomie delivery receipt → AI extracts items and prices → compares to last invoice from same supplier → alerts if anything went up: "Tomatoes up 23% from Kamau Suppliers since last month"
- Real-time shift P&L: manager opens dashboard mid-service and sees live: revenue so far, labor cost (clocked-in hours × wage), estimated food cost, estimated gross profit vs. same shift last week
- Food cost trend line: weekly food cost % charted over time — visual trend makes erosion obvious

---

### DOMAIN 8: WHATSAPP COMMERCE LAYER

#### 8.1 — WhatsApp Receipt (Default Channel)

**Source:** Nobody does this. This is our invention for Africa.

**Build:**
After every completed payment, send WhatsApp message to customer's phone with:
- Business name, logo (inline image), location, date/time
- Itemized order: each item, quantity, unit price
- Subtotal, tax (eTIMS-compliant VAT breakdown), total
- Payment method: "M-Pesa — confirmed (REF: QAB7YX12)" or "Cash — Change: KES 100"
- Loyalty points earned this visit + current balance
- Loyalty progress bar: "3 more visits and you earn a free item"

**We add for Africa:**
- Customer can reply "RETURN" → starts return request flow (logged in audit trail)
- Customer can reply "RECEIPT" anytime → last receipt resent
- Receipt in Swahili if customer's language preference is Swahili
- Merchant branding: their logo appears in the WhatsApp message as a media attachment

**Market justification:** WhatsApp accounts for ~20% of all online food order transactions in Kenya. Every Kenyan has it. Every Kenyan checks it more than email. The receipt in WhatsApp is more useful than a printed receipt in a drawer.

---

#### 8.2 — WhatsApp Commerce (Orders via WhatsApp)

**Source:** Nobody has this fully. Africa-original and enormous.

**Build:**
Customer sends message to business WhatsApp number. NLP (Claude) parses intent. System responds:

1. **Menu browsing:** "Show me your menu" → reply with category list → customer selects → subcategory and items appear
2. **Order placement:** "I want 2 ugali na samaki and 1 pilau" → system shows order summary → customer confirms
3. **Payment:** system sends M-Pesa STK Push to customer's number → customer confirms → order sent to KDS
4. **Status updates:** "Your order is being prepared... Grace says it'll be ready in 15 minutes"
5. **Receipt:** full WhatsApp receipt with M-Pesa reference

**We add for Africa:**
- Swahili and English NLP: "nataka ugali mbili na maji baridi" is understood as 2x ugali + 1x cold water
- Sheng parsing: "niongezee ketchup kama kawaida yangu" (add ketchup like usual for me)
- Loyalty via WhatsApp: customer texts "MY POINTS" → "Grace, you have 340 points (KES 340 value)"
- Owner reporting via WhatsApp: owner texts "SALES TODAY" to their own system → live summary returned
- Table ordering via WhatsApp: QR at table → links to WhatsApp number with table ID pre-filled

---

#### 8.3 — WhatsApp AI Voice Note Ordering

**Source:** HungerRush OrderAI, Square Voice AI

**Build:**
- Customer sends a WhatsApp voice note to the business number
- AWS Transcribe (Swahili + English model) transcribes the voice note
- Claude parses the order from the transcription
- System confirms the order summary back as a text message
- M-Pesa STK Push sent for confirmation

**We add for Africa:**
- Swahili voice understanding — not just English
- Caller recognition: "Same as last time?" — one-word confirmation completes repeat order
- Sheng understanding in voice: "Niambie kama na fries tena" (the same thing but add fries this time)

---

### DOMAIN 9: COMPLIANCE LAYER

#### 9.1 — KRA eTIMS Compliance (Kenya)

**Source:** Nobody else has built this correctly. This is our legal moat in Kenya.

**Build:**
- Every receipt generated by the POS is automatically eTIMS-compliant
- ETR receipt format with KRA-required fields: business PIN, ETR serial number, KRA QR code
- VAT calculated at correct rates per item category
- Z-report generation for daily submission to KRA
- Tax exemption categories: medical items, NGO purchases, zero-rated goods
- ESD integration for fiscal device sign-off

**No configuration required from the merchant.** They sign up, connect their KRA PIN, and every receipt is automatically compliant.

**We add:**
- Uganda EFRIS integration (Phase 2 — Month 7)
- Nigeria FIRS integration (Phase 2 — Month 10)
- Tax report export in KRA format for annual filing
- eTIMS compliance status badge in the owner dashboard: green (compliant), red (issue detected)

**Market justification:** From January 2026, KRA rejects tax returns without eTIMS-backed receipts. Criminal penalties up to KES 1 million. This is the #1 forcing function for POS adoption in Kenya right now. A POS that makes compliance automatic removes the biggest pain in the market.

---

### DOMAIN 10: OFFLINE AND RESILIENCE LAYER

#### 10.1 — True 72-Hour Offline Mode

**Source:** TouchBistro (local-first), Erply (unlimited offline)

**Build:**
- WatermelonDB (SQLite-backed) on device — all writes go local first
- Cloud sync happens in background when connection is available
- Offline capabilities:
  - Full POS operation: create orders, add items, apply discounts
  - Cash payment: full processing
  - M-Pesa offline QR: static QR displayed, payment captured as "pending confirmation"
  - Card store-and-forward: card transactions queued for processing when online
  - All audit log entries stored locally and synced on reconnect
- Conflict resolution: server timestamp wins; local orphan transactions are flagged for review

**We add for Africa:**
- **Load shedding mode**: power-cut detection (battery status falls below 20% + grid power lost) → screen dims, non-essential features disabled, "X minutes of battery remaining" shown
- Mobile hotspot failover: detect when main router loses power → prompt staff to enable phone hotspot → POS reconnects automatically
- Offline indicator: always visible in corner — green (online), orange (offline, syncing queue), red (offline, large queue backing up)
- "Offline since [X hours ago]" shown to manager in owner dashboard with transaction count pending sync
- Sync queue priority: M-Pesa confirmations and payment records sync first

---

#### 10.2 — Multi-Tenant + Multi-Branch Architecture

**Source:** Revel, Erply

**Build:**
- One owner account → multiple businesses (restaurant + retail shop + salon)
- Each business → multiple locations/branches
- Staff belong to a specific location
- Data isolation: PostgreSQL row-level security — business_id on every row

**We add for Africa:**
- Cross-business consolidated owner view: all businesses' revenue on one screen
- Consolidated daily WhatsApp: "Total revenue across your 3 businesses today: KES 87,400"
- One subscription covers all businesses (not per-location pricing that penalizes growth)
- Branch comparison: which branch is performing best, worst, most improved

---

### DOMAIN 11: PLATFORM AND DISTRIBUTION

#### 11.1 — Delivery Aggregator Integration

**Source:** Toast Delivery Services (DoorDash, Uber Eats via middleware)

**Build:**
- Deliverect API as middleware aggregator
- Single integration covers: Bolt Food Kenya, Glovo, Uber Eats
- Orders from all platforms appear in one unified queue
- Auto-route to KDS — no separate tablet, no manual re-entry
- Menu sync: push menu changes to all platforms simultaneously

**We add for Africa:**
- Delivery platform performance report: which platform brings highest-margin orders, which has highest cancellation rate, which has best customer repeat rate
- Delivery commission cost tracking: each platform's fee shown as a cost line in reports
- Order throttling: limit incoming delivery orders per 15-minute window during rush — kitchen doesn't get overwhelmed

**Market data:** Glovo Kenya: 314,000 active users in Q1 2025. Online delivery market: $534.6M in 2024, growing to $799.9M by 2028. This is real revenue being captured by delivery apps at 15–30% commission. Every order through our direct online ordering page is 15–30% that stays with the merchant.

---

#### 11.2 — Commission-Free Online Ordering Page

**Source:** Toast Online Ordering

**Build:**
- Branded ordering page at custom subdomain (mama-kitchen.yourpos.com)
- Owner's logo, brand colors, food photography
- Pickup and delivery options
- Payment via M-Pesa or card
- Orders go directly to KDS — zero commission to delivery apps

**We add for Africa:**
- WhatsApp order link: merchant shares link via WhatsApp Status, Instagram bio, Google Business
- Pre-ordering: customer orders for a specific future time slot
- Google Food Ordering integration: "Order" button directly on Google Search and Google Maps results

---

#### 11.3 — No-Code Automation Rules Engine

**Source:** Shopify Flow

**Build:**
Merchants build automation rules: IF [trigger] THEN [action]. No code required.

**Built-in Africa-optimized templates:**
- "When stock drops below 5 units, send me a WhatsApp"
- "When a customer spends over KES 10,000 total lifetime, tag them as VIP"
- "Every Monday at 7AM, send me last week's sales summary via WhatsApp"
- "When any menu item hasn't sold in 30 days, alert me"
- "When a void is processed, notify manager via WhatsApp immediately"
- "When food cost % exceeds 35%, send daily alert until resolved"
- "When it's the 25th of the month, remind me to prepare extra staff"
- "When Bolt Food order comes in, auto-accept if kitchen queue is under 5 orders"
- "When M-Pesa reconciliation shows a discrepancy, flag it"

---

#### 11.4 — Franchise + Chain Management

**Source:** Erply (franchise architecture), NCR

**Build:**
- HQ hierarchy: controls menus, pricing floors, brand standards, and consolidated reports
- Branch operators see only their branch
- Central menu push: one change at HQ → propagates to all branches within 60 seconds
- Branch-level price overrides: HQ sets minimum, branch can price above but never below
- Royalty engine: % of each branch's sales calculated and reported to franchisor automatically

**We add for Africa:**
- Compliance score per branch: is the branch opening on time, using approved suppliers, hitting required margins?
- HQ morning briefing: consolidated AI briefing across all franchise locations at 6AM
- "Compare branches" view: side-by-side performance ranking for all franchise locations

---

#### 11.5 — Integrated Financial Services

**Source:** Square Banking, Toast Capital, Lightspeed Capital

**Build:**
1. Business wallet: daily sales sweep to a dedicated business account
2. Tax savings sub-account: auto-set aside 16% of daily revenue (VAT equivalent) so tax bills don't surprise
3. Merchant advance: partner with Kenyan MFI/bank to use POS data as credit underwriting

**We add for Africa:**
- M-Pesa till sweep: M-Pesa till receipts → auto-transferred to business wallet daily
- Cash flow forecast: 30-day forward cash flow based on historical patterns + upcoming reservations
- Chama/SACCO integration: auto-route configured % of daily profit to SACCO savings account
- This feature is the final form of the financial layer. In Kenya, banks don't lend to restaurant SMEs. Our POS data is the best credit score available for them.

---

#### 11.6 — Multi-Currency + Forex-Aware Pricing

**Source:** Nobody. Africa-original.

**Build:**
- Price items in KES. Accept payment in USD or EUR (common in tourist areas, Nairobi CBD international hotels).
- Real-time exchange rate from Central Bank of Kenya API
- Tax-compliant receipts in both currencies

**We add for Africa:**
- Forex alert: notify owner when exchange rate moves more than 2% since last price update
- Cross-border trading mode: KES/UGX/TZS pricing for merchants near Uganda or Tanzania borders
- AFCFTA readiness: architecture designed to support future unified African payment standards

---

#### 11.7 — USSD POS Mode (Feature Phone Support)

**Source:** Nobody. Africa-original.

**Build:**
Basic POS via USSD (*123# dial):
- Make a sale: enter items by code, enter customer phone for payment
- Check today's revenue total
- Add stock received
- Customer authorizes payment by dialing USSD

**Serves:** Mobile vendors, market stall traders, very remote locations with no smartphones. Plant the seed. These operators will move up to the full app as their business grows.

---

#### 11.8 — Additional Vertical Modules

**Repairs / Job Cards** (Source: NCR)
Customer drops off item. Job card: fault reported, diagnosis, parts needed, price estimate, technician assigned, ready date. Customer notified via WhatsApp at each stage. Payment on collection.
Serves: phone repair shops, electronics repair, tailors, cobblers — extremely common in Kenyan urban markets.

**Event Ticketing** (Source: KORONA POS)
Create events, sell tickets (GA + reserved + VIP), generate QR tickets, door scanner mode on handheld. Ticket revenue tracked separately from food/beverage.
Serves: comedy nights, church fundraisers, food festivals, sports events.

**Rental Management** (Source: NCR Counterpoint)
Items rented out: due date, customer details, security deposit, damage assessment, overdue alerts via WhatsApp.
Serves: event equipment rental (chairs, tents, sound systems), sports equipment, casual vehicle rental.

**Multi-Brand / Ghost Kitchen** (Source: specialized ghost kitchen software)
One kitchen, multiple virtual brands. Each brand: own KDS lane color, own delivery app presence, own reporting. All orders consolidated into one kitchen queue.

---

### DOMAIN 12: SWAHILI AND LOCAL LANGUAGE LAYER

#### 12.1 — Full Swahili UI

**Source:** Nobody. Gap in every global POS.

**Build:**
- Full POS interface in Swahili — every screen, every button, every error message
- Staff sets their preferred language on their profile
- POS displays in their language — same device, different staff, different language
- Receipts printed in customer's preferred language (Swahili or English)
- AI assistant understands and responds in Swahili
- WhatsApp notifications sent in Swahili if preference is set

**Market justification:** A staff member who thinks in Swahili works 30% faster in Swahili. "Void" means nothing to someone whose first language is Swahili. "Futa Agizo" (cancel order) does. This is not just localization — it reduces training time, reduces errors, and makes the product feel like it was built for them rather than translated for them.

**Phased:** Swahili (Month 12) → Yoruba → Hausa → Amharic (expansion)

---

## THE API-FIRST ARCHITECTURE

### Why API-First

API-first does not mean microservices. It means: **every piece of functionality is only accessible through its documented API contract**. Internal modules call the same API your mobile app calls. This means:

1. The POS app, the owner dashboard, the KDS, and a third-party integration all use the same endpoints
2. When you expose a developer API, you don't need to build anything new — you already have it
3. When a hotel wants to connect their PMS to room-charge capability, there is a clean API for that
4. When Bolt Food wants direct POS integration without Deliverect, there is an endpoint for that

This is what Revel proved: being API-first turns a POS into a platform. Platforms are worth 10× more than products.

### API Design Rules (Non-Negotiable)

```
1. Every response:  { data: ..., meta: { timestamp, request_id }, errors?: [...] }
2. Pagination:      cursor-based (?cursor=xxxx&limit=50) — no offset/page
3. Money:           always integer cents/cents-equivalent
                    { amount: 87500, currency: "KES" } — never floats
4. Timestamps:      ISO 8601 UTC always — "2026-06-24T12:34:56Z"
5. Errors:          RFC 7807 Problem Details
                    { type, title, detail, status, instance }
6. Rate limits:     60 req/min standard tier
                    600 req/min sync and webhook operations
7. Auth:            Bearer JWT
                    Scopes: pos:read pos:write reports:read admin:write
8. Idempotency:     All payment initiations require Idempotency-Key header
                    Retry-safe: same key = same response, no double-charge
9. Versioning:      /api/v1/ — breaking changes get a new version, old versions
                    deprecated with 12-month notice
10. Webhooks:       Signed with HMAC-SHA256
                    Retry with exponential backoff on 5xx
                    Delivered within 30 seconds of event
```

### Full API Contract

#### Authentication
```
POST   /auth/pin                   Staff PIN login at POS terminal
                                   Body: { device_id, pin, location_id }

POST   /auth/login                 Owner email/password login (dashboard)
                                   Body: { email, password }

POST   /auth/otp/send              Send WhatsApp OTP to phone number
                                   Body: { phone }

POST   /auth/otp/verify            Verify OTP, receive tokens
                                   Body: { phone, otp }

POST   /auth/refresh               Refresh JWT token pair
                                   Body: { refresh_token }

POST   /auth/logout                Invalidate current session
```

#### Orders
```
POST   /locations/{id}/orders      Create new order
GET    /locations/{id}/orders      List orders (cursor paginated, filterable)
GET    /orders/{id}                Order details with full item list
PATCH  /orders/{id}/status         Update order status (open/in-progress/ready/served)
POST   /orders/{id}/items          Add item to open order
PATCH  /orders/{id}/items/{itemId} Update item (quantity, modifiers, notes)
DELETE /orders/{id}/items/{itemId} Remove item from open order
POST   /orders/{id}/payments       Initiate payment on order
GET    /orders/{id}/payments       List payments on order
POST   /orders/{id}/void           Void entire order (manager permission + reason required)
POST   /orders/{id}/refund         Refund paid order (manager permission + reason required)
POST   /orders/{id}/transfer       Transfer order to different table
GET    /orders/{id}/audit          Full audit trail for this specific order
POST   /orders/{id}/receipt/send   Resend WhatsApp receipt to a phone number
```

#### Products
```
GET    /businesses/{id}/products          Full product catalog
POST   /businesses/{id}/products          Create product
GET    /products/{id}                     Product details with variants
PATCH  /products/{id}                     Update product
DELETE /products/{id}                     Soft-delete product (never permanently deleted)
POST   /products/{id}/variants            Add variant to product
PATCH  /products/{id}/variants/{varId}    Update variant
POST   /businesses/{id}/products/import   Bulk import via CSV
GET    /businesses/{id}/categories        Category tree
POST   /businesses/{id}/categories        Create category
```

#### Inventory
```
GET    /locations/{id}/stock              Current stock levels all products
GET    /locations/{id}/stock/alerts       Products below low-stock threshold
POST   /locations/{id}/stock/adjust       Manual stock adjustment (reason required)
POST   /locations/{id}/stock/receive      Goods receipt (PO fulfilled or ad-hoc)
POST   /locations/{id}/stock/transfer     Transfer stock to another location
GET    /locations/{id}/stock/forecast     ML demand forecast per SKU (7/14/30-day)
```

#### Payments
```
POST   /orders/{id}/payments/mpesa        Initiate M-Pesa STK Push
                                          Body: { phone, idempotency_key }
GET    /orders/{id}/payments/mpesa/status Check STK Push status
POST   /orders/{id}/payments/cash         Record cash payment
POST   /orders/{id}/payments/card         Initiate card payment via payment provider
POST   /orders/{id}/payments/loyalty      Redeem loyalty points
POST   /orders/{id}/payments/split        Split payment across multiple methods
POST   /payments/{id}/refund              Refund a specific payment
```

#### Webhooks (Inbound from Payment Providers)
```
POST   /webhooks/mpesa/{locationId}       Safaricom Daraja C2B callback
POST   /webhooks/mpesa/stk/{orderId}      Safaricom STK Push result callback
POST   /webhooks/flutterwave              Flutterwave payment callback
POST   /webhooks/paystack                 Paystack payment callback
POST   /webhooks/deliverect/order         Delivery platform new order
```

#### Customers
```
GET    /businesses/{id}/customers         Customer list (searchable, paginated)
POST   /businesses/{id}/customers         Create or upsert customer by phone number
GET    /customers/{id}                    Customer profile
GET    /customers/{id}/orders             Full order history
PATCH  /customers/{id}                    Update customer profile, tags, notes
POST   /customers/{id}/loyalty/adjust     Add or deduct loyalty points (with reason)
GET    /customers/{id}/loyalty/history    Points earn/redeem history
POST   /customers/{id}/credit/transaction Add to credit tab or record credit payment
GET    /customers/{id}/credit/statement   Full credit tab statement
POST   /customers/{id}/credit/statement/send  Send statement to customer via WhatsApp
```

#### Tables and Reservations
```
GET    /locations/{id}/tables             Floor plan with all table statuses
POST   /locations/{id}/tables             Create table
PATCH  /tables/{id}                       Update table (name, capacity, position)
DELETE /tables/{id}                       Remove table
PATCH  /tables/{id}/status                Update table status
POST   /tables/{id}/transfer              Transfer active order to another table
POST   /tables/{id}/merge                 Merge with another table

GET    /locations/{id}/reservations       List reservations by date range
POST   /locations/{id}/reservations       Create reservation
GET    /reservations/{id}                 Reservation details
PATCH  /reservations/{id}                 Update (confirm, seat, no-show, cancel)
GET    /locations/{id}/waitlist           Current walk-in waitlist
POST   /locations/{id}/waitlist           Add to waitlist
PATCH  /waitlist/{id}/seat                Mark as seated
```

#### Kitchen Display (WebSocket — not REST)
```
WS     /kds/{locationId}/{stationId}      Kitchen display WebSocket connection

— Server → Client events:
order.new          New ticket arrives at this station
order.update       Ticket modified (item added/removed, note changed)
item.status        Item marked started, ready, or bumped
rush.flag          Order flagged as rush/priority
order.cancel       Order voided — remove from display
station.pause      Manager paused incoming tickets

— Client → Server events:
item.bump          Staff marks item as complete
order.ready        All items complete, food runner can pick up
order.fire         Staff fires next course for a table
```

#### Staff
```
GET    /businesses/{id}/staff             Staff list with roles
POST   /businesses/{id}/staff/invite      Invite staff via WhatsApp
PATCH  /staff/{id}/role                   Change role (owner permission only)
PATCH  /staff/{id}/pin                    Change staff PIN (manager or owner)
DELETE /staff/{id}                        Deactivate staff account
POST   /staff/{id}/clockin                Clock in to shift
POST   /staff/{id}/clockout               Clock out of shift
GET    /locations/{id}/staff/clockins     Active clock-ins at location right now
GET    /staff/{id}/performance            Performance summary for period
```

#### Analytics
```
GET    /locations/{id}/analytics/today    Live today summary (cache: 60 seconds)
GET    /locations/{id}/analytics/sales    Sales with filters (from/to, category, method)
GET    /locations/{id}/analytics/hourly   Hourly heatmap for date range
GET    /locations/{id}/analytics/items    Item performance with profitability
GET    /locations/{id}/analytics/staff    Staff performance for period
GET    /businesses/{id}/analytics/weekly  Weekly report (all locations)
GET    /users/{id}/analytics/overview     Cross-business owner summary
GET    /businesses/{id}/analytics/benchmark  Competitive benchmarks (network threshold)
GET    /locations/{id}/analytics/forecast  ML revenue and demand forecast
```

#### Reports
```
POST   /businesses/{id}/reports/query     Natural language query → structured answer
                                          Body: { question, language: "en"|"sw" }
GET    /reports/{id}/pdf                  Download pre-generated report as PDF
POST   /businesses/{id}/reports/generate  Request report generation (async via job queue)
GET    /businesses/{id}/reports           List saved and scheduled reports
POST   /businesses/{id}/reports/schedule  Schedule recurring report delivery
```

#### Audit Log
```
GET    /businesses/{id}/audit             Full audit log (filterable, cursor paginated)
GET    /orders/{id}/audit                 Order-specific audit trail
GET    /staff/{id}/audit                  Audit trail filtered by staff member
POST   /businesses/{id}/audit/export      Request PDF export of audit log for period
```

#### Tax Compliance
```
POST   /locations/{id}/tax/zreport        Generate daily Z-report for KRA
GET    /locations/{id}/tax/zreports       List Z-reports
POST   /locations/{id}/tax/etims/submit   Submit receipts to eTIMS (auto-batched)
GET    /locations/{id}/tax/etims/status   eTIMS compliance status
```

#### Supplier and Purchase Orders
```
GET    /businesses/{id}/suppliers         Supplier list
POST   /businesses/{id}/suppliers         Create supplier
GET    /businesses/{id}/purchase-orders   List POs
POST   /businesses/{id}/purchase-orders   Create PO
PATCH  /purchase-orders/{id}              Update PO status
POST   /purchase-orders/{id}/receive      Receive goods against PO
```

#### Integrations
```
GET    /businesses/{id}/integrations      List connected integrations
POST   /integrations/mpesa/connect        Connect Daraja credentials
POST   /integrations/whatsapp/connect     Connect WhatsApp Business number
POST   /integrations/deliverect/connect   Connect Deliverect account
POST   /integrations/xero/connect         Connect Xero accounting
POST   /integrations/quickbooks/connect   Connect QuickBooks
POST   /integrations/kra-tims/connect     Connect KRA credentials
```

#### Developer API (Third-Party Integrations)
```
POST   /api/v1/orders                     Create order via API key
GET    /api/v1/orders/{id}                Read order
GET    /api/v1/products                   Read product catalog
POST   /api/v1/products                   Create product (with write scope)
GET    /api/v1/customers                  Read customer list
POST   /api/v1/customers                  Create or upsert customer
GET    /api/v1/analytics/summary          Read sales summary for period
POST   /api/v1/webhooks                   Register outbound webhook URL
DELETE /api/v1/webhooks/{id}              Deregister webhook
GET    /api/v1/webhooks                   List registered webhooks
```

#### Webhook Events (Outbound to Third-Party Integrations)
```
order.created          New order placed
order.paid             Order payment confirmed
order.voided           Order voided
order.refunded         Order refunded
payment.completed      Any payment completed (M-Pesa, cash, card)
payment.failed         Payment failed (M-Pesa timeout, card decline)
inventory.low_stock    Product below low-stock threshold
customer.created       New customer record created
customer.loyalty_tier  Customer changed loyalty tier
staff.clockin          Staff member clocked in
staff.clockout         Staff member clocked out
```

---

## WHAT MAKES US UNSTOPPABLE: THE COMPLETE MOAT

### Technical Moat

**1. Native M-Pesa Architecture**
We don't integrate M-Pesa. We are built around M-Pesa. The STK Push flow, the offline QR fallback, the automatic reconciliation, the end-of-shift M-Pesa statement matching — all of this is native. A global POS like Toast adding M-Pesa would be grafting a limb onto a body. For us it is the circulatory system.

**2. Offline-First for Load Shedding**
WatermelonDB writes everything locally first. The cloud is a background sync target. The POS has zero dependency on internet connectivity for its core operation. This is not "degraded offline mode" — it is full operation. When Kenya Power cuts from 5PM to 10PM, we are the only POS that keeps working.

**3. WhatsApp as the Operating System**
WhatsApp is what owners and customers in Kenya use to run their lives. We don't fight this. We lean into it. Every important event — receipt, alert, briefing, report, staff invite, supplier PO, customer statement — arrives via WhatsApp. We are the only POS where the primary communication channel between the system and its users is WhatsApp.

### Data Moat

**4. The Benchmarking Network**
When we have 1,000 merchants in Nairobi, we can tell every merchant exactly how their metrics compare to their peers — by restaurant type, by neighborhood, by price tier. This data does not exist. Lightspeed built their data moat on US/EU restaurants. Ours will be the first African restaurant benchmarking dataset in history. No one can replicate it without matching our merchant count.

**5. African ML Models**
Our demand forecasting ML knows Eid, Idd, Mashujaa Day, school-term patterns, Kenya Power scheduled outage patterns, and payday cycles. A US-trained model doesn't know these. Our models are trained on African time series data from day one.

### Compliance Moat

**6. KRA eTIMS Compliance**
We are built for compliance. Every receipt is eTIMS-compliant automatically. When Uganda EFRIS and Nigeria FIRS launch, we add them as adapters behind the same interface. This compliance layer is a feature no global POS can quickly replicate — it requires local legal expertise, API integration with tax authorities, and ongoing maintenance. It is also the feature that eliminates a competitor by making their non-compliance a liability.

### Product Moat

**7. The Oweame (Credit Tab)**
No global POS has a native customer credit tab feature. In African markets, trusted regulars buy on credit at restaurants, bars, and kiosks. This is not a workaround — it is a deeply embedded social and commercial pattern. Building it natively, with WhatsApp statements and credit risk tracking, is a feature that makes us irreplaceable to the operators who rely on this pattern.

**8. WhatsApp Commerce**
A customer ordering via WhatsApp, paying via M-Pesa STK Push from within the conversation, and receiving a WhatsApp receipt — without downloading an app — is a complete commercial transaction that feels native to how Kenyan consumers already operate. No global POS company has built this. We own it.

**9. AI in Swahili**
The morning briefing in Swahili. The natural language query that works in Swahili. The menu assistant that understands "ugali mbili" without configuration. This is not translation — it is understanding the language that millions of East Africans think in. A global company hiring Swahili NLP engineers to match this would take 2+ years.

---

## THE COMPLETE FEATURE MATRIX

| # | Feature | Source | Tier | Kenya Add |
|---|---------|--------|------|-----------|
| F-001 | Core POS Selling | Toast, Square | Launch | Photo lookup, Swahili names, bulk items |
| F-002 | Cash + Change Calculator | Universal | Launch | Denomination breakdown, short-change alert |
| F-003 | M-Pesa Native (STK + QR + Offline) | OURS | Launch | Core architecture, not a feature |
| F-004 | WhatsApp Receipt | OURS | Launch | Swahili, customer reply flows |
| F-005 | 72-Hour Offline Mode | TouchBistro, Erply | Launch | Load shedding mode, hotspot failover |
| F-006 | Product & Inventory | Square, Lightspeed | Launch | No-barcode, bulk/weight, photo search |
| F-007 | Staff Roles + PIN Login | Toast, MICROS | Launch | WhatsApp invite, remote PIN change |
| F-008 | Multi-Tenant Architecture | Revel, Erply | Launch | Cross-business consolidated view |
| F-009 | Live Owner Dashboard | Toast Now | Launch | WhatsApp delivery, payday alerts |
| F-010 | Audit Log | Oracle MICROS, NCR | Launch | AI anomaly alerts, one-tap investigation |
| F-011 | KRA eTIMS Compliance | OURS | Launch | Auto-compliant, no configuration |
| F-012 | Table Management + Floor Plan | Toast, TouchBistro | Month 3-4 | Ghost tables, color-coded alert states |
| F-013 | Kitchen Display System | Toast KDS, MICROS | Month 3-4 | AI cook time, cross-station coordination |
| F-014 | Customer Profiles + Loyalty | Toast, SpotOn | Month 4-5 | M-Pesa auto-capture, WhatsApp capture |
| F-015 | Customer Credit Tab (Oweame) | OURS | Month 4-5 | Africa-original, WhatsApp statement |
| F-016 | QR Table Ordering | Toast, Lightspeed | Month 3-4 | Group QR, WhatsApp alternative |
| F-017 | Split Bill | Toast | Month 3-4 | WhatsApp split link, M-Pesa per person |
| F-018 | Multi-Payment | Universal | Month 4-5 | Void vs. refund distinction |
| F-019 | Menu Engineering AI | Toast, Lightspeed | Month 3-4 | True cost axis, price simulator |
| F-020 | AI Natural Language Reports | Toast IQ | Month 4-5 | Swahili queries, WhatsApp delivery |
| F-021 | Server Mode (Handheld) | Toast Go 2 | Month 5-6 | Tableside M-Pesa STK Push |
| F-022 | Product Variants | Lightspeed, Shopify | Month 2-3 | Standard |
| F-023 | Layaway / Installment | NCR Counterpoint | Month 4-5 | WhatsApp payment reminders |
| F-024 | Purchase Orders + Suppliers | Lightspeed, NCR | Month 4-5 | Supplier WhatsApp, Mkopo credit tracking |
| F-025 | Reservations + Waitlist | Toast, TouchBistro | Month 3-4 | WhatsApp two-way, no-show tracking |
| F-026 | AI Morning Briefing (6AM WhatsApp) | Lavu Marty AI | Month 5-6 | Swahili, event awareness, reply-for-more |
| F-027 | Competitive Benchmarking | Lightspeed Benchmarks | Month 6+ | African market data, our moat |
| F-028 | Delivery Aggregator (Deliverect) | Toast Delivery | Month 5-6 | Commission cost tracking, throttling |
| F-029 | AI Personalized Loyalty | SpotOn | Month 9 | Reward type per customer |
| F-030 | WhatsApp Commerce (Full Ordering) | OURS | Month 7 | Swahili NLP, Sheng, M-Pesa in-chat |
| F-031 | AI P&L Analysis | SpotOn Profit Assist | Month 7 | Supplier invoice OCR, real-time shift P&L |
| F-032 | Multi-Brand / Ghost Kitchen | Specialized software | Month 5-6 | Brand performance comparison |
| F-033 | Self-Ordering Kiosk | McDonald's, Toast | Month 5-6 | Photo-first, A/B upsell, M-Pesa payment |
| F-034 | Time-Based Menu Switching | TouchBistro | Month 3-4 | Ramadan mode, 86 list across channels |
| F-035 | Franchise + Chain Management | Erply, NCR | Month 10 | Branch compliance scoring |
| F-036 | AI Voice Ordering (WhatsApp) | HungerRush, Square | Month 9 | Swahili voice, Sheng understanding |
| F-037 | No-Code Automation Rules | Shopify Flow | Month 8 | Africa-specific templates |
| F-038 | Integrated Financial Services | Square Banking | Month 12 | M-Pesa sweep, Chama/SACCO integration |
| F-039 | Repairs / Job Cards | NCR Counterpoint | Month 10 | WhatsApp status updates |
| F-040 | Event Ticketing | KORONA POS | Month 11 | QR ticket + M-Pesa sales in same system |
| F-041 | Multi-Currency + Forex | OURS | Month 11 | Border trading, CBK exchange rate API |
| F-042 | Swahili Full UI | OURS | Month 12 | Staff language preference per user |
| F-043 | USSD POS Mode | OURS | Month 12 | Feature phone support |
| F-044 | Rental Management | NCR Counterpoint | Month 11 | WhatsApp overdue alerts |
| F-045 | Price Books (Multiple Tiers) | Lightspeed Retail | Month 6 | NGO/bulk buyer tier |
| F-046 | Online Ordering Page | Toast Online | Month 8 | WhatsApp link sharing, Google Food |
| F-047 | Sentiment + Review Intelligence | SpotOn (partial) | Month 8 | QR dish feedback correlation |

---

## THE DONE DEFINITION

A feature is not complete unless all 7 conditions are met:

**1. Works on a KES 12,000 Android phone on a 2G connection**
Not just on a MacBook with fibre. Test on the cheapest device available. If it doesn't work there, it doesn't ship.

**2. Works offline — or degrades gracefully with a visible offline badge**
"It needs internet" is not acceptable for any Tier 1 feature. Tier 2 features must degrade gracefully with clear UI feedback.

**3. A merchant with no training completes the task in under 60 seconds**
Tested on an actual restaurant operator, not an engineer. If they struggle, redesign. Time yourself watching them, not time you think it should take.

**4. The feature has a WhatsApp notification path**
If something important happens, the owner receives a WhatsApp message. The POS is push-by-default. Dashboard is for when they want more detail.

**5. Every significant action generates an audit log entry**
Who. What changed (old → new JSON). Why (mandatory reason for destructive actions). When. Where (device + IP). No exceptions.

**6. The API endpoint is documented in OpenAPI format with request/response examples**
If it's not documented, it doesn't exist as far as third-party integrators are concerned.

**7. Failure states are designed — not just the happy path**
What happens when M-Pesa STK Push times out? When the KDS goes offline mid-service? When the receipt printer runs out of paper? When the eTIMS server is unreachable? Design the failure. Not just the success.

---

## WHAT WE EXPLICITLY DO NOT BUILD

| Skipped Feature | Why | What We Tell Merchants |
|---|---|---|
| Full accounting / bookkeeping | Xero and QuickBooks are 20 years ahead of us | We sync to them via API |
| Payroll engine | Per-country legal complexity | Integrate with Workpay (Kenyan HR SaaS) |
| Full HR management | Out of scope | Integrate with Workpay |
| E-commerce store builder | Shopify is $100B for a reason | Integrate via Shopify API |
| Full hotel PMS | Enterprise specialist product | Expose room-charge API for hotel integrations |
| Social media management | Not our domain | Never |
| Website builder | Not our domain | Never |
| Crypto/Bitcoin payments | Low African adoption, regulatory unclear | Maybe in 5 years |
| Custom app white-labeling | Complex, low demand | Enterprise tier only |
| Full dark kitchen suite | Start with multi-brand (F-032), expand | Phased |
| Advanced franchise portal | Build HQ control first | Phased into franchise module |

---

*Document version: 1.0 — June 2026*
*Status: Product specification. All feature decisions are made. Build in the order defined in 18-build-order-and-technical-decisions.md.*
*North Star: Revenue processed through the platform per month (GMV). Merchant 90-day retention target: 80%+.*
