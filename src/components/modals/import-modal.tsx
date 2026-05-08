"use client"

import { useState, useCallback } from "react"
import { useUser } from "@clerk/nextjs"
import { createClient } from "@/utils/supabase/client"
import { X, Upload, CheckCircle } from "lucide-react"
import * as XLSX from "xlsx"
import { ASSET_CLASSES } from "@/lib/constants"

interface Props {
  onClose: () => void
  onImport: () => void
}

interface ParsedRow {
  name: string
  asset_class: string
  current_value: number
  invested_value: number
  units?: number
}

export function ImportModal({ onClose, onImport }: Props) {
  const { user } = useUser()
  const [step, setStep] = useState<"upload" | "preview" | "done">("upload")
  const [rows, setRows] = useState<ParsedRow[]>([])
  const [importing, setImporting] = useState(false)
  const [format, setFormat] = useState<"generic" | "groww" | "zerodha">("generic")

  // Flexible column finder: matches partial patterns case-insensitively
  const findCol = useCallback((row: Record<string, unknown>, patterns: string[]) => {
    for (const key of Object.keys(row)) {
      const lower = key.toLowerCase().trim()
      if (patterns.some(p => lower.includes(p))) return row[key]
    }
    return undefined
  }, [])

  function guessAssetClass(input: string): string {
    const lower = input.toLowerCase()
    const match = ASSET_CLASSES.find(cls => 
      cls.label.toLowerCase().includes(lower) || cls.id === lower
    )
    return match?.id || "stocks"
  }

  const detectFormat = useCallback((json: Record<string, unknown>[]): "zerodha" | "groww" | "generic" => {
    if (json.length === 0) return "generic"
    const keys = Object.keys(json[0]).map(k => k.toLowerCase().trim())
    // Zerodha: "Instrument", "Qty.", "Avg. cost", "LTP", "Cur. val"
    if (keys.some(k => k.includes("instrument")) && keys.some(k => k.includes("avg") && k.includes("cost"))) {
      return "zerodha"
    }
    // Groww: "Stock Name", "ISIN", "Quantity", "Average buy price", "Closing value"
    if (
      keys.some(k => k.includes("stock name") || k.includes("scheme name") || k.includes("company") || k.includes("symbol")) &&
      keys.some(k => k.includes("quantity") || k.includes("qty") || k.includes("units")) &&
      keys.some(k => k.includes("closing value") || k.includes("buy value") || k.includes("average buy price") || k.includes("value") || k.includes("price") || k.includes("ltp") || k.includes("nav"))
    ) {
      return "groww"
    }
    return "generic"
  }, [])

  // Some financial exports have metadata rows before the actual table.
  // Try parsing from different starting rows to find the real header.
  const isDataHeader = useCallback((keys: string[]) => {
    // Must have a name-like column AND a numeric/financial column
    const hasName = keys.some(k =>
      k.includes("stock name") || k.includes("instrument") || k.includes("scheme name") ||
      k.includes("company") || k.includes("symbol") || k.includes("scrip")
    )
    const hasNumeric = keys.some(k =>
      k.includes("quantity") || k.includes("qty") || k.includes("units") ||
      k.includes("value") || k.includes("price") || k.includes("ltp") ||
      k.includes("nav") || k.includes("avg") || k.includes("cost")
    )
    return hasName && hasNumeric
  }, [])

  const parseSheetWithHeaderScan = useCallback((sheet: XLSX.WorkSheet): Record<string, unknown>[] => {
    // First try default (row 1 is header)
    const defaultJson = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet)
    if (defaultJson.length > 0) {
      const keys = Object.keys(defaultJson[0]).map(k => k.toLowerCase())
      if (isDataHeader(keys)) {
        return defaultJson
      }
    }

    // Scan rows 1-15 looking for the real header row
    const range = XLSX.utils.decode_range(sheet["!ref"] || "A1")
    for (let headerRow = 1; headerRow <= Math.min(15, range.e.r); headerRow++) {
      const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { range: headerRow })
      if (json.length > 0) {
        const keys = Object.keys(json[0]).map(k => k.toLowerCase())
        if (isDataHeader(keys)) {
          return json
        }
      }
    }

    return defaultJson
  }, [isDataHeader])

  const handleFile = useCallback((file: File) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const data = new Uint8Array(e.target?.result as ArrayBuffer)
      const workbook = XLSX.read(data, { type: "array" })
      const sheet = workbook.Sheets[workbook.SheetNames[0]]
      const json = parseSheetWithHeaderScan(sheet)

      // Auto-detect format (also check filename)
      let detected = detectFormat(json)
      const fileName = file.name.toLowerCase()
      if (detected === "generic") {
        if (fileName.includes("groww") || fileName.includes("holdings_statement")) {
          detected = "groww"
        } else if (fileName.includes("zerodha") || fileName.includes("kite")) {
          detected = "zerodha"
        }
      }
      setFormat(detected)

      let parsed: ParsedRow[] = []

      if (detected === "zerodha") {
        parsed = json.map((row) => {
          const qty = Number(findCol(row, ["qty"]) || 0)
          const avgCost = Number(findCol(row, ["avg"]) || 0)
          const curVal = Number(findCol(row, ["cur. val", "cur val", "current val", "market val"]) || 0)
          const investedVal = qty * avgCost

          return {
            name: String(findCol(row, ["instrument", "stock", "symbol"]) || "").trim(),
            asset_class: "stocks" as const,
            current_value: curVal,
            invested_value: investedVal,
            units: qty || undefined,
          }
        })
      } else if (detected === "groww") {
        parsed = json.map((row) => {
          const name = String(
            findCol(row, ["stock name", "scheme name", "company", "symbol", "name", "scrip"]) || ""
          ).trim()
          const isMF = !!findCol(row, ["scheme name", "nav", "folio"])
          const qty = Number(findCol(row, ["quantity", "qty", "units"]) || 0)
          const avgPrice = Number(findCol(row, ["average buy price", "avg", "average", "buy price", "buy avg", "purchase price"]) || 0)
          const curVal = Number(findCol(row, ["closing value", "current val", "market val", "present val", "cur. val"]) || 0)
          const investedRaw = Number(findCol(row, ["buy value", "invested", "investment", "buy val", "cost", "total cost"]) || 0)
          const investedVal = investedRaw || (qty * avgPrice)
          const ltp = Number(findCol(row, ["closing price", "ltp", "last price"]) || 0)
          const currentValue = curVal || (qty * ltp)

          return {
            name,
            asset_class: isMF ? "mutual_funds" : "stocks",
            current_value: currentValue,
            invested_value: investedVal,
            units: qty || undefined,
          }
        })
      } else {
        // Generic CSV: expects name, asset_class, current_value, invested_value, units
        parsed = json.map((row) => ({
          name: String(row["name"] || row["Name"] || row["Asset"] || ""),
          asset_class: guessAssetClass(String(row["asset_class"] || row["type"] || row["Type"] || row["Category"] || "")),
          current_value: Number(row["current_value"] || row["Current Value"] || row["value"] || row["Value"] || 0),
          invested_value: Number(row["invested_value"] || row["Invested"] || row["cost"] || row["Cost"] || 0),
          units: Number(row["units"] || row["Units"] || row["Quantity"] || 0) || undefined,
        }))
      }

      setRows(parsed.filter(r => r.name && r.current_value > 0))
      setStep("preview")
    }
    reader.readAsArrayBuffer(file)
  }, [detectFormat, findCol, parseSheetWithHeaderScan])

  async function handleImport() {
    if (!user) return
    setImporting(true)
    const supabase = createClient()

    const insertData = rows.map(row => ({
      user_id: user.id,
      name: row.name,
      asset_class: row.asset_class,
      current_value: row.current_value,
      invested_value: row.invested_value,
      units: row.units || null,
      currency: "INR",
    }))

    await supabase.from("assets").insert(insertData)
    setImporting(false)
    setStep("done")
    setTimeout(onImport, 1500)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full sm:max-w-lg glass-elevated rounded-t-3xl sm:rounded-2xl shadow-2xl max-h-[85vh] overflow-y-auto">
        <div className="sm:hidden flex justify-center pt-3">
          <div className="w-10 h-1 rounded-full bg-black/[0.08] dark:bg-white/20" />
        </div>

        <div className="flex items-center justify-between p-5 border-b border-black/[0.04] dark:border-white/[0.06]">
          <h2 className="text-lg font-bold text-[#1d1d1f] dark:text-white">Import Portfolio</h2>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-all">
            <X className="w-5 h-5 text-[#515154] dark:text-[#98989d]" />
          </button>
        </div>

        <div className="p-5">
          {step === "upload" && (
            <div className="space-y-4">
              {/* Format selector */}
              <div>
                <label className="text-sm font-medium text-[#1d1d1f] dark:text-white">Import Format</label>
                <p className="text-xs text-[#86868b] mt-0.5">Auto-detected when you upload a file</p>
                <div className="grid grid-cols-3 gap-2 mt-2">
                  {([
                    { id: "generic", label: "CSV/Excel" },
                    { id: "zerodha", label: "Zerodha" },
                    { id: "groww", label: "Groww" },
                  ] as const).map(f => (
                    <button
                      key={f.id}
                      onClick={() => setFormat(f.id)}
                      className={`py-2.5 px-3 rounded-xl text-sm font-medium transition-all ${
                        format === f.id
                          ? "bg-[#1d1d1f] text-white"
                          : "bg-[#f5f5f7] text-[#1d1d1f]"
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Drop zone */}
              <label className="flex flex-col items-center justify-center h-40 border-2 border-dashed border-black/[0.08] rounded-2xl cursor-pointer hover:border-[#1d1d1f]/30 transition-all">
                <Upload className="w-8 h-8 text-[#86868b] mb-2" />
                <p className="text-sm font-medium text-[#1d1d1f]">Drop file or tap to upload</p>
                <p className="text-xs text-[#86868b] mt-1">.csv, .xlsx supported</p>
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

              {format === "groww" && (
                <p className="text-xs text-[#86868b]">
                  Export from Groww → Stocks → Holdings → Download Statement (.xlsx)
                </p>
              )}
              {format === "zerodha" && (
                <p className="text-xs text-[#86868b]">
                  Export from Zerodha Console → Holdings → Download (.xlsx)
                </p>
              )}
            </div>
          )}

          {step === "preview" && (
            <div className="space-y-4">
              <p className="text-sm text-[#86868b]">
                Found <span className="font-medium text-[#1d1d1f]">{rows.length}</span> assets to import
              </p>
              <div className="max-h-60 overflow-y-auto space-y-2">
                {rows.map((row, i) => (
                  <div key={i} className="flex items-center justify-between p-3 bg-[#f5f5f7] rounded-xl">
                    <div>
                      <p className="text-sm font-medium text-[#1d1d1f]">{row.name}</p>
                      <p className="text-xs text-[#86868b]">{row.asset_class} {row.units ? `· ${row.units} units` : ""}</p>
                    </div>
                    <p className="text-sm font-semibold text-[#1d1d1f]">₹{row.current_value.toLocaleString("en-IN")}</p>
                  </div>
                ))}
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => { setStep("upload"); setRows([]) }}
                  className="flex-1 py-3 rounded-xl bg-[#f5f5f7] text-[#1d1d1f] font-medium hover:bg-[#e8e8ed] transition-all"
                >
                  Back
                </button>
                <button
                  onClick={handleImport}
                  disabled={importing}
                  className="flex-1 py-3 rounded-xl bg-[#1d1d1f] text-white font-medium hover:opacity-90 transition-all disabled:opacity-50"
                >
                  {importing ? "Importing..." : `Import ${rows.length} Assets`}
                </button>
              </div>
            </div>
          )}

          {step === "done" && (
            <div className="text-center py-8">
              <CheckCircle className="w-16 h-16 text-[#1d1d1f] mx-auto mb-3" />
              <p className="text-lg font-bold text-[#1d1d1f]">Import Complete!</p>
              <p className="text-sm text-[#86868b] mt-1">{rows.length} assets added successfully</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
