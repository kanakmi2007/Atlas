import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      '/webhook': 'http://127.0.0.1:8001',
      '/upload-csv': 'http://127.0.0.1:8001',
      '/initial-state': 'http://127.0.0.1:8001',
      '/outputs': 'http://127.0.0.1:8001',
    }
  }
})