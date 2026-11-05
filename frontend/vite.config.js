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
    // Permite servir a través del túnel temporal de Cloudflare (necesario
    // para que Wompi pueda redirigir de vuelta a una URL pública real en
    // vez de localhost, que su WAF bloquea en producción). Quitar o ajustar
    // cuando el sitio ya esté en su dominio definitivo.
    allowedHosts: ['.trycloudflare.com'],
  },
  preview: {
    // El mismo bloqueo de host aplica a "vite preview", que es lo que
    // sirve el frontend compilado en Railway. Sin esto, Railway asigna un
    // dominio *.up.railway.app que Vite rechazaría por defecto.
    host: '0.0.0.0',
    allowedHosts: ['.up.railway.app', '.railway.app', 'aurtopartpro.online', '.aurtopartpro.online'],
  },
});
