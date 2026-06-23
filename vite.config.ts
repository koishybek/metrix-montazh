import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg'],
      manifest: {
        name: 'Metrix Installer',
        short_name: 'Metrix',
        description: 'Metrix Installer App for IoT-Exponenta',
        theme_color: '#ffffff',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      }
    })
  ],
  // Dev-only proxy so the browser can reach the Smart Metrix API without CORS.
  // The production bundle is unaffected (it uses the absolute API base URL).
  server: {
    proxy: {
      '/api': { target: 'https://sm.iot-exp.kz', changeOrigin: true, secure: true },
      '/api-token-auth': { target: 'https://sm.iot-exp.kz', changeOrigin: true, secure: true },
    },
  },
})
