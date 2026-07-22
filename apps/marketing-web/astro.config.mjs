import { defineConfig } from 'astro/config'

// Static output, near-zero JS by default — this app exists specifically
// because the internal/customer apps (React + Vite) are the wrong tool
// for a mostly-static, SEO-sensitive public site. See
// docs/adr/0001-tech-stack.md decision 4.
export default defineConfig({
  output: 'static',
  site: 'https://example.com', // replace once the production domain is set
})
