import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      'chess.js': 'chess.js/dist/cjs/chess.js'
    }
  },
  server: {
    host: '0.0.0.0',
    port: 3000
  }
})
