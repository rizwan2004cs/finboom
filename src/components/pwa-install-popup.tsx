"use client"

import { useEffect, useState } from "react"
import { Download, X } from "lucide-react"

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>
}

const DISMISS_KEY = "pwa-install-dismissed"

export function PwaInstallPopup() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    // Already installed as PWA
    if (window.matchMedia("(display-mode: standalone)").matches) return
    // User already dismissed
    if (localStorage.getItem(DISMISS_KEY)) return

    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
      // Small delay so page content loads first
      setTimeout(() => setVisible(true), 2000)
    }

    window.addEventListener("beforeinstallprompt", handler)
    return () => window.removeEventListener("beforeinstallprompt", handler)
  }, [])

  const handleInstall = async () => {
    if (!deferredPrompt) return
    await deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === "accepted") {
      localStorage.setItem(DISMISS_KEY, "installed")
    }
    setVisible(false)
    setDeferredPrompt(null)
  }

  const handleDismiss = () => {
    localStorage.setItem(DISMISS_KEY, Date.now().toString())
    setVisible(false)
  }

  if (!visible) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-9998 animate-[fadeIn_0.2s_ease]"
        onClick={handleDismiss}
      />
      {/* Popup */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-9999 w-[calc(100%-2rem)] max-w-95 animate-[slideUp_0.3s_ease]">
        <div className="rounded-2xl bg-white dark:bg-[#2c2c2e] border border-black/5 dark:border-white/10 shadow-2xl shadow-black/20 p-5">
          {/* Close button */}
          <button
            onClick={handleDismiss}
            className="absolute top-3 right-3 p-1 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
            aria-label="Dismiss"
          >
            <X className="w-4 h-4 text-[#86868b]" />
          </button>

          {/* Icon */}
          <div className="w-14 h-14 rounded-2xl bg-[#1d1d1f] dark:bg-white flex items-center justify-center mb-4 shadow-lg shadow-black/10 dark:shadow-white/10">
            <Download className="w-7 h-7 text-white dark:text-black" strokeWidth={2} />
          </div>

          {/* Text */}
          <h3 className="text-[17px] font-semibold text-[#1d1d1f] dark:text-white leading-tight mb-1">
            Add FinBoom to Home Screen
          </h3>
          <p className="text-[13px] text-[#86868b] leading-relaxed mb-5">
            Install for instant access, offline support, and a native app experience. No app store needed.
          </p>

          {/* Buttons */}
          <div className="flex gap-3">
            <button
              onClick={handleDismiss}
              className="flex-1 py-2.5 rounded-xl text-[14px] font-medium text-[#86868b] hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
            >
              Not Now
            </button>
            <button
              onClick={handleInstall}
              className="flex-1 py-2.5 rounded-xl text-[14px] font-medium bg-[#1d1d1f] dark:bg-white text-white dark:text-[#1d1d1f] hover:opacity-90 transition-colors shadow-md shadow-black/10 dark:shadow-white/10"
            >
              Install App
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
