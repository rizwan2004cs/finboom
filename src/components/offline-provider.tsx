"use client"

import { useEffect, useRef, useState, useCallback, createContext, useContext } from "react"
import { useUser } from "@/hooks/use-auth"
import { setupConnectivityListeners, fullSync } from "@/lib/offline/sync"
import { OfflineIndicator } from "@/components/offline-indicator"

interface AppContextValue {
  updateReady: boolean
  applyUpdate: () => void
  storageWarning: boolean
  storageUsage: number | null
  triggerSync: () => void
}

const UpdateContext = createContext<AppContextValue>({
  updateReady: false,
  applyUpdate: () => {},
  storageWarning: false,
  storageUsage: null,
  triggerSync: () => {},
})
export const useAppUpdate = () => useContext(UpdateContext)

export function OfflineProvider({ children }: { children: React.ReactNode }) {
  const { user } = useUser()
  const initialized = useRef(false)
  const [updateReady, setUpdateReady] = useState(false)
  const [storageWarning, setStorageWarning] = useState(false)
  const [storageUsage, setStorageUsage] = useState<number | null>(null)
  const waitingSW = useRef<ServiceWorker | null>(null)

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return

    navigator.serviceWorker
      .register("/sw.js")
      .then((reg) => {
        // If there's already a waiting worker (page was loaded after deploy)
        if (reg.waiting) {
          waitingSW.current = reg.waiting
          setUpdateReady(true)
        }

        // Listen for new SW installing
        reg.addEventListener("updatefound", () => {
          const newSW = reg.installing
          if (!newSW) return
          newSW.addEventListener("statechange", () => {
            // New SW installed and waiting to activate
            if (newSW.state === "installed" && navigator.serviceWorker.controller) {
              waitingSW.current = newSW
              setUpdateReady(true)
            }
          })
        })

        // Periodically check for updates (every 60 min)
        setInterval(() => reg.update(), 60 * 60 * 1000)
      })
      .catch((err) => {
        console.warn("[sw] Registration failed:", err)
      })

    // When the new SW takes over, clear caches and reload the page
    let refreshing = false
    navigator.serviceWorker.addEventListener("controllerchange", async () => {
      if (!refreshing) {
        refreshing = true
        const keys = await caches.keys()
        await Promise.all(keys.map((k) => caches.delete(k)))
        window.location.reload()
      }
    })
  }, [])

  function applyUpdate() {
    if (waitingSW.current) {
      waitingSW.current.postMessage({ type: "SKIP_WAITING" })
      // Fallback: if controllerchange doesn't fire within 2s, force reload
      setTimeout(async () => {
        // Clear all SW caches so the reload gets fresh content
        const keys = await caches.keys()
        await Promise.all(keys.map((k) => caches.delete(k)))
        window.location.reload()
      }, 2000)
    }
  }

  useEffect(() => {
    if (!user || initialized.current) return
    initialized.current = true

    const cleanup = setupConnectivityListeners(user.id)

    if (navigator.onLine) {
      fullSync(user.id)
    }

    return cleanup
  }, [user])

  const triggerSync = useCallback(() => {
    if (user) fullSync(user.id)
  }, [user])

  // Storage quota monitoring
  useEffect(() => {
    if (!navigator.storage?.estimate) return

    async function checkQuota() {
      const { usage, quota } = await navigator.storage.estimate()
      if (usage != null && quota != null && quota > 0) {
        const pct = usage / quota
        setStorageUsage(Math.round(pct * 100))
        setStorageWarning(pct >= 0.8)
      }
    }

    checkQuota()
    const interval = setInterval(checkQuota, 5 * 60 * 1000) // re-check every 5 min
    return () => clearInterval(interval)
  }, [])

  return (
    <UpdateContext.Provider value={{ updateReady, applyUpdate, storageWarning, storageUsage, triggerSync }}>
      <OfflineIndicator />
      {children}
    </UpdateContext.Provider>
  )
}
