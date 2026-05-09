"use client"

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react"

type DialogType = "alert" | "confirm"

interface DialogOptions {
  title?: string
  confirmLabel?: string
  cancelLabel?: string
  destructive?: boolean
}

interface DialogState {
  type: DialogType
  message: string
  options: DialogOptions
  resolve: (value: boolean) => void
}

interface AppDialogContextValue {
  showAlert: (message: string, options?: DialogOptions) => Promise<void>
  showConfirm: (message: string, options?: DialogOptions) => Promise<boolean>
}

const AppDialogContext = createContext<AppDialogContextValue | null>(null)

export function useAppDialog() {
  const ctx = useContext(AppDialogContext)
  if (!ctx) throw new Error("useAppDialog must be used within AppDialogProvider")
  return ctx
}

export function AppDialogProvider({ children }: { children: React.ReactNode }) {
  const [dialog, setDialog] = useState<DialogState | null>(null)
  const backdropRef = useRef<HTMLDivElement>(null)

  const showAlert = useCallback(
    (message: string, options: DialogOptions = {}) =>
      new Promise<void>((resolve) => {
        setDialog({
          type: "alert",
          message,
          options,
          resolve: () => resolve(),
        })
      }),
    []
  )

  const showConfirm = useCallback(
    (message: string, options: DialogOptions = {}) =>
      new Promise<boolean>((resolve) => {
        setDialog({
          type: "confirm",
          message,
          options,
          resolve,
        })
      }),
    []
  )

  const dismiss = useCallback(
    (value: boolean) => {
      if (!dialog) return
      dialog.resolve(value)
      setDialog(null)
    },
    [dialog]
  )

  // Escape key
  useEffect(() => {
    if (!dialog) return
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") dismiss(false)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [dialog, dismiss])

  return (
    <AppDialogContext.Provider value={{ showAlert, showConfirm }}>
      {children}
      {dialog && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            ref={backdropRef}
            className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-fade-in"
            onClick={() => dismiss(false)}
          />
          {/* Panel */}
          <div className="relative w-full max-w-sm max-w-[calc(100vw-2rem)] glass-elevated rounded-2xl shadow-2xl p-6 animate-fade-in">
            {dialog.options.title && (
              <h2 className="text-base font-semibold text-[#1d1d1f] dark:text-white mb-2">
                {dialog.options.title}
              </h2>
            )}
            <p className="text-sm text-[#3a3a3c] dark:text-[#b0b0b8] leading-relaxed">
              {dialog.message}
            </p>
            <div className="flex gap-3 mt-5 justify-end">
              {dialog.type === "confirm" && (
                <button
                  onClick={() => dismiss(false)}
                  className="liquid-glass-btn px-4 py-2 rounded-xl text-sm font-medium"
                >
                  {dialog.options.cancelLabel || "Cancel"}
                </button>
              )}
              <button
                onClick={() => dismiss(dialog.type === "confirm" ? true : false)}
                className={
                  dialog.options.destructive
                    ? "px-4 py-2 rounded-xl text-sm font-medium bg-red-500/90 hover:bg-red-500 text-white shadow-sm transition-all active:scale-95"
                    : "liquid-glass-btn-primary px-4 py-2 rounded-xl text-sm font-medium"
                }
                autoFocus
              >
                {dialog.options.confirmLabel ||
                  (dialog.type === "alert" ? "OK" : "Confirm")}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppDialogContext.Provider>
  )
}
