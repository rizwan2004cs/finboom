"use client"

import { useEffect, useState } from "react"
import { Download, Smartphone, Wifi, Zap } from "lucide-react"

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>
}

export function PwaInstallBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [isInstalled, setIsInstalled] = useState(false)

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
    }
    window.addEventListener("beforeinstallprompt", handler)

    if (window.matchMedia("(display-mode: standalone)").matches) {
      setIsInstalled(true)
    }

    return () => window.removeEventListener("beforeinstallprompt", handler)
  }, [])

  const handleInstall = async () => {
    if (!deferredPrompt) return
    await deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === "accepted") setIsInstalled(true)
    setDeferredPrompt(null)
  }

  if (isInstalled) return null

  return (
    <section className="py-20 bg-gradient-to-b from-[#1d1d1f] to-[#000]">
      <div className="max-w-[980px] mx-auto px-6 text-center">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 border border-white/10 mb-6">
          <Smartphone className="w-4 h-4 text-white/70" />
          <span className="text-[13px] font-medium text-white/70">Available as App</span>
        </div>
        <h2 className="text-[40px] leading-[1.1] font-semibold tracking-[-0.3px] text-white mb-4">
          Install FinBoom.
        </h2>
        <p className="text-[17px] text-white/60 max-w-[500px] mx-auto mb-10">
          Add to your home screen for a native app experience. No app store needed.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 max-w-[700px] mx-auto mb-10">
          {[
            { icon: Zap, title: "Instant Launch", desc: "Opens like a native app from your home screen" },
            { icon: Wifi, title: "Works Offline", desc: "Access your data even without internet" },
            { icon: Download, title: "Zero Storage", desc: "No download from app store required" },
          ].map((item) => (
            <div key={item.title} className="bg-white/5 backdrop-blur-sm rounded-2xl p-5 border border-white/10">
              <item.icon className="w-6 h-6 text-white/80 mx-auto mb-3" strokeWidth={1.5} />
              <h3 className="text-[14px] font-semibold text-white mb-1">{item.title}</h3>
              <p className="text-[12px] text-white/50">{item.desc}</p>
            </div>
          ))}
        </div>

        {deferredPrompt && (
          <button
            onClick={handleInstall}
            className="px-7 py-3 rounded-full bg-white !text-black text-[17px] font-semibold hover:bg-white/90 transition-all shadow-[0_0_20px_rgba(255,255,255,0.2)]"
          >
            Install FinBoom
          </button>
        )}
        {!deferredPrompt && (
          <p className="text-[13px] text-white/40">
            Open in Chrome or Edge on mobile to install
          </p>
        )}
      </div>
    </section>
  )
}
