"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { createPortal } from "react-dom"
import { ChevronDown } from "lucide-react"

interface Option {
  value: string
  label: string
}

interface CustomSelectProps {
  value: string
  onChange: (value: string) => void
  options: Option[]
  placeholder?: string
  className?: string
  required?: boolean
  variant?: "default" | "glass"
}

export function CustomSelect({ value, onChange, options, placeholder, className = "", required, variant = "default" }: CustomSelectProps) {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0, openUp: false })

  const updatePos = useCallback(() => {
    if (!triggerRef.current) return
    const rect = triggerRef.current.getBoundingClientRect()
    const spaceBelow = window.innerHeight - rect.bottom
    const spaceAbove = rect.top
    const openUp = spaceBelow < 220 && spaceAbove > spaceBelow
    setPos({
      top: openUp ? rect.top : rect.bottom + 4,
      left: rect.left,
      width: rect.width,
      openUp,
    })
  }, [])

  useEffect(() => {
    if (!open) return
    updatePos()
    window.addEventListener("scroll", updatePos, true)
    window.addEventListener("resize", updatePos)
    return () => {
      window.removeEventListener("scroll", updatePos, true)
      window.removeEventListener("resize", updatePos)
    }
  }, [open, updatePos])

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      const t = e.target as Node
      if (triggerRef.current?.contains(t) || dropdownRef.current?.contains(t)) return
      setOpen(false)
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [open])

  const selected = options.find(o => o.value === value)

  return (
    <>
      <div className={`relative ${className}`}>
        <button
          ref={triggerRef}
          type="button"
          onClick={() => setOpen(v => !v)}
          className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm text-left focus:outline-none focus:ring-2 focus:ring-[#1d1d1f]/10 dark:focus:ring-white/10 ${
            variant === "glass"
              ? "bg-white/70 dark:bg-white/[0.08] border border-black/[0.08] dark:border-white/[0.08]"
              : "bg-[#f5f5f7] dark:bg-[#2c2c2e]"
          }`}
        >
          <span className={selected ? "text-[#1d1d1f] dark:text-white" : "text-[#86868b]"}>
            {selected ? selected.label : placeholder || "Select..."}
          </span>
          <ChevronDown className={`w-4 h-4 text-[#86868b] transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
        {required && <input type="text" value={value} required className="sr-only" tabIndex={-1} readOnly />}
      </div>

      {open && typeof document !== "undefined" && createPortal(
        <div
          ref={dropdownRef}
          className="fixed bg-[#ffffff] dark:bg-[#2c2c2e] rounded-xl shadow-2xl border border-black/[0.08] dark:border-white/[0.08] max-h-52 overflow-y-auto overscroll-contain"
          style={{
            zIndex: 99999,
            top: pos.openUp ? undefined : pos.top,
            bottom: pos.openUp ? `${window.innerHeight - pos.top + 4}px` : undefined,
            left: pos.left,
            width: pos.width,
          }}
        >
          {options.length === 0 ? (
            <div className="px-4 py-3 text-sm text-[#86868b]">No options</div>
          ) : options.map(option => (
            <button
              key={option.value}
              type="button"
              onClick={() => { onChange(option.value); setOpen(false) }}
              className={`w-full px-4 py-2.5 text-sm text-left transition-colors first:rounded-t-xl last:rounded-b-xl ${
                option.value === value
                  ? "bg-[#f5f5f7] dark:bg-[#3a3a3c] font-medium text-[#1d1d1f] dark:text-white"
                  : "text-[#1d1d1f] dark:text-white hover:bg-[#f5f5f7] dark:hover:bg-[#3a3a3c]"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>,
        document.body
      )}
    </>
  )
}
