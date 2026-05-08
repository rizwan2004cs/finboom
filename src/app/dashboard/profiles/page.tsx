"use client"

import { useEffect, useState } from "react"
import { useUser } from "@/hooks/use-auth"
import { useProfile } from "@/hooks/use-profile"
import { fetchTable, insertRow, deleteRow } from "@/lib/offline"
import { Users, Plus, Trash2, Building2, User2, CheckCircle } from "lucide-react"
import type { Profile, Asset, Liability } from "@/lib/types"

function formatCurrency(amount: number) {
  if (amount >= 10000000) return `₹${(amount / 10000000).toFixed(2)} Cr`
  if (amount >= 100000) return `₹${(amount / 100000).toFixed(2)} L`
  if (amount >= 1000) return `₹${(amount / 1000).toFixed(1)}K`
  return `₹${amount.toLocaleString("en-IN")}`
}

export default function ProfilesPage() {
  const { user } = useUser()
  const { activeProfile, switchProfile, reloadProfiles } = useProfile()
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: "", type: "spouse" as "personal" | "spouse" | "parent" | "child" | "business" })
  const [profileSummaries, setProfileSummaries] = useState<Record<string, { assets: number; liabilities: number }>>({})

  useEffect(() => {
    if (!user) return
    loadProfiles()
  }, [user])

  async function loadProfiles() {
    const profilesList = await fetchTable<Profile>("profiles", user!.id, { order: { column: "created_at", ascending: true } })
    setProfiles(profilesList)

    // Load summaries for each profile
    const allAssets = await fetchTable<Asset>("assets", user!.id)
    const allLiabilities = await fetchTable<Liability>("liabilities", user!.id)
    const summaries: Record<string, { assets: number; liabilities: number }> = {}
    for (const profile of profilesList) {
      summaries[profile.id] = {
        assets: allAssets.filter(a => a.profile_id === profile.id).reduce((sum, a) => sum + Number(a.current_value), 0),
        liabilities: allLiabilities.filter(l => l.profile_id === profile.id).reduce((sum, l) => sum + Number(l.outstanding_amount), 0),
      }
    }
    setProfileSummaries(summaries)
    setLoading(false)
  }

  async function createProfile(e: React.FormEvent) {
    e.preventDefault()
    if (!user || !form.name.trim()) return

    await insertRow("profiles", {
      user_id: user.id,
      name: form.name.trim(),
      type: form.type,
    })

    setForm({ name: "", type: "spouse" })
    setShowForm(false)
    await reloadProfiles()
    loadProfiles()
  }

  async function deleteProfile(id: string) {
    if (id === activeProfile?.id) {
      alert("Cannot delete the active profile. Switch to another profile first.")
      return
    }
    if (!confirm("Delete this profile and all associated data?")) return
    await deleteRow("profiles", id)
    setProfiles(prev => prev.filter(p => p.id !== id))
    await reloadProfiles()
  }

  const totalNetWorth = Object.values(profileSummaries).reduce(
    (sum, s) => sum + s.assets - s.liabilities, 0
  )

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="skeleton h-7 w-28 rounded-lg" />
        {[1, 2, 3].map(i => (
          <div key={i} className="liquid-glass rounded-2xl p-5 flex items-center gap-4">
            <div className="skeleton h-12 w-12 rounded-full" />
            <div className="flex-1 space-y-2">
              <div className="skeleton h-5 w-28 rounded-lg" />
              <div className="skeleton h-3 w-20 rounded-lg" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#1d1d1f]">Profiles</h1>
          <p className="text-sm text-[#86868b]">Manage family & business profiles</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 liquid-glass-btn-primary"
        >
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">New Profile</span>
        </button>
      </div>

      {/* Consolidated Net Worth */}
      {profiles.length > 0 && (
        <div className="bg-[#f5f5f7] rounded-2xl p-5 border border-white/40">
          <p className="text-xs text-[#86868b]">Consolidated Net Worth</p>
          <p className="text-2xl font-bold text-[#1d1d1f] mt-1">{formatCurrency(totalNetWorth)}</p>
          <p className="text-xs text-[#86868b] mt-1">Across {profiles.length} profile{profiles.length !== 1 ? "s" : ""}</p>
        </div>
      )}

      {/* Create Form */}
      {showForm && (
        <form onSubmit={createProfile} className="liquid-glass rounded-2xl p-5 space-y-3">
          <h3 className="font-semibold text-[#1d1d1f]">Create New Profile</h3>

          <div>
            <label className="text-xs text-[#86868b]">Profile Name</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))}
              placeholder="e.g. Spouse, Parents, Business"
              className="mt-1 w-full px-4 py-2.5 rounded-xl bg-[#f5f5f7] border-0 text-sm text-[#1d1d1f] placeholder:text-[#86868b] focus:outline-none focus:ring-2 focus:ring-[#1d1d1f]/10"
              autoFocus
            />
          </div>

          <div>
            <label className="text-xs text-[#86868b]">Type</label>
            <div className="grid grid-cols-3 gap-2 mt-1">
              {(["spouse", "parent", "child", "personal", "business"] as const).map(type => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setForm(prev => ({ ...prev, type }))}
                  className={`px-3 py-2 rounded-xl text-xs font-medium capitalize transition-all ${
                    form.type === type
                      ? "bg-[#1d1d1f] text-white"
                      : "bg-[#f5f5f7] text-[#86868b] hover:bg-[#e8e8ed]"
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-2">
            <button
              type="submit"
              className="flex-1 liquid-glass-btn-primary"
            >
              Create
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-4 py-2.5 rounded-xl bg-[#f5f5f7] text-[#86868b] text-sm font-medium hover:bg-[#e8e8ed] transition-all"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Profile Cards */}
      {profiles.length === 0 ? (
        <div className="liquid-glass rounded-2xl p-8 text-center">
          <div className="w-12 h-12 rounded-xl bg-white/50 backdrop-blur-sm flex items-center justify-center mx-auto mb-3">
            <User2 className="w-6 h-6 text-[#86868b]" strokeWidth={1.5} />
          </div>
          <p className="font-medium text-[#1d1d1f]">No profiles yet</p>
          <p className="text-sm text-[#86868b] mt-1">
            Create profiles to track family or business finances separately
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {profiles.map(profile => {
            const summary = profileSummaries[profile.id] || { assets: 0, liabilities: 0 }
            const netWorth = summary.assets - summary.liabilities
            const isActive = profile.id === activeProfile?.id
            const icon = profile.type === "business" ? (
              <Building2 className="w-5 h-5 text-[#1d1d1f] dark:text-white" strokeWidth={1.5} />
            ) : profile.type === "spouse" || profile.type === "parent" || profile.type === "child" ? (
              <Users className="w-5 h-5 text-[#1d1d1f] dark:text-white" strokeWidth={1.5} />
            ) : (
              <User2 className="w-5 h-5 text-[#1d1d1f] dark:text-white" strokeWidth={1.5} />
            )

            return (
              <div
                key={profile.id}
                className={`liquid-glass rounded-2xl p-5 transition-all cursor-pointer ${isActive ? "ring-2 ring-[#34c759]" : ""}`}
                onClick={() => switchProfile(profile.id)}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white/50 dark:bg-white/[0.08] backdrop-blur-sm flex items-center justify-center">
                    {icon}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-[#1d1d1f] dark:text-white">{profile.name}</p>
                      {isActive && <CheckCircle className="w-4 h-4 text-[#34c759]" />}
                    </div>
                    <p className="text-xs text-[#86868b] capitalize">{profile.type}{isActive ? " · Active" : ""}</p>
                  </div>
                  {!isActive && (
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteProfile(profile.id) }}
                      className="p-2 rounded-lg hover:bg-[#f5f5f7] dark:hover:bg-white/[0.08] transition-all"
                    >
                      <Trash2 className="w-4 h-4 text-[#86868b]" />
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-2 mt-4">
                  <div className="bg-[#f5f5f7] rounded-xl p-2.5 text-center">
                    <p className="text-[10px] text-[#86868b]">Assets</p>
                    <p className="text-sm font-semibold text-[#1d1d1f]">{formatCurrency(summary.assets)}</p>
                  </div>
                  <div className="bg-[#f5f5f7] rounded-xl p-2.5 text-center">
                    <p className="text-[10px] text-[#86868b]">Liabilities</p>
                    <p className="text-sm font-semibold text-[#6e6e73]">{formatCurrency(summary.liabilities)}</p>
                  </div>
                  <div className="bg-[#f5f5f7] rounded-xl p-2.5 text-center">
                    <p className="text-[10px] text-[#86868b]">Net Worth</p>
                    <p className={`text-sm font-semibold ${netWorth >= 0 ? "text-[#1d1d1f]" : "text-[#6e6e73]"}`}>
                      {formatCurrency(netWorth)}
                    </p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
