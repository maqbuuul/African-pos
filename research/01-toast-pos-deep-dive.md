# Toast POS — Deep Dive

> **"The Restaurant Operating System"**
> Founded: 2012, Boston, MA | IPO: 2021 (NYSE: TOST) | ARR: $1.1B+ | Merchants: 127,000+

---

## Why Toast Won the Restaurant Market

Toast is the clearest success story of vertical SaaS done right. They went all-in on restaurants — never retail — and built every layer of the stack themselves: hardware, software, payments, payroll, scheduling, and marketing. Merchants pay more per transaction but get a platform that genuinely understands restaurant operations.

---

## Core Product Suite

### 1. Point of Sale (Core)
- iPad-based (but Toast-ruggedized, splash-resistant, built for kitchen heat)
- **Counter service mode** and **full-service table mode** in same system
- Split bills by seat, item, percentage, or custom amount
- **Pre-auth tabs** for bars (open tabs without repeated card swipes)
- Offline mode — full functionality without internet (syncs on reconnect)
- Receipt options: print, text, email, or none
- **Dual-sided customer display** — shows order, customizations, loyalty balance

### 2. Toast Go (Handheld)
- Purpose-built handheld for tableside ordering and payment
- 4G LTE + Wi-Fi — works even if venue Wi-Fi drops
- IP54 splash resistant, 10-hour battery
- **Tableside payments** eliminate the "check walk" — reduces table turn time
- Servers can send orders to kitchen from anywhere in venue
- **"Pay at table" in 60 seconds** — no more waiting for check

### 3. Kitchen Display System (KDS)
- Replace paper tickets with real-time digital display
- Color-coded by timing (green → yellow → red as time passes)
- **Recall and bump** — servers can check if an item was made
- Multiple KDS routing — drinks to bar, food to kitchen, desserts to pastry
- **"Smart routing"** — automatically sends to correct station based on item type
- Expo screen for food runners — shows what's ready, what's waiting
- **Average ticket time tracking** — gamify kitchen speed

### 4. Toast Online Ordering
- Commission-free (unlike UberEats/DoorDash)
- **Branded ordering page** — your domain, your logo, your colors
- Pre-orders for future dates/times
- **Pickup + delivery** on same platform
- **Order throttling** — limit orders per 15-minute window during rush
- Integration with Google Food Ordering (order directly from Google search)
- **Social media ordering** — order link for Instagram bio

### 5. Toast Delivery Services
- In-house delivery management OR
- Marketplace delivery dispatch (connects to DoorDash Drive, etc.)
- **Driver tracking** for customers
- Delivery zone mapping
- Delivery fee and tip management

### 6. Toast Tables (Reservations)
- Waitlist management with SMS notifications
- Table management — drag-and-drop floor plan
- **Turn time predictions** — AI estimates how long each table will take
- Integration with Google Reserve

### 7. Toast Payroll & Team Management
- Full payroll built in (not third-party)
- **Tip pooling automation** — by hours, by sales, by custom rules
- Schedule builder with labor cost forecasting
- **Overtime alerts** before they happen
- Employee self-onboarding
- **Labor vs. sales** overlay in real-time dashboard

### 8. Toast Marketing & Loyalty
- **Toast Loyalty** — points or visit-based programs
- Automated email marketing triggered by behavior
- **"Win back" campaigns** — automatic email to customers who haven't visited in X days
- Gift card program (physical + digital)
- **Customer data ownership** — unlike delivery apps, Toast gives you the customer data

### 9. Toast Reporting & Analytics
- Real-time sales dashboard from any device
- **Menu engineering report** — profitability vs. popularity matrix (BCG-style)
- Labor cost as % of sales in real time
- **Predictive analytics** — forecasts next week's sales based on history + weather + events
- Custom report builder
- **Export to accounting** (QuickBooks, Xero integration)

---

## Toast's "Wow Factors" — What to Steal

### Wow Factor #1: The "Restaurant Operating System" Positioning
Toast doesn't sell a POS — they sell an OS for your restaurant. Everything connects: if you hire an employee in Payroll, they're automatically in the scheduling system. If they clock in, their hours flow to payroll. If they take an order, their tips are auto-calculated. **One system, zero data re-entry.**

### Wow Factor #2: Offline-First Architecture
Toast's offline mode is industry-leading. If your internet goes down:
- You can still take orders
- You can still process cards (stored and forwarded)
- You can still print
- Everything syncs the second connectivity returns
- **No one notices the internet went down**

### Wow Factor #3: Toast Capital
Merchant cash advances funded by Toast's transaction data. If your restaurant does $50K/month through Toast, Toast can offer you a $25K advance, repaid as a small % of daily sales. No application, no bank, instant approval. **This is worth millions in merchant loyalty.**

### Wow Factor #4: Menu Engineering Report
Toast's menu engineering tool places every menu item on a 2x2 matrix:
- **Stars** = high profit + high popularity → promote these
- **Plowhorses** = high popularity + low profit → reprice or reduce portion
- **Puzzles** = high profit + low popularity → needs marketing
- **Dogs** = low profit + low popularity → consider removing
This kind of insight is what a restaurant consultant charges $10,000 for.

### Wow Factor #5: Toast Now (Real-Time Mobile App)
Owners/managers see live sales, live labor cost %, live ticket times on their phone. They get an alert if a server hasn't taken a table in 15 minutes, if the kitchen is backing up, or if an hourly employee is approaching overtime. **Management from anywhere.**

### Wow Factor #6: Split Check UX
The most hated part of dining out — splitting the check — Toast makes genuinely fast:
- Split by seat (most common request)
- Split by item
- Split equally N ways
- Send each person their own payment link via text
- Each person pays on their own phone with Apple Pay/Google Pay
**Result: parties of 10 pay in 2 minutes instead of 10.**

### Wow Factor #7: Order & Pay (QR Code)
Guests scan QR code on table → see full menu → order → pay → done. No server needed for the transactional parts. Servers become **hospitality providers** not order-takers. Staffing required drops 30-40% in some venues.

---

## Toast Pricing Model

| Plan | Monthly Cost | Transaction Fee |
|------|-------------|-----------------|
| Starter | $0 | 3.09% + $0.15 |
| Point of Sale | $69/location | 2.49% + $0.15 |
| Build Your Own | $110+ | 2.49% + $0.15 |

Hardware sold or leased. Toast locks you into their payment processing — cannot use third-party processors.

---

## Toast Hardware Ecosystem

| Device | Purpose | Price |
|--------|---------|-------|
| Toast Flex (15") | Main terminal | ~$627 |
| Toast Flex for Guest | Customer-facing display | ~$355 |
| Toast Go 2 | Handheld server tablet | ~$409 |
| Toast Kiosk | Self-ordering kiosk | ~$799+ |
| Toast KDS | Kitchen display | ~$627 |
| Toast Hub | Network hub/router | ~$95 |

---

## Toast Integrations (Top Picks)

- **Reservations**: OpenTable, Resy, Yelp
- **Delivery**: DoorDash, Uber Eats, Grubhub (via middleware)
- **Accounting**: QuickBooks, Xero, Restaurant365
- **Inventory**: BlueCart, Craftable, MarketMan
- **HR/Scheduling**: 7shifts, HotSchedules
- **Loyalty**: Paytronix (when Toast Loyalty isn't enough)

---

## Toast Weaknesses (Attack Points)

1. **Payment processing lock-in** — you MUST use Toast Payments. No choice.
2. **Expensive hardware** — proprietary, can't use third-party tablets
3. **US-only focus** — limited international presence
4. **Contract lock-in** — early termination fees
5. **Customer support** — historically poor, now improving
6. **Complex pricing** — add-ons stack up fast
7. **No retail mode** — purely restaurant, no hybrid

---

## Key Metric: What Toast Knows About Your Restaurant

Toast collects and analyzes:
- Every transaction ever made
- Time of day patterns
- Weather correlation with sales
- Server performance (sales per hour, tips per table)
- Kitchen efficiency (time from order to bump)
- Menu item performance over time
- Customer return rate
- Peak vs. slow period patterns

**This data is the moat.** Toast knows your restaurant better than you do.
