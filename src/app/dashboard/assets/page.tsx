"use client"

import { Suspense, useEffect, useState } from "react"
import { useUser } from "@/hooks/use-auth"
import { useProfile } from "@/hooks/use-profile"
import { useSearchParams } from "next/navigation"
import { useOfflineQuery } from "@/hooks/use-offline-query"
import { useDeleteMutation } from "@/hooks/use-offline-mutation"
import { deleteRow } from "@/lib/offline"
import { useQueryClient } from "@tanstack/react-query"
import { Plus, Search, Trash2, Edit2, Upload } from "lucide-react"
import type { Asset } from "@/lib/types"
import { ASSET_CLASSES } from "@/lib/constants"
import { CategoryIcon } from "@/components/category-icon"
import { useAppDialog } from "@/components/app-dialog"
import { AddAssetModal } from "@/components/modals/add-asset-modal"
import { ImportModal } from "@/components/modals/import-modal"
import { CustomSelect } from "@/components/custom-select"
import { useCurrency } from "@/hooks/use-currency"

export default function AssetsPageWrapper() {
  return (
    <Suspense fallback={<div className="space-y-4">{[1,2,3].map(i => <div key={i} className="h-20 liquid-glass rounded-2xl animate-pulse" />)}</div>}>
      <AssetsPage />
    </Suspense>
  )
}

function AssetsPage() {
  const { formatCompact: formatCurrency } = useCurrency()
  const { user } = useUser()
  const { activeProfile } = useProfile()
  const searchParams = useSearchParams()
  const [showAddModal, setShowAddModal] = useState(false)
  const [showImportModal, setShowImportModal] = useState(false)
  const [editAsset, setEditAsset] = useState<Asset | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [filterClass, setFilterClass] = useState<string>("all")
  const [clearing, setClearing] = useState(false)

  const pf = activeProfile ? [{ column: "profile_id", op: "eq" as const, value: activeProfile.id }] : undefined
  const { data: assets = [], isLoading: loading } = useOfflineQuery<Asset>(
    "assets", user?.id, {
      order: { column: "current_value", ascending: false },
      filters: pf,
      enabled: !!activeProfile,
    }
  )
  const deleteMut = useDeleteMutation("assets")
  const queryClient = useQueryClient()

  useEffect(() => {
    if (searchParams.get("action") === "add") setShowAddModal(true)
    if (searchParams.get("action") === "import") setShowImportModal(true)
  }, [searchParams])

  const { showConfirm } = useAppDialog()

  async function deleteAsset(id: string) {
    await showConfirm("Delete this asset?", {
      destructive: true,
      onConfirm: async () => { await deleteMut.mutateAsync(id) },
    })
  }

  async function clearCategory() {
    const cls = ASSET_CLASSES.find(c => c.id === filterClass)
    const categoryAssets = assets.filter(a => a.asset_class === filterClass)
    if (!categoryAssets.length) return
    await showConfirm(`Delete all ${categoryAssets.length} assets in "${cls?.label || filterClass}"? This cannot be undone.`, {
      destructive: true,
      onConfirm: async () => {
        for (const asset of categoryAssets) {
          await deleteRow("assets", asset.id)
        }
        queryClient.invalidateQueries({ queryKey: ["assets"] })
      },
    })
  }

  const filtered = assets.filter(a => {
    const matchesSearch = a.name.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesClass = filterClass === "all" || a.asset_class === filterClass
    return matchesSearch && matchesClass
  })

  const totalValue = filtered.reduce((sum, a) => sum + Number(a.current_value), 0)
  const totalInvested = filtered.reduce((sum, a) => sum + Number(a.invested_value), 0)
  const totalGain = totalValue - totalInvested
  const gainPercent = totalInvested > 0 ? (totalGain / totalInvested) * 100 : 0

  if (loading || !user || !activeProfile) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="skeleton h-7 w-32 rounded-lg" />
          <div className="flex gap-2">
            <div className="skeleton h-9 w-24 rounded-xl" />
            <div className="skeleton h-9 w-24 rounded-xl" />
          </div>
        </div>
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="liquid-glass rounded-2xl p-4 flex items-center gap-4">
            <div className="skeleton h-10 w-10 rounded-xl" />
            <div className="flex-1 space-y-2">
              <div className="skeleton h-4 w-32 rounded-lg" />
              <div className="skeleton h-3 w-20 rounded-lg" />
            </div>
            <div className="skeleton h-5 w-20 rounded-lg" />
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-4" data-tour-page="assets">
      {/* Header */}
      <div className="flex items-center justify-between" data-tour-el="assets-header">
        <div>
          <h1 className="text-xl font-bold text-[#1d1d1f] dark:text-white">Assets</h1>
          <p className="text-sm text-[#515154] dark:text-[#98989d]">{assets.length} investments tracked</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowImportModal(true)}
            className="p-2.5 rounded-xl bg-[#f5f5f7] text-[#1d1d1f] hover:bg-[#e8e8ed] transition-all"
          >
            <Upload className="w-4 h-4" />
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 liquid-glass-btn-primary"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Add Asset</span>
          </button>
        </div>
      </div>

      {/* Summary Bar */}
      <div className="grid grid-cols-3 gap-3">
        <div className="liquid-glass rounded-2xl p-3">
          <p className="text-[10px] uppercase tracking-wider text-[#515154] dark:text-[#98989d] font-semibold">Total Value</p>
          <p className="text-lg font-bold text-[#1d1d1f] dark:text-white mt-0.5">{formatCurrency(totalValue)}</p>
        </div>
        <div className="liquid-glass rounded-2xl p-3">
          <p className="text-[10px] uppercase tracking-wider text-[#515154] dark:text-[#98989d] font-semibold">Invested</p>
          <p className="text-lg font-bold text-[#1d1d1f] dark:text-white mt-0.5">{formatCurrency(totalInvested)}</p>
        </div>
        <div className="liquid-glass rounded-2xl p-3">
          <p className="text-[10px] uppercase tracking-wider text-[#515154] dark:text-[#98989d] font-semibold">Gain/Loss</p>
          <p className="text-lg font-bold text-[#1d1d1f] dark:text-white mt-0.5">
            {totalGain >= 0 ? "+" : ""}{gainPercent.toFixed(1)}%
          </p>
        </div>
      </div>

      {/* Search & Filter */}
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#515154] dark:text-[#98989d]" />
          <input
            type="text"
            placeholder="Search assets..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-[#f5f5f7] dark:bg-white/10 border-0 text-sm text-[#1d1d1f] dark:text-white placeholder:text-[#86868b] focus:outline-none focus:ring-2 focus:ring-[#1d1d1f]/10 dark:focus:ring-white/20"
          />
        </div>
        <CustomSelect
          value={filterClass}
          onChange={(val) => setFilterClass(val)}
          options={[{ value: "all", label: "All Classes" }, ...ASSET_CLASSES.map(cls => ({ value: cls.id, label: cls.label }))]}
          className="w-40"
        />
        {filterClass !== "all" && (
          <button
            onClick={clearCategory}
            disabled={clearing}
            className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 text-sm font-medium hover:bg-red-100 dark:hover:bg-red-500/20 transition-all disabled:opacity-50"
            title={`Delete all ${ASSET_CLASSES.find(c => c.id === filterClass)?.label} assets`}
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{clearing ? "Clearing..." : "Clear All"}</span>
          </button>
        )}
      </div>

      {/* Asset List */}
      <div className="space-y-2">
        {filtered.length === 0 ? (
          <div className="liquid-glass rounded-2xl p-8 text-center">
            <div className="w-12 h-12 rounded-xl bg-white/50 backdrop-blur-sm flex items-center justify-center mx-auto mb-3">
              <Search className="w-6 h-6 text-[#86868b]" strokeWidth={1.5} />
            </div>
            <p className="font-medium text-[#1d1d1f] dark:text-white">No assets yet</p>
            <p className="text-sm text-[#515154] dark:text-[#98989d] mt-1">Add your first investment to get started</p>
            <button
              onClick={() => setShowAddModal(true)}
              className="mt-4 liquid-glass-btn-primary"
            >
              Add Asset
            </button>
          </div>
        ) : (
          filtered.map((asset) => {
            const cls = ASSET_CLASSES.find(c => c.id === asset.asset_class)
            const gain = Number(asset.current_value) - Number(asset.invested_value)
            const gainPct = Number(asset.invested_value) > 0 
              ? (gain / Number(asset.invested_value)) * 100 
              : 0
            return (
              <div key={asset.id} className="liquid-glass rounded-2xl p-4 transition-all">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white/50 backdrop-blur-sm flex items-center justify-center">
                    <CategoryIcon name={cls?.icon || "MoreHorizontal"} className="w-4.5 h-4.5 text-[#1d1d1f]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-[#1d1d1f] dark:text-white truncate">{asset.name}</p>
                    <p className="text-xs text-[#515154] dark:text-[#98989d] font-medium">{cls?.label || asset.asset_class}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-[#1d1d1f] dark:text-white">{formatCurrency(Number(asset.current_value))}</p>
                    <p className="text-xs font-medium text-[#3a3a3c] dark:text-[#aeaeb2]">
                      {gain >= 0 ? "+" : ""}{gainPct.toFixed(1)}%
                    </p>
                  </div>
                  <div className="flex gap-1 ml-2">
                    <button
                      onClick={() => setEditAsset(asset)}
                      className="p-1.5 rounded-lg hover:bg-[#f5f5f7] transition-all"
                    >
                      <Edit2 className="w-3.5 h-3.5 text-[#86868b]" />
                    </button>
                    <button
                      onClick={() => deleteAsset(asset.id)}
                      className="p-1.5 rounded-lg hover:bg-[#f5f5f7] transition-all"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-[#86868b]" />
                    </button>
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Modals */}
      {(showAddModal || editAsset) && (
        <AddAssetModal
          asset={editAsset}
          onClose={() => { setShowAddModal(false); setEditAsset(null) }}
          onSave={() => { setShowAddModal(false); setEditAsset(null); queryClient.invalidateQueries({ queryKey: ["assets"] }) }}
        />
      )}
      {showImportModal && (
        <ImportModal
          onClose={() => setShowImportModal(false)}
          onImport={() => { setShowImportModal(false); queryClient.invalidateQueries({ queryKey: ["assets"] }) }}
        />
      )}
    </div>
  )
}
