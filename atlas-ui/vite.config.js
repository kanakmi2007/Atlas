import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      '/v1': 'http://127.0.0.1:8080',
      '/api': 'http://127.0.0.1:8080',
      '/health': 'http://127.0.0.1:8080',
      '/webhook': 'http://127.0.0.1:8080',
      '/upload-csv': 'http://127.0.0.1:8080',
      '/initial-state': 'http://127.0.0.1:8080',
      '/outputs': 'http://127.0.0.1:8080',
    }
  }
})
