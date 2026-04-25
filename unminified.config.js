import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  plugins: [react()],
  build: {
    minify: false
  },
  resolve: {
    alias: {
      'chess.js': resolve(__dirname, './src/chess-shim.js')
    }
  }
})
