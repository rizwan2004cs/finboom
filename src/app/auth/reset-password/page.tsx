"use client"

import { useState } from "react"
import { createClient } from "@/utils/supabase/client"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Eye, EyeOff, Lock } from "lucide-react"

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const router = useRouter()

  async function handleReset(e: React.FormEvent) {
    e.preventDefault()
    if (password.length < 6) {
      setError("Password must be at least 6 characters")
      return
    }
    if (password !== confirm) {
      setError("Passwords do not match")
      return
    }
    setLoading(true)
    setError(null)
    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password })
    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      setSuccess(true)
      setTimeout(() => router.push("/dashboard"), 2000)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#e8eaf0] via-[#f0eef5] to-[#eaf4f0] dark:from-[#0a0a0a] dark:via-[#111113] dark:to-[#0d0d0f] px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <Link href="/" className="text-3xl font-bold tracking-[-0.5px] text-[#1d1d1f] dark:text-white">
            FinBoom
          </Link>
          <p className="mt-2 text-[#86868b] text-sm">Set your new password</p>
        </div>

        <div className="liquid-glass rounded-2xl p-6 space-y-4">
          {success ? (
            <div className="text-center py-4">
              <p className="text-sm text-green-600 dark:text-green-400 font-medium">
                Password updated successfully!
              </p>
              <p className="text-xs text-[#86868b] mt-1">Redirecting to dashboard...</p>
            </div>
          ) : (
            <form onSubmit={handleReset} className="space-y-3">
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="New password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-white/60 dark:bg-white/[0.06] border border-black/[0.08] dark:border-white/[0.08] text-sm text-[#1d1d1f] dark:text-white placeholder:text-[#86868b] focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition-all"
                />
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#86868b]" />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#86868b] hover:text-[#1d1d1f] dark:hover:text-white"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="Confirm new password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                  minLength={6}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/60 dark:bg-white/[0.06] border border-black/[0.08] dark:border-white/[0.08] text-sm text-[#1d1d1f] dark:text-white placeholder:text-[#86868b] focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition-all"
                />
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#86868b]" />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 rounded-xl bg-[#1d1d1f] dark:bg-white text-white dark:text-[#1d1d1f] text-sm font-medium hover:opacity-90 transition-all disabled:opacity-50"
              >
                {loading ? "Updating..." : "Update Password"}
              </button>

              {error && (
                <p className="text-xs text-red-500 text-center">{error}</p>
              )}
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
