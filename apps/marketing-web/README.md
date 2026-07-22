# Marketing Web

Astro public marketing site and docs. See `docs/adr/0001-tech-stack.md`
decision 4 for why this is a separate app from `customer-web` (React +
Vite): this surface is mostly static content and benefits from SEO —
Astro ships near-zero JS by default, which a full React/Next.js app
wouldn't for content that's 95% static.

Responsibilities:

- Public marketing pages
- Developer/API docs entry point (placeholder until the OpenAPI-generated
  docs from `BUILD_WORKFLOW.md` P19 replace it)

Explicitly not this app's job: authenticated dashboards, QR/online
ordering (`customer-web`), or anything else covered by
`PROJECT_STRUCTURE.md`'s other app entries.
