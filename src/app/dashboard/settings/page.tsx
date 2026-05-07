"use client"

import { useEffect, useState } from "react"
import { useUser, useClerk } from "@clerk/nextjs"
import { createClient } from "@/utils/supabase/client"
import { Settings, Download, Globe, Trash2, Users, LogOut, Moon, Sun } from "lucide-react"
import { CURRENCIES } from "@/lib/constants"
import type { SharedAccess } from "@/lib/types"

export default function SettingsPage() {
  const { user } = useUser()
  const { signOut } = useClerk()
  const [currency, setCurrency] = useState("INR")
  const [theme, setTheme] = useState<"light" | "dark" | "system">(() => {
    if (typeof window !== "undefined") {
      return (localStorage.getItem("theme") as "light" | "dark" | "system") || "light"
    }
    return "light"
  })
  const [sharedAccess, setSharedAccess] = useState<SharedAccess[]>([])
  const [shareEmail, setShareEmail] = useState("")
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    if (!user) return
    loadSettings()
  }, [user])

  useEffect(() => {
    // Apply theme
    const root = document.documentElement
    if (theme === "dark") {
      root.classList.add("dark")
    } else if (theme === "light") {
      root.classList.remove("dark")
    } else {
      // System preference
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches
      root.classList.toggle("dark", prefersDark)
    }
    localStorage.setItem("theme", theme)
  }, [theme])

  async function loadSettings() {
    const supabase = createClient()

    // Load profile settings
    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", user!.id)
      .eq("type", "personal")
      .single()

    if (profile?.currency) setCurrency(profile.currency)

    // Load shared access
    const { data: shared } = await supabase
      .from("shared_access")
      .select("*")
      .eq("owner_user_id", user!.id)

    setSharedAccess(shared || [])

    setLoading(false)
  }

  async function saveCurrency(newCurrency: string) {
    setCurrency(newCurrency)
    const supabase = createClient()
    await supabase
      .from("profiles")
      .update({ currency: newCurrency })
      .eq("user_id", user!.id)
      .eq("type", "personal")
  }

  async function exportData(format: "csv" | "json") {
    setExporting(true)
    const supabase = createClient()

    const [assetsRes, liabilitiesRes, transactionsRes] = await Promise.all([
      supabase.from("assets").select("*").eq("user_id", user!.id),
      supabase.from("liabilities").select("*").eq("user_id", user!.id),
      supabase.from("transactions").select("*").eq("user_id", user!.id),
    ])

    const data = {
      assets: assetsRes.data || [],
      liabilities: liabilitiesRes.data || [],
      transactions: transactionsRes.data || [],
      exportedAt: new Date().toISOString(),
    }

    let blob: Blob
    let filename: string

    if (format === "json") {
      blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" })
      filename = `finboom-export-${new Date().toISOString().slice(0, 10)}.json`
    } else {
      // CSV - export assets as example
      const headers = ["name", "asset_class", "invested_value", "current_value", "created_at"]
      const rows = (data.assets || []).map(a =>
        headers.map(h => String((a as Record<string, unknown>)[h] ?? "")).join(",")
      )
      const csv = [headers.join(","), ...rows].join("\n")
      blob = new Blob([csv], { type: "text/csv" })
      filename = `finboom-assets-${new Date().toISOString().slice(0, 10)}.csv`
    }

    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)

    setExporting(false)
  }

  async function addSharedAccess(e: React.FormEvent) {
    e.preventDefault()
    if (!user || !shareEmail.trim()) return

    const supabase = createClient()
    await supabase.from("shared_access").insert({
      owner_user_id: user.id,
      shared_with_email: shareEmail.trim(),
      permission: "view",
    })

    setShareEmail("")
    loadSettings()
  }

  async function removeSharedAccess(id: string) {
    const supabase = createClient()
    await supabase.from("shared_access").delete().eq("id", id)
    setSharedAccess(prev => prev.filter(s => s.id !== id))
  }

  async function deleteAccount() {
    if (!confirm("Are you sure? This will permanently delete all your data. This cannot be undone.")) return
    if (!confirm("Last chance! Type DELETE in the next prompt if you really want to proceed.")) return

    const supabase = createClient()
    // Delete all user data
    await Promise.all([
      supabase.from("assets").delete().eq("user_id", user!.id),
      supabase.from("liabilities").delete().eq("user_id", user!.id),
      supabase.from("transactions").delete().eq("user_id", user!.id),
      supabase.from("goals").delete().eq("user_id", user!.id),
      supabase.from("snapshots").delete().eq("user_id", user!.id),
      supabase.from("health_checks").delete().eq("user_id", user!.id),
      supabase.from("profiles").delete().eq("user_id", user!.id),
      supabase.from("shared_access").delete().eq("owner_user_id", user!.id),
    ])

    signOut()
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="skeleton h-7 w-24 rounded-lg" />
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="liquid-glass rounded-2xl p-5 space-y-3">
            <div className="skeleton h-4 w-32 rounded-lg" />
            <div className="skeleton h-9 w-full rounded-xl" />
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-[#1d1d1f]">Settings</h1>
        <p className="text-sm text-[#86868b]">Manage your preferences</p>
      </div>

      {/* Account */}
      <div className="liquid-glass rounded-2xl p-5">
        <h3 className="font-semibold text-[#1d1d1f] mb-3 flex items-center gap-2">
          <Settings className="w-4 h-4" /> Account
        </h3>
        <div className="flex items-center gap-3">
          {user?.imageUrl && (
            <img src={user.imageUrl} alt="" className="w-10 h-10 rounded-full" />
          )}
          <div>
            <p className="text-sm font-medium text-[#1d1d1f]">{user?.fullName || "User"}</p>
            <p className="text-xs text-[#86868b]">{user?.primaryEmailAddress?.emailAddress}</p>
          </div>
        </div>
      </div>

      {/* Theme */}
      <div className="liquid-glass rounded-2xl p-5">
        <h3 className="font-semibold text-[#1d1d1f] mb-3 flex items-center gap-2">
          {theme === "dark" ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />} Appearance
        </h3>
        <div className="grid grid-cols-3 gap-2">
          {(["light", "dark", "system"] as const).map(t => (
            <button
              key={t}
              onClick={() => setTheme(t)}
              className={`px-3 py-2.5 rounded-xl text-xs font-medium capitalize transition-all ${
                theme === t
                  ? "bg-[#1d1d1f] text-white"
                  : "bg-[#f5f5f7] text-[#86868b] hover:text-[#1d1d1f]"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Currency */}
      <div className="liquid-glass rounded-2xl p-5">
        <h3 className="font-semibold text-[#1d1d1f] mb-3 flex items-center gap-2">
          <Globe className="w-4 h-4" /> Currency
        </h3>
        <select
          value={currency}
          onChange={(e) => saveCurrency(e.target.value)}
          className="w-full px-4 py-2.5 rounded-xl bg-[#f5f5f7] border-0 text-sm text-[#1d1d1f] focus:outline-none focus:ring-2 focus:ring-[#1d1d1f]/10"
        >
          {CURRENCIES.map(c => (
            <option key={c.code} value={c.code}>
              {c.symbol} {c.code} - {c.name}
            </option>
          ))}
        </select>
      </div>

      {/* Export Data */}
      <div className="liquid-glass rounded-2xl p-5">
        <h3 className="font-semibold text-[#1d1d1f] mb-3 flex items-center gap-2">
          <Download className="w-4 h-4" /> Export Data
        </h3>
        <p className="text-xs text-[#86868b] mb-3">Download all your financial data</p>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => exportData("json")}
            disabled={exporting}
            className="px-4 py-2.5 rounded-xl bg-[#f5f5f7] text-[#1d1d1f] text-sm font-medium hover:bg-[#e8e8ed] transition-all disabled:opacity-50"
          >
            Export JSON
          </button>
          <button
            onClick={() => exportData("csv")}
            disabled={exporting}
            className="px-4 py-2.5 rounded-xl bg-[#f5f5f7] text-[#1d1d1f] text-sm font-medium hover:bg-[#e8e8ed] transition-all disabled:opacity-50"
          >
            Export CSV
          </button>
        </div>
      </div>

      {/* Shared Access */}
      <div className="liquid-glass rounded-2xl p-5">
        <h3 className="font-semibold text-[#1d1d1f] mb-3 flex items-center gap-2">
          <Users className="w-4 h-4" /> Shared Access
        </h3>
        <p className="text-xs text-[#86868b] mb-3">
          Grant read-only access to your financial data
        </p>

        <form onSubmit={addSharedAccess} className="flex gap-2 mb-3">
          <input
            type="email"
            value={shareEmail}
            onChange={(e) => setShareEmail(e.target.value)}
            placeholder="email@example.com"
            className="flex-1 px-4 py-2.5 rounded-xl bg-[#f5f5f7] border-0 text-sm text-[#1d1d1f] placeholder:text-[#86868b] focus:outline-none focus:ring-2 focus:ring-[#1d1d1f]/10"
          />
          <button
            type="submit"
            className="liquid-glass-btn-primary"
          >
            Add
          </button>
        </form>

        {sharedAccess.length > 0 && (
          <div className="space-y-2">
            {sharedAccess.map(access => (
              <div key={access.id} className="flex items-center justify-between py-2 px-3 bg-[#f5f5f7] rounded-xl">
                <span className="text-sm text-[#1d1d1f]">{access.shared_with_email}</span>
                <button
                  onClick={() => removeSharedAccess(access.id)}
                  className="p-1 rounded hover:bg-white transition-all"
                >
                  <Trash2 className="w-3.5 h-3.5 text-[#86868b]" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Sign Out */}
      <button
        onClick={() => signOut()}
        className="w-full py-3 rounded-xl bg-[#f5f5f7] text-[#1d1d1f] text-sm font-medium hover:bg-[#e8e8ed] transition-all flex items-center justify-center gap-2"
      >
        <LogOut className="w-4 h-4" />
        Sign Out
      </button>

      {/* Danger Zone */}
      <div className="liquid-glass rounded-2xl p-5">
        <h3 className="font-semibold text-[#1d1d1f] mb-2 flex items-center gap-2">
          <Trash2 className="w-4 h-4" /> Danger Zone
        </h3>
        <p className="text-xs text-[#86868b] mb-3">
          Permanently delete your account and all data. This cannot be undone.
        </p>
        <button
          onClick={deleteAccount}
          className="liquid-glass-btn-primary"
        >
          Delete Account
        </button>
      </div>
    </div>
  )
}
