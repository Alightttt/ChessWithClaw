import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    include: ['chess.js'],
    force: true,
  },
  build: {
    commonjsOptions: {
      include: [/chess\.js/, /node_modules/],
      transformMixedEsModules: true,
    },
    rollupOptions: {
      output: {
        manualChunks: {
          chess: ['chess.js'],
        },
      },
    },
  },
  server: {
    host: '0.0.0.0',
    port: 3000,
  },
})
