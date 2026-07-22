# Developer Portal

React + Vite app (ADR 0001 — moved off the original Next.js scaffold, same as
`customer-web`) for the public developer platform: API reference, app
registration console, sandbox keys, and the app marketplace.

Full spec: `HOSPITALITY_OS_MASTER_PLAN.md` Module 17, `BUILD_WORKFLOW.md`
phase P19 and section 7.

This is intentionally last. P19 depends on the internal `/api/v1` surface
and its underlying modules (P2, P3, P5, P7, P12, P13) being stable enough
to promise externally — do not start building this ahead of P18.
