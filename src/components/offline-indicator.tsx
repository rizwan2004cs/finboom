"use client"

import { useEffect, useState } from "react"
import { WifiOff, RefreshCw, CloudOff, Check } from "lucide-react"
import { onSyncStatus, getPendingCount } from "@/lib/offline"

type Status = "online" | "offline" | "syncing" | "synced" | "error"

export function OfflineIndicator() {
  const [status, setStatus] = useState<Status>("online")
  const [pending, setPending] = useState(0)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    // Check initial state
    if (!navigator.onLine) {
      setStatus("offline")
      setVisible(true)
    }

    const cleanup = onSyncStatus((s) => {
      setStatus(s)
      setVisible(true)
      if (s === "synced") {
        // Hide after 3s on success
        setTimeout(() => setVisible(false), 3000)
      }
    })

    // Track pending count
    const interval = setInterval(async () => {
      const count = await getPendingCount()
      setPending(count)
    }, 5000)

    return () => {
      cleanup()
      clearInterval(interval)
    }
  }, [])

  if (!visible) return null

  return (
    <div
      className={`
        fixed top-16 left-1/2 -translate-x-1/2 z-[100] px-4 py-2 rounded-full
        flex items-center gap-2 text-sm font-medium shadow-lg backdrop-blur-xl
        transition-all duration-300 animate-in slide-in-from-top
        ${status === "offline" ? "bg-amber-500/90 text-white" : ""}
        ${status === "syncing" ? "bg-blue-500/90 text-white" : ""}
        ${status === "synced" ? "bg-green-500/90 text-white" : ""}
        ${status === "error" ? "bg-red-500/90 text-white" : ""}
        ${status === "online" ? "bg-green-500/90 text-white" : ""}
      `}
    >
      {status === "offline" && (
        <>
          <WifiOff size={16} />
          <span>Offline{pending > 0 ? ` · ${pending} pending` : ""}</span>
        </>
      )}
      {status === "syncing" && (
        <>
          <RefreshCw size={16} className="animate-spin" />
          <span>Syncing changes...</span>
        </>
      )}
      {status === "synced" && (
        <>
          <Check size={16} />
          <span>All synced</span>
        </>
      )}
      {status === "error" && (
        <>
          <CloudOff size={16} />
          <span>Sync failed · will retry</span>
        </>
      )}
      {status === "online" && (
        <>
          <Check size={16} />
          <span>Back online</span>
        </>
      )}
    </div>
  )
}
