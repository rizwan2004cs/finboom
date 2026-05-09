"use client"

import { useEffect, useState } from "react"
import { WifiOff, RefreshCw, CloudOff, Check, Download, HardDrive } from "lucide-react"
import { onSyncStatus, getPendingCount } from "@/lib/offline"
import { useAppUpdate } from "@/components/offline-provider"

type Status = "online" | "offline" | "syncing" | "synced" | "error"

export function OfflineIndicator() {
  const [status, setStatus] = useState<Status>("online")
  const [pending, setPending] = useState(0)
  const [visible, setVisible] = useState(false)
  const { updateReady, applyUpdate, storageWarning, storageUsage } = useAppUpdate()
  const [storageDismissed, setStorageDismissed] = useState(false)

  useEffect(() => {
    // Check initial state
    if (!navigator.onLine) {
      setStatus("offline")
      setVisible(true)
    }

    const cleanup = onSyncStatus((s) => {
      setStatus(s)
      setVisible(true)
      if (s === "synced" || s === "online") {
        // Hide after 3s on success/reconnect
        setTimeout(() => setVisible(false), 3000)
      }
      if (s === "error") {
        // Auto-hide error after 5s (retry happens in background)
        setTimeout(() => setVisible(false), 5000)
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

  if (!visible && !updateReady && !(storageWarning && !storageDismissed)) return null

  return (
    <>
      {/* App update banner */}
      {updateReady && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-[101] animate-in slide-in-from-top">
          <button
            onClick={applyUpdate}
            className="flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-500/90 text-white text-sm font-medium shadow-lg backdrop-blur-xl hover:bg-indigo-600/90 transition-colors cursor-pointer"
          >
            <Download size={16} />
            <span>New version available · Tap to update</span>
          </button>
        </div>
      )}

      {/* Sync status pill */}
      {visible && (
        <div
          className={`
            fixed ${updateReady ? "top-28" : "top-16"} left-1/2 -translate-x-1/2 z-[100] px-4 py-2 rounded-full
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
      )}

      {/* Storage quota warning */}
      {storageWarning && !storageDismissed && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-[100] animate-in slide-in-from-bottom">
          <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-amber-500/90 text-white text-sm font-medium shadow-lg backdrop-blur-xl">
            <HardDrive size={16} />
            <span>Storage {storageUsage}% full</span>
            <button
              onClick={() => setStorageDismissed(true)}
              className="ml-1 px-2 py-0.5 rounded-full bg-white/20 hover:bg-white/30 text-xs cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}
    </>
  )
}
