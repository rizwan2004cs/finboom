"use client"

import { useEffect, useRef } from "react"
import { useUser } from "@clerk/nextjs"
import { setupConnectivityListeners, fullSync } from "@/lib/offline/sync"
import { OfflineIndicator } from "@/components/offline-indicator"

export function OfflineProvider({ children }: { children: React.ReactNode }) {
  const { user } = useUser()
  const initialized = useRef(false)

  useEffect(() => {
    // Register service worker
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch((err) => {
        console.warn("[sw] Registration failed:", err)
      })
    }
  }, [])

  useEffect(() => {
    if (!user || initialized.current) return
    initialized.current = true

    // Set up online/offline listeners with auto-sync
    const cleanup = setupConnectivityListeners(user.id)

    // Initial data pull to populate IndexedDB cache
    if (navigator.onLine) {
      fullSync(user.id)
    }

    return cleanup
  }, [user])

  return (
    <>
      <OfflineIndicator />
      {children}
    </>
  )
}
