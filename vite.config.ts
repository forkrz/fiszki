import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// Na GitHub Pages aplikacja działa pod /<nazwa-repo>/ – workflow ustawia BASE_PATH.
const base = process.env.BASE_PATH || '/';

export default defineConfig({
  base,
  plugins: [
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['icon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Fiszki – nauka do security',
        short_name: 'Fiszki',
        description: 'Fiszki ABCD działające offline',
        lang: 'pl',
        theme_color: '#0f172a',
        background_color: '#0f172a',
        display: 'standalone',
        orientation: 'portrait',
        start_url: base,
        scope: base,
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      workbox: {
        // Pliki z pytaniami trafiają do cache, więc działają w trybie samolotowym.
        globPatterns: ['**/*.{js,css,html,svg,png,json}']
      }
    })
  ]
});
