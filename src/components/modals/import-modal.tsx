"use client"

import { useState, useCallback } from "react"
import { useUser } from "@clerk/nextjs"
import { createClient } from "@/utils/supabase/client"
import { X, Upload, FileSpreadsheet, CheckCircle } from "lucide-react"
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
  const [format, setFormat] = useState<"generic" | "zerodha" | "groww">("generic")

  const handleFile = useCallback((file: File) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const data = new Uint8Array(e.target?.result as ArrayBuffer)
      const workbook = XLSX.read(data, { type: "array" })
      const sheet = workbook.Sheets[workbook.SheetNames[0]]

      let parsed: ParsedRow[] = []

      if (format === "zerodha") {
        // Zerodha holdings XLSX has metadata rows at top — find the header row
        const allRows = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1 })
        const headerIdx = allRows.findIndex((row) =>
          row.some((cell) => typeof cell === "string" && (cell === "Stock Name" || cell === "Instrument"))
        )
        const json = headerIdx >= 0
          ? XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { range: headerIdx })
          : XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet)

        parsed = json.map((row) => ({
          name: String(row["Stock Name"] || row["Instrument"] || row["Symbol"] || row["Trading Symbol"] || ""),
          asset_class: "stocks",
          current_value: Number(row["Closing value"] || row["Cur. val"] || row["Current Value"] || 0),
          invested_value: Number(row["Buy value"] || 0) || (Number(row["Average buy price"] || row["Avg. cost"] || row["Buy Average"] || 0) * Number(row["Quantity"] || row["Qty."] || 1)),
          units: Number(row["Quantity"] || row["Qty."] || 0),
        }))
      } else if (format === "groww") {
        const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet)
        parsed = json.map((row) => ({
          name: String(row["Stock Name"] || row["Scheme Name"] || row["Name"] || ""),
          asset_class: row["Scheme Name"] ? "mutual_funds" : "stocks",
          current_value: Number(row["Current Value"] || row["Market Value"] || 0),
          invested_value: Number(row["Invested Value"] || row["Investment"] || row["Buy Value"] || 0),
          units: Number(row["Quantity"] || row["Units"] || 0),
        }))
      } else {
        // Generic CSV: expects name, asset_class, current_value, invested_value, units
        const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet)
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
  }, [format])

  function guessAssetClass(input: string): string {
    const lower = input.toLowerCase()
    const match = ASSET_CLASSES.find(cls => 
      cls.label.toLowerCase().includes(lower) || cls.id === lower
    )
    return match?.id || "stocks"
  }

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
                <label className="text-sm font-medium text-[#1d1d1f]">Import Format</label>
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

              {format === "zerodha" && (
                <p className="text-xs text-[#86868b]">
                  Export from Zerodha Console → Portfolio → Holdings → Download
                </p>
              )}
              {format === "groww" && (
                <p className="text-xs text-[#86868b]">
                  Export from Groww → Investments → Download Statement
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
