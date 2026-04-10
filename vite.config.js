import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    include: ['chess.js'],
  },
  build: {
    commonjsOptions: {
      include: [/chess\.js/, /node_modules/],
    },
  },
  server: {
    host: '0.0.0.0',
    port: 3000
  }
})
