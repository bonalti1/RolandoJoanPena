import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// Per-site identity, read from the deploying site's environment. One codebase
// serves every leader's OS: VITE_OWNER_NAME rebrands the tab title and the
// installed-app name (e.g. "Cristo's Dashboard"); unset keeps Rolando's.
const env = loadEnv('production', '.', 'VITE_')
const OWNER = (env.VITE_OWNER_NAME || '').trim()
const FIRST = OWNER.split(/\s+/)[0] || 'Rolando'
const TITLE = `${FIRST}'s Dashboard`

/** Fills %VITE_OWNER_TITLE% in index.html with the site's computed title. */
const ownerTitle = (): Plugin => ({
  name: 'owner-title',
  transformIndexHtml: (html) => html.replace(/%VITE_OWNER_TITLE%/g, TITLE),
})

export default defineConfig({
  plugins: [
    ownerTitle(),
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: TITLE,
        short_name: FIRST,
        description: 'Tasks, bills, calendar, journal and more — all in one place.',
        theme_color: '#172032',
        background_color: '#f5f7fa',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icon-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // App shell is cached for offline use. Calls to the AI function are
        // network-only (never cached) so answers are always fresh.
        navigateFallbackDenylist: [/^\/\.netlify\//],
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
      },
    }),
  ],
})
