import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// In development the API runs on :3001 and Vite proxies /api to it.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: { '/api': { target: process.env.VITE_API_TARGET || 'http://localhost:3001', changeOrigin: true } },
  },
  build: { outDir: 'dist', sourcemap: false },
  test: { environment: 'node', include: ['test/**/*.test.{js,jsx}'], setupFiles: ['test/setup.js'] },
});
