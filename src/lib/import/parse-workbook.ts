import * as XLSX from "xlsx"

// Reads EVERY sheet of a CSV/XLSX workbook (the old importer only read the
// first sheet, missing MF data on secondary tabs). For each sheet it finds
// the real header row - many broker/MF statements have metadata rows before
// the table - and returns a normalized object table per sheet.

export type RawTable = {
  sheet: string
  headers: string[]
  rows: Record<string, unknown>[]
}

const HEADER_HINTS = [
  "name", "stock", "scheme", "instrument", "security", "company", "scrip",
  "symbol", "isin", "qty", "quantity", "units", "unit",
  "price", "nav", "ltp", "rate", "value", "amount", "cost", "invested",
  "avg", "average", "market", "current", "closing", "folio",
]

function cellToString(cell: unknown): string {
  if (cell == null) return ""
  return String(cell).trim()
}

function isHeaderHint(text: string): boolean {
  const lower = text.toLowerCase()
  return HEADER_HINTS.some((h) => lower.includes(h))
}

// Picks the row index that most looks like the column header: prefers a row
// with several textual cells that match known field hints, else the first row
// with at least two non-empty text cells.
function findHeaderRowIndex(aoa: unknown[][]): number {
  let bestIndex = 0
  let bestScore = -1
  const scanLimit = Math.min(aoa.length, 20)

  for (let r = 0; r < scanLimit; r++) {
    const row = aoa[r] ?? []
    const textCells = row.map(cellToString).filter((c) => c.length > 0)
    if (textCells.length < 2) continue

    const hintMatches = textCells.filter(isHeaderHint).length
    // Reward hint matches heavily; lightly reward having more labelled columns.
    const score = hintMatches * 10 + textCells.length
    if (score > bestScore) {
      bestScore = score
      bestIndex = r
    }
    // A strong header (>=2 hint matches) is good enough - stop early.
    if (hintMatches >= 2) break
  }
  return bestIndex
}

function buildHeaders(headerRow: unknown[]): string[] {
  const seen = new Map<string, number>()
  return headerRow.map((cell, i) => {
    let name = cellToString(cell)
    if (!name) name = `column_${i + 1}`
    const count = seen.get(name) ?? 0
    seen.set(name, count + 1)
    return count === 0 ? name : `${name} (${count + 1})`
  })
}

function sheetToTable(name: string, sheet: XLSX.WorkSheet): RawTable | null {
  const aoa = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    blankrows: false,
    defval: "",
  })
  if (aoa.length < 2) return null

  const headerIndex = findHeaderRowIndex(aoa)
  const headers = buildHeaders(aoa[headerIndex] ?? [])
  if (headers.length < 2) return null

  const rows: Record<string, unknown>[] = []
  for (let r = headerIndex + 1; r < aoa.length; r++) {
    const rowArr = aoa[r] ?? []
    // Skip fully-empty rows.
    if (!rowArr.some((c) => cellToString(c).length > 0)) continue
    const obj: Record<string, unknown> = {}
    headers.forEach((h, i) => {
      obj[h] = rowArr[i] ?? ""
    })
    rows.push(obj)
  }

  if (rows.length === 0) return null
  return { sheet: name, headers, rows }
}

export function readWorkbookTables(data: ArrayBuffer): RawTable[] {
  const workbook = XLSX.read(new Uint8Array(data), { type: "array" })
  const tables: RawTable[] = []
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName]
    if (!sheet) continue
    const table = sheetToTable(sheetName, sheet)
    if (table) tables.push(table)
  }
  return tables
}

// A table "looks like holdings" if its headers include both a name-like and a
// value/quantity-like column. Used to auto-pick the right sheet.
export function looksLikeHoldings(table: RawTable): boolean {
  const lower = table.headers.map((h) => h.toLowerCase())
  const hasName = lower.some((h) =>
    /name|stock|scheme|instrument|security|company|scrip|symbol/.test(h)
  )
  const hasValue = lower.some((h) =>
    /qty|quantity|units|value|amount|nav|price|ltp|cost|invested/.test(h)
  )
  return hasName && hasValue
}

// Chooses the holdings tables from a workbook (so a file with separate stocks
// and mutual-fund sheets imports both). Falls back to the largest table.
export function pickHoldingTables(tables: RawTable[]): RawTable[] {
  const holdings = tables.filter(looksLikeHoldings)
  if (holdings.length > 0) return holdings
  if (tables.length === 0) return []
  return [tables.reduce((a, b) => (b.rows.length > a.rows.length ? b : a), tables[0])]
}
