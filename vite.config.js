import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Static SPA build → outputs to dist/ for Cloudflare Pages.
export default defineConfig({
  plugins: [react()],
  build: { outDir: 'dist' },
})
