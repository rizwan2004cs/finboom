"use client"

import { useEffect, useRef, useState, createContext, useContext } from "react"
import { useUser } from "@/hooks/use-auth"
import { setupConnectivityListeners, fullSync } from "@/lib/offline/sync"
import { OfflineIndicator } from "@/components/offline-indicator"

const UpdateContext = createContext<{ updateReady: boolean; applyUpdate: () => void }>({
  updateReady: false,
  applyUpdate: () => {},
})
export const useAppUpdate = () => useContext(UpdateContext)

export function OfflineProvider({ children }: { children: React.ReactNode }) {
  const { user } = useUser()
  const initialized = useRef(false)
  const [updateReady, setUpdateReady] = useState(false)
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

    // When the new SW takes over, reload the page
    let refreshing = false
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (!refreshing) {
        refreshing = true
        window.location.reload()
      }
    })
  }, [])

  function applyUpdate() {
    if (waitingSW.current) {
      waitingSW.current.postMessage({ type: "SKIP_WAITING" })
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

  return (
    <UpdateContext.Provider value={{ updateReady, applyUpdate }}>
      <OfflineIndicator />
      {children}
    </UpdateContext.Provider>
  )
}
