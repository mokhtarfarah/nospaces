/// <reference lib="webworker" />
import { clientsClaim } from 'workbox-core'
import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching'

declare const self: ServiceWorkerGlobalScope & { __WB_MANIFEST: { url: string; revision: string | null }[] }

clientsClaim()
self.skipWaiting()

precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()

// Handle iOS share sheet POST (Web Share Target)
self.addEventListener('fetch', (event: FetchEvent) => {
  const url = new URL(event.request.url)
  if (url.pathname === '/add' && event.request.method === 'POST') {
    event.respondWith(
      (async () => {
        const formData = await event.request.formData()
        const image = formData.get('images') as File | null
        if (image) {
          const cache = await caches.open('nospaces-share-target')
          await cache.put('shared-image', new Response(image, {
            headers: { 'Content-Type': image.type },
          }))
        }
        return Response.redirect('/add?shared=true', 303)
      })()
    )
  }
})
