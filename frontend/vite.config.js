import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      // Keep the browser Host (localhost:5173) so Flask `_site_url()` builds an OAuth
      // redirect_uri that matches Google Console — not the backend port 5001.
      '/api': {
        target: 'http://localhost:5001',
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq, req) => {
            const host = req.headers.host
            if (host) {
              proxyReq.setHeader('Host', host)
              proxyReq.setHeader('X-Forwarded-Host', host)
            }
            proxyReq.setHeader('X-Forwarded-Proto', 'http')
          })
        },
      },
    },
  },
})
