import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Reached via QR scan / direct link / WhatsApp message on patchy 3G/4G
  // in-restaurant, disproportionately on cheap Android phones — not
  // organic search. ADR 0001 picked React + Vite over Next.js for this app
  // specifically for bundle size and time-to-interactive over SSR/SEO, so
  // keep an explicit eye on build output size as real routes are added.
  build: {
    target: 'es2020',
  },
})
