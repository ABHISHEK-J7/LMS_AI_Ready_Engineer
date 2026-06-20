import { fileURLToPath, URL } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (id.includes('xlsx')) return 'xlsx';
          if (id.includes('gsap')) return 'gsap';
          if (id.includes('@tanstack')) return 'react-query';
          if (id.includes('react-router') || id.includes('@remix-run') || id.includes('react-dom') || /node_modules\/(react|scheduler)\//.test(id)) return 'react';
          return 'vendor';
        },
      },
    },
  },
  server: {
    port: 5174,
    proxy: {
      '/api': { target: 'http://localhost:5050', changeOrigin: true },
    },
  },
});
