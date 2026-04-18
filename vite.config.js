import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    include: ['chess.js'],
    esbuildOptions: {
      target: 'es2020',
    },
  },
  build: {
    target: 'es2020',
    commonjsOptions: {
      include: [/chess\.js/, /node_modules/],
      transformMixedEsModules: true,
      requireReturnsDefault: 'auto',
    },
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('chess.js')) {
            return 'chess-vendor'
          }
          if (id.includes('node_modules')) {
            return 'vendor'
          }
        },
      },
    },
  },
  server: {
    host: '0.0.0.0',
    port: 3000,
  },
})
