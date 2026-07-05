"use client"

import { useState } from "react"
import { useUser } from "@/hooks/use-auth"
import { useProfile } from "@/hooks/use-profile"
import { useOfflineQuery } from "@/hooks/use-offline-query"
import { useDeleteMutation } from "@/hooks/use-offline-mutation"
import { useQueryClient } from "@tanstack/react-query"
import { Plus, Repeat, Trash2, Edit2, Bell, BellOff, CalendarClock } from "lucide-react"
import type { Sip } from "@/lib/types"
import { useAppDialog } from "@/components/app-dialog"
import { useCurrency } from "@/hooks/use-currency"
import { AddSipModal } from "@/components/modals/add-sip-modal"
import { SipMonthChecklist } from "@/components/sip-month-checklist"

function ordinal(n: number): string {
  const v = n % 100
  if (v >= 11 && v <= 13) return `${n}th`
  switch (n % 10) {
    case 1: return `${n}st`
    case 2: return `${n}nd`
    case 3: return `${n}rd`
    default: return `${n}th`
  }
}

export default function SipsPage() {
  const { formatCompact: formatCurrency } = useCurrency()
  const { user } = useUser()
  const { activeProfile } = useProfile()
  const queryClient = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [editSip, setEditSip] = useState<Sip | null>(null)

  const pf = activeProfile ? [{ column: "profile_id", op: "eq" as const, value: activeProfile.id }] : undefined
  const { data: sips = [], isLoading } = useOfflineQuery<Sip>(
    "sips", user?.id, {
      order: { column: "sip_day", ascending: true },
      filters: pf,
      enabled: !!activeProfile,
    }
  )
  const loading = isLoading || !user || !activeProfile
  const deleteMut = useDeleteMutation("sips")
  const { showConfirm } = useAppDialog()

  const activeSips = sips.filter(s => s.active)
  const monthlyTotal = activeSips.reduce((sum, s) => sum + Number(s.amount), 0)

  async function deleteSip(id: string) {
    await showConfirm("Delete this SIP?", {
      destructive: true,
      onConfirm: async () => { await deleteMut.mutateAsync(id) },
    })
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="skeleton h-7 w-24 rounded-lg" />
        {[1, 2, 3].map(i => (
          <div key={i} className="liquid-glass rounded-2xl p-5 space-y-3">
            <div className="flex items-center gap-3">
              <div className="skeleton h-9 w-9 rounded-xl" />
              <div className="skeleton h-5 w-32 rounded-lg" />
            </div>
            <div className="skeleton h-3 w-40 rounded-lg" />
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-4" data-tour-page="sips">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#1d1d1f]">SIPs</h1>
          <p className="text-sm text-[#86868b]">
            {activeSips.length > 0
              ? `${formatCurrency(monthlyTotal)}/mo across ${activeSips.length} active`
              : "Track your recurring investments"}
          </p>
        </div>
        <button
          onClick={() => { setEditSip(null); setShowForm(true) }}
          className="flex items-center gap-1.5 liquid-glass-btn-primary"
        >
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">Add SIP</span>
        </button>
      </div>

      <SipMonthChecklist sips={sips} profileId={activeProfile?.id} />

      {/* SIP List */}
      {sips.length === 0 ? (
        <div className="liquid-glass rounded-2xl p-8 text-center">
          <div className="w-12 h-12 rounded-xl bg-white/50 backdrop-blur-sm flex items-center justify-center mx-auto mb-3">
            <Repeat className="w-6 h-6 text-[#86868b]" strokeWidth={1.5} />
          </div>
          <p className="font-medium text-[#1d1d1f]">No SIPs yet</p>
          <p className="text-sm text-[#86868b] mt-1">
            Add your monthly mutual fund SIPs and get a reminder before each debit
          </p>
          <button
            onClick={() => setShowForm(true)}
            className="mt-4 liquid-glass-btn-primary"
          >
            Add SIP
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {sips.map((sip) => (
            <div key={sip.id} className={`liquid-glass rounded-2xl p-5 ${sip.active ? "" : "opacity-60"}`}>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-white/50 backdrop-blur-sm flex items-center justify-center flex-shrink-0">
                    <Repeat className="w-5 h-5 text-[#1d1d1f]" strokeWidth={1.5} />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-[#1d1d1f] truncate">{sip.name}</p>
                    {sip.fund_name && (
                      <p className="text-xs text-[#86868b] truncate">{sip.fund_name}</p>
                    )}
                  </div>
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  <button
                    onClick={() => { setEditSip(sip); setShowForm(true) }}
                    className="p-1.5 rounded-lg hover:bg-[#f5f5f7] transition-all"
                    aria-label="Edit SIP"
                  >
                    <Edit2 className="w-3.5 h-3.5 text-[#86868b]" />
                  </button>
                  <button
                    onClick={() => deleteSip(sip.id)}
                    className="p-1.5 rounded-lg hover:bg-[#f5f5f7] transition-all"
                    aria-label="Delete SIP"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-[#86868b]" />
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between mt-3">
                <p className="text-lg font-semibold text-[#1d1d1f]">{formatCurrency(Number(sip.amount))}</p>
                <div className="flex items-center gap-3 text-xs text-[#86868b]">
                  <span className="flex items-center gap-1">
                    <CalendarClock className="w-3.5 h-3.5" />
                    {ordinal(sip.sip_day)} every month
                  </span>
                  {sip.reminder_enabled ? (
                    <Bell className="w-3.5 h-3.5 text-[#1d1d1f]" />
                  ) : (
                    <BellOff className="w-3.5 h-3.5" />
                  )}
                </div>
              </div>

              {!sip.active && (
                <p className="text-[11px] text-[#86868b] mt-2">Paused — excluded from totals and reminders</p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit SIP Modal */}
      {showForm && (
        <AddSipModal
          sip={editSip}
          onClose={() => { setShowForm(false); setEditSip(null) }}
          onSave={() => { setShowForm(false); setEditSip(null); queryClient.invalidateQueries({ queryKey: ["sips"] }) }}
        />
      )}
    </div>
  )
}
