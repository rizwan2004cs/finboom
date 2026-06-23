"use client"

import { useState, useCallback, useMemo } from "react"
import { useUser } from "@/hooks/use-auth"
import { useProfile } from "@/hooks/use-profile"
import { useCurrency } from "@/hooks/use-currency"
import { useQueryClient } from "@tanstack/react-query"
import { insertRow } from "@/lib/offline"
import { X, Upload, CheckCircle, Sparkles, AlertTriangle, Loader2 } from "lucide-react"
import { ASSET_CLASSES, type AssetClassId } from "@/lib/constants"
import type { Asset } from "@/lib/types"
import { readWorkbookTables, pickHoldingTables, type RawTable } from "@/lib/import/parse-workbook"
import {
  buildColumnMapping,
  headerForField,
  IMPORT_FIELD_LABELS,
  type ColumnMapping,
  type ImportField,
} from "@/lib/import/column-mapper"
import { parseAmount } from "@/lib/import/parse-amount"
import { inferAssetClass } from "@/lib/import/asset-class-infer"

interface Props {
  onClose: () => void
  onImport: () => void
}

type PreviewRow = {
  index: number
  name: string
  isin?: string
  asset_class: AssetClassId
  units?: number
  current_value: number
  invested_value: number
  currency: string
  skipReason?: string
}

const CURRENCIES = ["INR", "USD", "EUR", "GBP", "AED", "SGD"]
const FIELD_OPTIONS = Object.keys(IMPORT_FIELD_LABELS) as ImportField[]
const TOTAL_ROW_REGEX = /^(total|grand total|sub ?total|portfolio total|net total)\b/

function signatureOf(t: RawTable) {
  return t.headers.join("|")
}

// Pick the best holdings table; merge sibling sheets that share the same
// header layout (e.g. a stocks + MF split with identical columns). Sheets
// with a different layout are reported, never silently dropped.
function chooseTable(tables: RawTable[]): {
  table: RawTable | null
  skippedSheets: string[]
} {
  const holdings = pickHoldingTables(tables)
    .slice()
    .sort((a, b) => b.rows.length - a.rows.length)
  if (holdings.length === 0) return { table: null, skippedSheets: [] }

  const primary = holdings[0]
  const sig = signatureOf(primary)
  const merged: RawTable = {
    sheet: primary.sheet,
    headers: primary.headers,
    rows: [...primary.rows],
  }
  const skippedSheets: string[] = []
  for (const t of holdings.slice(1)) {
    if (signatureOf(t) === sig) merged.rows.push(...t.rows)
    else skippedSheets.push(t.sheet)
  }
  return { table: merged, skippedSheets }
}

export function ImportModal({ onClose, onImport }: Props) {
  const { formatCompact, toINR } = useCurrency()
  const { user } = useUser()
  const { activeProfile } = useProfile()
  const queryClient = useQueryClient()

  const [step, setStep] = useState<"upload" | "mapping" | "preview" | "done">("upload")
  const [fileName, setFileName] = useState("")
  const [error, setError] = useState("")
  const [table, setTable] = useState<RawTable | null>(null)
  const [mapping, setMapping] = useState<ColumnMapping>({})
  const [confidence, setConfidence] = useState(1)
  const [extraSheets, setExtraSheets] = useState<string[]>([])
  const [currency, setCurrency] = useState("INR")
  const [rowClass, setRowClass] = useState<Record<number, AssetClassId>>({})
  const [excluded, setExcluded] = useState<Set<number>>(new Set())
  const [aiLoading, setAiLoading] = useState(false)
  const [aiUsed, setAiUsed] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importedCount, setImportedCount] = useState(0)

  const tryAiMapping = useCallback(async (t: RawTable) => {
    setAiLoading(true)
    try {
      const res = await fetch("/api/import/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ headers: t.headers, sampleRows: t.rows.slice(0, 5) }),
      })
      const data = await res.json()
      if (res.ok && data.mapping) {
        setMapping(data.mapping)
        setAiUsed(true)
      }
    } catch {
      // Heuristic mapping stays in place on any failure.
    } finally {
      setAiLoading(false)
    }
  }, [])

  const handleFile = useCallback(
    (file: File) => {
      setError("")
      setFileName(file.name)
      setAiUsed(false)
      const reader = new FileReader()
      reader.onload = (e) => {
        try {
          const buf = e.target?.result as ArrayBuffer
          const tables = readWorkbookTables(buf)
          const { table: chosen, skippedSheets } = chooseTable(tables)
          if (!chosen || chosen.rows.length === 0) {
            setError(
              "Couldn't find any holdings here. Make sure the file has a header row with names and values."
            )
            return
          }

          const { mapping: guessed, confidence: conf } = buildColumnMapping(
            chosen.headers,
            chosen.rows
          )
          setTable(chosen)
          setMapping(guessed)
          setConfidence(conf)
          setExtraSheets(skippedSheets)
          setRowClass({})
          setExcluded(new Set())

          // Seed currency from a detected currency column if present.
          const ccyHeader = headerForField(guessed, "currency")
          if (ccyHeader) {
            const firstVal = chosen.rows
              .map((r) => String(r[ccyHeader] ?? "").toUpperCase().trim())
              .find(Boolean)
            const code = firstVal && CURRENCIES.find((c) => firstVal.includes(c))
            if (code) setCurrency(code)
          }

          setStep("mapping")
          if (conf < 0.5) void tryAiMapping(chosen)
        } catch {
          setError("Failed to read the file. Please upload a valid .csv or .xlsx export.")
        }
      }
      reader.readAsArrayBuffer(file)
    },
    [tryAiMapping]
  )

  const setFieldForHeader = useCallback((header: string, field: ImportField) => {
    setMapping((prev) => {
      const next = { ...prev }
      if (field !== "none") {
        for (const h of Object.keys(next)) {
          if (next[h] === field) next[h] = "none"
        }
      }
      next[header] = field
      return next
    })
  }, [])

  // Names already in the portfolio (any active profile query) for de-duplication.
  const existingNames = useMemo(() => {
    const names = new Set<string>()
    const cached = queryClient.getQueriesData({ queryKey: ["assets"] }) as Array<
      [unknown, Asset[] | undefined]
    >
    for (const [, data] of cached) {
      if (Array.isArray(data)) {
        for (const a of data) {
          if (a?.name) names.add(a.name.toLowerCase().trim())
        }
      }
    }
    return names
  }, [queryClient])

  const previewRows = useMemo<PreviewRow[]>(() => {
    if (!table) return []
    const h = (f: ImportField) => headerForField(mapping, f)
    const nameH = h("name")
    const isinH = h("isin")
    const unitsH = h("units")
    const priceH = h("price_nav")
    const avgH = h("avg_price")
    const invH = h("invested_value")
    const curH = h("current_value")
    const classH = h("asset_class")
    const folioH = h("folio")

    return table.rows.map((row, index) => {
      const name = nameH ? String(row[nameH] ?? "").trim() : ""
      const isin = isinH ? String(row[isinH] ?? "").trim() : ""
      const units = unitsH ? parseAmount(row[unitsH]) : 0
      const price = priceH ? parseAmount(row[priceH]) : 0
      const avg = avgH ? parseAmount(row[avgH]) : 0
      let invested = invH ? parseAmount(row[invH]) : 0
      let current = curH ? parseAmount(row[curH]) : 0
      if (!current && units && price) current = units * price
      if (!invested && units && avg) invested = units * avg

      const classText = classH ? String(row[classH] ?? "") : ""
      const hasFolio = folioH ? String(row[folioH] ?? "").trim() !== "" : false
      const hasNav = !!priceH && /nav/i.test(priceH)
      const asset_class =
        rowClass[index] ?? inferAssetClass({ name, isin, classText, hasFolio, hasNav })

      const lname = name.toLowerCase()
      let skipReason: string | undefined
      if (!name) skipReason = "No name"
      else if (TOTAL_ROW_REGEX.test(lname)) skipReason = "Total row"
      else if (current <= 0 && invested <= 0 && units <= 0) skipReason = "No value"
      else if (existingNames.has(lname)) skipReason = "Already in portfolio"

      return {
        index,
        name,
        isin: isin || undefined,
        asset_class,
        units: units || undefined,
        current_value: Math.max(0, current),
        invested_value: Math.max(0, invested),
        currency,
        skipReason,
      }
    })
  }, [table, mapping, rowClass, currency, existingNames])

  const importableRows = useMemo(
    () => previewRows.filter((r) => !r.skipReason && !excluded.has(r.index)),
    [previewRows, excluded]
  )
  const skippedRows = useMemo(() => previewRows.filter((r) => r.skipReason), [previewRows])

  function toggleExcluded(index: number) {
    setExcluded((prev) => {
      const next = new Set(prev)
      if (next.has(index)) next.delete(index)
      else next.add(index)
      return next
    })
  }

  async function handleImport() {
    if (!user || !activeProfile) return
    setImporting(true)
    let count = 0
    for (const r of importableRows) {
      // Normalise to INR — the app aggregates assuming INR, so a USD/EUR import
      // must be converted before storage rather than kept in its source currency.
      await insertRow("assets", {
        user_id: user.id,
        profile_id: activeProfile.id,
        name: r.name,
        asset_class: r.asset_class,
        current_value: toINR(r.current_value, r.currency),
        invested_value: toINR(r.invested_value, r.currency),
        units: r.units ?? null,
        currency: "INR",
        ...(r.isin ? { notes: `ISIN: ${r.isin}` } : {}),
      })
      count += 1
    }
    setImportedCount(count)
    setImporting(false)
    setStep("done")
    setTimeout(onImport, 1500)
  }

  function sampleValue(header: string): string {
    if (!table) return ""
    const v = table.rows.map((r) => String(r[header] ?? "").trim()).find(Boolean)
    return v ?? ""
  }

  return (
    <div className="fixed inset-0 z-60 flex items-end sm:items-center justify-center">
      <button aria-label="Close" className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full sm:max-w-lg glass-elevated rounded-t-3xl sm:rounded-2xl shadow-2xl max-h-[88vh] overflow-y-auto">
        <div className="sm:hidden flex justify-center pt-3">
          <div className="w-10 h-1 rounded-full bg-black/[0.08] dark:bg-white/20" />
        </div>

        <div className="flex items-center justify-between p-5 border-b border-black/[0.04] dark:border-white/[0.06]">
          <h2 className="text-lg font-bold text-[#1d1d1f] dark:text-white">Import Portfolio</h2>
          <button onClick={onClose} aria-label="Close" className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-all">
            <X className="w-5 h-5 text-[#515154] dark:text-[#98989d]" />
          </button>
        </div>

        <div className="p-5 pb-8 sm:pb-5">
          {step === "upload" && (
            <div className="space-y-4">
              <p className="text-sm text-[#86868b]">
                Upload any broker or mutual-fund statement (.csv or .xlsx). FinBoom auto-detects the
                columns - stocks, mutual funds, or a mixed export - and lets you review before importing.
              </p>

              <label className="flex flex-col items-center justify-center h-40 border-2 border-dashed border-black/[0.08] dark:border-white/[0.12] rounded-2xl cursor-pointer hover:border-[#1d1d1f]/30 dark:hover:border-white/30 transition-all">
                <Upload className="w-8 h-8 text-[#86868b] mb-2" />
                <p className="text-sm font-medium text-[#1d1d1f] dark:text-white">Drop file or tap to upload</p>
                <p className="text-xs text-[#86868b] mt-1">.csv, .xlsx, .xls supported</p>
                <input
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) handleFile(file)
                  }}
                />
              </label>

              {error && (
                <div className="flex items-start gap-2 p-3 rounded-xl bg-red-500/10 text-red-700 dark:text-red-400 text-sm">
                  <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <p className="text-xs text-[#86868b]">
                Groww: Stocks/MF → Holdings → Download statement. Zerodha: Console → Holdings → Download.
              </p>
            </div>
          )}

          {step === "mapping" && table && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-[#86868b]">
                  Review how columns from <span className="font-medium text-[#1d1d1f] dark:text-white">{fileName}</span> map to fields.
                </p>
                <span
                  className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${
                    confidence >= 0.5
                      ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                      : "bg-amber-500/10 text-amber-700 dark:text-amber-400"
                  }`}
                >
                  {Math.round(confidence * 100)}% match
                </span>
              </div>

              {confidence < 0.5 && (
                <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-amber-500/10">
                  <p className="text-xs text-amber-800 dark:text-amber-300">
                    Low confidence. Try AI mapping (sends only column names + 5 sample rows).
                  </p>
                  <button
                    onClick={() => table && tryAiMapping(table)}
                    disabled={aiLoading}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-[#1d1d1f] dark:bg-white text-white dark:text-[#1d1d1f] disabled:opacity-50 shrink-0"
                  >
                    {aiLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                    {aiUsed ? "Re-run AI" : "Use AI"}
                  </button>
                </div>
              )}
              {aiUsed && confidence >= 0.5 && (
                <p className="text-xs text-accent">AI mapping applied. Adjust anything below if needed.</p>
              )}

              <div className="max-h-72 overflow-y-auto space-y-2">
                {table.headers.map((header) => (
                  <div key={header} className="flex items-center gap-3 p-2.5 bg-[#f5f5f7] dark:bg-white/[0.04] rounded-xl">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-[#1d1d1f] dark:text-white truncate">{header}</p>
                      <p className="text-xs text-[#86868b] truncate">e.g. {sampleValue(header) || "—"}</p>
                    </div>
                    <select
                      aria-label={`Map column ${header}`}
                      value={mapping[header] ?? "none"}
                      onChange={(e) => setFieldForHeader(header, e.target.value as ImportField)}
                      className="shrink-0 text-sm px-2.5 py-1.5 rounded-lg border border-black/10 dark:border-white/10 bg-white dark:bg-white/5 text-[#1d1d1f] dark:text-white"
                    >
                      {FIELD_OPTIONS.map((f) => (
                        <option key={f} value={f}>
                          {IMPORT_FIELD_LABELS[f]}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => { setStep("upload"); setTable(null) }}
                  className="flex-1 py-3 rounded-xl bg-[#f5f5f7] dark:bg-white/10 text-[#1d1d1f] dark:text-white font-medium hover:bg-[#e8e8ed] dark:hover:bg-white/15 transition-all"
                >
                  Back
                </button>
                <button
                  onClick={() => setStep("preview")}
                  disabled={!headerForField(mapping, "name")}
                  className="flex-1 py-3 rounded-xl bg-[#1d1d1f] dark:bg-white text-white dark:text-[#1d1d1f] font-medium hover:opacity-90 transition-all disabled:opacity-50"
                >
                  Preview
                </button>
              </div>
              {!headerForField(mapping, "name") && (
                <p className="text-xs text-amber-700 dark:text-amber-400">Map a column to “Name” to continue.</p>
              )}
            </div>
          )}

          {step === "preview" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm text-[#86868b]">
                  <span className="font-medium text-[#1d1d1f] dark:text-white">{importableRows.length}</span> ready
                  {skippedRows.length > 0 && <> · {skippedRows.length} skipped</>}
                </p>
                <div className="flex items-center gap-1.5">
                  <label htmlFor="import-currency" className="text-xs text-[#86868b]">Currency</label>
                  <select
                    id="import-currency"
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    className="text-sm px-2.5 py-1.5 rounded-lg border border-black/10 dark:border-white/10 bg-white dark:bg-white/5 text-[#1d1d1f] dark:text-white"
                  >
                    {CURRENCIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>

              {extraSheets.length > 0 && (
                <p className="text-xs text-amber-700 dark:text-amber-400">
                  {extraSheets.length} other sheet(s) had a different layout and weren&apos;t imported: {extraSheets.join(", ")}. Re-upload them separately.
                </p>
              )}

              <div className="max-h-64 overflow-y-auto space-y-2">
                {importableRows.map((row) => (
                  <div key={row.index} className="flex items-center gap-2 p-3 bg-[#f5f5f7] dark:bg-white/[0.04] rounded-xl">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-[#1d1d1f] dark:text-white truncate">{row.name}</p>
                      <div className="flex items-center gap-1.5 mt-1">
                        <select
                          aria-label={`Asset class for ${row.name}`}
                          value={row.asset_class}
                          onChange={(e) =>
                            setRowClass((prev) => ({ ...prev, [row.index]: e.target.value as AssetClassId }))
                          }
                          className="text-xs px-2 py-1 rounded-md border border-black/10 dark:border-white/10 bg-white dark:bg-white/5 text-[#515154] dark:text-[#98989d] max-w-[150px]"
                        >
                          {ASSET_CLASSES.map((c) => (
                            <option key={c.id} value={c.id}>{c.label}</option>
                          ))}
                        </select>
                        {row.units ? <span className="text-xs text-[#86868b]">· {row.units} u</span> : null}
                      </div>
                    </div>
                    <p className="text-sm font-semibold text-[#1d1d1f] dark:text-white shrink-0">{formatCompact(row.current_value)}</p>
                    <button
                      onClick={() => toggleExcluded(row.index)}
                      aria-label={`Exclude ${row.name}`}
                      className="p-1.5 rounded-full hover:bg-black/5 dark:hover:bg-white/10 shrink-0"
                    >
                      <X className="w-4 h-4 text-[#86868b]" />
                    </button>
                  </div>
                ))}
                {importableRows.length === 0 && (
                  <p className="text-sm text-[#86868b] text-center py-4">No rows to import. Check the column mapping.</p>
                )}
              </div>

              {skippedRows.length > 0 && (
                <details className="text-xs text-[#86868b]">
                  <summary className="cursor-pointer select-none">{skippedRows.length} skipped row(s)</summary>
                  <div className="mt-2 space-y-1 max-h-32 overflow-y-auto">
                    {skippedRows.map((row) => (
                      <div key={row.index} className="flex items-center justify-between gap-2">
                        <span className="truncate">{row.name || "(unnamed)"}</span>
                        <span className="shrink-0 text-[#a1a1a6]">{row.skipReason}</span>
                      </div>
                    ))}
                  </div>
                </details>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => setStep("mapping")}
                  className="flex-1 py-3 rounded-xl bg-[#f5f5f7] dark:bg-white/10 text-[#1d1d1f] dark:text-white font-medium hover:bg-[#e8e8ed] dark:hover:bg-white/15 transition-all"
                >
                  Back
                </button>
                <button
                  onClick={handleImport}
                  disabled={importing || importableRows.length === 0}
                  className="flex-1 py-3 rounded-xl bg-[#1d1d1f] dark:bg-white text-white dark:text-[#1d1d1f] font-medium hover:opacity-90 transition-all disabled:opacity-50"
                >
                  {importing ? "Importing..." : `Import ${importableRows.length}`}
                </button>
              </div>
            </div>
          )}

          {step === "done" && (
            <div className="text-center py-8">
              <CheckCircle className="w-16 h-16 text-emerald-500 mx-auto mb-3" />
              <p className="text-lg font-bold text-[#1d1d1f] dark:text-white">Import Complete!</p>
              <p className="text-sm text-[#86868b] mt-1">{importedCount} assets added successfully</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
