"use client"

import { useEffect, useState } from "react"
import { WifiOff, RefreshCw, Download, HardDrive } from "lucide-react"
import { onSyncStatus, getPendingCount } from "@/lib/offline"
import { useAppUpdate } from "@/components/offline-provider"

type Status = "online" | "offline" | "syncing" | "synced" | "error"

/* ── Floating banners (update + storage) ── */
export function OfflineIndicator() {
  const { updateReady, applyUpdate, storageWarning, storageUsage } = useAppUpdate()
  const [storageDismissed, setStorageDismissed] = useState(false)

  if (!updateReady && !(storageWarning && !storageDismissed)) return null

  return (
    <>
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

/* ── Inline sync icon for TopBar ── */
export function SyncButton({ onSync }: { onSync: () => void }) {
  const [status, setStatus] = useState<Status>("online")
  const [pending, setPending] = useState(0)

  useEffect(() => {
    if (!navigator.onLine) setStatus("offline")

    const cleanup = onSyncStatus((s) => setStatus(s))

    const interval = setInterval(async () => {
      const count = await getPendingCount()
      setPending(count)
    }, 5000)

    return () => { cleanup(); clearInterval(interval) }
  }, [])

  const spinning = status === "syncing"
  const isOffline = status === "offline"
  const hasError = status === "error"

  let color = "text-[#1d1d1f] dark:text-white"
  if (spinning) color = "text-[#1d1d1f] dark:text-white"
  else if (isOffline) color = "text-amber-500"
  else if (hasError) color = "text-red-500"

  const title = isOffline
    ? `Offline${pending > 0 ? ` · ${pending} pending` : ""}`
    : spinning
      ? "Syncing..."
      : hasError
        ? "Sync failed · tap to retry"
        : status === "synced"
          ? "All synced"
          : "Tap to sync"

  return (
    <button
      onClick={onSync}
      disabled={spinning || isOffline}
      title={title}
      suppressHydrationWarning
      className={`relative p-2 rounded-xl transition-all duration-200 hover:bg-white/60 dark:hover:bg-white/[0.06] disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer ${color}`}
    >
      {isOffline ? (
        <WifiOff className="w-[18px] h-[18px]" strokeWidth={1.5} />
      ) : (
        <RefreshCw
          className={`w-[18px] h-[18px] transition-transform duration-300 ${spinning ? "animate-spin" : ""}`}
          strokeWidth={1.5}
        />
      )}
      {pending > 0 && !spinning && (
        <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 flex items-center justify-center rounded-full bg-amber-500 text-white text-[10px] font-bold leading-none">
          {pending}
        </span>
      )}
    </button>
  )
}
