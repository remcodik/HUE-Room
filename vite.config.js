import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
        manifest: {
          name: 'HUE Room',
          short_name: 'HUE Room',
          description: 'Philips Hue plattegrond bediening',
          theme_color: '#0f172a',
          background_color: '#0f172a',
          display: 'standalone',
          orientation: 'any',
          start_url: '/',
          icons: [
            { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
            { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }
          ]
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg}']
        }
      }),
      // Dev-only: mirror the Vercel /api/token serverless function locally
      {
        name: 'hue-api-dev',
        configureServer(server) {
          server.middlewares.use('/api/token', async (req, res) => {
            const clientId = env.HUE_CLIENT_ID
            const clientSecret = env.HUE_CLIENT_SECRET

            if (!clientId || !clientSecret) {
              res.writeHead(500, { 'Content-Type': 'application/json' })
              res.end(JSON.stringify({ error: 'Voeg HUE_CLIENT_ID en HUE_CLIENT_SECRET toe aan .env.local' }))
              return
            }

            const url = new URL(req.url, 'http://localhost')
            const grant_type = url.searchParams.get('grant_type')
            const code = url.searchParams.get('code')
            const refresh_token = url.searchParams.get('refresh_token')
            const redirect_uri = url.searchParams.get('redirect_uri')

            const body = new URLSearchParams({ grant_type })
            if (grant_type === 'authorization_code' && code) body.append('code', code)
            if (grant_type === 'authorization_code' && redirect_uri) body.append('redirect_uri', redirect_uri)
            if (grant_type === 'refresh_token' && refresh_token) body.append('refresh_token', refresh_token)

            try {
              const tokenRes = await fetch('https://api.meethue.com/v2/oauth2/token', {
                method: 'POST',
                headers: {
                  'Authorization': 'Basic ' + Buffer.from(`${clientId}:${clientSecret}`).toString('base64'),
                  'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: body.toString(),
              })
              const data = await tokenRes.json()
              res.writeHead(tokenRes.ok ? 200 : tokenRes.status, { 'Content-Type': 'application/json' })
              res.end(JSON.stringify(data))
            } catch (err) {
              res.writeHead(502, { 'Content-Type': 'application/json' })
              res.end(JSON.stringify({ error: 'Hue API niet bereikbaar', detail: err.message }))
            }
          })
        }
      }
    ],
  }
})
