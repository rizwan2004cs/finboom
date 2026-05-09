"use client"

import { useCallback, useEffect, useRef, useState } from "react"

const PIN_KEY = "finboom-pin"
const PIN_UNLOCKED_KEY = "finboom-pin-unlocked"
const MAX_ATTEMPTS = 5
const LOCKOUT_KEY = "finboom-pin-lockout"
const LOCKOUT_DURATION = 60_000 // 1 minute

// --- Validation constraints (Groww-style) ---
const SEQUENTIAL_ASC = ["0123", "1234", "2345", "3456", "4567", "5678", "6789"]
const SEQUENTIAL_DESC = SEQUENTIAL_ASC.map((s) => s.split("").reverse().join(""))

function validatePin(pin: string): string | null {
  if (pin.length !== 4) return "PIN must be 4 digits"
  if (/^(\d)\1{3}$/.test(pin)) return "PIN cannot be all same digits"
  if (SEQUENTIAL_ASC.includes(pin) || SEQUENTIAL_DESC.includes(pin))
    return "PIN cannot be sequential digits"
  return null
}

function hashPin(pin: string): string {
  // Simple hash for local storage — not cryptographic, but sufficient
  // for a client-side app lock (the actual data is protected by auth)
  let h = 0
  const s = "fb:" + pin
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0
  }
  return h.toString(36)
}

function getSavedPin(): string | null {
  if (typeof window === "undefined") return null
  return localStorage.getItem(PIN_KEY)
}

function isUnlocked(): boolean {
  if (typeof window === "undefined") return true
  return sessionStorage.getItem(PIN_UNLOCKED_KEY) === "1"
}

// --- PIN Input Component ---
function PinInput({
  length = 4,
  value,
  onChange,
  error,
  disabled,
}: {
  length?: number
  value: string
  onChange: (v: string) => void
  error?: boolean
  disabled?: boolean
}) {
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Hidden input for keyboard */}
      <input
        ref={inputRef}
        type="tel"
        inputMode="numeric"
        pattern="[0-9]*"
        maxLength={length}
        value={value}
        onChange={(e) => {
          const v = e.target.value.replace(/\D/g, "").slice(0, length)
          onChange(v)
        }}
        className="sr-only"
        autoFocus
        disabled={disabled}
        autoComplete="off"
      />

      {/* Dot indicators */}
      <div
        className="flex gap-4 cursor-text"
        onClick={() => inputRef.current?.focus()}
      >
        {Array.from({ length }).map((_, i) => (
          <div
            key={i}
            className={`w-4 h-4 rounded-full transition-all duration-200 ${
              error
                ? "bg-red-500 animate-shake"
                : i < value.length
                  ? "bg-[#1d1d1f] dark:bg-white scale-110"
                  : "bg-[#d1d1d6] dark:bg-[#48484a]"
            }`}
          />
        ))}
      </div>
    </div>
  )
}

// --- Lock Screen ---
export function PinLockGate({ children }: { children: React.ReactNode }) {
  const [unlocked, setUnlocked] = useState(true) // default true to avoid flash
  const [hasPin, setHasPin] = useState(false)
  const [pin, setPin] = useState("")
  const [error, setError] = useState("")
  const [attempts, setAttempts] = useState(0)
  const [lockedUntil, setLockedUntil] = useState(0)
  const [countdown, setCountdown] = useState(0)

  useEffect(() => {
    const saved = getSavedPin()
    if (!saved) {
      setUnlocked(true)
      return
    }
    setHasPin(true)
    if (isUnlocked()) {
      setUnlocked(true)
    } else {
      setUnlocked(false)
    }
    // Check lockout
    const lockout = localStorage.getItem(LOCKOUT_KEY)
    if (lockout) {
      const until = parseInt(lockout, 10)
      if (Date.now() < until) {
        setLockedUntil(until)
      } else {
        localStorage.removeItem(LOCKOUT_KEY)
      }
    }
  }, [])

  // Countdown timer for lockout
  useEffect(() => {
    if (lockedUntil <= 0) return
    const interval = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((lockedUntil - Date.now()) / 1000))
      setCountdown(remaining)
      if (remaining <= 0) {
        setLockedUntil(0)
        setAttempts(0)
        localStorage.removeItem(LOCKOUT_KEY)
      }
    }, 1000)
    return () => clearInterval(interval)
  }, [lockedUntil])

  const handleSubmit = useCallback(
    (value: string) => {
      if (value.length !== 4) return
      if (lockedUntil > Date.now()) return

      const saved = getSavedPin()
      if (saved && hashPin(value) === saved) {
        sessionStorage.setItem(PIN_UNLOCKED_KEY, "1")
        setUnlocked(true)
        setError("")
        setAttempts(0)
        localStorage.removeItem(LOCKOUT_KEY)
      } else {
        const newAttempts = attempts + 1
        setAttempts(newAttempts)
        setError(`Incorrect PIN (${MAX_ATTEMPTS - newAttempts} attempts left)`)
        setPin("")

        if (newAttempts >= MAX_ATTEMPTS) {
          const until = Date.now() + LOCKOUT_DURATION
          setLockedUntil(until)
          localStorage.setItem(LOCKOUT_KEY, until.toString())
          setError("")
        }
      }
    },
    [attempts, lockedUntil]
  )

  useEffect(() => {
    if (pin.length === 4) handleSubmit(pin)
  }, [pin, handleSubmit])

  if (unlocked || !hasPin) return <>{children}</>

  const isLockedOut = lockedUntil > Date.now()

  return (
    <div className="fixed inset-0 z-[200] bg-gradient-to-br from-[#e8eaf0] via-[#f0eef5] to-[#eaf4f0] dark:from-[#0a0a0a] dark:via-[#111113] dark:to-[#0d0d0f] flex items-center justify-center">
      <div className="flex flex-col items-center gap-8 px-6">
        {/* Logo */}
        <div className="w-16 h-16 rounded-2xl bg-[#1d1d1f] dark:bg-white flex items-center justify-center">
          <span className="text-2xl font-bold text-white dark:text-[#1d1d1f]">F</span>
        </div>

        <div className="text-center">
          <h1 className="text-xl font-bold text-[#1d1d1f] dark:text-white mb-1">
            Enter PIN
          </h1>
          <p className="text-sm text-[#86868b]">
            Enter your 4-digit PIN to continue
          </p>
        </div>

        {isLockedOut ? (
          <div className="text-center">
            <p className="text-sm text-red-500 font-medium">
              Too many attempts
            </p>
            <p className="text-xs text-[#86868b] mt-1">
              Try again in {countdown}s
            </p>
          </div>
        ) : (
          <>
            <PinInput
              value={pin}
              onChange={setPin}
              error={!!error}
              disabled={isLockedOut}
            />
            {error && (
              <p className="text-xs text-red-500 font-medium">{error}</p>
            )}
          </>
        )}
      </div>
    </div>
  )
}

// --- Setup / Change PIN (for Settings) ---
export function PinSetup() {
  const [hasPin, setHasPin] = useState(false)
  const [mode, setMode] = useState<"idle" | "set" | "confirm" | "remove">("idle")
  const [pin, setPin] = useState("")
  const [confirmPin, setConfirmPin] = useState("")
  const [removePin, setRemovePin] = useState("")
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")

  useEffect(() => {
    setHasPin(!!getSavedPin())
  }, [])

  function handleSetPin(value: string) {
    setPin(value)
    if (value.length === 4) {
      const err = validatePin(value)
      if (err) {
        setError(err)
        setTimeout(() => { setPin(""); setError("") }, 800)
        return
      }
      setError("")
      setMode("confirm")
    }
  }

  function handleConfirm(value: string) {
    setConfirmPin(value)
    if (value.length === 4) {
      if (value !== pin) {
        setError("PINs don't match")
        setTimeout(() => { setConfirmPin(""); setError("") }, 800)
        return
      }
      localStorage.setItem(PIN_KEY, hashPin(pin))
      sessionStorage.setItem(PIN_UNLOCKED_KEY, "1")
      setHasPin(true)
      setMode("idle")
      setPin("")
      setConfirmPin("")
      setSuccess("PIN set successfully")
      setTimeout(() => setSuccess(""), 2000)
    }
  }

  function handleRemove(value: string) {
    setRemovePin(value)
    if (value.length === 4) {
      const saved = getSavedPin()
      if (saved && hashPin(value) === saved) {
        localStorage.removeItem(PIN_KEY)
        sessionStorage.removeItem(PIN_UNLOCKED_KEY)
        localStorage.removeItem(LOCKOUT_KEY)
        setHasPin(false)
        setMode("idle")
        setRemovePin("")
        setSuccess("PIN removed")
        setTimeout(() => setSuccess(""), 2000)
      } else {
        setError("Incorrect PIN")
        setTimeout(() => { setRemovePin(""); setError("") }, 800)
      }
    }
  }

  function cancel() {
    setMode("idle")
    setPin("")
    setConfirmPin("")
    setRemovePin("")
    setError("")
  }

  if (mode === "set") {
    return (
      <div className="flex flex-col items-center gap-4 py-2">
        <p className="text-sm text-[#1d1d1f] dark:text-white font-medium">Enter new PIN</p>
        <p className="text-xs text-[#86868b]">Avoid sequential or repeated digits</p>
        <PinInput value={pin} onChange={handleSetPin} error={!!error} />
        {error && <p className="text-xs text-red-500">{error}</p>}
        <button onClick={cancel} className="text-xs text-[#86868b] hover:text-[#1d1d1f] dark:hover:text-white">
          Cancel
        </button>
      </div>
    )
  }

  if (mode === "confirm") {
    return (
      <div className="flex flex-col items-center gap-4 py-2">
        <p className="text-sm text-[#1d1d1f] dark:text-white font-medium">Confirm PIN</p>
        <p className="text-xs text-[#86868b]">Re-enter your PIN to confirm</p>
        <PinInput value={confirmPin} onChange={handleConfirm} error={!!error} />
        {error && <p className="text-xs text-red-500">{error}</p>}
        <button onClick={cancel} className="text-xs text-[#86868b] hover:text-[#1d1d1f] dark:hover:text-white">
          Cancel
        </button>
      </div>
    )
  }

  if (mode === "remove") {
    return (
      <div className="flex flex-col items-center gap-4 py-2">
        <p className="text-sm text-[#1d1d1f] dark:text-white font-medium">Enter current PIN to remove</p>
        <PinInput value={removePin} onChange={handleRemove} error={!!error} />
        {error && <p className="text-xs text-red-500">{error}</p>}
        <button onClick={cancel} className="text-xs text-[#86868b] hover:text-[#1d1d1f] dark:hover:text-white">
          Cancel
        </button>
      </div>
    )
  }

  return (
    <div>
      {success && <p className="text-xs text-green-600 dark:text-green-400 mb-3">{success}</p>}
      <div className="flex gap-2">
        <button
          onClick={() => setMode("set")}
          className="flex-1 px-4 py-2.5 rounded-xl bg-[#f5f5f7] dark:bg-[#2c2c2e] text-[#1d1d1f] dark:text-white text-sm font-medium hover:bg-[#e8e8ed] dark:hover:bg-[#3a3a3c] transition-all"
        >
          {hasPin ? "Change PIN" : "Set PIN"}
        </button>
        {hasPin && (
          <button
            onClick={() => setMode("remove")}
            className="px-4 py-2.5 rounded-xl bg-[#f5f5f7] dark:bg-[#2c2c2e] text-red-500 text-sm font-medium hover:bg-[#e8e8ed] dark:hover:bg-[#3a3a3c] transition-all"
          >
            Remove
          </button>
        )}
      </div>
    </div>
  )
}
