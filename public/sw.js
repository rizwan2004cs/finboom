/// <reference lib="webworker" />

/**
 * FinBoom Service Worker
 * - Precaches the app shell (HTML, CSS, JS, fonts)
 * - Network-first for API/data, cache-first for static assets
 * - Offline fallback for navigation requests
 */

const SW_VERSION = "v1"
const CACHE_STATIC = `finboom-static-${SW_VERSION}`
const CACHE_PAGES = `finboom-pages-${SW_VERSION}`
const CACHE_DATA = `finboom-data-${SW_VERSION}`

const sw = self as unknown as ServiceWorkerGlobalScope

// Static assets to precache
const PRECACHE_URLS = [
  "/dashboard",
  "/manifest.json",
  "/icons/icon-192.svg",
  "/icons/icon-512.svg",
]

// Install: precache core assets
sw.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_STATIC).then(async (cache) => {
      // Precache what we can, don't fail install if some assets 404
      for (const url of PRECACHE_URLS) {
        try {
          await cache.add(url)
        } catch {
          console.warn(`[sw] Failed to precache: ${url}`)
        }
      }
    })
  )
  sw.skipWaiting()
})

// Activate: clean old caches
sw.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_STATIC && key !== CACHE_PAGES && key !== CACHE_DATA)
          .map((key) => caches.delete(key))
      )
    )
  )
  sw.clients.claim()
})

// Fetch strategies
sw.addEventListener("fetch", (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Skip non-GET requests
  if (request.method !== "GET") return

  // Skip Clerk auth requests and Supabase API requests (handled by IndexedDB layer)
  if (url.hostname.includes("clerk") || url.hostname.includes("supabase")) return

  // Skip chrome-extension and other non-http(s) requests
  if (!url.protocol.startsWith("http")) return

  // Navigation requests: network-first with offline fallback
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Cache a clone of successful navigation responses
          if (response.ok) {
            const clone = response.clone()
            caches.open(CACHE_PAGES).then((cache) => cache.put(request, clone))
          }
          return response
        })
        .catch(() =>
          caches.match(request).then((cached) => {
            if (cached) return cached
            // Fallback to cached dashboard shell
            return caches.match("/dashboard").then((shell) => {
              if (shell) return shell
              return new Response(
                `<!DOCTYPE html>
                <html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
                <title>FinBoom - Offline</title>
                <style>
                  body{font-family:system-ui;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#0a0a0a;color:#fff}
                  .c{text-align:center}.c h1{font-size:2rem;margin-bottom:0.5rem}.c p{opacity:0.6;margin-bottom:1.5rem}
                  .c button{background:#34c759;color:#fff;border:none;padding:12px 24px;border-radius:12px;font-size:1rem;cursor:pointer}
                </style></head><body>
                <div class="c"><h1>You're offline</h1><p>Check your connection and try again</p>
                <button onclick="location.reload()">Retry</button></div></body></html>`,
                { headers: { "Content-Type": "text/html" } }
              )
            })
          })
        )
    )
    return
  }

  // Static assets (JS, CSS, fonts, images): stale-while-revalidate
  if (
    url.pathname.startsWith("/_next/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname.endsWith(".woff2") ||
    url.pathname.endsWith(".woff") ||
    url.pathname.endsWith(".svg") ||
    url.pathname.endsWith(".png") ||
    url.pathname.endsWith(".jpg")
  ) {
    event.respondWith(
      caches.open(CACHE_STATIC).then(async (cache) => {
        const cached = await cache.match(request)
        const fetchPromise = fetch(request)
          .then((response) => {
            if (response.ok) {
              cache.put(request, response.clone())
            }
            return response
          })
          .catch(() => cached!)

        return cached || fetchPromise
      })
    )
    return
  }
})

// Listen for sync message from the app
sw.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    sw.skipWaiting()
  }
})
