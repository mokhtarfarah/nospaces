import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png'],
      // The image-cutout engine (@imgly/background-removal) drags in onnxruntime's
      // ~24MB WASM. It's lazy-loaded only when someone polishes a photo, so it must
      // NOT go in the SW precache (which is fetched up front on every install) —
      // exclude it; it's still served + runtime-cached normally on first use.
      injectManifest: {
        globIgnores: ['**/ort-*.wasm', '**/*.onnx'],
      },
      manifest: {
        name: 'Nospaces',
        short_name: 'Nospaces',
        description: 'Your personal taste library',
        theme_color: '#002FA7',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
        share_target: {
          action: '/add',
          method: 'POST',
          enctype: 'multipart/form-data',
          params: {
            files: [{ name: 'images', accept: ['image/*'] }],
          },
        },
      },
    }),
  ],
})
