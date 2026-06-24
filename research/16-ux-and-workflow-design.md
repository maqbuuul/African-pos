# UX & Workflow Design — Simplicity as a Feature

> The best POS is the one your most exhausted, most distracted staff member can use correctly under pressure at 8pm on a Saturday. Design for that person, and you design for everyone.

---

## The Fundamental UX Problem

Every POS company thinks the problem is "too few features." The real problem is **too many decisions**.

Every time a staff member has to think — "which button do I press?" — they slow down, make mistakes, or skip the step entirely. The goal is to eliminate decisions, not add features.

**Decision cost in a restaurant:**
- Cashier hesitates 3 seconds on every transaction
- 200 transactions/day × 3 seconds = 10 extra minutes lost
- 10 minutes × 6 days/week × 52 weeks = 52 hours/year lost to bad UX

That is a measurable business cost. Design eliminates it.

---

## Design Principles

### Principle 1: One Tap to the Most Common Action
The most frequent action on any screen should require exactly **one tap** from wherever the user is.

| User | Most common action | Steps to get there |
|------|-------------------|--------------------|
| Cashier | Add item to order | 1 tap (search or category) |
| Server | Send order to kitchen | 1 tap |
| Manager | Check today's sales | 1 tap (home screen) |
| Owner | See revenue across all businesses | 1 tap (home screen) |
| Stockroom | Mark item received | 2 taps max |

If any of these take more taps, redesign.

### Principle 2: Progressive Disclosure
Show the minimum needed. Reveal more only if asked.

```
BAD:  Show all 15 order options on one screen
GOOD: Show the 5 most relevant, "+ more options" if needed

BAD:  Settings screen with 40 items
GOOD: 6 settings categories, each expanding to sub-settings

BAD:  Product form with 20 fields
GOOD: Name + price required. Everything else is optional, collapsed.
```

### Principle 3: Confirmation for Destructive Actions Only
Ask "Are you sure?" only for actions that cannot be undone.

```
CONFIRM REQUIRED:    Delete item, cancel order, void payment
NO CONFIRM NEEDED:   Add item, change quantity, apply discount

The confirmation dialog must:
  - State exactly what will be deleted/cancelled
  - Show the consequence ("Order #1842 · KSh 14,200 will be cancelled")
  - Require manager PIN for high-value actions (configurable threshold)
```

### Principle 4: Error Prevention Over Error Recovery
Design so mistakes can't be made, rather than recovering after they happen.

```
PREVENTION examples:
  • Can't submit an order with zero items
  • Can't ring a price higher than KSh 999,999 (catches digit errors)
  • Payment amount auto-fills from order total
  • Cash given field auto-calculates change
  • Staff clock-in shows their name + photo before confirming (prevent wrong PIN)

RECOVERY examples (when prevention fails):
  • Void item button always visible to manager (never buried)
  • Last 5 transactions always accessible without opening reports
  • Offline transactions clearly marked — easy to review on reconnect
```

### Principle 5: Speed in the Critical Path
The critical path is: open order → add items → process payment → receipt.

Anything not in the critical path can be slow (settings, reports, configurations). The critical path must be fast on every device, including a low-end Android phone on 2G.

```
Performance targets:
  App launch → ready to sell:          < 3 seconds
  Item search response:                < 200ms
  Add item to cart:                    < 100ms (instant)
  Payment screen load:                 < 500ms
  Receipt generation:                  < 1 second
  Full sync after 1 hour offline:      < 10 seconds
```

---

## Navigation Structure

### Mobile Bottom Navigation (5 Tabs Max)

```
┌─────────────────────────────────────────────┐
│                                             │
│               CONTENT AREA                 │
│                                             │
├────────┬────────┬────────┬────────┬────────┤
│  🏠    │  🛒    │  📊    │  📦    │  ···   │
│  Home  │  POS   │  Sales │  Stock │  More  │
└────────┴────────┴────────┴────────┴────────┘
```

- **Home**: Today at a glance (manager/owner)
- **POS**: The selling interface (cashier/server)
- **Sales**: Reports and analytics
- **Stock**: Inventory management
- **More**: Staff, customers, settings, reports

Staff who only have POS access see: **[POS]** only.

### "More" screen (overflow)

```
┌─────────────────────────────────────────────┐
│ ← More                                      │
├─────────────────────────────────────────────┤
│  👥  Customers                          →   │
│  🧑‍🍳  Staff & Schedules                  →   │
│  📋  Reports                            →   │
│  ⚙️  Settings                           →   │
│  💳  Payments & Billing                 →   │
│  ❓  Help & Support                     →   │
│  🔔  Notifications                      →   │
│                                             │
│  ── Branch: Westlands ─────────────────     │
│  [Switch branch]                            │
└─────────────────────────────────────────────┘
```

No nested menus beyond 2 levels. Ever.

---

## POS Terminal — The Selling Interface

This is the screen cashiers and servers look at all day. It must be perfect.

### Restaurant POS Layout (Tablet/Terminal)

```
┌───────────────────────────────────────────────────────────────┐
│  Table 4 · James     [New Order]  [Tables]  [🔍]   12:34pm   │
├───────────────────────────────────────┬───────────────────────┤
│  MENU                                 │  CURRENT ORDER        │
│                                       │                        │
│  🔍  Search menu...                   │  Nyama Choma     x1   │
│                                       │  + Extra salad        │
│  [Starters]  [Mains]  [Drinks]       │  KSh 1,200            │
│  [Specials]  [Dessert]               │                        │
│                                       │  Pilau (half)    x2   │
│  ┌──────────┐  ┌──────────┐          │  KSh 1,600            │
│  │Nyama     │  │  Pilau   │          │                        │
│  │ Choma    │  │          │          │  ─────────────────     │
│  │ KSh 1200 │  │ KSh 800  │          │  Subtotal   KSh 2,800  │
│  └──────────┘  └──────────┘          │  VAT 16%    KSh 448   │
│  ┌──────────┐  ┌──────────┐          │  Total      KSh 3,248  │
│  │  Ugali   │  │ Chapati  │          │                        │
│  │          │  │          │          │  [Discount]  [Note]   │
│  │  KSh 100 │  │ KSh 80   │          │                        │
│  └──────────┘  └──────────┘          │  [Send to kitchen]    │
│  ┌──────────┐  ┌──────────┐          │  [Charge KSh 3,248]   │
│  │  Tilapia │  │  Chicken │          │                        │
│  │          │  │          │          │                        │
│  │ KSh 1400 │  │ KSh 1100 │          │                        │
│  └──────────┘  └──────────┘          │                        │
└───────────────────────────────────────┴───────────────────────┘
```

**Key decisions:**
- Menu on the left, order on the right — mirror of mental model (choose → see result)
- Product images mandatory — African POS users often have mixed literacy levels
- Big tap targets (minimum 80×80px per item)
- Item name + price is all that's shown (not SKU, not description)
- "Send to kitchen" and "Charge" are the two most visible buttons

### Quick Items (Retail Counter)

For retail or fast QSR — no table, no courses, just scan or tap:

```
┌─────────────────────────────────────────────┐
│  [🔍 Scan barcode]  ≡  James  12:34pm       │
├─────────────────────────────────────────────┤
│  🔍  Search or scan...                      │
├──────────────────────────────────────────┤  │
│  ┌────────┐  ┌────────┐  ┌────────┐      │  │
│  │ Bread  │  │  Milk  │  │ Sugar  │  ... │  │
│  │KSh 60  │  │KSh 120 │  │KSh 250 │      │  │
│  └────────┘  └────────┘  └────────┘      │  │
│  (Quick items — most sold today)          │  │
├──────────────────────────────────────────┴──┤
│  BASKET                             3 items │
│  Bread ×1   KSh 60                   🗑️    │
│  Milk  ×2   KSh 240                  🗑️    │
│  Sugar ×1   KSh 250                  🗑️    │
│                                             │
│  Total:   KSh 550                          │
│                                             │
│  [💰 Cash]   [📱 M-Pesa]   [💳 Card]       │
└─────────────────────────────────────────────┘
```

Three payment buttons always visible. No dropdown. Tap M-Pesa → STK push sent immediately.

### Payment Flow

```
Tap [📱 M-Pesa]
        ↓
┌─────────────────────────────────────────────┐
│  M-Pesa Payment                             │
│                                             │
│  Amount: KSh 550                           │
│                                             │
│  Enter customer phone:                      │
│  ┌─────────────────────────────────────┐   │
│  │  +254 │ 0712 345 678               │   │
│  └─────────────────────────────────────┘   │
│                                             │
│  Or: [📷 Scan QR code]                     │
│      [🔍 Search by name/loyalty]           │
│                                             │
│  [Send STK Push]                            │
└─────────────────────────────────────────────┘
        ↓
┌─────────────────────────────────────────────┐
│  ⏳ Waiting for payment...                  │
│                                             │
│  KSh 550 · Mama's Kitchen                  │
│  M-Pesa prompt sent to +254 0712 345 678   │
│                                             │
│  ████████░░  Customer completing payment    │
│                                             │
│  [Cancel]                                   │
└─────────────────────────────────────────────┘
        ↓ (on M-Pesa confirmation callback)
┌─────────────────────────────────────────────┐
│  ✅ Payment Complete                        │
│                                             │
│  KSh 550 paid via M-Pesa                   │
│  Ref: RKH7JX8901                           │
│                                             │
│  [🖨️ Print receipt]                        │
│  [📱 Send to WhatsApp]   ← default         │
│  [Skip receipt]                             │
└─────────────────────────────────────────────┘
```

Total time from "Send STK Push" to receipt: typically 8-15 seconds. No staff action needed during wait — they can prep the receipt, bag the order, etc.

---

## Workflows — Step by Step

### Workflow 1: Add a New Product (Retail)

Target: under 60 seconds for basic product.

```
1. Tap [+ Add Product] on inventory screen
2. Screen shows minimal form:

   ┌───────────────────────────────────────┐
   │  Product name  [________________]     │
   │  Selling price [________________]     │
   │  Category      [Select ▼]            │
   │                                       │
   │  ── Optional (tap to expand) ──────   │
   │  ▸ Barcode                           │
   │  ▸ Cost price (for margin tracking)  │
   │  ▸ Starting stock quantity           │
   │  ▸ Stock alert threshold             │
   │  ▸ Photo                             │
   │                                       │
   │       [Save product]                  │
   └───────────────────────────────────────┘

3. Tap Save → product appears in inventory + POS immediately
4. Barcode scanner prompt: "Scan barcode to link it to this product?"
   (Optional — skip to dismiss)
```

Required fields: 2. Everything else optional.

### Workflow 2: Add a New Menu Item (Restaurant)

```
1. Settings → Menu → [+ Add item]
2. Minimal form (same pattern):

   Name:     [Nyama Choma         ]
   Price:    [KSh 1,200           ]
   Category: [Mains ▼             ]

   ▸ Description
   ▸ Cost (for margin tracking)
   ▸ Photo
   ▸ Modifiers (add-ons, removals)
   ▸ Available times (breakfast/lunch/dinner)
   ▸ Link to inventory items (for deduction)

3. Save → live on POS in all locations immediately
```

### Workflow 3: Add a New Staff Member

```
1. Settings → Staff → [+ Add staff]
2. Form:
   Name:          [Grace Njeri     ]
   Phone:         [+254 ...        ]
   Role:          [Cashier ▼       ]
   Branch:        [Westlands ▼     ]

3. Tap [Send invitation]
   → WhatsApp sent to Grace with PIN + app link
   → Grace appears in staff list as "Invited"
   → Once she logs in: "Active"

Total manager time: < 60 seconds
```

### Workflow 4: End of Day

Manager should be able to close the day in under 3 minutes.

```
Step 1: Cash count
   System shows: expected cash KSh 13,113
   Manager counts: [KSh 12,900    ]
   Variance: KSh 213 short
   Note: [Broke change for customer, KSh 200]
   [Confirm close]

Step 2: Auto-generated summary shown
   Revenue: KSh 42,300
   Orders: 148
   Cash variance: KSh 213 (explained)
   
   [Send to WhatsApp] [Print Z-report] [Done]

Step 3: Reports sent automatically
   Owner WhatsApp: Daily summary
   Manager phone: Z-report PDF
```

### Workflow 5: Receive Stock (Purchase Order)

```
From inventory screen:
1. Tap stock item → [Receive stock]
2. Enter quantity received: [20 bags]
3. Confirm supplier (or choose new): [Nairobi Wholesalers]
4. Price paid (optional, for cost tracking): [KSh 36,000]
5. [Confirm received]
   → Inventory updated immediately
   → If PO existed: PO marked received
   → Cost average updated for margin calculations
```

---

## Onboarding Flow (First-Time User)

The goal: merchant makes their first sale within 10 minutes of signing up.

```
Time 0:00  → Sign up (name + phone OTP)
Time 0:30  → Business name + type + country
Time 1:00  → First branch name
Time 1:30  → "You're in! Let's add your first product →"

  ┌─────────────────────────────────────────┐
  │  🎉 Welcome to [POS Name], Grace!       │
  │                                         │
  │  Your account is ready.                 │
  │  Let's set up your first product.       │
  │                                         │
  │  What do you sell?                      │
  │  ┌────────────────────────────────────┐ │
  │  │ Product name  [Chapati           ] │ │
  │  │ Price         [KSh 40            ] │ │
  │  └────────────────────────────────────┘ │
  │                                         │
  │  [Add this product →]                   │
  │  or [Skip and browse template menus]    │
  └─────────────────────────────────────────┘

Time 2:30  → First product added
Time 2:30  → "Try making a sale" prompt
Time 3:00  → First order created (test mode)
Time 4:00  → "Set up M-Pesa to accept payments" prompt
Time 6:00  → M-Pesa configured (paybill/till entered)
Time 8:00  → M-Pesa test transaction (KSh 1 to themselves)
Time 10:00 → Ready for real transactions
```

Progress indicator during onboarding:
```
[✓] Account created
[✓] First business added
[✓] First product added
[ ] Accept your first payment ← you are here
[ ] Invite your first staff member
```

5 steps. Not 15. Not "complete your profile 45%" like LinkedIn.

---

## Template Menus (Africa-Specific)

Instead of starting from scratch, merchant chooses a template:

```
"What kind of restaurant are you?"

┌──────────┐  ┌──────────┐  ┌──────────┐
│🍳 Fast   │  │🪑 Sit-   │  │☕ Café / │
│  Food /  │  │  down    │  │  Coffee  │
│  Nyama   │  │  Restaurant│  │  Shop   │
└──────────┘  └──────────┘  └──────────┘
┌──────────┐  ┌──────────┐  ┌──────────┐
│🍕 Pizza/ │  │🍺 Bar /  │  │🏠 Home  │
│  Chips   │  │  Lounge  │  │  Kitchen │
└──────────┘  └──────────┘  └──────────┘
```

Selecting "Fast Food / Nyama" loads a pre-built menu:
```
Loaded: 24 items across 4 categories
  Proteins: Nyama Choma, Chicken, Tilapia
  Starch: Ugali, Chapati, Rice, Chips
  Sides: Kachumbari, Avocado
  Drinks: Soda, Water, Juice
  
Prices are pre-set to Nairobi average market rates.
Edit any item to match your actual prices.
```

**This reduces setup time from 2 hours to 5 minutes.** It also teaches new businesses what items restaurants of their type typically sell — a soft business advisory.

---

## Empty States (Not Empty Pages)

Empty states are opportunities, not blank screens.

```
No orders today:
┌─────────────────────────────────────────────┐
│                                             │
│           🛒                                │
│                                             │
│      No orders yet today                   │
│                                             │
│  Your first order will show up here.        │
│  Ready to sell?                             │
│                                             │
│  [Go to POS →]                              │
│                                             │
└─────────────────────────────────────────────┘

No customers:
┌─────────────────────────────────────────────┐
│           👥                                │
│                                             │
│      No customers yet                       │
│                                             │
│  Customers are added automatically when     │
│  they provide their phone number at         │
│  checkout, or scan a QR code to join.       │
│                                             │
│  [Share loyalty sign-up link]               │
└─────────────────────────────────────────────┘
```

Every empty state has: explanation of why it's empty + what to do next.

---

## Error Messages (Human, Not Technical)

```
BAD:  "Error 422: Validation failed on field 'phone_number'"
GOOD: "That phone number doesn't look right. Try: 0712 345 678"

BAD:  "500 Internal Server Error"
GOOD: "Something went wrong on our side. Your order is safe — tap Retry."

BAD:  "M-Pesa API returned error code 1032"
GOOD: "The customer's M-Pesa may have timed out. Ask them to try again."

BAD:  "Insufficient permissions"
GOOD: "Only managers can process refunds. Ask James to approve this."
```

Rule: every error message must tell the user what happened AND what to do next. A message that only says what went wrong is 50% of an error message.
