import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'
// @ts-expect-error Vercel Function source is plain JavaScript by design.
import onRequest from './api/fund-api.js'

function localApiPlugin () {
  return {
    name: 'om-fund-local-api',
    configureServer (server: { middlewares: { use: Function } }) {
      server.middlewares.use('/api', async function (req: any, res: any, next: Function) {
        if (req.method !== 'GET') return next()
        const protocol = req.headers['x-forwarded-proto'] || 'http'
        const host = req.headers.host || 'localhost:5173'
        // Connect-style middleware strips the mounted /api prefix from req.url.
        // Restore it so the shared handler receives the same pathname as Vercel.
        const requestPath = String(req.url || '/').startsWith('/api/')
          ? req.url
          : `/api${req.url || '/'}`
        const request = new Request(`${protocol}://${host}${requestPath}`, {
          method: req.method,
          headers: req.headers
        })
        const response = await onRequest({ request })
        response.headers.forEach(function (value: string, key: string) { res.setHeader(key, value) })
        res.statusCode = response.status
        res.end(Buffer.from(await response.arrayBuffer()))
      })
    }
  }
}

export default defineConfig({
  plugins: [
    localApiPlugin(),
    vue(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['favicon.png', 'icons/app-192.png', 'icons/app-512.png'],
      manifest: {
        name: 'OM Fund',
        short_name: 'OM Fund',
        description: '轻量基金与指数自选行情工具',
        theme_color: '#ffffff',
        background_color: '#f4f5f7',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        lang: 'zh-CN',
        icons: [
          { src: '/icons/app-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/app-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/app-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,woff2}'],
        navigateFallback: '/index.html',
        runtimeCaching: [
          {
            urlPattern: function ({ url }) {
              return url.pathname.startsWith('/api/')
            },
            handler: 'NetworkFirst',
            options: {
              cacheName: 'omfund-api-v1',
              networkTimeoutSeconds: 8,
              cacheableResponse: { statuses: [0, 200] },
              expiration: {
                maxEntries: 120,
                maxAgeSeconds: 24 * 60 * 60
              }
            }
          }
        ]
      }
    })
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  }
})
