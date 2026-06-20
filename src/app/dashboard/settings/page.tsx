"use client"

import { useEffect, useState } from "react"
import { useUser, useAuth } from "@/hooks/use-auth"
import { createClient } from "@/utils/supabase/client"
import { Settings, Download, Globe, Trash2, LogOut, Moon, Sun, RefreshCw, Lock } from "lucide-react"
import { PinSetup } from "@/components/pin-lock"
import { CURRENCIES } from "@/lib/constants"
import { CustomSelect } from "@/components/custom-select"
import { useAppDialog } from "@/components/app-dialog"
import { useCurrency } from "@/hooks/use-currency"

export default function SettingsPage() {
  const { user } = useUser()
  const { signOut } = useAuth()
  const { currency, setCurrency, refreshRates, loading: ratesLoading, lastUpdated } = useCurrency()
  const [fetchingRates, setFetchingRates] = useState(false)
           const [isOnline, setIsOnline] = useState(typeof navigator !== "undefined" ? navigator.onLine : true)

  useEffect(() => {
    const goOnline = () => setIsOnline(true)
    const goOffline = () => setIsOnline(false)
    window.addEventListener("online", goOnline)
    window.addEventListener("offline", goOffline)
    return () => { window.removeEventListener("online", goOnline); window.removeEventListener("offline", goOffline) }
  }, [])
  const [theme, setTheme] = useState<"light" | "dark" | "system">(() => {
    if (typeof window !== "undefined") {
      return (localStorage.getItem("theme") as "light" | "dark" | "system") || "light"
    }
    return "light"
  })
  const [exporting, setExporting] = useState(false)
  const loading = !user

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

  async function saveCurrency(newCurrency: string) {
    setCurrency(newCurrency)
  }

  async function exportData(format: "csv" | "json") {
    setExporting(true)
    const supabase = createClient()

    const [
      assetsRes,
      liabilitiesRes,
      transactionsRes,
      goalsRes,
      snapshotsRes,
      profilesRes,
      partiesRes,
      partyTxRes,
      budgetsRes,
    ] = await Promise.all([
      supabase.from("assets").select("*").eq("user_id", user!.id),
      supabase.from("liabilities").select("*").eq("user_id", user!.id),
      supabase.from("transactions").select("*").eq("user_id", user!.id),
      supabase.from("goals").select("*").eq("user_id", user!.id),
      supabase.from("snapshots").select("*").eq("user_id", user!.id),
      supabase.from("profiles").select("*").eq("user_id", user!.id),
      supabase.from("parties").select("*").eq("user_id", user!.id),
      supabase.from("party_transactions").select("*").eq("user_id", user!.id),
      supabase.from("budgets").select("*").eq("user_id", user!.id),
    ])

    const data = {
      profiles: profilesRes.data || [],
      assets: assetsRes.data || [],
      liabilities: liabilitiesRes.data || [],
      transactions: transactionsRes.data || [],
      goals: goalsRes.data || [],
      snapshots: snapshotsRes.data || [],
      parties: partiesRes.data || [],
      partyTransactions: partyTxRes.data || [],
      budgets: budgetsRes.data || [],
      exportedAt: new Date().toISOString(),
    }

    let blob: Blob
    let filename: string
    const dateStr = new Date().toISOString().slice(0, 10)

    if (format === "json") {
      blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" })
      filename = `finboom-export-${dateStr}.json`
    } else {
      // CSV — one sheet per table, separated by headers
      const sections: string[] = []

      const toCsv = (label: string, rows: Record<string, unknown>[]) => {
        if (!rows.length) return `# ${label}\n(no data)\n`
        const keys = Object.keys(rows[0])
        const header = keys.join(",")
        const lines = rows.map(r =>
          keys.map(k => {
            const v = r[k]
            const s = v == null ? "" : String(v)
            return s.includes(",") || s.includes('"') || s.includes("\n")
              ? `"${s.replace(/"/g, '""')}"`
              : s
          }).join(",")
        )
        return `# ${label}\n${header}\n${lines.join("\n")}\n`
      }

      sections.push(toCsv("Profiles", data.profiles))
      sections.push(toCsv("Assets", data.assets))
      sections.push(toCsv("Liabilities", data.liabilities))
      sections.push(toCsv("Transactions", data.transactions))
      sections.push(toCsv("Goals", data.goals))
      sections.push(toCsv("Snapshots", data.snapshots))
      sections.push(toCsv("Parties", data.parties))
      sections.push(toCsv("Party Transactions", data.partyTransactions))
      sections.push(toCsv("Budgets", data.budgets))

      blob = new Blob([sections.join("\n")], { type: "text/csv" })
      filename = `finboom-export-${dateStr}.csv`
    }

    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)

    setExporting(false)
  }

  const { showConfirm } = useAppDialog()

  async function deleteAccount() {
    if (!(await showConfirm("Are you sure? This will permanently delete all your data. This cannot be undone.", { title: "Delete Account", destructive: true, confirmLabel: "Delete Everything" }))) return
    await showConfirm("Last chance! This action cannot be reversed.", {
      title: "Final Confirmation",
      destructive: true,
      confirmLabel: "Yes, Delete",
      onConfirm: async () => {
        const supabase = createClient()
        await Promise.all([
          supabase.from("assets").delete().eq("user_id", user!.id),
          supabase.from("liabilities").delete().eq("user_id", user!.id),
          supabase.from("transactions").delete().eq("user_id", user!.id),
          supabase.from("goals").delete().eq("user_id", user!.id),
          supabase.from("snapshots").delete().eq("user_id", user!.id),
          supabase.from("health_checks").delete().eq("user_id", user!.id),
          supabase.from("profiles").delete().eq("user_id", user!.id),
        ])
        signOut()
      },
    })
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
    <div className="space-y-4" data-tour-page="settings">
      {/* Header */}
      <div data-tour-el="settings-header">
        <h1 className="text-xl font-bold text-[#1d1d1f] dark:text-white">Settings</h1>
        <p className="text-sm text-[#86868b]">Manage your preferences</p>
      </div>

      {/* Account */}
      <div className="liquid-glass rounded-2xl p-5">
        <h3 className="font-semibold text-[#1d1d1f] dark:text-white mb-3 flex items-center gap-2">
          <Settings className="w-4 h-4" /> Account
        </h3>
        <div className="flex items-center gap-3">
          {user?.imageUrl && (
            <img src={user.imageUrl} alt="" className="w-10 h-10 rounded-full" referrerPolicy="no-referrer" />
          )}
          <div>
            <p className="text-sm font-medium text-[#1d1d1f] dark:text-white">{user?.fullName || "User"}</p>
            <p className="text-xs text-[#86868b]">{user?.email}</p>
          </div>
        </div>
      </div>

      {/* Theme */}
      <div className="liquid-glass rounded-2xl p-5">
        <h3 className="font-semibold text-[#1d1d1f] dark:text-white mb-3 flex items-center gap-2">
          {theme === "dark" ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />} Appearance
        </h3>
        <div className="grid grid-cols-3 gap-2">
          {(["light", "dark", "system"] as const).map(t => (
            <button
              key={t}
              onClick={() => setTheme(t)}
              className={`px-3 py-2.5 rounded-xl text-xs font-medium capitalize transition-all ${
                theme === t
                  ? "bg-[#1d1d1f] dark:bg-white text-white dark:text-[#1d1d1f]"
                  : "bg-[#f5f5f7] dark:bg-[#2c2c2e] text-[#86868b] hover:text-[#1d1d1f] dark:hover:text-white"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* PIN Lock */}
      <div className="liquid-glass rounded-2xl p-5">
        <h3 className="font-semibold text-[#1d1d1f] dark:text-white mb-2 flex items-center gap-2">
          <Lock className="w-4 h-4" /> PIN Lock
        </h3>
        <p className="text-xs text-[#86868b] mb-3">
          Add a 4-digit PIN to lock your dashboard. Works offline.
        </p>
        <PinSetup />
      </div>

      {/* Currency */}
      <div className="liquid-glass rounded-2xl p-5">
        <h3 className="font-semibold text-[#1d1d1f] dark:text-white mb-3 flex items-center gap-2">
          <Globe className="w-4 h-4" /> Currency
        </h3>
        <CustomSelect
          value={currency}
          onChange={(val) => saveCurrency(val)}
          options={CURRENCIES.map(c => ({ value: c.code, label: `${c.symbol} ${c.code} - ${c.name}` }))}
        />
        <div className="flex items-center justify-between mt-3">
          <p className="text-xs text-[#86868b]">
            {lastUpdated
              ? `Rates updated: ${new Date(lastUpdated).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}`
              : "No rates fetched yet"}
          </p>
          <button
            onClick={async () => {
              setFetchingRates(true)
              try { await refreshRates() } finally { setFetchingRates(false) }
            }}
            disabled={fetchingRates || ratesLoading || !isOnline}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#f5f5f7] dark:bg-[#2c2c2e] text-xs font-medium text-[#6e6e73] dark:text-[#aeaeb2] hover:text-[#1d1d1f] dark:hover:text-white hover:bg-[#e8e8ed] dark:hover:bg-[#3a3a3c] transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${fetchingRates ? "animate-spin" : ""}`} />
            {fetchingRates ? "Fetching…" : "Fetch latest rates"}
          </button>
        </div>
      </div>

      {/* Export Data */}
      <div className="liquid-glass rounded-2xl p-5">
        <h3 className="font-semibold text-[#1d1d1f] dark:text-white mb-3 flex items-center gap-2">
          <Download className="w-4 h-4" /> Export Data
        </h3>
        <p className="text-xs text-[#86868b] mb-3">Download all your financial data</p>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => exportData("json")}
            disabled={exporting}
            className="px-4 py-2.5 rounded-xl bg-[#f5f5f7] dark:bg-[#2c2c2e] text-[#1d1d1f] dark:text-white text-sm font-medium hover:bg-[#e8e8ed] dark:hover:bg-[#3a3a3c] transition-all disabled:opacity-50"
          >
            Export JSON
          </button>
          <button
            onClick={() => exportData("csv")}
            disabled={exporting}
            className="px-4 py-2.5 rounded-xl bg-[#f5f5f7] dark:bg-[#2c2c2e] text-[#1d1d1f] dark:text-white text-sm font-medium hover:bg-[#e8e8ed] dark:hover:bg-[#3a3a3c] transition-all disabled:opacity-50"
          >
            Export CSV
          </button>
        </div>
      </div>

      {/* Sign Out */}
      <button
        onClick={() => signOut()}
        className="w-full py-3 rounded-xl bg-[#f5f5f7] dark:bg-[#2c2c2e] text-[#1d1d1f] dark:text-white text-sm font-medium hover:bg-[#e8e8ed] dark:hover:bg-[#3a3a3c] transition-all flex items-center justify-center gap-2"
      >
        <LogOut className="w-4 h-4" />
        Sign Out
      </button>

      {/* Danger Zone */}
      <div className="liquid-glass rounded-2xl p-5">
        <h3 className="font-semibold text-[#1d1d1f] dark:text-white mb-2 flex items-center gap-2">
          <Trash2 className="w-4 h-4" /> Danger Zone
        </h3>
        <p className="text-xs text-[#86868b] mb-3">
          Permanently delete your account and all data. This cannot be undone.
        </p>
        <button
          onClick={deleteAccount}
          className="liquid-glass-btn-destructive"
        >
          <Trash2 className="w-4 h-4" />
          Delete Account
        </button>
      </div>
    </div>
  )
}
