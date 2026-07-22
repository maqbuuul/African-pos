# African POS — Global Intelligence Research Library

> Deep research on every major POS system in the world — restaurant and retail — with a complete blueprint for building the best POS ever made for African markets.
> 
> Compiled: June 2026 | Sources: 100+ verified sources, live agent research

---

## Files in This Library

### Part 1 — Global Market Research (Files 00-11)
| File | What It Contains |
|------|----------------|
| [00-market-overview.md](00-market-overview.md) | $29B market, tier rankings, 8 megatrends |
| [01-toast-pos-deep-dive.md](01-toast-pos-deep-dive.md) | Toast IQ, menu engineering AI, Toast Capital, every weakness |
| [02-square-deep-dive.md](02-square-deep-dive.md) | AI voice ordering, Bitcoin banking, freemium model, 1,000+ ecosystem |
| [03-lightspeed-deep-dive.md](03-lightspeed-deep-dive.md) | Competitive benchmarking, NuOrder B2B, hotel room charging |
| [04-other-restaurant-pos-leaders.md](04-other-restaurant-pos-leaders.md) | TouchBistro, SpotOn Profit Assist, HungerRush OrderAI, SkyTab, Lavu Marty AI, Clover |
| [05-retail-pos-leaders.md](05-retail-pos-leaders.md) | Shopify unified commerce, NCR Counterpoint layaway, KORONA ticketing, Cin7, Erply franchise |
| [06-ai-and-cutting-edge-features.md](06-ai-and-cutting-edge-features.md) | Every AI feature across every platform — Toast IQ, Lavu Marty, Presto drive-thru |
| [07-what-to-steal-master.md](07-what-to-steal-master.md) | **THE BIG ONE** — 45+ features to steal with implementation notes + 13 Africa-original features |
| [08-pricing-models-and-monetization.md](08-pricing-models-and-monetization.md) | The stacking revenue model, what not to do, African pricing strategy |
| [09-technology-architecture.md](09-technology-architecture.md) | Full tech stack, offline architecture, M-Pesa integration code |
| [10-complete-feature-matrix.md](10-complete-feature-matrix.md) | 100+ features side-by-side vs. every global leader |
| [11-competitive-landscape-updated-2026.md](11-competitive-landscape-updated-2026.md) | 10 biggest 2025-2026 developments, 8 gaps nobody is filling |

### Part 2 — Our Product Blueprint (Files 12-17)
| File | What It Contains |
|------|----------------|
| [12-multi-tenant-architecture.md](12-multi-tenant-architecture.md) | Owner → multiple businesses → branches → staff. DB schema, permissions, registration flow, billing |
| [13-data-and-ml-system.md](13-data-and-ml-system.md) | Real ML demand forecasting (LightGBM), anomaly detection, African market patterns (payday, school terms) |
| [14-bi-dashboard-design.md](14-bi-dashboard-design.md) | 8 essential views, mobile-first wireframes, color system, loading states for Africa |
| [15-automated-reporting-system.md](15-automated-reporting-system.md) | WhatsApp-native push reports, two-way command system, PDF generation, multi-business summary |
| [16-ux-and-workflow-design.md](16-ux-and-workflow-design.md) | Design principles, POS terminal layout, payment flow, onboarding in 10 min, template menus |
| [17-essential-feature-spec.md](17-essential-feature-spec.md) | Tier 1/2/3 feature list, explicit skip list, API contracts, event bus, "done" definition |
| [08-pricing-models-and-monetization.md](08-pricing-models-and-monetization.md) | How every leader makes money, the stacking revenue model, African pricing strategy |
| [09-technology-architecture.md](09-technology-architecture.md) | Technical blueprint: stack, offline architecture, DB schema, AI implementation, M-Pesa integration |
| [10-complete-feature-matrix.md](10-complete-feature-matrix.md) | Side-by-side feature comparison: every leader vs. our target |
| [11-competitive-landscape-updated-2026.md](11-competitive-landscape-updated-2026.md) | 2025-2026 developments, market gaps, African local competitors, AI race timeline |

---

## The 5-Minute Summary

### What the Leaders Do That Nobody Else Does

**Toast**: Conversational AI that executes (not just reports). Menu engineering matrix. Payroll + scheduling built in. Tableside split-by-seat via text link. Merchant loans from transaction data.

**Square**: True freemium that converts. AI voice phone ordering. Bitcoin payments. External data (weather/events) in AI analysis. 1,000+ partner ecosystem.

**Lightspeed**: Competitive benchmarking (compare your metrics to nearby similar businesses, daily). NuOrder B2B wholesale buying inside the POS. AI natural language reporting.

**SpotOn**: AI P&L analysis (not just sales — actual profit and loss). First to do this. #1 rated support.

**Lavu Marty**: 6-agent AI system. Morning briefing by 5 AM. Covers promo, pricing, scheduling, waste, staff coaching, and P&L digest.

**HungerRush**: AI phone ordering at 5M+ orders scale. Caller ID → customer profile popup. Driver dispatch with GPS.

**Presto**: AI drive-thru voice ordering. Dairy Queen rolling out to 3,000 locations.

**Shopify**: True unified commerce — one inventory for online + offline. 4,000+ apps. Automation engine (Shopify Flow). BOPIS/BORIS native.

---

### What Nobody Is Doing (Our Opportunity)

1. **Mobile Money as first-class payment** (M-Pesa, MTN MoMo, Airtel)
2. **WhatsApp ordering + receipts + marketing** (native, not third-party)
3. **AI in African languages** (Swahili, Yoruba, Amharic)
4. **Offline mobile money** (queue and process when reconnected)
5. **Customer credit / running tab** (Oweame) as first-class feature
6. **Layaway/rent-to-own** for African retail purchase patterns
7. **Tax compliance** for KRA/FIRS/SARS/GRA
8. **Franchise royalty automation** for African chains
9. **Informal market features** (no barcode, sell by weight/count, denomination cash counting)
10. **Supplier credit tracking** (what you owe each supplier)

---

### The Architecture in One Paragraph

Build offline-first (local SQLite, sync to cloud when available). API-first microservices (every feature is an API). React Native for cross-platform POS app. PostgreSQL + Redis backend. Claude API for conversational AI and natural language reporting. Python Prophet for demand forecasting. Mobile money natively integrated (Daraja, MTN, Airtel APIs). WhatsApp Business API for receipts and marketing. Support all hardware — Android tablets, receipt printers, card readers — no proprietary lock-in.

---

### The Pricing Model in One Paragraph

Free tier that actually works (up to 50 products, 1 location, M-Pesa + cash). Business tier at ~$15/month. Pro at ~$38/month. Enterprise custom. Revenue from: software subscriptions (60%), payment processing revenue share (30%), financial products — lending, savings (10%). Layer these revenue streams and ARPU grows to $50-80/month per merchant. Never lock merchants into payment processing — compete on value, not captivity.

---

## How to Use This Research

**For product decisions**: Start with [07-what-to-steal-master.md](07-what-to-steal-master.md). Every feature is ranked by priority.

**For investor conversations**: Start with [00-market-overview.md](00-market-overview.md) + [11-competitive-landscape-updated-2026.md](11-competitive-landscape-updated-2026.md). Shows market size and gap.

**For engineering**: Start with [09-technology-architecture.md](09-technology-architecture.md). Has actual code.

**For pricing discussions**: Start with [08-pricing-models-and-monetization.md](08-pricing-models-and-monetization.md).

**For competitor knowledge**: Any specific system file (01-05).

---

*Research compiled from: company websites, pricing pages, G2/Capterra reviews, press releases, investor presentations, NRA 2026 announcements, and live agent research with 100+ verified sources.*
