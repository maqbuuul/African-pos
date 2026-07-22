# Automated Reporting System — Reports That Come to You

> Nobody opens a dashboard to check on their business at 2am. But a WhatsApp message at 9pm saying "Great day — KSh 52,000" takes 3 seconds to read and tells you everything. Build reports that arrive, not reports you have to fetch.

---

## Core Principle: Push, Don't Pull

Global leaders send reports by email. Email open rates for business reports: under 25%. Most owners never read them.

**WhatsApp open rate: 98%.**

Every automated report goes to WhatsApp first, email second (optional). This is not a nice-to-have — it is the foundation of the reporting system.

---

## The Report Hierarchy

```
REAL-TIME ALERTS        → Immediate WhatsApp (triggered by event)
DAILY SUMMARY           → WhatsApp every evening
WEEKLY INTELLIGENCE     → WhatsApp + rich PDF, Sunday evening
MONTHLY REPORT          → WhatsApp + full PDF, 1st of month
CUSTOM REPORTS          → On-demand, generated in app or scheduled
```

---

## 1. Real-Time Alerts (Event-Triggered)

These fire immediately when something happens. They are **never batched** — they arrive the moment the trigger fires.

### Alert: Large Order
```
Trigger: Single transaction > 3× average order value

WhatsApp message:
━━━━━━━━━━━━━━━━━━━━
⚡ Large Order Alert
━━━━━━━━━━━━━━━━━━━━
Mama's Kitchen · Westlands
Just now · Cashier: Grace N.

Order #1842: KSh 48,200
(Your average: KSh 286)

Items:
• Nyama Choma × 12 — KSh 28,800
• Pilau × 8 — KSh 14,400
• Sodas × 20 — KSh 5,000

Payment: M-Pesa ✅

Looks like a catering order — everything OK?
Reply OK to confirm, or QUERY to flag for review.
━━━━━━━━━━━━━━━━━━━━
```

Two-way: owner can reply. "QUERY" flags the order for manager review. This is something no POS does — **WhatsApp as a command interface**.

### Alert: Stock Critical
```
Trigger: ML model predicts stockout today or tomorrow

WhatsApp:
━━━━━━━━━━━━━━━━━━━━
🔴 Stock Alert · Westlands Branch
━━━━━━━━━━━━━━━━━━━━
2 items need restocking TODAY:

1. Rice (5kg bags)
   In stock: 3 bags · Runs out: ~2pm today
   Usual supplier: Nairobi Wholesalers
   Last order: KSh 1,800 for 20 bags

2. Cooking Oil (5L)
   In stock: 2 bottles · Runs out: tomorrow
   Usual supplier: Nakumatt Wholesale

Reply ORDER to send a WhatsApp message to
your suppliers, or tap the link to manage:
[stock.yourpos.com/reorder/xxxx]
━━━━━━━━━━━━━━━━━━━━
```

### Alert: Void Spike
```
Trigger: Voids in last 2 hours exceed 5% of revenue

WhatsApp:
━━━━━━━━━━━━━━━━━━━━
⚠️ Unusual Activity · Westlands
━━━━━━━━━━━━━━━━━━━━
4 voids in the last 2 hours totalling KSh 3,200
(Your usual rate: < KSh 400 per 2 hours)

Voided by: David K. (3) and James O. (1)

This might be normal — or worth checking.
[See void log →]
━━━━━━━━━━━━━━━━━━━━
```

### Alert: Revenue Milestone
```
Trigger: Daily revenue crosses a personal best or round number

WhatsApp:
🎉 New Record! Mama's Kitchen · Westlands
KSh 78,400 today — your best Tuesday ever!
Previous record: KSh 71,200 (last month)
```

Short. Celebratory. No action needed — just acknowledgement. These build relationship with the product.

---

## 2. Daily Summary (Every Evening)

**Delivery time**: 30 minutes after the branch closes, or 9:30 PM if no close time set.
**Format**: WhatsApp message (text, no PDF)
**Length**: Fits in one WhatsApp screen — no scrolling

```
━━━━━━━━━━━━━━━━━━━━━━━━━
📊 Daily Summary · Tuesday 24 Jun
Mama's Kitchen · Westlands
━━━━━━━━━━━━━━━━━━━━━━━━━

Revenue:      KSh 42,300  ↑12% vs last Tue
Orders:       148          Avg: KSh 286
Customers:    129          (19 new)
Peak hour:    1pm — KSh 8,200

Payment breakdown:
  M-Pesa   62%  KSh 26,226
  Cash     31%  KSh 13,113
  Card      7%  KSh 2,961

Best item:    Nyama Choma (21 sold, KSh 8,400)
Best server:  Grace N. (KSh 14,200 in sales)

Staff:        5 worked · 0 absences
Voids:        KSh 400 (normal)

── Inventory ────────────────────
🔴 Rice — order today
🟡 Cooking Oil — order by Thursday

── Tomorrow ────────────────────
Wednesday forecast: ~KSh 38,000
(Usually slower mid-week)
Scheduled staff: 4

Good work today! 💪
━━━━━━━━━━━━━━━━━━━━━━━━━
```

**Strict rules:**
- No charts in WhatsApp message (not rendered on all devices)
- Arrows for trend (↑↓) instead of percentages everywhere
- Inventory section only if there are alerts — not shown if all OK
- Tone is warm and human, not robotic

---

## 3. Weekly Intelligence Report (Every Sunday)

**Delivery time**: Sunday at 7 PM
**Format**: WhatsApp summary + link to view full PDF
**Length**: WhatsApp is one screen. PDF is 2 pages.

### WhatsApp Message (Sunday)
```
━━━━━━━━━━━━━━━━━━━━━━━━━
📈 Weekly Summary · Week of Jun 17–23
Mama's Kitchen
━━━━━━━━━━━━━━━━━━━━━━━━━

Revenue:   KSh 284,000  ↑9% vs last week
Orders:    986  ·  Avg: KSh 288

Best day:  Saturday KSh 58,400
Worst day: Wednesday KSh 31,200

── 3 things to know ────────────
1. ⭐ Your Nyama Choma drove 19% of all revenue.
   Consider featuring it more prominently.

2. 📉 Weekday lunches are down 14% vs. last month.
   Tue–Thu 12–2pm is your weakest window.

3. 📦 Cooking oil and rice both ran low this week.
   Set up a Thursday standing order to prevent this.

── Full report ──────────────────
[View weekly report PDF →]
Includes: by-day breakdown, menu performance,
staff rankings, and next week forecast.
━━━━━━━━━━━━━━━━━━━━━━━━━
```

### PDF Report (2 pages max)

Page 1:
```
┌─────────────────────────────────────────────┐
│  [LOGO]  Mama's Kitchen · Weekly Report     │
│          Week of 17–23 June 2026            │
├─────────────────────────────────────────────┤
│                                             │
│  REVENUE           KSh 284,000   ↑9%        │
│  ORDERS            986           ↑6%        │
│  AVG TICKET        KSh 288       ↑3%        │
│  CUSTOMERS         748           ↑11%       │
│                                             │
│  Daily trend ─────────────────────────────  │
│  [Sparkline bar chart, 7 bars]              │
│  Mon    Tue    Wed    Thu    Fri    Sat    Sun│
│  34.2K  38.1K  31.2K  41.4K  48.7K  58.4K  32K│
│                                             │
│  Payment split ──────────────────────────── │
│  M-Pesa 61% · Cash 30% · Card 9%            │
│                                             │
│  Peak hours: 12-2pm & 7-9pm (consistent)   │
│                                             │
├─────────────────────────────────────────────┤
│  MENU PERFORMANCE                           │
│                                             │
│  ⭐ Stars (promote)                         │
│  Nyama Choma     KSh 53,900  Margin 68%     │
│  Pilau           KSh 24,300  Margin 72%     │
│                                             │
│  🐴 Raise price (popular, low margin)       │
│  Ugali           KSh 29,400  Margin 28%     │
│  → A KSh 10 price increase = +KSh 15K/mo   │
│                                             │
│  🐕 Consider removing (low profit + sales)  │
│  Chips Masala    KSh 1,400   Margin 22%     │
└─────────────────────────────────────────────┘
```

Page 2:
```
┌─────────────────────────────────────────────┐
│  STAFF PERFORMANCE                          │
│                                             │
│  1. Grace N.    KSh 84,200  ███████████████ │
│  2. Peter O.    KSh 71,400  ████████████░░  │
│  3. David K.    KSh 48,200  ████████░░░░░░  │
│     ↑ Slow table turn — worth reviewing     │
│                                             │
│  Voids: KSh 2,800 (1.0% of revenue) ✅      │
│  Staff hours: 186.5h · Labor: 22% of rev ✅ │
│                                             │
├─────────────────────────────────────────────┤
│  INVENTORY REVIEW                           │
│                                             │
│  2 stockout events this week                │
│  Rice: ran out Tue afternoon                │
│  → Lost est. KSh 4,200 in sales             │
│                                             │
│  Suggested: place Rice order every Thursday │
│  for 25 bags (keeps ~7 day buffer)          │
│                                             │
├─────────────────────────────────────────────┤
│  NEXT WEEK FORECAST                         │
│                                             │
│  Estimated revenue: ~KSh 295,000  (↑4%)    │
│  Payday week effect expected Friday-Sat     │
│  Peak day: Saturday — schedule extra staff  │
│                                             │
│  3 customer birthdays this week             │
│  → Send them a birthday offer on Monday     │
└─────────────────────────────────────────────┘
```

---

## 4. Monthly Report (1st of Each Month)

More comprehensive. Delivered as a full PDF with WhatsApp notification.

**Additional sections in monthly (not in weekly):**
- Month-over-month and year-over-year comparison
- Customer acquisition: new vs. returning breakdown
- Loyalty program ROI: loyalty customers vs. non-loyalty spend
- Tax summary: VAT/GST collected (ready for submission)
- Full inventory history: what you ordered, what you sold, shrinkage estimate
- Profitability estimate: if COGS data is available, estimated gross profit

---

## 5. Custom Reports (On-Demand)

Available from the Reports section in the app. Built with natural language:

```
┌─────────────────────────────────────────────┐
│ ← Reports                                   │
├─────────────────────────────────────────────┤
│  🔍 Ask your data anything...               │
│  ┌───────────────────────────────────────┐  │
│  │ Show me last month's sales by branch   │  │
│  └───────────────────────────────────────┘  │
│  [Generate]                                 │
│                                             │
│  ── Or choose a template ────────────────   │
│                                             │
│  📊 Sales by period         [Run →]         │
│  📦 Inventory movement      [Run →]         │
│  👥 Customer activity       [Run →]         │
│  🧑‍🍳 Staff performance       [Run →]         │
│  💰 Tax summary             [Run →]         │
│  📉 Slow-moving stock        [Run →]         │
│  🎂 Customer birthdays       [Run →]         │
│  💸 Void & comp log          [Run →]         │
│                                             │
│  ── Scheduled reports ────────────────────  │
│  Daily 9pm WhatsApp         ✅ On [Edit]     │
│  Weekly Sunday PDF          ✅ On [Edit]     │
│  Monthly 1st PDF            ✅ On [Edit]     │
│                                             │
└─────────────────────────────────────────────┘
```

### Natural Language Report Engine

```typescript
async function generateNaturalLanguageReport(
  query: string,
  businessId: string,
  locationId?: string
): Promise<Report> {

  // Step 1: Parse intent with LLM
  const intent = await claude.messages.create({
    model: 'claude-sonnet-4-6',
    system: `You are a data query parser for a POS system. 
             Extract: time period, metrics, groupings, filters.
             Return JSON only.`,
    messages: [{
      role: 'user',
      content: `Business context: ${businessContext}
                Query: "${query}"
                
                Return JSON: {
                  period: { start: "ISO date", end: "ISO date" },
                  metrics: ["revenue", "orders", "avg_ticket", ...],
                  group_by: ["day" | "week" | "item" | "staff" | "branch"],
                  filters: { location_id?: ..., item_category?: ... }
                }`
    }]
  });

  const params = JSON.parse(intent.content[0].text);

  // Step 2: Run the query (read-only, no raw SQL execution — parametrized only)
  const data = await runReportQuery(params, businessId);

  // Step 3: Generate natural language summary
  const summary = await claude.messages.create({
    messages: [{
      role: 'user',
      content: `Query: "${query}"
                Data: ${JSON.stringify(data)}
                
                Write a 3-5 sentence summary of the key findings.
                Include the most important number first.
                Suggest one action the owner should take.
                Use KES currency format with commas.`
    }]
  });

  return {
    query,
    summary: summary.content[0].text,
    data,
    charts: buildCharts(params, data),
    generated_at: new Date()
  };
}
```

---

## Report Delivery Infrastructure

```typescript
// Report scheduler (runs as a cron job)
const reportScheduler = {

  // Daily: 30 min after closing, or 9:30pm
  daily: async (locationId: string) => {
    const report = await generateDailyReport(locationId);
    const message = formatForWhatsApp(report, 'daily');

    await sendWhatsApp({
      to:      getOwnerPhone(locationId),
      message: message
    });

    await sendWhatsApp({
      to:      getManagerPhone(locationId),
      message: message
    });

    // Also available in-app immediately
    await saveReport(report);
  },

  // Weekly: Sunday 7pm
  weekly: async (businessId: string) => {
    const report   = await generateWeeklyReport(businessId);
    const pdfUrl   = await generatePDF(report);   // stored in R2/S3
    const message  = formatForWhatsApp(report, 'weekly', pdfUrl);

    await sendWhatsApp({ to: getOwnerPhone(businessId), message });
  },

  // Monthly: 1st of month, 8am
  monthly: async (businessId: string) => {
    const report  = await generateMonthlyReport(businessId);
    const pdfUrl  = await generatePDF(report);
    const message = formatForWhatsApp(report, 'monthly', pdfUrl);

    await sendWhatsApp({ to: getOwnerPhone(businessId), message });
  }
};

// Cron schedule (using BullMQ for reliability)
cron.schedule('30 21 * * *', () => runDailyReports());   // 9:30pm daily
cron.schedule('0 19 * * 0',  () => runWeeklyReports());  // 7pm Sunday
cron.schedule('0 8 1 * *',   () => runMonthlyReports()); // 8am 1st of month
```

---

## The WhatsApp Two-Way Command System

Reports are not just push — they accept replies:

```
Command   → What it does
─────────────────────────────────────────────────
SALES     → Get today's revenue right now
STOCK     → Get current low stock alert list
STAFF     → See who's clocked in right now
VOID      → See today's voids
HELP      → See all available commands
ORDER     → (When in stock alert context) Triggers order to supplier
OK        → (When in large order alert) Confirms it was legitimate
QUERY     → (When in large order alert) Flags for review
STOP      → Pause alerts for 24 hours
```

Implementation:
```typescript
// WhatsApp webhook handler
app.post('/webhooks/whatsapp', async (req, res) => {
  const { from, body, context } = parseWhatsAppMessage(req.body);

  const command = body.trim().toUpperCase();
  const user    = await getUserByPhone(from);
  const biz     = await getActiveBusinessForUser(user.id);

  switch (command) {
    case 'SALES':
      const todaySales = await getTodaySales(biz.id);
      await replyWhatsApp(from, formatSalesQuickReply(todaySales));
      break;

    case 'STOCK':
      const alerts = await getStockAlerts(biz.id);
      await replyWhatsApp(from, formatStockAlerts(alerts));
      break;

    case 'ORDER':
      // Context-aware: if last message was a stock alert, trigger reorder
      if (context?.stockAlertId) {
        await triggerReorderFlow(context.stockAlertId, user.id);
        await replyWhatsApp(from, '✅ Order request sent to your supplier.');
      }
      break;

    default:
      if (command.startsWith('REPORT ')) {
        // Natural language: "REPORT sales by item last week"
        const query  = command.replace('REPORT ', '');
        const report = await generateNaturalLanguageReport(query, biz.id);
        await replyWhatsApp(from, report.summary + '\n' + report.link);
      }
  }
});
```

---

## Multi-Business Owner Reports

Owner receives ONE message covering all businesses, not one per business:

```
━━━━━━━━━━━━━━━━━━━━━━━━━
📊 Daily Across All Businesses · Tue Jun 24
━━━━━━━━━━━━━━━━━━━━━━━━━

🍽️ Mama's Kitchen:    KSh 42,300  ↑12%
💈 Glam Salon:         KSh 14,200  ↓ 3%
🛍️ Ngong Minimart:    KSh 31,000  ↑ 9%

Total:  KSh 87,500  ↑ 7% vs yesterday

⚠️ Salon down 3% — check in with the manager
🔴 Rice needs ordering at the restaurant

[View full details →]
━━━━━━━━━━━━━━━━━━━━━━━━━
```

One message. Under 30 seconds to read. Complete picture of the entire portfolio.

---

## Report Generation Architecture (Technical)

```
                    ┌──────────────────────┐
                    │  REPORT ENGINE       │
                    │  (background worker) │
                    └──────────┬───────────┘
                               │
              ┌────────────────┼────────────────┐
              ▼                ▼                ▼
    ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
    │  SQL queries  │  │  ML outputs  │  │  LLM summary │
    │  (DuckDB)     │  │  (forecasts) │  │  (Claude)    │
    └──────┬────────┘  └──────┬───────┘  └──────┬───────┘
           │                  │                  │
           └──────────────────┼──────────────────┘
                              ▼
                    ┌──────────────────────┐
                    │  Report object       │
                    │  (JSON + Markdown)   │
                    └──────────┬───────────┘
                               │
              ┌────────────────┼────────────────┐
              ▼                ▼                ▼
    ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
    │  WhatsApp    │  │  PDF render  │  │  In-app      │
    │  (text)      │  │  (Puppeteer) │  │  (stored)    │
    └──────────────┘  └──────────────┘  └──────────────┘
```

PDF generation:
```typescript
// Render HTML template → headless Chrome → PDF
async function generatePDF(report: Report): Promise<string> {
  const html    = renderReportTemplate(report); // React → HTML
  const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
  const page    = await browser.newPage();

  await page.setContent(html);
  const pdfBuffer = await page.pdf({
    format: 'A4',
    margin: { top: '20mm', right: '20mm', bottom: '20mm', left: '20mm' }
  });

  await browser.close();

  // Upload to R2 / S3
  const url = await uploadToStorage(`reports/${report.id}.pdf`, pdfBuffer);
  return url;  // signed URL valid for 7 days
}
```
