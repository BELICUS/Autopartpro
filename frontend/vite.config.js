import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Las peticiones a /api se reenvían al backend. Así el navegador las ve
    // como mismo origen y en desarrollo no hace falta lidiar con CORS.
    proxy: {
      '/api': { target: 'http://localhost:4000', changeOrigin: true },
      '/imagenes': { target: 'http://localhost:4000', changeOrigin: true },
    },
  },
});
