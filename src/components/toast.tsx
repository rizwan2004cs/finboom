"use client"

import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react"
import { CheckCircle2, AlertTriangle, Info, X } from "lucide-react"

type ToastType = "success" | "error" | "info"

interface ToastItemData {
  id: number
  type: ToastType
  message: string
}

interface ToastContextValue {
  toast: (message: string, type?: ToastType) => void
  success: (message: string) => void
  error: (message: string) => void
  info: (message: string) => void
}

// No-op fallback so the hook is safe to call from shared hooks even if a
// provider isn't mounted (e.g. in tests or non-dashboard trees).
const NOOP: ToastContextValue = {
  toast: () => {},
  success: () => {},
  error: () => {},
  info: () => {},
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function useToast(): ToastContextValue {
  return useContext(ToastContext) ?? NOOP
}

const TOAST_STYLES: Record<ToastType, { ring: string; icon: React.ReactNode }> = {
  success: {
    ring: "ring-emerald-500/30",
    icon: <CheckCircle2 className="w-4 h-4 text-emerald-500" />,
  },
  error: {
    ring: "ring-red-500/30",
    icon: <AlertTriangle className="w-4 h-4 text-red-500" />,
  },
  info: {
    ring: "ring-accent/30",
    icon: <Info className="w-4 h-4 text-accent" />,
  },
}

function ToastCard({ toast, onClose }: Readonly<{ toast: ToastItemData; onClose: () => void }>) {
  const style = TOAST_STYLES[toast.type]
  return (
    <div
      aria-live="polite"
      className={`pointer-events-auto flex items-center gap-2.5 max-w-[calc(100vw-2rem)] sm:max-w-sm px-4 py-3 rounded-2xl glass-elevated shadow-2xl ring-1 ${style.ring} animate-fade-in`}
    >
      <span className="shrink-0">{style.icon}</span>
      <p className="text-sm text-[#1d1d1f] dark:text-white leading-snug">{toast.message}</p>
      <button
        onClick={onClose}
        aria-label="Dismiss"
        className="ml-1 shrink-0 p-1 rounded-full hover:bg-black/5 dark:hover:bg-white/10"
      >
        <X className="w-3.5 h-3.5 text-[#86868b]" />
      </button>
    </div>
  )
}

export function ToastProvider({ children }: Readonly<{ children: React.ReactNode }>) {
  const [toasts, setToasts] = useState<ToastItemData[]>([])
  const idRef = useRef(0)

  const remove = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const toast = useCallback(
    (message: string, type: ToastType = "info") => {
      if (!message) return
      const id = (idRef.current += 1)
      setToasts((prev) => [...prev.slice(-2), { id, type, message }])
      setTimeout(() => remove(id), 4000)
    },
    [remove]
  )

  const success = useCallback((m: string) => toast(m, "success"), [toast])
  const error = useCallback((m: string) => toast(m, "error"), [toast])
  const info = useCallback((m: string) => toast(m, "info"), [toast])

  const value = useMemo(
    () => ({ toast, success, error, info }),
    [toast, success, error, info]
  )

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed z-[200] bottom-0 inset-x-0 flex flex-col items-center gap-2 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pointer-events-none">
        {toasts.map((t) => (
          <ToastCard key={t.id} toast={t} onClose={() => remove(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}
