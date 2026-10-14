import { fileURLToPath, URL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: {
    port: 5173,
    strictPort: true,
    // the /docs page imports ../docs/guides/*.md; allow only that folder outside web/
    fs: { allow: ['.', '../docs/guides'] },
    // the RoadWatch API (`uv run roadwatch serve`) - one origin in dev, same as production
    proxy: { '/api': { target: 'http://127.0.0.1:8000', changeOrigin: false } },
  },
})
